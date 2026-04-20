/**
 * lib/api/dashboard.ts
 * Fonctions fetch pour le tableau de bord.
 * Toutes les requêtes passent par les API routes Next.js (/api/...)
 * qui proxyfient vers https://apicpmsl.stelloud.cloud
 */

// ── Types ─────────────────────────────────────────────────────────────────────
import { clientFetch as apiFetch } from '@/lib/client-fetch'

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
  isCurrent: boolean  // ← source de vérité pour le statut ouvert/clôturé
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

// ── Fonctions ─────────────────────────────────────────────────────────────────

/**
 * Récupère l'année scolaire courante via GET /api/academic-years/current.
 * Retourne null si aucune année n'est marquée courante (404).
 */
export async function fetchActiveAcademicYear(): Promise<AcademicYear | null> {
  try {
    return await apiFetch<AcademicYear>('/api/academic-years/current')
  } catch {
    return null
  }
}

/** Récupère toutes les années scolaires */
export async function fetchAllAcademicYears(): Promise<AcademicYear[]> {
  return apiFetch<AcademicYear[]>('/api/academic-years')
}

/** Récupère les étapes d'une année scolaire */
export async function fetchSteps(academicYearId: string): Promise<AcademicYearStep[]> {
  return apiFetch<AcademicYearStep[]>(`/api/academic-years/${academicYearId}/steps`)
}

/** Récupère les sessions de classe pour une année scolaire */
export async function fetchClassSessions(academicYearId: string): Promise<ClassSession[]> {
  return apiFetch<ClassSession[]>(`/api/class-sessions?academicYearId=${academicYearId}`)
}

/** Récupère le nombre d'élèves inscrits (ACTIVE) pour une session de classe */
export async function fetchEnrollmentCount(classSessionId: string): Promise<number> {
  const enrollments = await apiFetch<Enrollment[]>(
    `/api/enrollments?classSessionId=${classSessionId}&status=ACTIVE`
  )
  return enrollments.length
}

/** Retourne le nom affiché d'une session de classe */
export function getClassSessionName(session: ClassSession): string {
  const { classType, letter, track } = session.class
  const trackCode = track ? ` ${track.code}` : ''
  return `${classType.name} ${letter}${trackCode}`
}

/**
 * Retourne l'étape en cours.
 * Source de vérité : isCurrent du backend (enable/disable endpoints).
 * Fallback : première étape de la liste.
 */
export function getCurrentStep(steps: AcademicYearStep[]): AcademicYearStep | null {
  return steps.find(s => s.isCurrent) ?? steps[0] ?? null
}