/**
 * proxy.ts — Frontière réseau Next.js 16
 *
 * Rôle : optimistic check de session avant rendu des routes protégées.
 * Lit uniquement la PRÉSENCE du cookie `connect.sid` posé par express-session
 * côté backend (validation réelle = backend Express, pas ici).
 *
 * Suivant les best practices Next.js 16 :
 * - PAS de check BDD (proxy s'exécute sur chaque requête)
 * - PAS de logique métier
 * - Le backend reste l'autorité finale (defense in depth)
 *
 * Routes protégées :
 *   - /admin/*       → pages admin (redirect HTML vers /login si pas de cookie)
 *   - /api/*         → routes proxy (401 JSON si pas de cookie)
 *
 * Exceptions (toujours accessibles sans cookie) :
 *   - /login
 *   - /api/auth/login
 *   - /api/auth/logout
 *   - /api/auth/me   (le backend retourne 401 lui-même si session invalide)
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/proxy
 */
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "connect.sid";

/**
 * Routes API publiques (auth flow) — accessibles sans session.
 * Toute autre route /api/* exige le cookie.
 */
const PUBLIC_API_ROUTES = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
];

/**
 * Validation anti open-redirect.
 * N'autorise que les chemins relatifs commençant par / et pas par //
 * (// ouvrirait une redirection vers un domaine externe).
 */
function isSafeRedirectPath(path: string | null): boolean {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.startsWith("/\\")) return false;
  return true;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  const hasSession = Boolean(sessionCookie?.value);

  // ── Cas 1 : route API ────────────────────────────────────────────────
  if (pathname.startsWith("/api/")) {
    // Routes auth publiques → toujours laisser passer
    if (
      PUBLIC_API_ROUTES.some(
        (route) => pathname === route || pathname.startsWith(route + "/"),
      )
    ) {
      return NextResponse.next();
    }

    // Toute autre route /api/* exige une session
    if (!hasSession) {
      return NextResponse.json({ message: "Non authentifié" }, { status: 401 });
    }

    return NextResponse.next();
  }

  // ── Cas 2 : page /login ──────────────────────────────────────────────
  // User déjà authentifié sur /login → redirect vers dashboard (UX)
  if (pathname === "/login") {
    if (hasSession) {
      const from = request.nextUrl.searchParams.get("from");
      const destination = isSafeRedirectPath(from) ? from! : "/admin/dashboard";
      return NextResponse.redirect(new URL(destination, request.url));
    }
    return NextResponse.next();
  }

  // ── Cas 3 : routes admin protégées ───────────────────────────────────
  if (pathname.startsWith("/admin")) {
    if (!hasSession) {
      // Préserve la destination dans ?from=... pour redirect post-login
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname + search);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // ── Cas 4 : autres routes (pages publiques) ──────────────────────────
  return NextResponse.next();
}

/**
 * Matcher : routes sur lesquelles `proxy` s'exécute.
 *
 * On exclut :
 *  - _next/static, _next/image (assets Next)
 *  - favicon.ico
 *  - extensions de fichiers statiques (svg, png, jpg, etc.)
 *
 * On garde tout le reste pour gérer login, /admin/*, /api/*.
 */
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, robots.txt, sitemap.xml
     * - file extensions (svg, png, jpg, jpeg, gif, webp, ico, css, js, woff, woff2)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)",
  ],
};
