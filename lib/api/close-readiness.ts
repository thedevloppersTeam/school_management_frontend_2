/**
 * lib/api/close-readiness.ts
 *
 * Calcule le vrai statut de chaque classe avant clôture d'une période.
 * Remplace le mock `getMockClassroomStatuses()` qui alimentait la
 * checklist du ClosePeriodModal avec des données fixes.
 *
 * Fermeture du finding WF-001 : la checklist devient fonctionnelle,
 * la clôture ne peut plus passer sur des données bidon.
 *
 * Stratégie :
 *   Pour chaque classe (classSessionId) et une étape (stepId) donnée,
 *   on dérive côté client à partir des endpoints existants :
 *
 *     1. fetch /api/class-subjects?classSessionId=X   → matières
 *     2. fetch /api/enrollments?classSessionId=X      → élèves
 *     3. pour chaque matière, fetch les notes de l'étape
 *     4. on compte :
 *        - gradesEntered        : nb notes saisies (somme)
 *        - totalGrades          : nb_matières × nb_élèves actifs
 *        - studentsWithoutNisu  : élèves sans NISU valide (DR-001)
 *        - unmappedSubjects     : matières sans rubrique (DR-003)
 *        - status               : 'complete' | 'incomplete' | 'not-started'
 *
 * Contraintes respectées :
 *   - Aucun nouvel endpoint backend requis
 *   - Appels en parallèle par classe pour limiter la latence
 *   - Gère les erreurs par classe sans tout casser (dégradation par ligne)
 *
 * Note V1.5 : l'idéal serait un endpoint dédié
 * `GET /api/academic-year-steps/:id/close-readiness` qui renverrait
 * directement ce calcul. À demander au backend. En attendant, cette
 * implémentation dérive les mêmes valeurs avec N+M fetches (vs 1).
 */

import type { ApiClassSubject, ApiEnrollment, ApiGrade } from './grades'

// ── Structures attendues côté composant parent ───────────────────────────────

/**
 * Une "classroom" côté ConfigTabs est en fait une class-session
 * (instance d'une classe pour une année donnée). Son `id` est un
 * `classSessionId` backend.
 */
export interface InputClassroom {
  id:      string  // = classSessionId
  name:    string  // Ex: "7e A", "NS3 LLA"
  levelId: string  // = classTypeId (pour déduire className)
}

export interface InputLevel {
  id:   string  // = classTypeId
  name: string  // "7e", "NS3"…
}

/**
 * Format de sortie attendu par `ClosePeriodModal`.
 * Doit matcher l'interface `ClassroomGradeStatus` du modal.
 */
export interface ClassroomStatus {
  className:           string
  classroomName:       string
  sessionId:           string
  gradesEntered:       number
  totalGrades:         number
  studentsWithoutNisu: number
  unmappedSubjects:    number
  status:              'complete' | 'incomplete' | 'not-started'
}

// ── Validation NISU (DR-001) ─────────────────────────────────────────────────
// Le projet a encore la dérive EP-002 : code actuel = {14} alphanum,
// spec DR-001 = {12} chiffres. À valider avec MOA.
// Pour l'instant, on utilise la même règle que le reste du code
// pour rester cohérent.
function isNisuValid(nisu: string | null | undefined): boolean {
  if (!nisu) return false
  return /^[A-Z0-9]{14}$/.test(nisu.trim())
}

// ── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

// ── Calcul pour UNE classe ───────────────────────────────────────────────────

