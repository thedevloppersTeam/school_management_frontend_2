/**
 * POST /api/auth/login
 * Proxy → POST https://apicpmsl.stelloud.cloud/api/users/login
 *
 * Authentifie un utilisateur et propage le cookie de session.
 * Body : { username: string, password: string }
 * Public : pas d'auth requise (mais rate limité).
 *
 * Note : utilise forwardSetCookie pour propager connect.sid du backend
 * vers le browser (sinon la session ne serait pas créée côté client).
 *
 * SEC-A07-001 : rate limit anti brute-force (5 essais / 15 min / IP)
 */
import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import {
  checkRateLimit,
  getClientIp,
  buildRateLimitHeaders,
  RATE_LIMITS,
} from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // ─── Rate limit anti brute-force (SEC-A07-001) ───────────────────
  // Limite : 5 tentatives / 15 min / IP. Au-delà → 429 + Retry-After.
  // Note : reset au redémarrage du serveur (acceptable, voir lib/rate-limit.ts).
  const ip = getClientIp(request.headers);
  const limitCheck = checkRateLimit(ip, RATE_LIMITS.login);

  if (!limitCheck.allowed) {
    // Log structuré (anti-brute force tracking)
    // Sera amélioré avec Pino quand on traitera SEC-A09-001.
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "rate_limit_exceeded",
        route: "/api/auth/login",
        ip,
        retryAfterSec: limitCheck.retryAfterSec,
        timestamp: new Date().toISOString(),
      }),
    );

    const minutes = Math.ceil(limitCheck.retryAfterSec / 60);
    return NextResponse.json(
      {
        message: `Trop de tentatives de connexion. Réessayez dans ${minutes} minute(s).`,
      },
      {
        status: 429,
        headers: buildRateLimitHeaders(limitCheck, RATE_LIMITS.login),
      },
    );
  }

  // ─── Forward au backend (logique inchangée) ─────────────────────
  return backendFetch(request, "/api/users/login", "POST", {
    forwardSetCookie: true,
  });
}
