/**
 * Service de résultats serveur — client (SPEC-RESULTATS § 4, lot L3).
 *
 * GET /api/results?classSessionId=&stepId=[&scope=] renvoie, pour TOUTE une
 * salle à une étape, les chiffres calculés une seule fois par le serveur. Le
 * navigateur ne calcule plus rien pour le bulletin : il affiche.
 *
 * Un appel par (salle, étape, portée), mis en cache pour la génération en lot :
 * 30 bulletins d'une salle = 1 requête de résultats, jamais une par élève.
 * Le cache vit CACHE_TTL_MS (60 s) : assez pour un lot, assez court pour
 * qu'une note saisie ensuite apparaisse sans recharger la page. Il est aussi
 * vidé quand une dispense change (invalidateExclusionsCache, lib/api/bulletin).
 * Un échec n'est pas mis en cache.
 *
 * Les types reflètent la sérialisation du serveur (src/lib/results/types.ts,
 * Decimal → chaîne exacte). Les champs non lus par le bulletin ne sont pas
 * déclarés.
 */
import { clientFetch as apiFetch } from '@/lib/client-fetch'

/** Chaîne décimale EXACTE (ex. "6.6666666666666666667"), jamais arrondie par le serveur. */
export type DecimalString = string

export type ResultsScope = 'common' | 'exam' | 'all'
export type RubriqueCode = 'R1' | 'R2' | 'R3'
export type EntryState = 'noted' | 'missing' | 'exempted'

export interface ResultSection {
  sectionId: string
  name: string
  isExam: boolean
  maxScore: DecimalString
  score: DecimalString | null
  state: EntryState
}

export interface ResultSubject {
  classSubjectId: string
  subjectId: string
  trackId: string | null
  name: string
  rubrique: RubriqueCode
  isExam: boolean
  mode: 'sections' | 'global'
  numerator: DecimalString
  denominator: DecimalString
  average: DecimalString | null
  state: EntryState
  sections: ResultSection[]
}

export interface ResultRubrique {
  code: RubriqueCode
  numerator: DecimalString
  denominator: DecimalString
  average: DecimalString | null
}

/** Ligne à imprimer, décidée par le serveur (RS-04, D2). */
export interface PrintLine {
  classSubjectId: string
  sectionId: string | null
  name: string
  isParent: boolean
  note: DecimalString | null
  maxScore: DecimalString | null
}

export interface PrintRubrique {
  code: RubriqueCode
  lines: PrintLine[]
  totalNote: DecimalString
  totalMaxScore: DecimalString
}

export interface ResultStep {
  stepId: string
  stepNumber: number
  isExamBlanc: boolean
  exempted: boolean
  examMode: boolean
  subjects: ResultSubject[]
  rubriques: Record<RubriqueCode, ResultRubrique>
  average: DecimalString
  averageOrNull: DecimalString | null
  print: Record<RubriqueCode, PrintRubrique>
}

/** Statut de l'inscription (enum serveur EnrollmentStatus). */
export type EnrollmentStatus = 'ACTIVE' | 'TRANSFERRED' | 'DROPPED' | 'GRADUATED'

export interface ResultStudent {
  enrollmentId: string
  studentId: string
  trackId: string | null
  /**
   * D-17 : le service renvoie TOUTES les inscriptions de la salle. Un élève
   * TRANSFERRED ou DROPPED a ses résultats (donc ses bulletins) mais n'entre
   * jamais dans les moyennes de classe (ACTIVE + GRADUATED seulement).
   */
  status: EnrollmentStatus
  steps: ResultStep[]
  annual: DecimalString | null
}

export interface ResultClassAverages {
  /** Inscriptions comptées : ACTIVE + GRADUATED (D-17). */
  enrollmentCount: number
  subjects: Record<string, DecimalString | null>
  rubriques: Record<RubriqueCode, DecimalString | null>
  step: DecimalString | null
  annual: DecimalString | null
}

export interface ResultWarning {
  code: string
  message: string
}

export interface RoomResults {
  classSessionId: string
  stepId: string
  scope: ResultsScope | null
  students: ResultStudent[]
  classAverages: { all: ResultClassAverages; byTrack: Record<string, ResultClassAverages> }
  warnings: ResultWarning[]
}

export const CACHE_TTL_MS = 60_000
const cache = new Map<string, { promise: Promise<RoomResults>; at: number }>()

/** Résultats d'une salle à une étape. `scope` absent : portée du service (RS-03). */
export function fetchRoomResults(classSessionId: string, stepId: string, scope?: ResultsScope): Promise<RoomResults> {
  const key = `${classSessionId}:${stepId}:${scope ?? ''}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.promise
  const query = new URLSearchParams({ classSessionId, stepId })
  if (scope) query.set('scope', scope)
  const promise = apiFetch<RoomResults>(`/api/results?${query.toString()}`)
  cache.set(key, { promise, at: Date.now() })
  promise.catch(() => {
    if (cache.get(key)?.promise === promise) cache.delete(key)
  })
  return promise
}

/**
 * Vide le cache : après une saisie de notes, ou entre deux tests. Sans
 * argument, tout ; sinon la seule salle.
 */
export function invalidateRoomResults(classSessionId?: string): void {
  if (!classSessionId) {
    cache.clear()
    return
  }
  for (const key of [...cache.keys()]) if (key.startsWith(`${classSessionId}:`)) cache.delete(key)
}
