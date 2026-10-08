/**
 * lib/api/promotions.ts
 * Opérations de fin d'année : promotion des élèves vers l'année suivante et
 * reprise de la configuration (salles + matières) d'une année précédente.
 *
 * La moyenne générale annuelle est calculée CÔTÉ SERVEUR : classer une
 * promotion entière depuis le navigateur demanderait des centaines de requêtes.
 */

import { clientFetch as apiFetch } from '@/lib/client-fetch'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PromotionStudent {
  enrollmentId: string
  studentId: string
  studentCode: string
  firstname: string
  lastname: string
  track: { id: string; code: string; name: string } | null
  /** Moyenne générale annuelle sur 10, ou null si aucune note. */
  average: number | null
  /** Nombre d'étapes réellement prises en compte. */
  stepsCounted: number
  /** Atteint le seuil. Indicatif : la directrice reste libre de promouvoir. */
  eligible: boolean
}

export interface PromotionPreview {
  classSession: {
    id: string
    className: string
    classTypeId: string
    isTerminal: boolean
    academicYear: string
  }
  threshold: number
  counts: { total: number; eligible: number; notEligible: number }
  students: PromotionStudent[]
}

export interface PromotionItem {
  enrollmentId: string
  targetClassSessionId: string
  trackId?: string | null
}

export interface PromotionResult {
  message: string
  promotedCount: number
  skippedCount: number
  promoted: Array<{ enrollmentId: string; newEnrollmentId: string; studentName: string }>
  skipped: Array<{ enrollmentId: string; studentName: string; reason: string }>
}

export interface ConfigurationPreviewRow {
  classSessionId: string
  classId: string
  className: string
  subjectCount: number
  alreadyExistsInTarget: boolean
  targetSubjectCount: number
}

export interface CopyConfigurationResult {
  message: string
  sessionsCreated: number
  subjectsCopied: number
  subjectsSkipped: number
  details: Array<{
    className: string
    sessionCreated: boolean
    subjectsCopied: number
    subjectsSkipped: number
  }>
}

// ── Fonctions ─────────────────────────────────────────────────────────────────

/** Élèves d'une salle avec leur moyenne annuelle et leur éligibilité au seuil. */
export async function fetchPromotionPreview(
  classSessionId: string,
  threshold: number,
): Promise<PromotionPreview> {
  return apiFetch<PromotionPreview>(
    `/api/promotions/preview?classSessionId=${classSessionId}&threshold=${threshold}`,
  )
}

/** Promeut les élèves sélectionnés vers leurs salles cibles. */
export async function promoteStudents(
  items: PromotionItem[],
  notes?: string,
): Promise<PromotionResult> {
  return apiFetch<PromotionResult>('/api/promotions/promote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, notes }),
  })
}

/** Aperçu : quelles salles seraient créées / existent déjà dans l'année cible. */
export async function fetchConfigurationPreview(
  sourceAcademicYearId: string,
  targetAcademicYearId: string,
): Promise<{ sessions: ConfigurationPreviewRow[] }> {
  return apiFetch<{ sessions: ConfigurationPreviewRow[] }>(
    `/api/promotions/configuration-preview?sourceAcademicYearId=${sourceAcademicYearId}&targetAcademicYearId=${targetAcademicYearId}`,
  )
}

/** Recrée les salles choisies dans l'année cible et y recopie les matières. */
export async function copyYearConfiguration(params: {
  sourceAcademicYearId: string
  targetAcademicYearId: string
  classIds?: string[]
}): Promise<CopyConfigurationResult> {
  return apiFetch<CopyConfigurationResult>('/api/promotions/copy-configuration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
}
