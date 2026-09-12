import Decimal from "decimal.js"
import type { RubriqueEntry } from "@/components/BulletinScolaire"
import {
  computeRubrique,
  computeStep,
  computeStepAverage,
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
}

export type BulletinClassAverages = {
  moyClasseR1: number | null
  moyClasseR2: number | null
  moyClasseR3: number | null
  moyenneClasseEtape: number | null
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
  // Distinct d'une moyenne de 0, qui est un vrai résultat.
  const moyenneEtape =
    moyR1 === null && moyR2 === null && moyR3 === null
      ? null
      : step.average.toNumber()

  return {
    moyR1,
    moyR2,
    moyR3,
    moyenneEtape,
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
function classAverageOf(values: Array<number | null | undefined>): number | null {
  const entries = values.map((value) => ({
    average: value === null || value === undefined ? null : new Decimal(value),
  }))
  const result = computeClassAverage(entries)
  return result === null ? null : result.toNumber()
}

export function calculateClassAverages(averages: BulletinAverages[]): BulletinClassAverages {
  return {
    moyClasseR1: classAverageOf(averages.map((avg) => avg.moyR1)),
    moyClasseR2: classAverageOf(averages.map((avg) => avg.moyR2)),
    moyClasseR3: classAverageOf(averages.map((avg) => avg.moyR3)),
    moyenneClasseEtape: classAverageOf(averages.map((avg) => avg.moyenneEtape)),
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
