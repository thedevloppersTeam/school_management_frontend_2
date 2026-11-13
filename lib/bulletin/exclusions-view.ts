/**
 * Lecture, pour les ecrans de saisie, des dispenses renvoyees par
 * GET /api/enrollments/excluded-sections.
 *
 * Une ligne a `sectionId === null` est une dispense de la MATIERE ENTIERE pour
 * (inscription, matiere, etape) — decision E1, DECISIONS.md D-48. Elle
 * l'emporte sur les dispenses de sous-matieres et sur une note saisie : la
 * note reste en base (reprise 2024-2025) mais ne compte pas.
 *
 * `buildExclusionSet` (from-api.ts) rend un ensemble plat de cles pour le
 * calcul ; les ecrans de saisie ont besoin de la forme inverse (qui est
 * dispense de quoi), d'ou ces fonctions. Elles ne calculent aucune moyenne.
 */

export interface LigneDispense {
  enrollmentId: string
  /** NULL possible pour d'anciennes lignes de sous-matiere (CALCUL-BULLETIN § 5). */
  classSubjectId: string | null
  /** NULL = dispense de la matiere entiere. */
  sectionId: string | null
}

/** Dispenses d'UNE matiere a l'etape affichee, par inscription. */
export interface DispensesDeLaMatiere {
  /** Inscriptions dispensees de la matiere entiere. */
  matiereEntiere: ReadonlySet<string>
  /** Par inscription, les sous-matieres dispensees (chaines seulement). */
  sousMatieres: ReadonlyMap<string, ReadonlySet<string>>
}

export const DISPENSES_VIDES: DispensesDeLaMatiere = {
  matiereEntiere: new Set(),
  sousMatieres: new Map(),
}

const AUCUNE_SOUS_MATIERE: ReadonlySet<string> = new Set()

/** Ne garde que les lignes de `classSubjectId`. */
export function dispensesDeLaMatiere(
  rows: readonly LigneDispense[],
  classSubjectId: string,
): DispensesDeLaMatiere {
  const matiereEntiere = new Set<string>()
  const sousMatieres = new Map<string, Set<string>>()
  for (const r of rows) {
    if (r.classSubjectId !== classSubjectId) continue
    if (r.sectionId === null) {
      matiereEntiere.add(r.enrollmentId)
      continue
    }
    const set = sousMatieres.get(r.enrollmentId) ?? new Set<string>()
    set.add(r.sectionId)
    sousMatieres.set(r.enrollmentId, set)
  }
  return { matiereEntiere, sousMatieres }
}

export function sousMatieresDispensees(
  vue: DispensesDeLaMatiere,
  enrollmentId: string,
): ReadonlySet<string> {
  return vue.sousMatieres.get(enrollmentId) ?? AUCUNE_SOUS_MATIERE
}

/**
 * Apres enregistrement des sous-matieres d'un eleve : remplace ses
 * sous-matieres, sans toucher a la dispense de matiere entiere (le serveur la
 * conserve quand `wholeSubject` est absent, Q2 option B de D-48).
 */
export function avecSousMatieres(
  vue: DispensesDeLaMatiere,
  enrollmentId: string,
  sectionIds: readonly string[],
): DispensesDeLaMatiere {
  const sousMatieres = new Map(vue.sousMatieres)
  sousMatieres.set(enrollmentId, new Set(sectionIds))
  return { matiereEntiere: vue.matiereEntiere, sousMatieres }
}

/** Eleves attendus au compteur « X / Y » : sans les dispenses de matiere entiere. */
export function elevesAttendus<T extends { id: string }>(
  enrollments: readonly T[],
  matiereEntiere: ReadonlySet<string>,
): T[] {
  return enrollments.filter((e) => !matiereEntiere.has(e.id))
}

/**
 * Corps de POST /api/enrollments/:id/excluded-sections pour la fenetre des
 * sous-matieres : chaines seulement, jamais `wholeSubject` (geste E31, hors de
 * ce lot). Sans `wholeSubject`, le serveur conserve la dispense de matiere.
 */
export function corpsDispensesSousMatieres(
  classSubjectId: string,
  stepId: string,
  brouillon: Iterable<string | null>,
): { classSubjectId: string; stepId: string; sectionIds: string[] } {
  const sectionIds = [...new Set(brouillon)].filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  )
  return { classSubjectId, stepId, sectionIds }
}

/**
 * Dispenses d'UN eleve, toutes matieres, pour la saisie par eleve.
 *
 * Les sous-matieres sont rendues par `sectionId` seul, comme avant ce lot :
 * le defaut « cle sans la matiere » (tronc commun / filiere partageant les
 * memes sous-matieres) n'est pas corrige ici.
 */
export function dispensesDeLEleve(
  rows: readonly LigneDispense[],
  enrollmentId: string,
): { matieresEntieres: ReadonlySet<string>; sousMatieres: ReadonlySet<string> } {
  const matieresEntieres = new Set<string>()
  const sousMatieres = new Set<string>()
  for (const r of rows) {
    if (r.enrollmentId !== enrollmentId) continue
    if (r.sectionId !== null) sousMatieres.add(r.sectionId)
    else if (r.classSubjectId !== null) matieresEntieres.add(r.classSubjectId)
  }
  return { matieresEntieres, sousMatieres }
}

/**
 * Valeur affichee dans le champ d'une sous-matiere : la note d'une matiere
 * dispensee entiere reste visible (grisee) ; une sous-matiere dispensee seule
 * reste vide, comme avant ce lot.
 */
export function valeurSousMatiere(
  value: string | undefined,
  matiereDispensee: boolean,
  sousMatiereDispensee: boolean,
): string {
  if (matiereDispensee) return value ?? ''
  if (sousMatiereDispensee) return ''
  return value ?? ''
}

// ── Lecture des dispenses : un echec n'est pas « aucune dispense » ──────────

export type LectureDispenses<T> = { ok: true; rows: T[] } | { ok: false }

export const MESSAGE_DISPENSES_INDISPONIBLES =
  "Les dispenses n'ont pas pu être chargées : moyennes non calculées. Réessayez."

/** Variante de la grille de saisie, qui ne calcule pas de moyenne. */
export const MESSAGE_DISPENSES_INDISPONIBLES_SAISIE =
  "Les dispenses n'ont pas pu être chargées : saisie bloquée pour éviter une erreur. Réessayez."

/**
 * Etat de la grille par matiere apres la lecture des dispenses. En echec, les
 * dispenses sont INCONNUES : la saisie est bloquee (aucune case, aucun
 * enregistrement, aucune modification des dispenses), au lieu de laisser
 * saisir comme s'il n'y en avait aucune.
 */
export function etatDispensesDeLaMatiere(
  lecture: LectureDispenses<LigneDispense>,
  classSubjectId: string,
): { dispenses: DispensesDeLaMatiere; saisieBloquee: boolean } {
  if (!lecture.ok) return { dispenses: DISPENSES_VIDES, saisieBloquee: true }
  return { dispenses: dispensesDeLaMatiere(lecture.rows, classSubjectId), saisieBloquee: false }
}

/**
 * Distingue une lecture echouee d'une liste vide. Calculer une moyenne sur
 * une liste vide « par defaut » ferait entrer les notes dispensees (D-04).
 */
export async function lireDispenses<T>(charger: () => Promise<T[]>): Promise<LectureDispenses<T>> {
  try {
    const rows = await charger()
    return Array.isArray(rows) ? { ok: true, rows } : { ok: false }
  } catch {
    return { ok: false }
  }
}
