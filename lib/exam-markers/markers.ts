/**
 * Marqueurs d'examen — règles d'écran PURES (SPEC-RESULTATS RS-03, RS-06,
 * RS-07 ; décision D3 ; lot M1). Ni fetch, ni React.
 *
 *  - étape « d'examen blanc »          → POST /api/academic-years/steps/update/:id { isExamBlanc }
 *  - affectation « matière d'examen »  → POST /api/class-subjects/update/:id      { isExam }
 *                                        (classes d'examen seulement : niveau is_terminal)
 *  - sous-matière « d'examen »         → POST /api/subjects/sections/update/:id   { isExam }
 *                                        (RÉFÉRENTIEL : toutes les années du niveau)
 *
 * Un marqueur change les composants retenus par le service de résultats, donc
 * les moyennes déjà calculées : confirmation dès que des notes sont touchées.
 */

export type MarkerKind = 'step' | 'classSubject' | 'section'

export interface MarkerChange {
  kind: MarkerKind
  id: string
  /** Libellé lisible : nom de l'étape, de la matière, de la sous-matière. */
  label: string
  next: boolean
}

export interface YearGradeCount {
  academicYearId: string
  yearString: string
  gradeCount: number
}

export interface MarkerImpact {
  gradeCount: number
  /** Sous-matière seulement : notes touchées par année scolaire. */
  byYear?: YearGradeCount[]
}

export interface ExamWarning {
  classSessionId: string
  className: string
  code: 'TERMINAL_SANS_EXAMEN_BLANC' | 'EXAMEN_BLANC_SANS_COMPOSANT' | string
  message: string
}

/** La case « Matière d'examen » n'existe que pour une classe d'examen (niveau is_terminal). */
export function showExamSubjectCheckbox(level: { isTerminal?: boolean } | null | undefined): boolean {
  return level?.isTerminal === true
}

const PARAM: Record<MarkerKind, string> = { step: 'stepId', classSubject: 'classSubjectId', section: 'sectionId' }

export function impactUrl(kind: MarkerKind, id: string): string {
  return `/api/exam-markers/impact?${PARAM[kind]}=${encodeURIComponent(id)}`
}

export function updateRequest(change: Pick<MarkerChange, 'kind' | 'id' | 'next'>): { url: string; body: Record<string, boolean> } {
  const id = encodeURIComponent(change.id)
  if (change.kind === 'step') return { url: `/api/academic-years/steps/update/${id}`, body: { isExamBlanc: change.next } }
  if (change.kind === 'classSubject') return { url: `/api/class-subjects/update/${id}`, body: { isExam: change.next } }
  return { url: `/api/subjects/sections/update/${id}`, body: { isExam: change.next } }
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

/**
 * Texte de la confirmation, ou null quand aucune note n'est touchée (le
 * changement s'applique alors sans confirmation).
 */
export function confirmationText(change: MarkerChange, impact: MarkerImpact): { title: string; body: string; years: string[] } | null {
  if (impact.gradeCount <= 0) return null
  const notes = plural(impact.gradeCount, 'note', 'notes')
  if (change.kind === 'step') {
    return {
      title: change.next ? "Marquer l'étape comme examen blanc ?" : "Retirer le marqueur d'examen blanc ?",
      body:
        `« ${change.label} » est déjà notée (${notes}). Les composants retenus à cette étape changent pour les classes ` +
        `d'examen : leurs moyennes d'étape, de classe et générales changent, bulletins déjà imprimés compris.`,
      years: [],
    }
  }
  if (change.kind === 'classSubject') {
    return {
      title: change.next ? 'Marquer comme matière d\'examen ?' : 'Retirer le marqueur « matière d\'examen » ?',
      body:
        `« ${change.label} » porte déjà ${notes}. La matière ${change.next ? 'ne compte plus' : 'compte de nouveau'} ` +
        `aux étapes ordinaires et ${change.next ? 'compte' : 'ne compte plus'} seule à l'étape d'examen blanc : ` +
        `les moyennes de cette salle changent.`,
      years: [],
    }
  }
  const years = (impact.byYear ?? []).map((y) => `${y.yearString} : ${plural(y.gradeCount, 'note', 'notes')}`)
  return {
    title: change.next ? "Marquer comme sous-matière d'examen ?" : 'Retirer le marqueur « sous-matière d\'examen » ?',
    body:
      `« ${change.label} » appartient au référentiel du niveau : le changement vaut pour TOUTES les années de ce niveau, ` +
      `déjà notées comprises (${notes} au total). Les moyennes de ces années changent, bulletins déjà imprimés compris.`,
    years,
  }
}

/** Bandeau RS-07 en tête du paramétrage de l'année, ou null s'il n'y a rien à signaler. */
export function warningsBanner(warnings: ExamWarning[] | null | undefined): { title: string; lines: string[] } | null {
  if (!warnings || warnings.length === 0) return null
  return {
    title: plural(warnings.length, "avertissement d'examen (RS-07)", "avertissements d'examen (RS-07)"),
    lines: warnings.map((w) => `${w.className} — ${w.message}`),
  }
}
