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
    // B-3 : une requête relayée n'est jamais conditionnelle. Avec no-cache,
    // Express ne la juge jamais « fraîche » et ne répond jamais 304 sans corps,
    // même si un intermédiaire ajoute If-None-Match.
    "cache-control": "no-cache",
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

  // 1. Transmission. Seul un échec ICI veut dire « serveur injoignable » (ou
  //    délai dépassé). Avant B-3, tout incident ultérieur — réponse sans corps,
  //    corps interrompu — tombait dans le même `catch` et s'affichait
  //    « Backend unreachable », alors que le serveur avait répondu.
  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl.toString(), {
      method,
      headers,
      body,
      redirect: "manual",
      signal: controller.signal,
      // Jamais de cache de données Next.js sur un relais d'API.
      cache: "no-store",
    });
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    return transportFailure(error, method, path);
  }

  // 2. Lecture du corps : le serveur a répondu ; une coupure ici n'est pas
  //    une panne de joignabilité, et le statut reçu est dit.
  let raw: string;
  try {
    raw = await backendRes.text();
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === "AbortError") return transportFailure(error, method, path);
    logger.error(
      {
        event: "backend_fetch_body_error",
        method,
        path,
        status: backendRes.status,
        errorName: err.name,
        errorMessage: err.message,
      },
      "Backend response interrupted",
    );
    return NextResponse.json(
      { message: `Réponse du serveur interrompue (statut ${backendRes.status}). Réessayez.` },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeoutId);
  }

  // 3. Réponse sans corps (204, 304…) : relayée telle quelle. NextResponse.json
  //    lève une exception sur ces statuts — c'était l'une des sources du faux
  //    « Backend unreachable » (B-3).
  if (NULL_BODY_STATUSES.has(backendRes.status)) {
    const empty = new NextResponse(null, { status: backendRes.status });
    if (options.forwardSetCookie) appendBackendSetCookie(empty, backendRes.headers);
    return empty;
  }

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
}

/** Schéma de réponse : seul `safeParse` est utilisé (validateurs générés du contrat). */
interface SchemaReponse {
  safeParse(data: unknown):
    | { success: true }
    | { success: false; error: { issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; code: string }> } };
}

/**
 * Relais qui VALIDE la réponse de succès contre le contrat (ADR-007 § 2 :
 * « valide chaque réponse avant usage »), côté serveur de Next.js : aucun
 * octet de zod n'est envoyé au navigateur.
 *
 * - Le transport est celui de backendFetch, inchangé.
 * - Les réponses d'erreur (4xx, 5xx) et sans corps sont relayées telles quelles.
 * - Une réponse 2xx qui ne respecte pas le contrat devient un 502
 *   CONTRAT_REPONSE_INVALIDE : jamais une valeur partielle à l'écran. Le journal
 *   ne garde que les chemins et les codes d'écart de zod, jamais les valeurs
 *   (la réponse peut porter des données d'élèves).
 */
export async function backendFetchValide(
  request: NextRequest,
  path: string,
  method: string,
  schema: SchemaReponse,
): Promise<NextResponse> {
  const response = await backendFetch(request, path, method);
  if (!response.ok || NULL_BODY_STATUSES.has(response.status)) return response;

  let data: unknown;
  try {
    data = await response.clone().json();
  } catch {
    data = undefined;
  }

  const result = schema.safeParse(data);
  if (result.success) return response;

  logger.error(
    {
      event: "backend_contract_violation",
      method,
      path,
      status: response.status,
      issues: result.error.issues.slice(0, 20).map((issue) => ({
        path: issue.path.map(String).join("."),
        code: issue.code,
      })),
    },
    "Backend response does not match the pinned contract",
  );

  return NextResponse.json(
    {
      code: "CONTRAT_REPONSE_INVALIDE",
      message:
        "La réponse du serveur ne correspond pas au contrat attendu : l'application et le serveur ne sont probablement pas à la même version.",
    },
    { status: 502 },
  );
}

/** En-têtes d'une réponse binaire relayés au navigateur (fichier, image). */
const BINARY_FORWARDED_HEADERS = [
  "content-type",
  "content-length",
  "content-disposition",
  "cache-control",
  "x-content-type-options",
  "content-security-policy",
] as const;

/**
 * Relais BINAIRE (GET) : image ou fichier, octets et en-têtes du serveur
 * transmis tels quels. backendFetch relit toute réponse en JSON et ne convient
 * pas (SPEC-MENFP 6.4). Même transport : cookie, délai, échec de transmission.
 *
 * Une réponse d'erreur JSON du serveur (401, 403, 404, 409…) est relayée en
 * JSON avec son statut, comme par backendFetch.
 */
export async function backendFetchBinary(request: NextRequest, path: string): Promise<NextResponse> {
  const targetUrl = new URL(path, env.BACKEND_URL);
  request.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  const headers: Record<string, string> = { accept: "*/*", "cache-control": "no-cache" };
  const cookie = request.headers.get("cookie");
  if (cookie) headers.cookie = cookie;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl.toString(), {
      method: "GET",
      headers,
      redirect: "manual",
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    return transportFailure(error, "GET", path);
  }

  if (NULL_BODY_STATUSES.has(backendRes.status)) {
    clearTimeout(timeoutId);
    return new NextResponse(null, { status: backendRes.status });
  }

  if (!backendRes.ok) {
    let raw = "";
    try {
      raw = await backendRes.text();
    } catch {
      raw = "";
    } finally {
      clearTimeout(timeoutId);
    }
    let data: unknown = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }
    return NextResponse.json(data, { status: backendRes.status });
  }

  // Les en-têtes sont reçus : le délai ne doit pas couper le flux d'octets.
  clearTimeout(timeoutId);
  const forwarded = new Headers();
  for (const name of BINARY_FORWARDED_HEADERS) {
    const value = backendRes.headers.get(name);
    if (value) forwarded.set(name, value);
  }
  return new NextResponse(backendRes.body, { status: backendRes.status, headers: forwarded });
}

/** Statuts HTTP qui ne portent jamais de corps (Fetch : « null body status »). */
const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);

/** Échec de TRANSMISSION : délai dépassé (504) ou serveur injoignable (503). */
function transportFailure(error: unknown, method: string, path: string): NextResponse {
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
    {
      message: "Serveur injoignable : la requête n'a pas pu lui être transmise. Réessayez dans un instant.",
      code: "BACKEND_UNREACHABLE",
    },
    { status: 503 },
  );
}
