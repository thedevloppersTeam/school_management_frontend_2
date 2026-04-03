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

export interface ApiClassSubject {
  id: string
  subjectId: string
  classSessionId: string
  coefficientOverride: number | null
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

// ── Fetch class subjects — normalise les Decimal Prisma ───────────────────────

export async function fetchClassSubjects(classSessionId: string): Promise<ApiClassSubject[]> {
  const res = await fetch(`/api/class-subjects?classSessionId=${classSessionId}`, {
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Impossible de charger les matières')
  const data = await res.json()

  return data.map((cs: ApiClassSubject) => ({
    ...cs,
    coefficientOverride: cs.coefficientOverride != null ? Number(cs.coefficientOverride) : null,
    subject: {
      ...cs.subject,
      maxScore:    Number(cs.subject.maxScore),
      coefficient: Number(cs.subject.coefficient),
      sections: (cs.subject.sections || []).map(sec => ({
        ...sec,
        maxScore: Number(sec.maxScore),
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
    studentScore: Number(g.studentScore),
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
