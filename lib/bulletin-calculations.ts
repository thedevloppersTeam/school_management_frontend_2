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
  // Poids R1/R2/R3 = 70/25/5. On RENORMALISE sur les rubriques réellement
  // présentes : sinon une rubrique vide (fréquent sur un bulletin d'examen
  // officiel où les matières de filière ne couvrent pas les 3 rubriques)
  // annulait toute la moyenne. Si les 3 sont présentes, le total des poids
  // vaut 1 → résultat identique à avant.
  const parts = [
    { moy: moyR1, weight: 0.7 },
    { moy: moyR2, weight: 0.25 },
    { moy: moyR3, weight: 0.05 },
  ].filter((p): p is { moy: number; weight: number } => p.moy !== null)

  if (parts.length === 0) return null

  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0)
  const weighted = parts.reduce((sum, p) => sum + p.moy * p.weight, 0)
  return weighted / totalWeight
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
