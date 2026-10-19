/**
 * Élèves partis visibles (D-22) — règles d'écran PURES, sans fetch ni React.
 *
 *  - filtre de liste « Actifs / Partis / Tous » (défaut : Tous) ;
 *  - présence d'une inscription à une étape (saisie des notes, du comportement,
 *    bulletins) : ACTIVE à toute étape ; DROPPED aux étapes ≤ sa dernière étape
 *    suivie, dans l'ordre des dates de début (même règle que le serveur,
 *    src/lib/departures/writeGuard.ts, et que RS-09) ; absente après, ou si le
 *    départ n'est pas complété. TRANSFERRED et GRADUATED : jamais (inchangé).
 *
 * Le serveur reste juge : il refuse la même saisie (400) si l'écran se trompe.
 */
import { formatFrenchLongDate } from '@/lib/date-format'
import { orderSteps, type StepForDeparture } from '@/lib/departures/departures'

export type PresenceFilter = 'ALL' | 'ACTIVE' | 'LEFT'

export const PRESENCE_FILTERS: { value: PresenceFilter; label: string }[] = [
  { value: 'ALL', label: 'Tous' },
  { value: 'ACTIVE', label: 'Actifs' },
  { value: 'LEFT', label: 'Partis' },
]

/** Filtre par défaut des listes d'élèves (D-22). */
export const DEFAULT_PRESENCE_FILTER: PresenceFilter = 'ALL'

/** Un élève « parti » est une inscription DROPPED (D-19, D-21). */
export const isLeft = (status: string | null | undefined): boolean => status === 'DROPPED'

export function matchesPresence(status: string | null | undefined, filter: PresenceFilter): boolean {
  if (filter === 'ACTIVE') return status === 'ACTIVE'
  if (filter === 'LEFT') return isLeft(status)
  return true
}

export interface PresenceEnrollment {
  status: string
  lastAttendedStepId?: string | null
}

/** L'inscription est-elle proposée (saisie, bulletin) à cette étape ? */
export function presentAtStep(e: PresenceEnrollment, stepId: string, steps: StepForDeparture[]): boolean {
  if (e.status === 'ACTIVE') return true
  if (e.status !== 'DROPPED' || !e.lastAttendedStepId || !stepId) return false
  const ordered = orderSteps(steps)
  const last = ordered.findIndex((s) => s.id === e.lastAttendedStepId)
  const here = ordered.findIndex((s) => s.id === stepId)
  return last >= 0 && here >= 0 && here <= last
}

/**
 * Inscription saisissable à au moins une étape : ACTIVE, ou DROPPED au départ
 * complété (dernière étape suivie connue). Un départ à compléter n'est proposé
 * nulle part tant qu'il n'est pas complété (le serveur le refuse aussi).
 */
export function hasEntrySteps(e: PresenceEnrollment): boolean {
  return e.status === 'ACTIVE' || (e.status === 'DROPPED' && !!e.lastAttendedStepId)
}

/** Étapes auxquelles l'inscription est proposée, dans l'ordre reçu. */
export function stepsForEnrollment<T extends StepForDeparture>(e: PresenceEnrollment, steps: T[]): T[] {
  return steps.filter((s) => presentAtStep(e, s.id, steps))
}

/** « Parti le 20 janvier 2026 », ou « Parti » sans date. */
export function leftLabel(leftAt: string | null | undefined): string {
  return leftAt ? `Parti le ${formatFrenchLongDate(leftAt)}` : 'Parti'
}
