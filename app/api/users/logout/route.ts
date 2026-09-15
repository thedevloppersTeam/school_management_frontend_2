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

function isLegitimateRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");

  if (!host) return false;

  const expectedHosts = [`https://${host}`, `http://${host}`];

  if (origin) return expectedHosts.includes(origin);
  if (referer) return expectedHosts.some((h) => referer.startsWith(h));

  return true;
}

function makeLogoutRedirect(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set(SESSION_COOKIE, "", COOKIE_CLEAR_OPTIONS);
  return response;
}

export async function POST(request: NextRequest) {
  const backendResponse = await backendFetch(
    request,
    "/api/users/logout",
    "POST",
    { forwardSetCookie: true },
  );

  backendResponse.cookies.set(SESSION_COOKIE, "", COOKIE_CLEAR_OPTIONS);

  return backendResponse;
}

export async function GET(request: NextRequest) {
  if (!isLegitimateRequest(request)) {
    return NextResponse.json(
      {
        error: "Forbidden",
        message: "Cross-origin GET to logout is not allowed. Use POST.",
      },
      { status: 403 },
    );
  }

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
  }

  return makeLogoutRedirect(request);
}
