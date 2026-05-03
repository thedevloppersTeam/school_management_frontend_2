import { NextRequest, NextResponse } from "next/server";
import { env } from "./env";
import { logger } from "./logger";

/**
 * Timeout max pour les requêtes backend.
 * Au-delà, on renvoie 504 pour éviter de bloquer les workers Next.js (FF3).
 */
const BACKEND_TIMEOUT_MS = 15_000;

/**
 * Options pour étendre le comportement de backendFetch.
 */
export interface BackendFetchOptions {
  /**
   * Si true, le header `set-cookie` du backend est forwardé au browser.
   * Indispensable pour les routes d'auth (login, logout) qui doivent
   * propager la session connect.sid.
   * Par défaut : false (rétrocompatibilité).
   */
  forwardSetCookie?: boolean;
}

export async function backendFetch(
  request: NextRequest,
  path: string,
  method: string,
  options: BackendFetchOptions = {},
): Promise<NextResponse> {
  const targetUrl = new URL(path, env.BACKEND_URL);

  // Forward query parameters from the incoming request
  request.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  const headers: Record<string, string> = {};
  const cookie = request.headers.get("cookie");
  if (cookie) headers["cookie"] = cookie;

  let body: string | undefined;
  if (method !== "GET" && method !== "HEAD") {
    try {
      const json = await request.json();

      // SEC-A09-002 : ne PLUS logger le body complet (contenait passwords en clair).
      // On log uniquement la méthode + path + clés présentes (pas les valeurs).
      // La redaction du logger gère password/nisu/email même si une clé connue passe,
      // mais on reste conservateur : on ne forward jamais les valeurs ici.
      if (env.NODE_ENV === "development") {
        const bodyKeys = Object.keys(json ?? {});
        logger.debug(
          {
            event: "backend_fetch_request",
            method,
            path,
            bodyKeys, // ← juste les noms des champs, jamais les valeurs
          },
          "backendFetch outgoing",
        );
      }

      body = JSON.stringify(json);
      headers["content-type"] = "application/json";
    } catch {
      // no body
    }
  }

  // FF3 — Timeout pour éviter DoS par requêtes lentes
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

  try {
    const backendRes = await fetch(targetUrl.toString(), {
      method,
      headers,
      body,
      // FF2 — Ne pas suivre les redirections (anti-SSRF via 302 malveillant)
      redirect: "manual",
      signal: controller.signal,
    });

    const data = await backendRes.json().catch(() => null);
    const response = NextResponse.json(data, { status: backendRes.status });

    // Forward set-cookie si demandé (auth routes uniquement)
    if (options.forwardSetCookie) {
      const setCookie = backendRes.headers.get("set-cookie");
      if (setCookie) {
        response.headers.set("set-cookie", setCookie);
      }
    }

    return response;
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };

    // SEC-A09-001 : logs structurés pour ingestion future (Loki/Datadog)
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