async function computeClassroomStatus(
  classroom: InputClassroom,
  level: InputLevel | undefined,
  stepId: string
): Promise<ClassroomStatus> {
  const sessionId = classroom.id

  // Défaut (en cas d'échec partiel)
  const base: ClassroomStatus = {
    className:           level?.name ?? '—',
    classroomName:       classroom.name,
    sessionId,
    gradesEntered:       0,
    totalGrades:         0,
    studentsWithoutNisu: 0,
    unmappedSubjects:    0,
    status:              'not-started',
  }

  // 1. Matières + élèves en parallèle
  const [subjects, enrollments] = await Promise.all([
    fetchJson<ApiClassSubject[]>(`/api/class-subjects?classSessionId=${sessionId}`),
    fetchJson<ApiEnrollment[]>(`/api/enrollments?classSessionId=${sessionId}`),
  ])

  // Pas de données → classe vide ou erreur → statut "not-started"
  if (!subjects || !enrollments) return base

  // Filtrer les enrollments actifs (exclure ceux désactivés si applicable)
  const activeEnrollments = enrollments.filter(e => {
    // Le statut exact varie selon le backend. On garde tout sauf si
    // explicitement "CANCELLED" / "TRANSFERRED" etc. Règle prudente :
    // on considère tout enrollment présent comme "actif" par défaut.
    const status = (e.status ?? '').toUpperCase()
    return status !== 'CANCELLED' && status !== 'TRANSFERRED'
  })

  // Validation DR-001 : NISU manquant
  const studentsWithoutNisu = activeEnrollments.filter(
    e => !isNisuValid(e.student.nisu)
  ).length

  // Validation DR-003 : matière sans rubrique
  // ApiClassSubject.subject a un champ `rubric` (optionnel)
  const unmappedSubjects = subjects.filter(cs => !cs.subject.rubric).length

  // Cas vide
  if (subjects.length === 0 || activeEnrollments.length === 0) {
    return {
      ...base,
      gradesEntered: 0,
      totalGrades:   0,
      studentsWithoutNisu,
      unmappedSubjects,
      status:        'not-started',
    }
  }

  // 2. Compter les notes — un fetch par matière
  // Note : on ne peut pas paralléliser trop large (limite réseau).
  // Ici on parallélise sur les matières de cette classe (typiquement <15).
  const gradesPerSubject = await Promise.all(
    subjects.map(cs =>
      fetchJson<ApiGrade[]>(`/api/grades/class-subject/${cs.id}/step/${stepId}`)
    )
  )

  const totalGrades = subjects.length * activeEnrollments.length
  const gradesEntered = gradesPerSubject
    .flatMap(g => g ?? [])
    // Ne compter qu'une note par (enrollment, classSubject, step), pas
    // les notes de section. sectionId === null = note principale.
    .filter(g => g.sectionId === null)
    .length

  // Statut dérivé
  let status: ClassroomStatus['status']
  if (gradesEntered === 0) {
    status = 'not-started'
  } else if (gradesEntered >= totalGrades) {
    status = 'complete'
  } else {
    status = 'incomplete'
  }

  return {
    className:     level?.name ?? '—',
    classroomName: classroom.name,
    sessionId,
    gradesEntered,
    totalGrades,
    studentsWithoutNisu,
    unmappedSubjects,
    status,
  }
}

// ── Point d'entrée public ────────────────────────────────────────────────────

/**
 * Calcule le statut de toutes les classes pour une étape donnée.
 *
 * @param classrooms  — liste des classes (class-sessions) à auditer
 * @param levels      — liste des niveaux (class-types) pour le mapping
 *                      classTypeId → className
 * @param stepId      — ID de l'étape à clôturer
 *
 * @returns Un tableau de statuts, un par classe. Trié par className+classroomName.
 *          Aucune erreur n'est throwée — en cas d'échec partiel, les
 *          classes concernées remontent avec des valeurs à 0.
 */
export async function computeClassroomStatuses(
  classrooms: InputClassroom[],
  levels:     InputLevel[],
  stepId:     string
): Promise<ClassroomStatus[]> {
  if (!stepId || classrooms.length === 0) return []

  // Index des niveaux pour lookup O(1)
  const levelById = new Map(levels.map(l => [l.id, l]))

  // Fetch parallèle sur toutes les classes (limité par la taille réelle
  // d'un établissement : ~20-40 classes max au CPMSL selon H4).
  const statuses = await Promise.all(
    classrooms.map(c =>
      computeClassroomStatus(c, levelById.get(c.levelId), stepId)
    )
  )

  // Tri alphabétique pour affichage déterministe
  return statuses.sort((a, b) => {
    const byClass = a.className.localeCompare(b.className)
    if (byClass !== 0) return byClass
    return a.classroomName.localeCompare(b.classroomName)
  })
}