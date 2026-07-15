import { parseDecimal } from '@/lib/decimal'

export interface ApiSubjectSection {
  id: string
  name: string
  code: string
  maxScore: number
  displayOrder: number
}

export interface ApiSubject {
  id: string
  name: string
  code: string
  maxScore: number
  coefficient: number
  hasSections: boolean
  sections: ApiSubjectSection[]
  rubric?: { id: string; name: string; code: string } | null
}

export interface ApiTrack {
  id: string
  code: string
  name: string
}

export interface ApiClassSubject {
  id: string
  subjectId: string
  classSessionId: string
  coefficientOverride: number | null
  /** null = matière du tronc commun ; sinon matière d'examen officiel de cette filière */
  trackId: string | null
  track?: ApiTrack | null
  subject: ApiSubject
}

export interface ApiEnrollmentStudent {
  id: string
  studentCode: string
  nisu?: string | null
  user: { id: string; firstname: string; lastname: string }
}

export interface ApiEnrollment {
  id: string
  status: string
  /** Filière de l'élève (obligatoire en classe terminale, null sinon) */
  trackId?: string | null
  track?: ApiTrack | null
  student: ApiEnrollmentStudent
}

export interface ApiGrade {
  id: string
  enrollmentId: string
  classSubjectId: string
  sectionId: string | null
  stepId: string
  studentScore: number
  gradeType: 'EXAM' | 'HOMEWORK' | 'ORAL'
  comment?: string | null
}

export interface CreateGradePayload {
  enrollmentId: string
  classSubjectId: string
  sectionId?: string
  stepId: string
  studentScore: number
  gradeType: 'EXAM' | 'HOMEWORK' | 'ORAL'
  comment?: string
}

// ── Portée des matières (filière) ─────────────────────────────────────────────
// 'common' = tronc commun (trackId null) — concerne TOUS les élèves de la salle.
// 'exam'   = examen officiel — uniquement les matières de la filière de l'élève.
// 'all'    = les deux (vue de saisie).
export type SubjectScope = 'common' | 'exam' | 'all'

/**
 * Matières visibles pour un élève selon la portée.
 * Un élève ne voit JAMAIS les matières d'examen d'une autre filière que la sienne.
 */
export function filterSubjectsByScope(
  classSubjects: ApiClassSubject[],
  scope: SubjectScope,
  studentTrackId: string | null | undefined,
): ApiClassSubject[] {
  return classSubjects.filter((cs) => {
    const isCommon = cs.trackId == null
    if (scope === 'common') return isCommon
    const isOwnExam = !isCommon && !!studentTrackId && cs.trackId === studentTrackId
    if (scope === 'exam') return isOwnExam
    return isCommon || isOwnExam // 'all'
  })
}

// ── Fetch class subjects — normalise les Decimal Prisma ───────────────────────

export async function fetchClassSubjects(classSessionId: string): Promise<ApiClassSubject[]> {
  const res = await fetch(`/api/class-subjects?classSessionId=${classSessionId}`, {
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Impossible de charger les matières')
  const data = await res.json()

  return data.map((cs: ApiClassSubject) => ({
    ...cs,
    coefficientOverride: cs.coefficientOverride != null ? parseDecimal(cs.coefficientOverride) : null,
    subject: {
      ...cs.subject,
      maxScore:    parseDecimal(cs.subject.maxScore) ?? 0,
      coefficient: parseDecimal(cs.subject.coefficient) ?? 1,
      sections: (cs.subject.sections || []).map(sec => ({
        ...sec,
        maxScore: parseDecimal(sec.maxScore) ?? 0,
      }))
    }
  }))
}

// ── Fetch enrollments ─────────────────────────────────────────────────────────

export async function fetchEnrollments(classSessionId: string): Promise<ApiEnrollment[]> {
  const res = await fetch(`/api/enrollments?classSessionId=${classSessionId}&status=ACTIVE`, {
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Impossible de charger les élèves')
  return res.json()
}

// ── Fetch grades — normalise studentScore ─────────────────────────────────────

export async function fetchGradesForClassSubjectStep(
  classSubjectId: string,
  stepId: string
): Promise<ApiGrade[]> {
  const res = await fetch(`/api/grades/class-subject/${classSubjectId}/step/${stepId}`, {
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Impossible de charger les notes')
  const data = await res.json()

  return data.map((g: ApiGrade) => ({
    ...g,
    studentScore: parseDecimal(g.studentScore) ?? 0,
  }))
}

// ── Bulk create grades ────────────────────────────────────────────────────────

export async function bulkCreateGrades(grades: CreateGradePayload[]): Promise<void> {
  const res = await fetch('/api/grades/bulk-create', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grades }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.message ?? "Erreur lors de l'enregistrement des notes")
  }
}

// ── Delete an existing grade ──────────────────────────────────────────────────
// Effacer une note déjà enregistrée = la retirer complètement (pas un 0) :
// elle ne doit plus exister, comme si elle n'avait jamais été saisie.

export async function deleteGrade(gradeId: string): Promise<void> {
  const res = await fetch(`/api/grades/delete/${gradeId}`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.message ?? 'Erreur lors de la suppression de la note')
  }
}

// ── Update an existing grade ──────────────────────────────────────────────────

export async function updateGrade(
  gradeId: string,
  studentScore: number,
  gradeType: 'EXAM' | 'HOMEWORK' | 'ORAL' = 'EXAM'
): Promise<void> {
  const res = await fetch(`/api/grades/update/${gradeId}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentScore, gradeType }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.message ?? "Erreur lors de la mise à jour de la note")
  }
}