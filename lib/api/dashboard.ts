/**
 * lib/api/dashboard.ts
 * Fonctions fetch pour le tableau de bord.
 * Toutes les requêtes passent par les API routes Next.js (/api/...)
 * qui proxyfient vers https://apicpmsl.stelloud.cloud
 */

// ── Types ─────────────────────────────────────────────────────────────────────
import { clientFetch as apiFetch, ApiError } from '@/lib/client-fetch'

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
    // Pas de `track` ici : une SALLE n'a pas de filiere. Le modele ne la porte
    // ni sur `Class` ni sur `ClassSession` — elle vit sur l'inscription de
    // chaque eleve (`Enrollment.trackId`) et sur la matiere
    // (`ClassSubject.trackId`). Une meme salle heberge donc plusieurs filieres.
    //
    // Le champ a existe ici, declare optionnel, et une dizaine d'endroits
    // construisaient un libelle de classe en le lisant. Le backend ne l'a
    // jamais envoye : toutes ces branches etaient mortes et le suffixe de
    // filiere toujours vide. Le retirer du type empeche de les reecrire.
  }
  academicYear: { id: string; name: string; yearString?: string | null }
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
 *
 * Retourne null UNIQUEMENT quand le serveur répond qu'aucune année n'est
 * marquée courante (404). Toute autre erreur — réseau coupé, 500, timeout —
 * est propagée.
 *
 * Ne pas revenir à un `catch { return null }` global : l'appelant ne pourrait
 * plus distinguer « il n'y a pas d'année » de « je n'ai pas pu joindre le
 * serveur », et afficherait à l'utilisateur que son année scolaire a disparu
 * en l'invitant à en recréer une — sur une base parfaitement saine.
 */
export async function fetchActiveAcademicYear(): Promise<AcademicYear | null> {
  try {
    return await apiFetch<AcademicYear>('/api/academic-years/current')
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
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

/** Retourne le nom affiché d'une session de classe. Ex. « NS3 A ». */
export function getClassSessionName(session: ClassSession): string {
  const { classType, letter } = session.class
  return `${classType.name} ${letter}`
}

/**
 * Retourne l'étape en cours.
 * Source de vérité : isCurrent du backend (enable/disable endpoints).
 * Fallback : première étape de la liste.
 */
export function getCurrentStep(steps: AcademicYearStep[]): AcademicYearStep | null {
  return steps.find(s => s.isCurrent) ?? steps[0] ?? null
}
