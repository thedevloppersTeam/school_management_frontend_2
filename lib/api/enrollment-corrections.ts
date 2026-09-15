/**
 * lib/api/enrollment-corrections.ts
 *
 * Correction d'affectation + journal d'audit élève.
 *
 * Corriger une affectation, c'est réparer une erreur de saisie à l'inscription :
 * l'élève n'a jamais appartenu à la salle ou à la filière enregistrée. C'est un
 * geste distinct du transfert (l'élève y était, il n'y est plus), qui passe par
 * `/api/enrollments/transfer`.
 *
 * L'id de l'inscription ne change jamais. Deux modes, déterminés par la
 * filière :
 *   MODE A — même filière : les notes suivent dans la salle cible.
 *   MODE B — filière différente : toutes les notes de l'année sont effacées.
 *            Le journal en conserve la copie intégrale.
 *
 * Toutes les règles sont rejouées par le backend au moment de l'action : le
 * preview sert à informer l'utilisateur, il ne fait pas autorité.
 */

import { clientFetch as apiFetch } from '@/lib/client-fetch'

// ── Types ────────────────────────────────────────────────────────────────────

export type CorrectionMode = 'A' | 'B'

/** Affectation, côté source comme côté cible. */
export interface CorrectionAssignment {
  classSessionId: string
  className:      string
  trackId:        string | null
  trackName:      string | null
}

/**
 * Écart bloquant. `rule` renvoie à la règle de la spec :
 *   R1 année ou niveau différent · R2 cible identique à la source ·
 *   R3 inscription déjà existante sur la salle cible ·
 *   R4 filière absente de la salle cible ·
 *   R5 matière notée sans équivalent (MODE A) ·
 *   R6 barème ou coefficient divergent (MODE A).
 */
export interface CorrectionBlocker {
  rule:         string
  subjectName?: string
  detail:       string
}

/**
 * Avertissement non bloquant.
 *   BULLETIN_NOT_REPRODUCIBLE — un bulletin déjà remis ne sera plus
 *     régénérable automatiquement ; le journal garde les notes.
 *   CLOSED_STEP_AFFECTED — au moins une étape concernée est clôturée.
 */
export interface CorrectionWarning {
  code:   string
  detail: string
}

export interface CorrectionImpact {
  gradesMoved:             number
  gradesDeleted:           number
  exclusionsMoved:         number
  exclusionsDeleted:       number
  stepExemptionsPreserved: number
  behaviorsPreserved:      number
  stepsAffected:           string[]
}

/** Une note qui sera détruite. Affichée nominativement avant confirmation. */
export interface GradeToDelete {
  subjectName:  string
  stepName:     string
  studentScore: string
  maxScore:     string | null
}

export interface CorrectionMappingEntry {
  subjectName:        string
  fromClassSubjectId: string
  toClassSubjectId:   string
}

export interface CorrectionPreview {
  enrollment: {
    id:          string
    studentId:   string
    studentName: string
    current:     CorrectionAssignment
  }
  target:         CorrectionAssignment
  mode:           CorrectionMode
  canCorrect:     boolean
  blockers:       CorrectionBlocker[]
  warnings:       CorrectionWarning[]
  impact:         CorrectionImpact
  gradesToDelete: GradeToDelete[]
  mapping:        CorrectionMappingEntry[]
}

export interface CorrectAssignmentPayload {
  targetClassSessionId: string
  targetTrackId:        string | null
  reason:               string
  /** Obligatoire en MODE B : sans lui le backend refuse en 400. */
  acknowledgeDataLoss?: boolean
}

export interface CorrectAssignmentResult {
  message:    string
  mode:       CorrectionMode
  auditLogId: string
  applied: {
    gradesMoved:       number
    gradesDeleted:     number
    exclusionsMoved:   number
    exclusionsDeleted: number
  }
  warnings: CorrectionWarning[]
}

// ── Journal d'audit ──────────────────────────────────────────────────────────

