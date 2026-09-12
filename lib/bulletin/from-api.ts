/**
 * Adaptateur entre les types de l'API et lib/bulletin/compute.ts.
 *
 * compute.ts ne connait ni fetch, ni ApiClassSubject, ni React : c'est ce qui
 * permettra de le deplacer vers le backend. Toute la traduction vit ici.
 *
 * Les trois consommateurs — bulletin 8½×11, rapport 8½×14, affichage ecran —
 * passent par ce fichier. Un seul point de traduction, comme il n'y a qu'un
 * seul point de calcul.
 */

import Decimal from 'decimal.js'
import type { RubriqueCode, SectionInput, SubjectInput } from './compute'

// ─────────────────────────────────────────────────────────────────────────────
// Formes minimales attendues de l'API. Volontairement structurelles : on ne
// depend pas des interfaces de lib/api/grades.ts, seulement de leur forme.
// ─────────────────────────────────────────────────────────────────────────────

export type NumericLike = number | string

export interface ApiSectionLike {
  id: string
  name: string
  maxScore: NumericLike
}

export interface ApiSubjectLike {
  id: string
  name: string
  maxScore: NumericLike
  rubric?: { id: string; code?: string } | null
  sections?: ApiSectionLike[] | null
}

export interface ApiClassSubjectLike {
  id: string
  maxScoreOverride?: NumericLike | null
  subject: ApiSubjectLike
}

export interface ApiGradeLike {
  classSubjectId: string
  sectionId: string | null
  studentScore: NumericLike
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispenses — la cle COMPLETE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sentinelle pour une dispense portant sur la matiere entiere.
 *
 * Symetrique de grades.section_id IS NULL, qui signifie « note globale ».
 * Les classes d'examen (9e, NS4) notent directement la matiere : la dispense
 * doit alors porter sur la matiere, pas sur une sous-matiere.
 */
export const WHOLE_SUBJECT = '*' as const

/**
 * Cle d'une dispense. Les QUATRE parties comptent.
 *
 * `step_id` est porte par la requete (un appel par etape), les trois autres
 * par cette cle. Omettre `classSubjectId` est un bug actif : une meme matiere
 * peut etre affectee deux fois a une session — tronc commun avec trackId null,
 * et examen de filiere avec un trackId — via
 * @@unique([classSessionId, subjectId, trackId]). Les deux affectations
 * partagent les memes sous-matieres, donc les memes sectionId. Une cle reduite
 * a (enrollmentId, sectionId) dispense l'eleve sur les DEUX affectations.
 */
export function exclusionKey(
  enrollmentId: string,
  classSubjectId: string,
  sectionId: string | null,
): string {
  return `${enrollmentId}::${classSubjectId}::${sectionId ?? WHOLE_SUBJECT}`
}

export interface ApiExclusionLike {
  enrollmentId: string
  classSubjectId: string
  sectionId: string | null
}

/** Construit l'ensemble des dispenses depuis la reponse de l'API. */
export function buildExclusionSet(rows: ApiExclusionLike[]): Set<string> {
  const set = new Set<string>()
  for (const r of rows) {
    set.add(exclusionKey(r.enrollmentId, r.classSubjectId, r.sectionId))
  }
  return set
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversion
// ─────────────────────────────────────────────────────────────────────────────

function dec(v: NumericLike | null | undefined, fallback = 0): Decimal {
  if (v === null || v === undefined) return new Decimal(fallback)
  return new Decimal(v)
}

const VALID_CODES: ReadonlySet<string> = new Set(['R1', 'R2', 'R3'])

export interface ToSubjectInputsResult {
  subjects: SubjectInput[]
  /**
   * DR-003 — matieres dont la rubrique est inconnue ou non mappee.
   * La regle dit de REFUSER le calcul, pas de les ignorer en silence.
   * L'appelant decide : bloquer, ou afficher l'avertissement.
   */
  unmapped: { classSubjectId: string; name: string; reason: string }[]
}

export function toSubjectInputs(params: {
  classSubjects: ApiClassSubjectLike[]
  grades: ApiGradeLike[]
  /** id de rubrique -> code. Construit depuis la liste des rubriques. */
  rubricCodeById: Record<string, string>
  enrollmentId: string
  /** Ensemble issu de buildExclusionSet. */
  exclusions?: Set<string>
}): ToSubjectInputsResult {
  const { classSubjects, grades, rubricCodeById, enrollmentId } = params
  const exclusions = params.exclusions ?? new Set<string>()

  const subjects: SubjectInput[] = []
  const unmapped: ToSubjectInputsResult['unmapped'] = []

  // Index des notes : (classSubjectId, sectionId|null) -> notes
  const byKey = new Map<string, Decimal[]>()
  for (const g of grades) {
    const k = `${g.classSubjectId}::${g.sectionId ?? WHOLE_SUBJECT}`
    const list = byKey.get(k)
    if (list) list.push(dec(g.studentScore))
    else byKey.set(k, [dec(g.studentScore)])
  }
  const scoresFor = (csId: string, sectionId: string | null): Decimal[] =>
    byKey.get(`${csId}::${sectionId ?? WHOLE_SUBJECT}`) ?? []

  for (const cs of classSubjects) {
    const rubricId = cs.subject.rubric?.id
    const code = rubricId ? rubricCodeById[rubricId] : undefined

    if (!code || !VALID_CODES.has(code)) {
      unmapped.push({
        classSubjectId: cs.id,
        name: cs.subject.name,
        reason: rubricId
          ? `rubrique ${rubricId} non mappee sur R1/R2/R3`
          : 'aucune rubrique rattachee a la matiere',
      })
      continue // DR-003 : jamais silencieux, remonte a l'appelant
    }

    const sections: SectionInput[] = (cs.subject.sections ?? []).map((s) => ({
      sectionId: s.id,
      name: s.name,
      maxScore: dec(s.maxScore),
      scores: scoresFor(cs.id, s.id),
      exempted: exclusions.has(exclusionKey(enrollmentId, cs.id, s.id)),
    }))

    subjects.push({
      classSubjectId: cs.id,
      name: cs.subject.name,
      rubrique: code as RubriqueCode,
      maxScore: dec(cs.subject.maxScore),
      maxScoreOverride:
        cs.maxScoreOverride === null || cs.maxScoreOverride === undefined
          ? null
          : dec(cs.maxScoreOverride),
      sections,
      globalScores: scoresFor(cs.id, null),
      exempted: exclusions.has(exclusionKey(enrollmentId, cs.id, null)),
    })
  }

  return { subjects, unmapped }
}

/** Raccourci : id de rubrique -> code, depuis une liste { id, code }. */
export function rubricIndex(
  rubrics: { id: string; code: string }[],
): Record<string, string> {
  const map: Record<string, string> = {}
  for (const r of rubrics) map[r.id] = r.code
  return map
}