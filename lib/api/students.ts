/**
 * lib/api/students.ts
 * Fonctions fetch pour la page élèves.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApiUser {
  id: string
  firstname: string
  lastname: string
  username: string
  type: string
  isActive: boolean
  profilePhoto?: string | null
}

export interface ApiStudent {
  id: string
  studentCode: string
  address?: string | null
  motherName?: string | null
  fatherName?: string | null
  phone1?: string | null
  phone2?: string | null
  parentsEmail?: string | null
  user: ApiUser
}

export interface ApiClassType {
  id: string
  name: string
  isTerminal: boolean
}

export interface ApiTrack {
  id: string
  name: string
  code: string
}

export interface ApiClass {
  id: string
  letter: string
  classType: ApiClassType
  track?: ApiTrack | null
}

export interface ApiClassSession {
  id: string
  class: ApiClass
}

export interface ApiEnrollment {
  id: string
  status: 'ACTIVE' | 'TRANSFERRED' | 'DROPPED' | 'GRADUATED'
  student: ApiStudent
  classSession: ApiClassSession
}

// ── Unified display type (utilisé par la page) ────────────────────────────────

export interface StudentRow {
  // identifiers
  enrollmentId: string
  studentId: string
  userId: string
  // display
  studentCode: string
  firstName: string
  lastName: string
  fullName: string
  avatar: string | null
  // class
  className: string       // ex: "7ème AF A" ou "NS3 A LLA"
  classSessionId: string
  // contact
  phone1: string | null
  motherName: string | null
  fatherName: string | null
  // status
  isActive: boolean
  enrollmentStatus: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/proxy?path=${encodeURIComponent(path)}`, {
    credentials: 'include',
    ...options,
  })
  if (!res.ok) throw new Error(`API ${res.status} — ${path}`)
  return res.json()
}

export function buildClassName(session: ApiClassSession): string {
  const { classType, letter, track } = session.class
  const trackCode = track ? ` ${track.code}` : ''
  return `${classType.name} ${letter}${trackCode}`
}

// ── Fetch functions ───────────────────────────────────────────────────────────

/**
 * Récupère tous les élèves inscrits pour une année scolaire.
 * Stratégie : enrollments filtrés par chaque classSession de l'année.
 */
export async function fetchStudentsByYear(academicYearId: string): Promise<StudentRow[]> {
  // 1. Toutes les sessions de classe pour cette année
  const sessions: ApiClassSession[] = await apiFetch(
    `/api/class-sessions/?academicYearId=${academicYearId}`
  )

  if (!sessions.length) return []

  // 2. Enrollments ACTIVE pour chaque session (en parallèle)
  const enrollmentArrays = await Promise.all(
    sessions.map(session =>
      apiFetch<ApiEnrollment[]>(
        `/api/enrollments/?classSessionId=${session.id}&status=ACTIVE`
      ).catch(() => [] as ApiEnrollment[])
    )
  )

  // 3. Flatten + map vers StudentRow
  const rows: StudentRow[] = []

  enrollmentArrays.forEach((enrollments, i) => {
    const session = sessions[i]
    const className = buildClassName(session)

    enrollments.forEach(enrollment => {
      const { student } = enrollment
      const { user } = student

      rows.push({
        enrollmentId: enrollment.id,
        studentId: student.id,
        userId: user.id,
        studentCode: student.studentCode ?? '—',
        firstName: user.firstname,
        lastName: user.lastname,
        fullName: `${user.firstname} ${user.lastname}`,
        avatar: user.profilePhoto ?? null,
        className,
        classSessionId: session.id,
        phone1: student.phone1 ?? null,
        motherName: student.motherName ?? null,
        fatherName: student.fatherName ?? null,
        isActive: user.isActive,
        enrollmentStatus: enrollment.status,
      })
    })
  })

  // 4. Trier par nom
  return rows.sort((a, b) => a.lastName.localeCompare(b.lastName))
}

/**
 * Récupère tous les élèves incluant inactifs (DROPPED/TRANSFERRED).
 */
export async function fetchAllStudentsByYear(academicYearId: string): Promise<StudentRow[]> {
  const sessions: ApiClassSession[] = await apiFetch(
    `/api/class-sessions/?academicYearId=${academicYearId}`
  )

  if (!sessions.length) return []

  const enrollmentArrays = await Promise.all(
    sessions.map(session =>
      apiFetch<ApiEnrollment[]>(
        `/api/enrollments/?classSessionId=${session.id}`
      ).catch(() => [] as ApiEnrollment[])
    )
  )

  const rows: StudentRow[] = []

  enrollmentArrays.forEach((enrollments, i) => {
    const session = sessions[i]
    const className = buildClassName(session)

    enrollments.forEach(enrollment => {
      const { student } = enrollment
      const { user } = student

      rows.push({
        enrollmentId: enrollment.id,
        studentId: student.id,
        userId: user.id,
        studentCode: student.studentCode ?? '—',
        firstName: user.firstname,
        lastName: user.lastname,
        fullName: `${user.firstname} ${user.lastname}`,
        avatar: user.profilePhoto ?? null,
        className,
        classSessionId: session.id,
        phone1: student.phone1 ?? null,
        motherName: student.motherName ?? null,
        fatherName: student.fatherName ?? null,
        isActive: user.isActive,
        enrollmentStatus: enrollment.status,
      })
    })
  })

  return rows.sort((a, b) => a.lastName.localeCompare(b.lastName))
}

/**
 * Récupère les classes distinctes (pour le filtre).
 */
export async function fetchClassSessionsForYear(
  academicYearId: string
): Promise<{ id: string; name: string }[]> {
  const sessions: ApiClassSession[] = await apiFetch(
    `/api/class-sessions/?academicYearId=${academicYearId}`
  )
  return sessions
    .map(s => ({ id: s.id, name: buildClassName(s) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Désactive un élève (status update sur l'enrollment).
 */
export async function dropEnrollment(enrollmentId: string): Promise<void> {
  await apiFetch(`/api/enrollments/status-update/${enrollmentId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'DROPPED', notes: 'Désactivé par l\'administrateur' }),
  })
}

/**
 * Réactive un élève.
 */
export async function reactivateEnrollment(enrollmentId: string): Promise<void> {
  await apiFetch(`/api/enrollments/status-update/${enrollmentId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'ACTIVE', notes: 'Réactivé par l\'administrateur' }),
  })
}