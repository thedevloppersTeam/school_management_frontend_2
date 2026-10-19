/**
 * Départs en cours d'année — règles d'écran PURES (SPEC-RESULTATS v0.3 RS-08).
 * Ni fetch, ni React. Le serveur reste juge (statut ACTIVE, étape de l'année,
 * date dans l'année) ; ces fonctions ne font que préparer la saisie.
 */

export type DepartureReason = 'TRANSFER_OTHER_SCHOOL' | 'DROPOUT' | 'OTHER'

export const DEPARTURE_REASONS: { value: DepartureReason; label: string }[] = [
  { value: 'TRANSFER_OTHER_SCHOOL', label: 'Transfert vers un autre établissement' },
  { value: 'DROPOUT', label: 'Abandon' },
  { value: 'OTHER', label: 'Autre' },
]

export const departureReasonLabel = (r: string | null | undefined): string =>
  DEPARTURE_REASONS.find((x) => x.value === r)?.label ?? '—'

export interface StepForDeparture {
  id: string
  name: string
  stepNumber: number
  startDate?: string | null
}

/** « AAAA-MM-JJ » d'une date d'API (date seule ou ISO complète), ou null. */
export const dayOf = (v: string | null | undefined): string | null =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null

/** Étapes dans l'ordre des dates de début (RS-09) ; sans date : après, par numéro. */
export function orderSteps<T extends StepForDeparture>(steps: T[]): T[] {
  return [...steps].sort((a, b) => {
    const da = dayOf(a.startDate), db = dayOf(b.startDate)
    if (da !== db) {
      if (da === null) return 1
      if (db === null) return -1
      return da < db ? -1 : 1
    }
    return a.stepNumber - b.stepNumber
  })
}

/**
 * Dernière étape suivie PRÉREMPLIE d'après la date de départ : la dernière
 * étape commencée à cette date (début ≤ date). Un départ pendant une étape la
 * compte comme suivie ; un départ entre deux étapes retient la précédente.
 * Date antérieure à toute étape, ou invalide : null (à choisir à la main).
 * La valeur reste modifiable à l'écran.
 */
export function inferLastAttendedStep(steps: StepForDeparture[], leftAt: string): string | null {
  const day = dayOf(leftAt)
  if (!day) return null
  let found: string | null = null
  for (const s of orderSteps(steps)) {
    const start = dayOf(s.startDate)
    if (start !== null && start <= day) found = s.id
  }
  return found
}

/** Date comprise dans l'année scolaire, bornes incluses (même contrôle que le serveur). */
export function isWithinYear(leftAt: string, year: { startDate?: string | null; endDate?: string | null }): boolean {
  const day = dayOf(leftAt), start = dayOf(year.startDate), end = dayOf(year.endDate)
  if (!day || !start || !end) return false
  return day >= start && day <= end
}
