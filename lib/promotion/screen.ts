/**
 * Aides d'AFFICHAGE de l'écran de promotion (fonctions pures, sans React).
 *
 * Elles ne décident rien. Le serveur recontrôle chaque règle et sa réponse
 * fait foi : ces fonctions ne servent qu'à montrer le bon champ au bon moment
 * et à ne proposer que les salles que le serveur acceptera. Un écart entre
 * elles et le serveur se voit : le serveur refuse et l'écran affiche SA raison.
 *
 * Aucune moyenne ici : elle arrive du serveur, déjà arrondie (RP-18).
 */
import type { Outcome, PreviewStudent } from '@/lib/api/promotions'

export interface LevelInfo {
  id: string
  name: string
  levelOrder?: number | null
  hasTrack?: boolean
}

export interface SessionInfo {
  id: string
  label: string
  classType: LevelInfo
}

/** Dernier niveau du cursus (NS4 = 13), même constante que le serveur (rules.ts). */
export const LAST_LEVEL_ORDER = 13

const isAdmitted = (o: Outcome) => o === 'ADMIS' || o === 'ADMIS_SOUS_CONDITION'

/** Champs de motif à montrer pour une issue retenue (RP-04, RP-05, RP-09, RP-23). */
export function requiredFields(student: Pick<PreviewStudent, 'proposedOutcome' | 'state'>, finalOutcome: Outcome) {
  return {
    overrideReason: finalOutcome !== student.proposedOutcome && finalOutcome !== 'ADMIS_SOUS_CONDITION',
    conditionText: finalOutcome === 'ADMIS_SOUS_CONDITION',
    unblockReason: student.state === 'blocked',
  }
}

export type Destination =
  | { kind: 'none' } // ADMIS_AILLEURS : aucune inscription N+1 (RP-06)
  | { kind: 'graduate' } // NS4 admis : sortie GRADUATED (RP-20)
  | { kind: 'session'; sessions: SessionInfo[] } // salle à choisir (RP-10, RP-19)

/** Salles de N+1 que le serveur acceptera pour cette issue (RP-19 : +1 exact ou même niveau). */
export function destinationFor(outcome: Outcome, source: LevelInfo, sessionsN1: SessionInfo[]): Destination {
  if (outcome === 'ADMIS_AILLEURS') return { kind: 'none' }
  if (outcome === 'REDOUBLE') {
    return { kind: 'session', sessions: sessionsN1.filter((s) => s.classType.id === source.id) }
  }
  if (source.levelOrder == null) return { kind: 'session', sessions: [] }
  if (source.levelOrder === LAST_LEVEL_ORDER) return { kind: 'graduate' }
  const wanted = source.levelOrder + 1
  return { kind: 'session', sessions: sessionsN1.filter((s) => s.classType.levelOrder === wanted) }
}

/** RP-11b : filière à choisir SEULEMENT à l'entrée dans un niveau à filière (NS2 → NS3). */
export function needsTrackChoice(outcome: Outcome, source: LevelInfo, target: SessionInfo | undefined): boolean {
  return isAdmitted(outcome) && source.hasTrack !== true && target?.classType.hasTrack === true
}

/** Année N+1 telle que le serveur la choisit : la première qui commence après N. */
export function nextYearOf<T extends { id: string; startDate: string }>(years: T[], yearN: T | undefined): T | undefined {
  if (!yearN) return undefined
  return [...years]
    .filter((y) => y.startDate > yearN.startDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
}
