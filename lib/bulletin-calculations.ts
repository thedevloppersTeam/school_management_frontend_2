import Decimal from "decimal.js"
import type { RubriqueEntry } from "@/components/BulletinScolaire"
import {
  computeRubrique,
  computeStep,
  computeStepAverage,
  stepAverageOrNull,
  computeClassAverage,
  type RubriqueCode,
  type RubriqueResult,
  type SubjectInput,
} from "@/lib/bulletin/compute"

export type RubriqueTotals = {
  note: number | null
  coeff: number | null
}

export type BulletinAverages = {
  moyR1: number | null
  moyR2: number | null
  moyR3: number | null
  moyenneEtape: number | null
  appreciation: string
  /**
   * Les MEMES valeurs, jamais passees par un flottant.
   *
   * Les champs `number` ci-dessus restent : ils alimentent la teinte
   * (`colorClass`), qui compare des nombres. Le TEXTE imprime, lui, se formate
   * a partir d'ici. Un double ne represente pas exactement un demi-centieme :
   * 6,425 exact devient 6,4249999999999998224, et `toFixed(2)` imprime alors
   * « 6,42 » au lieu de « 6,43 ».
   */
  exact: {
    moyR1: Decimal | null
    moyR2: Decimal | null
    moyR3: Decimal | null
    moyenneEtape: Decimal | null
  }
}

export type BulletinClassAverages = {
  moyClasseR1: number | null
  moyClasseR2: number | null
  moyClasseR3: number | null
  moyenneClasseEtape: number | null
  /** Idem : le texte imprime se formate d'ici, la teinte lit les `number`. */
  exact: {
    moyClasseR1: Decimal | null
    moyClasseR2: Decimal | null
    moyClasseR3: Decimal | null
    moyenneClasseEtape: Decimal | null
  }
}

/**
 * Σnotes et Σbarèmes d'une rubrique, tels qu'IMPRIMÉS sur la ligne de total du
 * bulletin (`bulletin-printable.tsx`, ligne de total de chaque rubrique).
 *
 * Règle MOA du 2026-09-09 : une note MANQUANTE compte 0 au numérateur et
 * CONSERVE son barème au dénominateur. Le filtre `note === null` qui excluait
 * l'entrée des deux sommes a donc sauté — c'est lui qui faisait imprimer
 * 20 / 50 là où la moyenne valait 20/80.
 *
 * Une dispense n'apparaît pas ici : elle n'a pas de ligne du tout, elle est
 * retirée en amont par `buildSubjectEntries`.
 *
 * Signature inchangée : cette fonction est appelée par un gabarit.
 */
export function calculateRubriqueTotals(entries: RubriqueEntry[]): RubriqueTotals {
  let note = 0
  let coeff = 0

  for (const entry of entries) {
    // En-tête de matière du gabarit MENFP : ni note, ni barème.
    if (entry.isParent) continue
    // Barème nul ou négatif : erreur de paramétrage, pas une note manquante.
    if (entry.coeff === null || entry.coeff === undefined || entry.coeff <= 0) continue

    coeff += entry.coeff
    // Note manquante : le barème est déjà compté, le numérateur reçoit 0.
    if (entry.note === null || entry.note === undefined) continue
    note += entry.note
  }

  return coeff > 0 ? { note, coeff } : { note: null, coeff: null }
}

/**
 * Moyenne d'une rubrique, déléguée au module de calcul.
 *
 * Part des SubjectInput et NON des RubriqueEntry : une note manquante doit
 * garder son barème au dénominateur, information que RubriqueEntry ne porte
 * pas (son `coeff` vaut `undefined` dès que la note manque).
 */
export function calculateRubriqueAverage(
  code: RubriqueCode,
  subjects: SubjectInput[],
): number | null {
  const result = computeRubrique(code, subjects)
  return result.average === null ? null : result.average.toNumber()
}

/** Enveloppe minimale : computeStepAverage ne lit que `code` et `average`. */
function asRubriqueResult(code: RubriqueCode, moy: number | null): RubriqueResult {
  return {
    code,
    numerator: new Decimal(0),
    denominator: new Decimal(0),
    average: moy === null ? null : new Decimal(moy),
    subjects: [],
    warnings: [],
  }
}

