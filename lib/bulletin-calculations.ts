import type { RubriqueEntry } from "@/components/BulletinScolaire"

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

export function calculateRubriqueTotals(entries: RubriqueEntry[]): RubriqueTotals {
  let note = 0
  let coeff = 0

  for (const entry of entries) {
    if (entry.isParent) continue
    if (entry.note === null || entry.note === undefined) continue
    if (entry.coeff === null || entry.coeff === undefined || entry.coeff <= 0) continue

    note += entry.note
    coeff += entry.coeff
  }

  return coeff > 0 ? { note, coeff } : { note: null, coeff: null }
}

export function calculateRubriqueAverage(entries: RubriqueEntry[]): number | null {
  const totals = calculateRubriqueTotals(entries)
  if (totals.note === null || totals.coeff === null) return null
  return (totals.note / totals.coeff) * 10
}

export function calculateStepAverage(
  moyR1: number | null,
  moyR2: number | null,
  moyR3: number | null,
): number | null {
  if (moyR1 === null || moyR2 === null || moyR3 === null) return null
  return moyR1 * 0.7 + moyR2 * 0.25 + moyR3 * 0.05
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

export function calculateBulletinAverages(params: {
  rubrique1: RubriqueEntry[]
  rubrique2: RubriqueEntry[]
  rubrique3: RubriqueEntry[]
}): BulletinAverages {
  const moyR1 = calculateRubriqueAverage(params.rubrique1)
  const moyR2 = calculateRubriqueAverage(params.rubrique2)
  const moyR3 = calculateRubriqueAverage(params.rubrique3)
  const moyenneEtape = calculateStepAverage(moyR1, moyR2, moyR3)

  return {
    moyR1,
    moyR2,
    moyR3,
    moyenneEtape,
    appreciation: getBulletinAppreciation(moyenneEtape),
  }
}

function averageNullable(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => value !== null && value !== undefined)
  if (valid.length === 0) return null
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

export function calculateClassAverages(averages: BulletinAverages[]): BulletinClassAverages {
  return {
    moyClasseR1: averageNullable(averages.map((avg) => avg.moyR1)),
    moyClasseR2: averageNullable(averages.map((avg) => avg.moyR2)),
    moyClasseR3: averageNullable(averages.map((avg) => avg.moyR3)),
    moyenneClasseEtape: averageNullable(averages.map((avg) => avg.moyenneEtape)),
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
