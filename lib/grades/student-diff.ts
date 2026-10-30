/**
 * Saisie par ÉLÈVE (app/admin/academic-year/[yearId]/grades/[enrollmentId]) :
 * écart entre les cases tapées et les notes en base → create / update / delete.
 *
 * Extrait tel quel de la page pour être testé sans React. Seul ajout : une
 * affectation à `accepteNotes === false` (décision du serveur, voir
 * accepte-notes.ts) n'entre jamais dans l'écart — ni création, ni
 * modification, ni suppression. Pour `true` ou un champ absent, le résultat est
 * celui d'avant.
 */
import type { ApiClassSubject, ApiGrade, CreateGradePayload } from '@/lib/api/grades'
import { accepteNotes } from '@/lib/grades/accepte-notes'
import { parseScore } from '@/lib/grades/score-input'

/** Une saisie = valeur tapée + validité (DR-004). */
export interface SaisieCase {
  value: string
  isValid: boolean
  error?: string
}

export interface DiffSaisieEleve {
  toCreate: CreateGradePayload[]
  toUpdate: { gradeId: string; studentScore: number }[]
  toDelete: string[]
}

/** Clé d'une case : classSubjectId (note globale) ou `${classSubjectId}::${sectionId}`. */
export function cleSaisie(classSubjectId: string, sectionId?: string | null): string {
  return sectionId ? `${classSubjectId}::${sectionId}` : classSubjectId
}

export function diffSaisieEleve(args: {
  /** Matières que l'élève peut porter (portée 'all'), filtre d'affichage exclu. */
  subjects: ReadonlyArray<Pick<ApiClassSubject, 'id' | 'subject'> & { accepteNotes?: unknown }>
  entries: ReadonlyMap<string, SaisieCase>
  existingGrades: ReadonlyArray<Pick<ApiGrade, 'id' | 'classSubjectId' | 'sectionId' | 'studentScore'>>
  excludedSections: ReadonlySet<string>
  enrollmentId: string
  stepId: string
}): DiffSaisieEleve {
  const { subjects, entries, existingGrades, excludedSections, enrollmentId, stepId } = args

  const existingByKey = new Map<string, (typeof existingGrades)[number]>()
  for (const g of existingGrades) existingByKey.set(cleSaisie(g.classSubjectId, g.sectionId), g)

  const toCreate: CreateGradePayload[] = []
  const toUpdate: { gradeId: string; studentScore: number }[] = []
  const toDelete: string[] = []

  for (const cs of subjects) {
    // Matière que le serveur déclare non saisissable : lecture seule.
    if (!accepteNotes(cs)) continue
    const hasSections = cs.subject.hasSections && cs.subject.sections.length > 0
    const targets = hasSections
      ? cs.subject.sections.map((sec) => ({ key: cleSaisie(cs.id, sec.id), sectionId: sec.id as string | undefined }))
      : [{ key: cs.id, sectionId: undefined as string | undefined }]

    for (const t of targets) {
      if (t.sectionId && excludedSections.has(t.sectionId)) continue // section dispensée : ignorer
      const entry = entries.get(t.key)
      const existing = existingByKey.get(t.key)
      const raw = entry?.value?.trim() ?? ''

      if (!raw) {
        if (existing) toDelete.push(existing.id) // note effacée = suppression
        continue
      }
      if (!entry?.isValid) continue
      const score = parseScore(raw)
      if (score === null) continue
      if (!existing) {
        toCreate.push({
          enrollmentId,
          classSubjectId: cs.id,
          ...(t.sectionId && { sectionId: t.sectionId }),
          stepId,
          studentScore: score,
          gradeType: 'EXAM',
        })
      } else if (score !== Number(existing.studentScore)) {
        toUpdate.push({ gradeId: existing.id, studentScore: score })
      }
    }
  }
  return { toCreate, toUpdate, toDelete }
}
