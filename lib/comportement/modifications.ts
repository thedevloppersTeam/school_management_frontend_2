/**
 * Comportements modifiés et non enregistrés — la règle, sans React (BACKLOG W3).
 *
 * Fonctions PURES, testées seules (`__tests__/modifications.test.ts`). L'onglet
 * Comportement (`components/school/cpmsl-behavior-grid.tsx`) compare ses
 * saisies en cours aux valeurs chargées pour savoir s'il a quelque chose à
 * perdre, comme la grille de saisie des notes le fait pour ses notes.
 *
 * L'unité est l'ÉLÈVE : une fiche modifiée compte pour une, quel que soit le
 * nombre de ses champs touchés. Une fiche remise à l'identique ne compte plus.
 */

/** Forme minimale d'une fiche de comportement en saisie. */
export interface SaisieComportement {
  absences: string
  retards: string
  devoirsManques: string
  leconsNonSues: string
  respectUniforme: string
  discipline: string
  pointsForts: string
  defis: string
  remarque: string
  /** Réponse par attitude : `true`, `false`, ou `null` (non répondu). Absente vaut `null`. */
  attitudeResponses: ReadonlyMap<string, boolean | null>
}

const CHAMPS = [
  'absences',
  'retards',
  'devoirsManques',
  'leconsNonSues',
  'respectUniforme',
  'discipline',
  'pointsForts',
  'defis',
  'remarque',
] as const satisfies ReadonlyArray<keyof SaisieComportement>

const SAISIE_VIDE: SaisieComportement = Object.freeze({
  absences: '',
  retards: '',
  devoirsManques: '',
  leconsNonSues: '',
  respectUniforme: '',
  discipline: '',
  pointsForts: '',
  defis: '',
  remarque: '',
  attitudeResponses: new Map<string, boolean | null>(),
})

const reponse = (m: ReadonlyMap<string, boolean | null>, id: string): boolean | null => m.get(id) ?? null

function attitudesModifiees(
  a: ReadonlyMap<string, boolean | null>,
  b: ReadonlyMap<string, boolean | null>,
): boolean {
  for (const id of new Set([...a.keys(), ...b.keys()])) {
    if (reponse(a, id) !== reponse(b, id)) return true
  }
  return false
}

/**
 * La fiche `courante` diffère-t-elle de la fiche chargée `initiale` ?
 * Comparaison exacte des textes ; une attitude absente vaut « non répondu ».
 * Sans fiche initiale, la comparaison se fait à une fiche vide.
 */
export function saisieModifiee(
  initiale: SaisieComportement | undefined,
  courante: SaisieComportement,
): boolean {
  const ref = initiale ?? SAISIE_VIDE
  for (const champ of CHAMPS) {
    if (ref[champ] !== courante[champ]) return true
  }
  return attitudesModifiees(ref.attitudeResponses, courante.attitudeResponses)
}

/** Nombre d'élèves dont la fiche en cours diffère de la fiche chargée. */
export function compterModifications(
  initiales: ReadonlyMap<string, SaisieComportement>,
  courantes: ReadonlyMap<string, SaisieComportement>,
): number {
  let n = 0
  for (const [enrollmentId, courante] of courantes) {
    if (saisieModifiee(initiales.get(enrollmentId), courante)) n++
  }
  return n
}

/**
 * Valeurs de référence après un enregistrement : chaque fiche effectivement
 * enregistrée devient la nouvelle référence ; les fiches en échec gardent
 * l'ancienne, et restent donc comptées comme modifiées.
 */
export function referencesApresEnregistrement<T extends SaisieComportement>(
  initiales: ReadonlyMap<string, T>,
  enregistrees: ReadonlyMap<string, T>,
): Map<string, T> {
  const next = new Map(initiales)
  for (const [enrollmentId, fiche] of enregistrees) next.set(enrollmentId, fiche)
  return next
}
