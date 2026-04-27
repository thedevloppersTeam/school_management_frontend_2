/**
 * /api/auth/logout — 2 méthodes supportées
 *
 * - POST : déconnexion API standard (utilisée par les Client Components).
 *          Forward set-cookie pour effacer connect.sid côté browser.
 *
 * - GET  : déconnexion via lien direct (ex: <a href="/api/auth/logout">).
 *          Tente d'invalider la session backend, puis redirige vers /login.
 *          Tolérant aux pannes : si le backend échoue, le cookie local
 *          est quand même effacé.
 */
import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import { env } from "@/lib/env";

export async function POST(request: NextRequest) {
  return backendFetch(request, "/api/users/logout", "POST", {
    forwardSetCookie: true,
  });
}

export async function GET(request: NextRequest) {
  const cookie = request.headers.get("cookie") ?? "";

  // Tentative best-effort d'invalider la session côté backend.
  // Si le backend est inaccessible, on continue quand même —
  // le cookie local sera effacé pour garantir la déconnexion locale.
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5_000);

    await fetch(`${env.BACKEND_URL}/api/users/logout`, {
      method: "POST",
      headers: { cookie },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));
  } catch {
    // Best-effort : on ignore les erreurs (timeout, réseau, etc.)
    // L'utilisateur sera déconnecté localement de toute façon.
  }

  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set("connect.sid", "", { maxAge: 0, path: "/" });
  return response;
}
