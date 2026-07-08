import { NextRequest, NextResponse } from "next/server";
import { env } from "./env";
import { logger } from "./logger";

/**
 * Timeout max pour les requêtes backend.
 * Au-delà, on renvoie 504 pour éviter de bloquer les workers Next.js.
 */
const BACKEND_TIMEOUT_MS = 15_000;

/**
 * Options pour étendre le comportement de backendFetch.
 */
export interface BackendFetchOptions {
  /**
   * Si true, le header `set-cookie` du backend est forwardé au navigateur.
   * Indispensable pour les routes d'auth comme login/logout.
   * Par défaut : false.
   */
  forwardSetCookie?: boolean;
}

function shouldForwardBody(method: string): boolean {
  const upperMethod = method.toUpperCase();
  return upperMethod !== "GET" && upperMethod !== "HEAD";
}

function isJsonContentType(contentType: string | null): boolean {
  return Boolean(contentType?.toLowerCase().includes("application/json"));
}

function getSafeJsonBodyKeys(body: ArrayBuffer, contentType: string | null): string[] | undefined {
  if (!isJsonContentType(contentType) || body.byteLength === 0 || body.byteLength > 64_000) {
    return undefined;
  }

  try {
    const text = new TextDecoder().decode(body);
    const parsed = JSON.parse(text);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.keys(parsed);
    }

    if (Array.isArray(parsed)) {
      return ["<array>"];
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function appendBackendSetCookie(response: NextResponse, backendHeaders: Headers): void {
  const headersWithGetSetCookie = backendHeaders as Headers & {
    getSetCookie?: () => string[];
  };

  const setCookies = headersWithGetSetCookie.getSetCookie?.();

  if (setCookies && setCookies.length > 0) {
    for (const cookie of setCookies) {
      response.headers.append("set-cookie", cookie);
    }
    return;
  }

  const setCookie = backendHeaders.get("set-cookie");
  if (setCookie) {
    response.headers.append("set-cookie", setCookie);
  }
}

export async function backendFetch(
  request: NextRequest,
  path: string,
  method: string,
  options: BackendFetchOptions = {},
): Promise<NextResponse> {
  const targetUrl = new URL(path, env.BACKEND_URL);

  // Forward query parameters from the incoming request.
  request.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  const headers: Record<string, string> = {
    accept: "application/json",
  };

  const cookie = request.headers.get("cookie");
  if (cookie) {
    headers.cookie = cookie;
  }

  let body: ArrayBuffer | undefined;

  if (shouldForwardBody(method)) {
    body = await request.arrayBuffer();

    const incomingContentType = request.headers.get("content-type");
    if (incomingContentType) {
      headers["content-type"] = incomingContentType;
    } else if (body.byteLength > 0) {
      headers["content-type"] = "application/json";
    }

    if (env.NODE_ENV === "development") {
      logger.debug(
        {
          event: "backend_fetch_request",
          method,
          path,
          contentType: incomingContentType ?? null,
          bodyBytes: body.byteLength,
          bodyKeys: getSafeJsonBodyKeys(body, incomingContentType),
        },
        "backendFetch outgoing",
      );
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

  try {
    const backendRes = await fetch(targetUrl.toString(), {
      method,
      headers,
      body,
      redirect: "manual",
      signal: controller.signal,
    });

    const raw = await backendRes.text();
    let data: unknown = null;

    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }
    }

    // Protection contre le backend stale : certains backends Express renvoient
    // 200 + "Ok" sur une route non montée. Sans ce contrôle, le frontend peut
    // croire qu'une opération a réussi alors que l'endpoint n'existe pas.
    if (backendRes.ok && data === null && raw.trim() === "Ok") {
      logger.error(
        {
          event: "backend_fetch_stale_backend",
          method,
          path,
          status: backendRes.status,
        },
        "Backend stale route fallback detected",
      );

      return NextResponse.json(
        {
          message:
            "Backend stale: the requested route is not mounted on the API server. Rebuild and restart the backend.",
        },
        { status: 502 },
      );
    }

    if (env.NODE_ENV === "development" && !backendRes.ok) {
      logger.debug(
        {
          event: "backend_fetch_response_error",
          method,
          path,
          status: backendRes.status,
        },
        "backendFetch non-OK response",
      );
    }

    const response = NextResponse.json(data, { status: backendRes.status });

    if (options.forwardSetCookie) {
      appendBackendSetCookie(response, backendRes.headers);
    }

    return response;
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };

    if (err.name === "AbortError") {
      logger.error(
        {
          event: "backend_fetch_timeout",
          method,
          path,
          timeoutMs: BACKEND_TIMEOUT_MS,
        },
        "Backend timeout",
      );

      return NextResponse.json({ message: "Backend timeout" }, { status: 504 });
    }

    logger.error(
      {
        event: "backend_fetch_error",
        method,
        path,
        errorName: err.name,
        errorMessage: err.message,
      },
      "Backend unreachable",
    );

    return NextResponse.json(
      { message: "Backend unreachable" },
      { status: 503 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}