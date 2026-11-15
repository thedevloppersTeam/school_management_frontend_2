/**
 * Case « Matière d'examen » par MATIÈRE (SPEC-RESULTATS RS-03, RS-06 ; défaut
 * constaté le 2026-11-15 sur une salle à filières ; décision d'Edy du même jour).
 *
 * Dans une salle à filières, une matière d'examen existe en une affectation par
 * filière. La case marque ou démarque TOUTES les affectations de la matière dans
 * la salle, toutes filières confondues : une requête par affectation, sur
 * l'endpoint existant (le serveur journalise chacune). Une salle sans filière a
 * une affectation par matière : un appel d'impact, un appel de mise à jour, comme
 * avant. Ni fetch, ni React : les appels sont injectés.
 */
import type { MarkerImpact } from './markers'

export interface ExamRow {
  id: string
  subjectId: string
  subjectName: string
  /** null = tronc commun. */
  trackCode?: string | null
  isExam: boolean
}

/** Toutes les affectations marquées, aucune, ou une partie (état mixte). */
export type ExamState = 'checked' | 'unchecked' | 'mixed'

export interface ExamGroup<T extends ExamRow = ExamRow> {
  subjectId: string
  label: string
  /** Affectations de la matière dans la salle, dans l'ordre reçu. */
  members: T[]
  marked: number
  state: ExamState
}

/** Groupes par matière, dans l'ordre de première apparition. */
export function examGroups<T extends ExamRow>(rows: T[]): ExamGroup<T>[] {
  const bySubject = new Map<string, T[]>()
  for (const row of rows) {
    const members = bySubject.get(row.subjectId)
    if (members) members.push(row)
    else bySubject.set(row.subjectId, [row])
  }
  return [...bySubject.entries()].map(([subjectId, members]) => {
    const marked = members.filter((m) => m.isExam).length
    const state: ExamState = marked === 0 ? 'unchecked' : marked === members.length ? 'checked' : 'mixed'
    return { subjectId, label: members[0].subjectName, members, marked, state }
  })
}

/** Mention de l'état mixte, ou null. */
export function mixedMention(group: ExamGroup): string | null {
  if (group.state !== 'mixed') return null
  return `marquée sur ${group.marked} filière(s) sur ${group.members.length}`
}

/** Valeur posée par un clic : une case cochée se décoche, une case vide ou indéterminée coche tout. */
export function nextValue(group: ExamGroup): boolean {
  return group.state !== 'checked'
}

/**
 * Affectations à modifier : celles dont le marqueur diffère de la valeur posée.
 * Une affectation déjà à cette valeur n'est pas touchée (le serveur n'y changerait
 * rien et n'écrirait aucune ligne de journal) : ses notes ne sont pas comptées.
 */
export function targets<T extends ExamRow>(group: ExamGroup<T>, next: boolean): T[] {
  return group.members.filter((m) => m.isExam !== next)
}

export interface GroupCalls {
  impact(classSubjectId: string): Promise<MarkerImpact>
  update(classSubjectId: string, next: boolean): Promise<void>
}

/** Notes touchées : somme des impacts, un appel par affectation. Un échec interrompt (rien n'est modifié). */
export async function totalImpact(members: ExamRow[], calls: GroupCalls): Promise<number> {
  let total = 0
  for (const m of members) total += (await calls.impact(m.id)).gradeCount
  return total
}

export interface GroupOutcome<T extends ExamRow = ExamRow> {
  updated: T[]
  failed: Array<{ row: T; error: unknown }>
}

/**
 * Mise à jour de chaque affectation, l'une après l'autre. Un échec n'arrête pas
 * les suivantes et n'est pas rattrapé : il est rendu, pour être nommé à l'écran
 * avant le rechargement de l'état depuis le serveur.
 */
export async function applyToGroup<T extends ExamRow>(members: T[], next: boolean, calls: GroupCalls): Promise<GroupOutcome<T>> {
  const outcome: GroupOutcome<T> = { updated: [], failed: [] }
  for (const row of members) {
    try {
      await calls.update(row.id, next)
      outcome.updated.push(row)
    } catch (error) {
      outcome.failed.push({ row, error })
    }
  }
  return outcome
}

/**
 * Phrase qui nomme les filières non mises à jour, ou null quand aucune affectation
 * en échec ne porte de filière (salle sans filière : message d'erreur inchangé).
 */
export function failureText(label: string, failed: ExamRow[]): string | null {
  if (!failed.some((r) => r.trackCode)) return null
  const names = failed.map((r) => r.trackCode ?? 'tronc commun')
  const which = names.length > 1 ? `les filières ${names.join(', ')}` : `la filière ${names[0]}`
  return `« ${label} » : marqueur non mis à jour pour ${which}. L'état affiché est relu depuis le serveur.`
}
