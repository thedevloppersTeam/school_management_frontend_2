/**
 * Découpage en pages — fonction pure, sans React.
 *
 * Le calcul était recopié à la main partout où il servait (par exemple
 * `app/admin/settings/page.tsx:1038-1041`) : quatre lignes d'arithmétique
 * d'indices, avec un `Math.min` de bornage qu'il fallait penser à écrire. Le
 * sortir ici le rend testable, et fige les cas limites plutôt que de les
 * laisser se redécouvrir à chaque écran.
 *
 * ── LA PAGE EST BORNÉE ICI, PAS DANS L'ÉTAT ────────────────────────────────
 * `page` est ramenée dans [1, pageCount] au calcul. L'appelant peut donc
 * garder un état libre — passer de 40 années à 3 après un filtre ne laisse pas
 * une page 3 vide à l'écran, et aucun `useEffect` de correction n'est requis.
 * C'est la convention qu'attend déjà `components/ui/table-pagination.tsx`,
 * dont la documentation dit : « La page courante est passée déjà bornée par
 * l'appelant ».
 */

export interface PageDecoupee<T> {
  /** Les éléments de la page courante. */
  items: T[]
  /** Page réellement affichée, après bornage. Toujours >= 1. */
  page: number
  /** Nombre total de pages. Vaut 1 même sur un tableau vide. */
  pageCount: number
  /** Index 0-based du premier élément — ce que `table-pagination` attend. */
  rangeStart: number
  /** Index 1-based du dernier élément affiché. 0 si la page est vide. */
  rangeEnd: number
  /** Taille du tableau AVANT découpage. */
  total: number
}

export function paginate<T>(
  items: ReadonlyArray<T>,
  page: number,
  perPage: number,
): PageDecoupee<T> {
  if (!Number.isInteger(perPage) || perPage < 1) {
    throw new Error("paginate: perPage doit etre un entier >= 1")
  }

  const total = items.length
  // `pageCount` vaut 1 sur un tableau vide : « page 1 sur 0 » ne veut rien
  // dire, et `table-pagination` masque de toute facon les controles a 1.
  const pageCount = Math.max(1, Math.ceil(total / perPage))

  // Bornage : une page hors plage — 0, -3, 99, NaN — retombe dans l'intervalle
  // au lieu de rendre une tranche vide.
  const demandee = Number.isFinite(page) ? Math.trunc(page) : 1
  const pageBornee = Math.min(Math.max(demandee, 1), pageCount)

  const rangeStart = (pageBornee - 1) * perPage
  const tranche = items.slice(rangeStart, rangeStart + perPage)

  return {
    items: tranche,
    page: pageBornee,
    pageCount,
    rangeStart,
    rangeEnd: rangeStart + tranche.length,
    total,
  }
}
