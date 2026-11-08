/**
 * Choix de couleur d'une ligne de légende : un jeton, ou « Sans couleur ».
 *
 * Fonctions PURES, sans React ni fetch.
 *
 * Décision D-44 sur C-28 (forme (a)) : une ligne peut n'avoir AUCUN jeton. Ce
 * n'est pas un quatrième nom de jeton : « Sans couleur » est une option de
 * l'interface, représentée ici par une sentinelle qui n'est JAMAIS envoyée au
 * serveur. Elle ne peut pas collider avec un nom de la charte (minuscules et
 * trait d'union seulement).
 *
 * Trois états, à ne pas confondre :
 *  - `null`        : rien n'est encore choisi (création : aucune option cochée
 *                    par défaut, « Sans couleur » comprise) ;
 *  - `SANS_COULEUR`: l'administrateur a choisi de ne mettre aucun jeton ;
 *  - une chaîne    : un nom de jeton.
 */
export const SANS_COULEUR = '__sans-couleur__' as const

export type ChoixCouleur = string | null

/** Choix initial d'un formulaire de modification, d'après le jeton enregistré. */
export function choixDepuisJeton(jeton: string | null | undefined): ChoixCouleur {
  return jeton === null || jeton === undefined ? SANS_COULEUR : jeton
}

/**
 * Valeur de `colorToken` correspondant au choix : le jeton, `null` pour « Sans
 * couleur », `undefined` si rien n'est choisi (formulaire incomplet).
 */
export function jetonDepuisChoix(choix: ChoixCouleur): string | null | undefined {
  if (choix === null) return undefined
  if (choix === SANS_COULEUR) return null
  return choix
}
