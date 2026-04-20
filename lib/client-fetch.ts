/**
 * lib/client-fetch.ts
 *
 * Wrapper fetch côté client (Client Components uniquement).
 *
 * Features :
 *  - credentials: 'include' par défaut (envoie les cookies de session)
 *  - Redirect auto vers /login sur 401 (FF7)
 *  - Extraction du message d'erreur depuis le body (data.message / data.error)
 *  - Type-safe via generics
 *  - Classe d'erreur dédiée avec status + path
 *
 * Usage :
 *   // GET
 *   const rubrics = await clientFetch<Rubric[]>('/api/subject-rubrics/')
 *
 *   // POST
 *   const created = await clientFetch<Rubric>('/api/subject-rubrics/create', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(data)
 *   })
 *
 *   // Gestion d'erreur enrichie
 *   try {
 *     await clientFetch('/api/students/create', { method: 'POST', ... })
 *   } catch (err) {
 *     if (err instanceof ApiError) toast({ description: err.message })
 *   }
 *
 * ⚠️ NE PAS utiliser côté serveur (Server Components, API routes).
 *    Pour le serveur, utiliser backendFetch de lib/backend.ts.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function clientFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    ...options,
  })

  // FF7 — Session expirée : redirect vers /login
  if (res.status === 401 && typeof window !== 'undefined') {
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login'
    }
    throw new ApiError(401, path, 'Unauthorized — redirecting to login')
  }

  // Parse du body (même en cas d'erreur pour extraire data.message)
  const text = await res.text()
  const data = text ? tryParseJson(text) : null

  if (!res.ok) {
    const backendMessage =
      (data && typeof data === 'object' && 'message' in data && typeof (data as any).message === 'string'
        ? (data as any).message
        : null) ??
      (data && typeof data === 'object' && 'error' in data && typeof (data as any).error === 'string'
        ? (data as any).error
        : null)

    throw new ApiError(
      res.status,
      path,
      backendMessage ?? `API error ${res.status}`
    )
  }

  return data as T
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}