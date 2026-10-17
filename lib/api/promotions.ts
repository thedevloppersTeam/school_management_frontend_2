/**
 * Promotion de fin d'année — client de l'API § 5 (SPEC-PROMOTION v0.3).
 *
 * Écrit pour ce contrat, pas repris de la branche `Transfer` (dont l'API
 * `promote` / `copy-configuration` n'existe pas ici). Le navigateur ne
 * calcule RIEN : la moyenne, l'issue proposée, l'état bloqué, le niveau cible
 * et la filière sont décidés et contrôlés par le serveur. Ce module ne fait
 * que transporter.
 */
import { clientFetch as apiFetch, ApiError } from '@/lib/client-fetch'

export type Outcome = 'ADMIS' | 'REDOUBLE' | 'ADMIS_SOUS_CONDITION' | 'ADMIS_AILLEURS'
export const OUTCOMES: Outcome[] = ['ADMIS', 'REDOUBLE', 'ADMIS_SOUS_CONDITION', 'ADMIS_AILLEURS']
export const OUTCOME_LABEL: Record<Outcome, string> = {
  ADMIS: 'Admis',
  REDOUBLE: 'Redouble',
  ADMIS_SOUS_CONDITION: 'Admis sous condition',
  ADMIS_AILLEURS: 'Admis ailleurs',
}

export type DecisionState = 'pending' | 'executed' | 'cancelled'

export interface PromotionDecision {
  id: string
  annualAverage: string | null
  threshold: string
  proposedOutcome: Outcome | null
  finalOutcome: Outcome
  overrideReason: string | null
  conditionText: string | null
  unblockReason: string | null
  nextEnrollmentId: string | null
  decidedAt: string
  executedAt: string | null
  cancelledAt: string | null
  state: DecisionState
}

export interface MissingEntry {
  stepName: string
  subjectName: string
  sectionName: string | null
}

export interface PreviewStudent {
  enrollmentId: string
  studentId: string
  firstname: string
  lastname: string
  trackId: string | null
  /** Valeur imprimée, 2 décimales, calculée par le serveur (RP-18). */
  annualAverage: string | null
  proposedOutcome: Outcome | null
  state: 'ready' | 'blocked'
  blockReason: string | null
  missing: MissingEntry[]
  decision: PromotionDecision | null
}

export interface PromotionPreview {
  classSessionId: string
  className: string
  academicYearId: string
  threshold: string
  unmappedSubjects: { classSubjectId: string; name: string; reason: string }[]
  students: PreviewStudent[]
}

export interface DecisionInput {
  enrollmentId: string
  finalOutcome: Outcome
  overrideReason?: string
  conditionText?: string
  unblockReason?: string
}

export type SaveDecisionsResult =
  | { ok: true; decisions: PromotionDecision[] }
  | { ok: false; message: string; errors: { enrollmentId: string; message: string }[] }

export interface ExecuteItem {
  decisionId: string
  targetClassSessionId?: string
  trackId?: string
}

export interface ExecuteResult {
  executed: { decisionId: string; kind: 'enroll' | 'graduate' | 'elsewhere'; nextEnrollmentId: string | null }[]
  excluded: { decisionId: string; message: string }[]
}

const json = (body: unknown): RequestInit => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export function fetchPromotionPreview(classSessionId: string): Promise<PromotionPreview> {
  return apiFetch<PromotionPreview>(`/api/promotions/preview?classSessionId=${encodeURIComponent(classSessionId)}`)
}

/** 422 = lot refusé en entier ; les erreurs par élève sont rendues, pas jetées. */
export async function savePromotionDecisions(
  classSessionId: string,
  decisions: DecisionInput[],
): Promise<SaveDecisionsResult> {
  try {
    const res = await apiFetch<{ decisions: PromotionDecision[] }>('/api/promotions/decisions', {
      method: 'PUT',
      ...json({ classSessionId, decisions }),
    })
    return { ok: true, decisions: res.decisions }
  } catch (err) {
    if (err instanceof ApiError && err.status === 422) {
      const body = err.body as { errors?: { enrollmentId: string; message: string }[] } | null
      return { ok: false, message: err.message, errors: body?.errors ?? [] }
    }
    throw err
  }
}

export function executePromotions(items: ExecuteItem[]): Promise<ExecuteResult> {
  return apiFetch<ExecuteResult>('/api/promotions/execute', { method: 'POST', ...json({ items }) })
}

export function cancelPromotion(decisionId: string, reason?: string): Promise<{ decisionId: string; state: 'cancelled' }> {
  return apiFetch(`/api/promotions/${encodeURIComponent(decisionId)}/cancel`, {
    method: 'POST',
    ...json(reason ? { reason } : {}),
  })
}
