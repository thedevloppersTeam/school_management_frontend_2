/**
 * Menu d'administration — lien actif pour une adresse.
 *
 * Fonction PURE, sans React. Un seul lien est actif : le PLUS LONG lien égal à
 * l'adresse, ou dont l'adresse est un prolongement après « / ». Ainsi
 * /admin/settings/releve active « Relevé de notes » et non « Établissement »
 * (/admin/settings), et /admin/settings-x n'active pas /admin/settings.
 *
 * Les paramètres de requête d'un lien (« ?… ») sont ignorés pour la
 * comparaison ; un lien vide ou « # » (année active pas encore chargée) n'est
 * jamais actif. Rend le lien tel qu'il a été fourni, ou null.
 */
export function activeHref(pathname: string, hrefs: readonly string[]): string | null {
  let best: string | null = null
  let bestLength = -1
  for (const href of hrefs) {
    const path = href.split('?')[0]
    if (!path || path === '#') continue
    const matches = pathname === path || pathname.startsWith(`${path}/`)
    if (matches && path.length > bestLength) {
      best = href
      bestLength = path.length
    }
  }
  return best
}