export type StudentAuditAction =
  | 'ENROLLMENT_CREATED'
  | 'ASSIGNMENT_CORRECTED'
  | 'ENROLLMENT_TRANSFERRED'
  | 'STUDENT_PROMOTED'
  | 'GRADE_CORRECTED_AFTER_CLOSURE'
  | 'BULLETIN_REGENERATED'
  | 'ENROLLMENT_DEACTIVATED'
  | 'ENROLLMENT_REACTIVATED'

/** Libellés d'affichage. Seule ASSIGNMENT_CORRECTED est écrite à ce jour. */
export const AUDIT_ACTION_LABELS: Record<StudentAuditAction, string> = {
  ENROLLMENT_CREATED:            'Inscription créée',
  ASSIGNMENT_CORRECTED:          "Correction d'affectation",
  ENROLLMENT_TRANSFERRED:        'Transfert',
  STUDENT_PROMOTED:              'Passage de classe',
  GRADE_CORRECTED_AFTER_CLOSURE: 'Note corrigée après clôture',
  BULLETIN_REGENERATED:          'Bulletin régénéré',
  ENROLLMENT_DEACTIVATED:        'Inscription désactivée',
  ENROLLMENT_REACTIVATED:        'Inscription réactivée',
}

/**
 * Contenu de `details` pour ASSIGNMENT_CORRECTED. Les autres gestes écriront
 * leur propre forme : tout est optionnel côté lecture.
 */
export interface AssignmentCorrectedDetails {
  mode?:            CorrectionMode
  from?:            Partial<CorrectionAssignment>
  to?:              Partial<CorrectionAssignment>
  gradesMoved?:     number
  gradesDeleted?:   GradeToDelete[]
  exclusionsMoved?: number
  bulletinsNoLongerReproducible?: Array<{ stepName: string; version: number }>
}

export interface StudentAuditLogRow {
  id:             string
  studentId:      string
  enrollmentId:   string | null
  academicYearId: string | null
  action:         StudentAuditAction
  actorUserId:    string | null
  reason:         string | null
  details:        AssignmentCorrectedDetails | null
  createdAt:      string
  student: {
    id:          string
    studentCode: string
    user:        { firstname: string; lastname: string }
  }
  actor:        { id: string; username: string } | null
  academicYear: { id: string; yearString: string } | null
}

export interface StudentAuditLogPage {
  page:       number
  pageSize:   number
  total:      number
  totalPages: number
  logs:       StudentAuditLogRow[]
}

export interface StudentAuditLogQuery {
  studentId?:      string
  academicYearId?: string
  action?:         StudentAuditAction
  from?:           string
  to?:             string
  page?:           number
  pageSize?:       number
}

// ── Appels ───────────────────────────────────────────────────────────────────

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

/**
 * Impact d'une correction, avant toute écriture. À rappeler à chaque
 * changement de salle ou de filière cible.
 */
export function fetchCorrectionPreview(
  enrollmentId: string,
  targetClassSessionId: string,
  targetTrackId: string | null,
): Promise<CorrectionPreview> {
  const qs = buildQuery({ targetClassSessionId, targetTrackId })
  return apiFetch<CorrectionPreview>(
    `/api/enrollments/${enrollmentId}/correction-preview${qs}`,
  )
}

/**
 * Applique la correction. Le backend refuse en 400 si le motif est vide, ou si
 * `acknowledgeDataLoss` manque en MODE B ; en 409 si un blocage subsiste.
 */
export function correctAssignment(
  enrollmentId: string,
  payload: CorrectAssignmentPayload,
): Promise<CorrectAssignmentResult> {
  return apiFetch<CorrectAssignmentResult>(
    `/api/enrollments/${enrollmentId}/correct-assignment`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
}

/** Journal d'audit, plus récent en premier. Lecture seule. */
export function fetchStudentAuditLogs(
  query: StudentAuditLogQuery = {},
): Promise<StudentAuditLogPage> {
  return apiFetch<StudentAuditLogPage>(
    `/api/student-audit-logs${buildQuery({ ...query })}`,
  )
}
