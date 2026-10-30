/**
 * Saisissabilité d'une affectation (classe × matière), telle que le SERVEUR
 * la décide.
 *
 * `GET /api/class-subjects` renvoie, pour chaque affectation, un booléen
 * `accepteNotes` : « une note peut-elle compter pour un élève de la portée de
 * cette affectation ». Le serveur refuse la création d'une note sur une
 * affectation à `false` (codes NOTE_FILIERE_HORS_CLASSE_EXAMEN et
 * LOT_FILIERE_HORS_CLASSE_EXAMEN, lot entier refusé).
 *
 * Le frontend n'en recopie PAS la règle (ADR-007 : il affiche, il ne décide
 * pas) : il ne lit ni le type de classe ni la filière pour savoir si une case
 * est saisissable, seulement ce champ.
 */

/** Infobulle d'une matière non saisissable. Texte exact, ne pas reformuler. */
export const MESSAGE_FILIERE_HORS_CLASSE = 'Matière de filière : ne compte pas dans cette classe'

/**
 * Lecteur tolérant du champ `accepteNotes`.
 *
 * - `false` → `false` : seule valeur qui retire la saisie ;
 * - `true` → `true` ;
 * - absent (`undefined`, ancien serveur qui n'envoie pas le champ) ou `null`
 *   → `true` : c'est le comportement d'avant le champ ;
 * - toute autre valeur (chaîne, nombre, objet) → `true`.
 *
 * Pourquoi une valeur illisible vaut `true` et non `false` : le serveur reste
 * le seul garde. Une case saisie à tort sur une affectation qu'il refuse est
 * rejetée par lui avec un code nommé, visible dans le bandeau d'échec ; rien
 * n'est écrit en silence. À l'inverse, lire `false` sur une valeur inattendue
 * figerait toute la grille d'une salle sur un simple écart de format, sans
 * recours pour l'utilisateur. On ne devine pas non plus « "false" » ou `0` :
 * le contrat est un booléen JSON, une conversion maison serait une règle de
 * plus côté frontend.
 */
export function normaliserAccepteNotes(raw: unknown): boolean {
  return raw !== false
}

/** Une affectation est-elle saisissable ? `accepteNotes` absent = oui. */
export function accepteNotes(cs: { accepteNotes?: unknown }): boolean {
  return normaliserAccepteNotes(cs.accepteNotes)
}

// ── Filet avant l'enregistrement ─────────────────────────────────────────────

interface OperationsDeSaisie<C extends { classSubjectId: string }, U extends { gradeId: string }> {
  toCreate: C[]
  toUpdate: U[]
  toDelete: string[]
}

/**
 * Retire d'un lot d'opérations toute écriture qui vise une affectation non
 * saisissable : création (par `classSubjectId`), modification et suppression
 * (par l'affectation de la note existante, retrouvée dans `existingGrades`).
 *
 * Les écrans rendent déjà ces cases non éditables ; ce filtre garantit qu'une
 * valeur restée en mémoire (collage, état antérieur à un rechargement) ne
 * parte jamais. Une note dont l'affectation est inconnue n'est pas retirée :
 * on ne bloque que sur un `false` explicite du serveur.
 */
export function retirerOperationsNonSaisissables<
  C extends { classSubjectId: string },
  U extends { gradeId: string },
>(
  ops: OperationsDeSaisie<C, U>,
  classSubjects: ReadonlyArray<{ id: string; accepteNotes?: unknown }>,
  existingGrades: ReadonlyArray<{ id: string; classSubjectId: string }>,
): OperationsDeSaisie<C, U> {
  const fermees = new Set(classSubjects.filter((cs) => !accepteNotes(cs)).map((cs) => cs.id))
  if (fermees.size === 0) return ops
  const affectationDe = new Map(existingGrades.map((g) => [g.id, g.classSubjectId]))
  const vise = (gradeId: string) => {
    const csId = affectationDe.get(gradeId)
    return csId !== undefined && fermees.has(csId)
  }
  return {
    toCreate: ops.toCreate.filter((c) => !fermees.has(c.classSubjectId)),
    toUpdate: ops.toUpdate.filter((u) => !vise(u.gradeId)),
    toDelete: ops.toDelete.filter((id) => !vise(id)),
  }
}
