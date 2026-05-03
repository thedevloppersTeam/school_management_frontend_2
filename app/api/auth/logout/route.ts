/**
 * /api/auth/logout — POST (recommandé) + GET (secondaire avec protection CSRF)
 *
 * SEC-A01-004 : protection CSRF en double couche
 *
 *   1. POST : méthode standard pour les opérations de mutation. Naturellement
 *             protégée contre CSRF basique (un <img> malveillant ne peut pas
 *             faire de POST cross-origin). Utilisée par le frontend via
 *             logout() de lib/data/auth-data.tsx.
 *
 *   2. GET  : conservé pour compatibilité (ex: <a href="/api/auth/logout"> dans
 *             un email reset password). Protégé par validation d'Origin/Referer
 *             pour bloquer les attaques CSRF naïves type <img src=...> sur un
 *             site malveillant.
 *
 * Bonus : les DEUX méthodes effacent le cookie connect.sid côté frontend
 * (defense in depth). Même si le backend a un bug et ne renvoie pas le bon
 * Set-Cookie, le frontend force l'effacement → pas de "session fantôme".
 */
import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import { env } from "@/lib/env";

const SESSION_COOKIE = "connect.sid";
const COOKIE_CLEAR_OPTIONS = {
  path: "/",
  maxAge: 0,
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

/**
 * Validation Origin/Referer — anti-CSRF pour le GET.
 *
 * Un attaquant qui met <img src="https://cpmsl.app/api/auth/logout"> sur son
 * site malveillant déclenchera une requête où :
 *   - Origin = "https://evil.com" (différent de notre host)
 *   - Referer = "https://evil.com/page" (différent de notre host)
 *
 * On rejette donc tout GET dont l'Origin OU le Referer ne matche pas notre host.
 *
 * Cas particuliers :
 *   - GET direct via barre URL navigateur : pas d'Origin, pas de Referer → on
 *     ACCEPTE (l'utilisateur a tapé l'URL délibérément, c'est légitime).
 *   - GET depuis un autre onglet de notre site : Origin = notre host → OK.
 *   - GET via <img> cross-site : Origin = site malveillant → REJET.
 */
function isLegitimateRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");

  if (!host) return false;

  // Construire les hosts attendus (https en prod, http accepté en dev local)
  const expectedHosts = [`https://${host}`, `http://${host}`];

  // Si Origin présent → DOIT matcher notre host
  if (origin) {
    return expectedHosts.includes(origin);
  }

  // Si Referer présent → DOIT commencer par notre host
  if (referer) {
    return expectedHosts.some((h) => referer.startsWith(h));
  }

  // Ni Origin ni Referer → légitime
  // (cas user qui tape l'URL directement, ou navigateur en mode privacy strict)
  return true;
}

/**
 * Construit la réponse de redirection vers /login avec cookie effacé.
 */
function makeLogoutRedirect(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set(SESSION_COOKIE, "", COOKIE_CLEAR_OPTIONS);
  return response;
}

/**
 * POST /api/auth/logout — méthode RECOMMANDÉE
 *
 * Forward au backend qui détruit la session, puis efface le cookie côté frontend
 * (defense in depth si le backend ne renvoie pas Set-Cookie correctement).
 */
export async function POST(request: NextRequest) {
  // 1. Forward au backend (détruit la session côté DB)
  const backendResponse = await backendFetch(
    request,
    "/api/users/logout",
    "POST",
    { forwardSetCookie: true },
  );

  // 2. Defense in depth : on efface aussi le cookie côté frontend.
  // Couvre le cas où le backend a un bug et ne renvoie pas Set-Cookie correct.
  backendResponse.cookies.set(SESSION_COOKIE, "", COOKIE_CLEAR_OPTIONS);

  return backendResponse;
}

/**
 * GET /api/auth/logout — méthode SECONDAIRE (compatibilité)
 *
 * Conservée pour les usages type <a href="/api/auth/logout"> dans les emails
 * ou les bookmarks. Protégée contre CSRF par validation Origin/Referer.
 *
 * Si la requête vient d'un site malveillant (Origin/Referer différent), on
 * répond 403 SANS détruire la session.
 *
 * Si la requête est légitime, on tente d'invalider la session backend (best
 * effort) et on efface le cookie côté frontend dans tous les cas.
 */
export async function GET(request: NextRequest) {
  // ── Anti-CSRF : valider l'origine de la requête ──
  if (!isLegitimateRequest(request)) {
    return NextResponse.json(
      {
        error: "Forbidden",
        message: "Cross-origin GET to logout is not allowed. Use POST.",
      },
      { status: 403 },
    );
  }

  // ── Tentative best-effort d'invalider la session backend ──
  const cookie = request.headers.get("cookie") ?? "";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5_000);

    await fetch(`${env.BACKEND_URL}/api/users/logout`, {
      method: "POST",
      headers: { cookie },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));
  } catch {
    // Best-effort : on ignore les erreurs (timeout, réseau, backend down, etc.)
  }

  // ── Toujours effacer le cookie + rediriger, même si backend KO ──
  return makeLogoutRedirect(request);
}
