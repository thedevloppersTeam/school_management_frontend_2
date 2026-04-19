/**
 * lib/client-fetch.ts
 *
 * Wrapper fetch côté client avec :
 *  - Credentials include par défaut (cookies)
 *  - Redirect auto sur 401 (FF7)
 *  - Gestion d'erreur uniforme
 *
 * À utiliser dans tous les Client Components qui appellent /api/*.
 */

export async function clientFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    ...options,
  })

  // Session expirée ou invalide → redirect vers login
  if (res.status === 401 && typeof window !== 'undefined') {
    window.location.href = '/login'
    throw new Error('Unauthorized — redirecting to login')
  }

  if (!res.ok) {
    throw new Error(`API error ${res.status}`)
  }

  return res.json()
}