export function calculateStepAverage(
  moyR1: number | null,
  moyR2: number | null,
  moyR3: number | null,
): number | null {
  // AUCUNE RENORMALISATION. Une rubrique sans moyenne compte ZÉRO.
  //
  // L'ancienne version renormalisait les poids sur les rubriques présentes.
  // Elle le justifiait par un cas « fréquent sur un bulletin d'examen officiel
  // où les matières de filière ne couvrent pas les 3 rubriques ». CE CAS
  // N'EXISTE PAS : sur le dump de production, les quatre filières de NS4
  // (LLA, SES, SMP, SVT) ont TOUTES des matières dans R1 (3), R2 (5) et R3 (2).
  //
  // La renormalisation traitait donc un symptôme dont la cause était ailleurs :
  // une rubrique paramétrée mais NON NOTÉE, qui doit compter zéro selon la
  // règle arbitrée par la MOA. Elle faisait lire 7,63 à un élève dont la règle
  // donne 5,34 — au-dessus du seuil de 7,00 imprimé en pied de page.
  //
  // Ce commentaire a survécu six mois à un calcul faux : ne pas le réécrire
  // sans rouvrir l'arbitrage.
  if (moyR1 === null && moyR2 === null && moyR3 === null) return null

  return computeStepAverage(
    asRubriqueResult('R1', moyR1),
    asRubriqueResult('R2', moyR2),
    asRubriqueResult('R3', moyR3),
  ).toNumber()
}

export function getBulletinAppreciation(average: number | null): string {
  if (average === null) return "—"
  if (average >= 9.0) return "A+"
  if (average >= 8.5) return "A"
  if (average >= 7.8) return "B+"
  if (average >= 7.5) return "B"
  if (average >= 6.9) return "C+"
  if (average >= 6.0) return "C"
  if (average >= 5.1) return "D"
  return "E"
}

/**
 * Moyennes du bulletin, à partir des SubjectInput — plus des RubriqueEntry.
 * Les RubriqueEntry restent produits pour le gabarit ; ils ne servent plus au
 * calcul.
 */
export function calculateBulletinAverages(subjects: SubjectInput[]): BulletinAverages {
  const step = computeStep(subjects)

  const moyR1 = step.r1.average === null ? null : step.r1.average.toNumber()
  const moyR2 = step.r2.average === null ? null : step.r2.average.toNumber()
  const moyR3 = step.r3.average === null ? null : step.r3.average.toNumber()

  // Rien d'exploitable dans les trois rubriques : pas de moyenne, un trait.
  // Distinct d'une moyenne de 0, qui est un vrai résultat. La règle vit
  // maintenant dans `stepAverageOrNull`, avec le calcul.
  const etapeExacte = stepAverageOrNull(step)
  const moyenneEtape = etapeExacte === null ? null : etapeExacte.toNumber()

  return {
    moyR1,
    moyR2,
    moyR3,
    moyenneEtape,
    exact: {
      moyR1: step.r1.average,
      moyR2: step.r2.average,
      moyR3: step.r3.average,
      moyenneEtape: etapeExacte,
    },
    // L'appréciation lettrée continue de lire le `number`. Elle compare à des
    // seuils (9,00 · 8,50 · 7,80 …) et n'est PAS dans le périmètre de cet
    // alignement : la déplacer ferait bouger une mention, pas un affichage.
    appreciation: getBulletinAppreciation(moyenneEtape),
  }
}

/**
 * Moyenne de classe sur une colonne. Délègue à computeClassAverage : un élève
 * sans moyenne sur la rubrique (dénominateur nul, donc entièrement dispensé)
 * est EXCLU du calcul ; un élève dont des notes manquent a une moyenne réelle,
 * éventuellement 0, et reste compté. Sur 30 élèves dont 3 dispensés, la
 * moyenne porte sur 27.
 */
function classAverageOf(values: Array<Decimal | null>): Decimal | null {
  return computeClassAverage(values.map((average) => ({ average })))
}

export function calculateClassAverages(averages: BulletinAverages[]): BulletinClassAverages {
  // Les valeurs entrent en Decimal. Elles faisaient auparavant un aller-retour
  // `Decimal -> number -> Decimal` avant d'etre moyennees, puis un dernier
  // `toNumber()` en sortie : trois conversions pour une moyenne.
  const r1 = classAverageOf(averages.map((avg) => avg.exact.moyR1))
  const r2 = classAverageOf(averages.map((avg) => avg.exact.moyR2))
  const r3 = classAverageOf(averages.map((avg) => avg.exact.moyR3))
  const etape = classAverageOf(averages.map((avg) => avg.exact.moyenneEtape))
  const n = (d: Decimal | null) => (d === null ? null : d.toNumber())

  return {
    moyClasseR1: n(r1),
    moyClasseR2: n(r2),
    moyClasseR3: n(r3),
    moyenneClasseEtape: n(etape),
    exact: {
      moyClasseR1: r1,
      moyClasseR2: r2,
      moyClasseR3: r3,
      moyenneClasseEtape: etape,
    },
  }
}

export function formatBulletinNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : value.toFixed(2)
}

export function normalizeRubriqueLabel(index: 1 | 2 | 3): string {
  return `Rubrique ${index}`
}

export function normalizeBulletinLevel(className: string): string {
  return className
    .replace(/\s*[-–—/]\s*[A-Z]$/i, "")
    .replace(/\s+\([A-Z]\)$/i, "")
    .replace(/\s+[A-Z]$/i, "")
    .trim()
}
