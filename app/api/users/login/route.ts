import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import {
  buildRateLimitHeaders,
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
} from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const limitCheck = checkRateLimit(ip, RATE_LIMITS.login);

  if (!limitCheck.allowed) {
    const minutes = Math.ceil(limitCheck.retryAfterSec / 60);
    return NextResponse.json(
      {
        message: `Trop de tentatives de connexion. Reessayez dans ${minutes} minute(s).`,
      },
      {
        status: 429,
        headers: buildRateLimitHeaders(limitCheck, RATE_LIMITS.login),
      },
    );
  }

  return backendFetch(request, "/api/users/login", "POST", {
    forwardSetCookie: true,
  });
}
