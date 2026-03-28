/**
 * lib/api/dashboard.ts
 * Fonctions fetch pour le tableau de bord.
 * Toutes les requêtes passent par les API routes Next.js (/api/...)
 * qui proxyfient vers https://apicpmsl.stelloud.cloud
 */

const BASE = '/api/proxy'

// ── Types réponses backend ────────────────────────────────────────────────────

export interface AcademicYear {
  id: string
  name: string
  yearString: string
  startDate: string
  endDate: string
  isCurrent: boolean
  steps: AcademicYearStep[]
}

export interface AcademicYearStep {
  id: string
  name: string
  stepNumber: number
  startDate: string
  endDate: string
  academicYearId: string
}

export interface ClassSession {
  id: string
  class: {
    id: string
    letter: string
    classType: { id: string; name: string; isTerminal: boolean }
    track?: { id: string; name: string; code: string }
  }
  academicYear: { id: string; name: string }
  displayName?: string
}

export interface Enrollment {
  id: string
  studentId: string
  classSessionId: string
  status: 'ACTIVE' | 'TRANSFERRED' | 'DROPPED' | 'GRADUATED'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/proxy?path=${encodeURIComponent(path)}`, {
    credentials: 'include',
    ...options,
  })
  if (!res.ok) throw new Error(`API error ${res.status} — ${path}`)
  return res.json()
}

// ── Fonctions dashboard ───────────────────────────────────────────────────────

/** Récupère toutes les années scolaires et retourne la courante */
export async function fetchActiveAcademicYear(): Promise<AcademicYear | null> {
  const years: AcademicYear[] = await apiFetch('/api/academic-years/')
  return years.find(y => y.isCurrent) ?? null
}

/** Récupère les étapes (steps) d'une année scolaire */
export async function fetchSteps(academicYearId: string): Promise<AcademicYearStep[]> {
  return apiFetch(`/api/academic-years/${academicYearId}/steps`)
}

/** Récupère les sessions de classe pour une année scolaire */
export async function fetchClassSessions(academicYearId: string): Promise<ClassSession[]> {
  return apiFetch(`/api/class-sessions/?academicYearId=${academicYearId}`)
}

/** Récupère le nombre d'élèves inscrits (ACTIVE) pour une session de classe */
export async function fetchEnrollmentCount(classSessionId: string): Promise<number> {
  const enrollments: Enrollment[] = await apiFetch(
    `/api/enrollments/?classSessionId=${classSessionId}&status=ACTIVE`
  )
  return enrollments.length
}

/** Récupère le total d'élèves actifs pour une année scolaire */
export async function fetchTotalStudents(academicYearId: string): Promise<number> {
  // On récupère toutes les sessions puis on somme les inscriptions actives
  const sessions = await fetchClassSessions(academicYearId)
  const counts = await Promise.all(sessions.map(s => fetchEnrollmentCount(s.id)))
  return counts.reduce((sum, n) => sum + n, 0)
}

/** Retourne le nom affiché d'une session de classe */
export function getClassSessionName(session: ClassSession): string {
  const { classType, letter, track } = session.class
  const trackCode = track ? ` ${track.code}` : ''
  return `${classType.name} ${letter}${trackCode}`
}

/** Détermine l'étape en cours selon la date du jour */
export function getCurrentStep(steps: AcademicYearStep[]): AcademicYearStep | null {
  const today = new Date()
  // Chercher d'abord une étape dont la date encadre aujourd'hui
  const active = steps.find(s => {
    const start = new Date(s.startDate)
    const end   = new Date(s.endDate)
    return today >= start && today <= end
  })
  if (active) return active
  // Sinon retourner la dernière étape passée
  const past = steps
    .filter(s => new Date(s.endDate) < today)
    .sort((a, b) => b.stepNumber - a.stepNumber)
  return past[0] ?? steps[0] ?? null
}