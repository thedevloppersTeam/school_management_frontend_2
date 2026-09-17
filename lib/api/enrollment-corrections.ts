/**
 * lib/api/enrollment-corrections.ts
 *
 * Correction d'affectation + journal d'audit élève.
 *
 * Corriger une affectation, c'est réparer une erreur de saisie à l'inscription :
 * l'élève n'a jamais appartenu à la salle ou à la filière enregistrée.
 *
 * C'est le seul geste qui déplace un élève à l'intérieur d'une année. L'ancien
 * transfert interne, `/api/enrollments/transfer`, a été retiré : il passait
 * l'inscription à TRANSFERRED et en créait une seconde, donc un doublon qui
 * pesait deux fois dans les moyennes. L'élève qui quitte réellement
 * l'établissement relève du départ, pas d'un déplacement.
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
 *   R5 matière sans équivalent dans la salle cible (MODE A) — qu'elle porte
 *      des notes, une dispense de section, ou les deux ; `detail` nomme le cas ·
 *   R6 barème ou coefficient divergent (MODE A), sur les matières notées
 *      seulement : une matière seulement dispensée ne porte aucune note ·
 *   R7 capacité de la salle cible dépassée.
 *
 * Deux codes ne visent aucun élève en particulier et n'arrivent que sur un
 * lot : `MIXED_MODE` et `R7`. Ils sont rendus dans `lot.blockers`.
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

// ── Correction en lot ────────────────────────────────────────────────────────

/**
 * Le lot obéit à trois règles que l'écran doit rendre visibles :
 *
 *  - TOUT OU RIEN. Un seul élève bloqué, et rien n'est écrit. Le backend tient
 *    le lot entier dans une seule transaction.
 *  - UN LOT = UN MODE. La filière vit sur l'inscription, pas sur la salle :
 *    une même salle héberge des élèves de filières différentes, donc une
 *    sélection peut mélanger les deux modes. Le lot mixte est refusé — un seul
 *    acquittement ne peut pas couvrir la destruction des notes d'une partie
 *    seulement des élèves.
 *  - R7, CAPACITÉ. Le total après correction doit tenir dans la capacité de la
 *    salle cible. Bloquant, ici comme en unitaire.
 */

/** Plafond appliqué par le backend. Au-delà, il refuse en 400. */
export const BATCH_MAX_ENROLLMENTS = 50

/** Une ligne de l'aperçu, par élève. `mode` est `null` si le plan a échoué. */
export interface BatchPreviewStudent {
  enrollmentId:   string
  studentName:    string | null
  current:        CorrectionAssignment | null
  mode:           CorrectionMode | null
  canCorrect:     boolean
  blockers:       CorrectionBlocker[]
  warnings:       CorrectionWarning[]
  impact:         CorrectionImpact | null
  gradesToDelete: GradeToDelete[]
}

/**
 * Verdict du lot. `blockers` porte les écarts qui ne visent aucun élève en
 * particulier : `MIXED_MODE`, `R7`, et rien d'autre à ce jour.
 */
export interface BatchPreviewLot {
  count:           number
  mode:            CorrectionMode | null
  canCorrect:      boolean
  blockers:        CorrectionBlocker[]
  blockedStudents: number
  modeBreakdown:   { A: number; B: number }
  maxBatchSize:    number
  totals: {
    gradesMoved:       number
    gradesDeleted:     number
    exclusionsMoved:   number
    exclusionsDeleted: number
  }
}

export interface BatchCorrectionPreview {
  lot:      BatchPreviewLot
  target:   CorrectionAssignment | null
  students: BatchPreviewStudent[]
}

export interface BatchCorrectPayload {
  enrollmentIds:        string[]
  targetClassSessionId: string
  targetTrackId:        string | null
  reason:               string
  /** Obligatoire en MODE B : sans lui le backend refuse en 400. */
  acknowledgeDataLoss?: boolean
}

export interface BatchCorrectResult {
  message: string
  mode:    CorrectionMode
  count:   number
  applied: {
    gradesMoved:       number
    gradesDeleted:     number
    exclusionsMoved:   number
    exclusionsDeleted: number
  }
  students: Array<{
    enrollmentId: string
    studentName:  string
    impact:       CorrectionImpact
    warnings:     CorrectionWarning[]
  }>
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

/**
 * Impact d'une correction sur toute une sélection, avant écriture. À rappeler
 * à chaque changement de salle ou de filière cible, comme en unitaire.
 *
 * Un élève dont le plan échoue ne fait pas tomber l'aperçu des autres : il
 * revient avec `canCorrect: false` et un bloqueur `R0`. L'écriture, elle, ne
 * pardonne pas — c'est voulu.
 */
export function fetchBatchCorrectionPreview(
  enrollmentIds: string[],
  targetClassSessionId: string,
  targetTrackId: string | null,
): Promise<BatchCorrectionPreview> {
  return apiFetch<BatchCorrectionPreview>(
    '/api/enrollments/correction-preview-batch',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enrollmentIds, targetClassSessionId, targetTrackId }),
    },
  )
}

/**
 * Applique la correction au lot entier. Tout ou rien.
 *
 * Refus possibles : 400 si le motif est vide, si `acknowledgeDataLoss` manque
 * en MODE B, ou si la sélection dépasse le plafond ; 409 si un élève reste
 * bloqué, si la sélection mélange les deux modes, si la capacité de la salle
 * cible est dépassée, ou si l'état a changé depuis l'aperçu.
 */
export function correctAssignmentBatch(
  payload: BatchCorrectPayload,
): Promise<BatchCorrectResult> {
  return apiFetch<BatchCorrectResult>(
    '/api/enrollments/correct-assignment-batch',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
}
