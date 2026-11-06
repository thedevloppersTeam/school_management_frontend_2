/**
 * Onglet Avancement : filtre, recherche et tri des lignes — la logique, sans
 * React (chantier W2, PR 4, T8 et T9). Testée seule (`__tests__/avancement.test.ts`).
 *
 * Aucune fusion « 1e AF A » ici, pas même comme clé de recherche : la
 * recherche compare la classe et la salle SÉPARÉMENT (DESIGN.md, « Pages de
 * notes »). Le libellé fusionné reste réservé à `getClassSessionName`, hors
 * des pages de notes.
 */
import type { SelectionClasseSalle } from './selection'

export type StatutAvancement = 'complete' | 'in-progress' | 'not-started'

/** Ce qu'il faut d'une ligne pour la filtrer, la chercher et la trier. */
export interface IdentiteLigneAvancement {
  sessionId: string
  /** `ClassType.id`. */
  classeId: string
  /** Nom de la classe, ex. « 1e AF ». */
  classe: string
  /** Lettre de la salle, ex. « A ». Chaîne vide si la salle n'en a pas. */
  salle: string
  /** Rang dans le cursus ; `null` si le niveau n'est pas ordonné. */
  levelOrder: number | null
  status: StatutAvancement
}

/** Minuscules, accents retirés, espaces réduits : « 1ère  AF » → « 1ere af ». */
export function normaliserRecherche(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * La ligne répond-elle à la recherche ? Règles, après normalisation :
 * - recherche vide : oui ;
 * - UN seul caractère : seule la SALLE est comparée (« A » trouve les salles
 *   A, pas les classes « AF ») — décision d'Edy du 2026-11-06 ;
 * - sinon : la salle est égale à la recherche, OU la classe la contient, OU la
 *   recherche est « X Y » avec une classe qui contient X et une salle égale à Y
 *   (« 1e AF A »).
 */
export function ligneCorrespondRecherche(
  recherche: string,
  ligne: Pick<IdentiteLigneAvancement, 'classe' | 'salle'>,
): boolean {
  const q = normaliserRecherche(recherche)
  if (q === '') return true
  const classe = normaliserRecherche(ligne.classe)
  const salle = normaliserRecherche(ligne.salle)
  if (q.length === 1) return salle === q
  if (salle === q) return true
  if (classe.includes(q)) return true
  const espace = q.lastIndexOf(' ')
  if (espace > 0) {
    const partieClasse = q.slice(0, espace)
    const partieSalle = q.slice(espace + 1)
    return salle === partieSalle && classe.includes(partieClasse)
  }
  return false
}

/**
 * Filtre Classe puis Salle (mode « filtre » de ClasseSalleSelect) : `null`
 * vaut « Toutes ». Ne garde que les lignes de la classe, puis de la salle choisies.
 */
export function filtrerParClasseSalle<T extends Pick<IdentiteLigneAvancement, 'classeId' | 'sessionId'>>(
  lignes: readonly T[],
  filtre: SelectionClasseSalle,
): T[] {
  return lignes.filter(
    (l) =>
      (filtre.classeId === null || l.classeId === filtre.classeId) &&
      (filtre.sessionId === null || l.sessionId === filtre.sessionId),
  )
}

const RANG_STATUT: Record<StatutAvancement, number> = { 'not-started': 0, 'in-progress': 1, complete: 2 }

const comparerNoms = (a: string, b: string) => a.localeCompare(b, 'fr', { numeric: true })

/**
 * Ordre du tableau : statut (non commencé, en cours, complet), puis ordre du
 * cursus (`levelOrder` ; les niveaux sans rang en fin, par nom), puis salle.
 * L'ordre ne dépend plus de la réponse du serveur.
 */
export function comparerLignesAvancement(a: IdentiteLigneAvancement, b: IdentiteLigneAvancement): number {
  const statut = RANG_STATUT[a.status] - RANG_STATUT[b.status]
  if (statut !== 0) return statut
  if (a.levelOrder !== null && b.levelOrder !== null && a.levelOrder !== b.levelOrder) {
    return a.levelOrder - b.levelOrder
  }
  if (a.levelOrder !== null && b.levelOrder === null) return -1
  if (a.levelOrder === null && b.levelOrder !== null) return 1
  return (
    comparerNoms(a.classe, b.classe) ||
    comparerNoms(a.salle, b.salle) ||
    comparerNoms(a.sessionId, b.sessionId)
  )
}
