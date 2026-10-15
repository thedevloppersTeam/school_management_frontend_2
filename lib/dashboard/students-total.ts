/**
 * Total d'élèves inscrits, tel qu'affiché par le tableau de bord.
 *
 * Fonctions PURES, sans React ni fetch.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 * Un comptage qui échoue n'est pas un zéro. Dès qu'un comptage de salle manque,
 * le total n'est pas connu : il vaut `null`, et l'écran affiche
 * « indisponible ». On n'affiche ni le sous-total des salles lues, ni
 * « au moins N » : un chiffre partiel présenté comme un total est faux.
 *
 * Aucune salle, en revanche, donne 0 : c'est un total légitime, qui dit qu'il
 * n'y a encore personne à inscrire.
 */

/**
 * Somme des comptages par salle. `null` désigne un comptage qui a échoué.
 * Liste vide → 0 ; au moins un `null` → `null`.
 */
export function sumEnrollmentCounts(counts: readonly (number | null)[]): number | null {
  let total = 0
  for (const count of counts) {
    if (count === null) return null
    total += count
  }
  return total
}

/**
 * Valeur rendue par un comptage, ou `null` si elle n'est pas un effectif.
 * `fetchEnrollmentCount` renvoie `.length` de la réponse : une réponse qui
 * n'est pas une liste donne `undefined`, qui ferait de la somme un `NaN`.
 */
export function toEnrollmentCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}
