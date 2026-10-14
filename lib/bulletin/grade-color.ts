/**
 * Barème de mention MENFP et bandes de couleur — source unique côté écran.
 *
 * Le barème était implémenté trois fois, de trois manières, sans qu'aucune ne
 * cite l'autre : `colorClass` dans `bulletin-printable.tsx` (couleurs, seuils
 * 50/60/69 sur un pourcentage), `getBulletinAppreciation` dans
 * `lib/bulletin-calculations.ts` (lettres, seuils 5,1/6,0/6,9… sur /10), et une
 * troisième dans l'écran de relevé (seuils 50/70 sur /100). Résultat reproduit :
 * entre 60,00 et 69,00, la même note s'affichait orange à l'écran et verte sur
 * la feuille remise à la famille.
 *
 * **Une seule table de bornes.** La bande et la mention sortent de la même
 * entrée de `GRADE_SCALE` : elles ne peuvent pas diverger. Une première version
 * de ce module dérivait la bande de ses propres seuils et la mention de
 * `getBulletinAppreciation` ; sur l'intervalle ouvert ]50 ; 51[ — atteignable,
 * 20,25/40 = 50,625 % — l'écran affichait une teinte orange et une mention « E »
 * côte à côte. C'est précisément ce que cette table rend impossible.
 *
 * **Résolution du trou de la légende.** La légende imprimée dit « ≤ 50 : E » et
 * « 51 – 59 : D » : elle ne dit rien de ]50 ; 51[. `colorClass` y répond orange,
 * `getBulletinAppreciation` y répond « E ». On suit `colorClass` et la lettre du
 * texte de la légende : au-dessus de 50, ce n'est plus un échec. C'est le seul
 * point où ce module s'écarte de `getBulletinAppreciation`, et
 * `grade-color.test.ts` vérifie qu'ils coïncident partout ailleurs.
 *
 * Les bandes sont identiques à `colorClass` (`bulletin-printable.tsx:25-35`),
 * qui reste la référence et n'est pas modifié : il travaille sur
 * `note / coeff × 100`, ce module sur le même pourcentage. Tant que les deux
 * coexistent, le test est le seul garde-fou contre une redivergence.
 */

export type GradeBand = "echec" | "deficient" | "assez-bien" | "neutre"

export interface GradeScaleEntry {
  /** Bande de couleur, au sens du gabarit imprimé. */
  band: GradeBand
  /** Mention MENFP. */
  mention: string
  /** Libellé long, tel qu'imprimé dans la légende. */
  label: string
  /** Plage telle qu'écrite dans la légende du bulletin, en pourcentage. */
  range: string
  /**
   * La même plage sur 10.
   *
   * La légende imprimée est écrite en 0-100 alors que le bulletin affiche ses
   * moyennes sur 10 : sur papier, la feuille se lit d'un coup d'œil et l'écart
   * passe. Un écran se parcourt par fragments — une clé de lecture qui ne parle
   * pas la même échelle que les chiffres affichés ne sert à rien.
   */
  rangeOn10: string
  /** Premier `matches` vrai gagne ; l'ordre est signifiant. */
  matches: (percent: number) => boolean
}

/** Reprise à l'identique de la légende imprimée au pied du bulletin. */
export const GRADE_SCALE: readonly GradeScaleEntry[] = [
  { band: "echec", mention: "E", label: "Échec", range: "≤ 50", rangeOn10: "≤ 5,00", matches: (p) => p <= 50 },
  { band: "deficient", mention: "D", label: "Déficient", range: "51 – 59", rangeOn10: "5,01 – 5,99", matches: (p) => p < 60 },
  { band: "assez-bien", mention: "C", label: "Assez bien", range: "60 – 68", rangeOn10: "6,00 – 6,89", matches: (p) => p < 69 },
  { band: "neutre", mention: "C+", label: "Bien", range: "69 – 74", rangeOn10: "6,90 – 7,49", matches: (p) => p < 75 },
  { band: "neutre", mention: "B", label: "Très bien", range: "75 – 77", rangeOn10: "7,50 – 7,79", matches: (p) => p < 78 },
  { band: "neutre", mention: "B+", label: "Très bien", range: "78 – 84", rangeOn10: "7,80 – 8,49", matches: (p) => p < 85 },
  { band: "neutre", mention: "A", label: "Excellent", range: "85 – 89", rangeOn10: "8,50 – 8,99", matches: (p) => p < 90 },
  { band: "neutre", mention: "A+", label: "Excellent", range: "90 – 100", rangeOn10: "9,00 – 10", matches: () => true },
]

function scaleEntry(percent: number | null | undefined): GradeScaleEntry | null {
  if (percent === null || percent === undefined || !Number.isFinite(percent)) return null
  return GRADE_SCALE.find((e) => e.matches(percent)) ?? null
}

/** Bande de couleur — mêmes bornes que `colorClass` du gabarit imprimé. */
export function gradeBand(percent: number | null | undefined): GradeBand {
  return scaleEntry(percent)?.band ?? "neutre"
}

/** Mention MENFP (A+ … E), dans le vocabulaire de la légende du bulletin. */
export function gradeMention(percent: number | null | undefined): string {
  return scaleEntry(percent)?.mention ?? "—"
}

/** Libellé long de la mention (« Assez bien », « Échec »…). */
export function gradeMentionLabel(mention: string): string {
  return GRADE_SCALE.find((e) => e.mention === mention)?.label ?? "non calculée"
}

/**
 * Teintes d'écran. Mêmes bandes et mêmes familles que le bulletin, mais sur les
 * jetons d'encre du produit.
 *
 * Les hex du gabarit ne peuvent pas être repris tels quels à l'écran :
 * `--orange` (#d9a21b) donne 2,30:1 sur une fiche blanche et `--green`
 * (#318c53) 4,19:1, tous deux sous le plancher de 4,5:1 de WCAG 1.4.3 — c'est
 * le défaut corrigé dans tout le dépôt le 14/09/2026, dont la note et la
 * moyenne affichées faisaient partie. Les encres gardent la famille et la
 * lisibilité : 8,24:1, 5,47:1 et 7,98:1 sur fiche blanche.
 *
 * Le papier n'est pas soumis à la même contrainte : le bulletin garde ses
 * valeurs, et la bande lue reste la même des deux côtés.
 *
 * NOTE OUVERTE — `assez-bien` emprunte `success-ink`, l'encre que DESIGN.md
 * réserve à « saisie validée ». Un jeton propre au barème est décidé mais pas
 * encore posé (point 3 du plan) ; quand il le sera, il se change ici, et ici
 * seulement.
 */
export function gradeBandToneClass(band: GradeBand): string {
  switch (band) {
    case "echec":
      return "text-error-ink"
    case "deficient":
      return "text-warning-ink"
    case "assez-bien":
      return "text-success-ink"
    default:
      return "text-foreground"
  }
}
