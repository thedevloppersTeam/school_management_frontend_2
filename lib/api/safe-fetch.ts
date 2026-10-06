/**
 * lib/api/safe-fetch.ts
 *
 * Lecture best-effort : une ressource absente ou en erreur rend la valeur de
 * repli au lieu de faire echouer l'appelant. Reserve aux donnees ACCESSOIRES
 * — un comportement, une photo, une liste de dispenses vide — jamais aux notes
 * elles-memes, dont l'absence doit rester une erreur visible.
 *
 * Extrait de lib/api/bulletin.ts, ou il etait prive : le module de dispenses
 * en a besoin, et le dupliquer aurait cree deux comportements a tenir
 * synchronises pour huit lignes.
 */
export async function safeFetch<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) return fallback
    return res.json()
  } catch {
    return fallback
  }
}
