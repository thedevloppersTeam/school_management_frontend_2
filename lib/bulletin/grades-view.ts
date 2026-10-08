/**
 * Moyennes de l'ecran Consultation des notes.
 *
 * Fonctions pures, sans React ni DOM, comme compute.ts dont elles reprennent
 * les regles. Tout reste en Decimal jusqu'au formatage : l'ecran affiche le
 * meme chiffre que le bulletin, arrondi compris (6,925 -> « 6.93 », la ou
 * `toNumber().toFixed(2)` donnait « 6.92 »).
 */

import Decimal from 'decimal.js'
import { computeClassAverage, formatAverage, DISPLAY_SCALE, type SubjectOutput } from './compute'

/** Formatage d'une moyenne sur 10 : le meme que celui du bulletin. */
export function afficherMoyenne(value: Decimal | null): string {
  return formatAverage(value)
}

/**
 * Pourcentage a passer a `gradeBand` / `gradeMention` (lib/bulletin/grade-color),
 * calcule depuis la moyenne EXACTE sur 10.
 *
 * Les bornes de la legende sont des entiers (<= 50, < 60, < 69 …). Un entier
 * est transmis tel quel ; une valeur strictement entre deux entiers k et k+1
 * est transmise comme k + 0,5, exactement representable. Chaque comparaison
 * de la legende donne donc le meme resultat que sur la valeur exacte, la ou
 * `toNumber()` arrondissait 6,8999… a 6,9 et changeait la mention.
 */
export function bandePourcent(moyenneSur10: Decimal | null): number | null {
  if (moyenneSur10 === null) return null
  const p = moyenneSur10.times(DISPLAY_SCALE)
  if (p.isInteger()) return p.toNumber()
  return p.floor().toNumber() + 0.5
}

/**
 * Moyenne de classe d'une colonne, dans le bareme NOMINAL de la colonne (celui
 * des cellules).
 *
 * Regle 3, via computeClassAverage : chaque eleve compte par sa moyenne de la
 * matiere sur 10 (SubjectOutput.average). Un eleve dispense (average null) est
 * exclu, une note manquante compte 0. Un eleve dont la matiere est hors de la
 * portee affichee est passe en `undefined` et ignore.
 */
export function moyenneColonne(
  sorties: Array<SubjectOutput | undefined>,
  baremeNominal: Decimal,
): Decimal | null {
  const entries = sorties
    .filter((s): s is SubjectOutput => s !== undefined)
    .map((s) => ({ average: s.average }))
  const surDix = computeClassAverage(entries)
  return surDix === null ? null : surDix.dividedBy(DISPLAY_SCALE).times(baremeNominal)
}

/** Moyenne de classe de l'etape : eleves sans moyenne (null) exclus. */
export function moyenneClasse(moyennes: Array<Decimal | null>): Decimal | null {
  return computeClassAverage(moyennes.map((average) => ({ average })))
}
