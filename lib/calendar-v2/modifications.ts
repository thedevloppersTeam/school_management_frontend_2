/**
 * Champs modifiés d'un formulaire de modification.
 *
 * Fonction PURE, sans React ni fetch. Une modification n'envoie que ce qui a
 * changé : un jeton de couleur qu'on ne touche pas n'est pas renvoyé, même s'il
 * n'est plus sélectionnable (SPEC-CAL-2 C-27), et une modification vide reste
 * impossible (« Enregistrer » désactivé, C-42).
 *
 * Comparaison stricte valeur par valeur (chaînes, nombres, `null`) : aucune
 * normalisation. Le serveur retire les espaces de bord.
 */
export type Valeur = string | number | null

export function champsModifies<T extends { [K in keyof T]: Valeur }>(initial: T, courant: T): Partial<T> {
  const diff: Partial<T> = {}
  for (const cle of Object.keys(courant) as Array<keyof T>) {
    if (!Object.is(initial[cle], courant[cle])) diff[cle] = courant[cle]
  }
  return diff
}

export function aDesModifications<T extends { [K in keyof T]: Valeur }>(initial: T, courant: T): boolean {
  return Object.keys(champsModifies(initial, courant)).length > 0
}
