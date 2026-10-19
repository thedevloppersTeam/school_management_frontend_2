/**
 * Adaptateur PUR : réponse du service de résultats → champs chiffrés de
 * BulletinData (SPEC-RESULTATS lot L3). Ni fetch, ni React, ni calcul.
 *
 * Le bulletin n'a plus de règle propre :
 *  - lignes et barèmes imprimés : ceux du service (D2 : seuls les composants
 *    retenus à l'étape ; total imprimé = dénominateur calculé). Fin de la
 *    règle de repli `override ?? max_score` du bulletin ;
 *  - moyennes de rubrique, d'étape, de classe, générale : valeurs EXACTES du
 *    service, arrondies ICI par formatAverage, au moment de l'affichage ;
 *  - élève transféré ou retiré (D-17) : bulletin généré comme les autres, le
 *    statut n'est pas lu ici ; la moyenne de classe imprimée est celle du
 *    service, calculée sur les seuls élèves ACTIVE + GRADUATED ;
 *  - une dispense n'a pas de ligne (le service ne l'imprime pas) ; une note
 *    manquante a `note: null`, que le gabarit imprime en trait, comme avant.
 *
 * Le type BulletinData et le gabarit (components/BulletinScolaire.tsx,
 * components/school/bulletin-printable.tsx) sont INCHANGÉS.
 */
import Decimal from 'decimal.js'
import type { BulletinData, RubriqueEntry } from '@/components/BulletinScolaire'
import { getBulletinAppreciation } from '@/lib/bulletin-calculations'
import { formatAverage } from '@/lib/bulletin/compute'
import type { DecimalString, PrintLine, RoomResults, RubriqueCode } from '@/lib/api/results'

/**
 * Inscription ABSENTE de la réponse du service (elle n'appartient pas à cette
 * salle). Jamais levée pour un statut : depuis D-17, le service renvoie aussi
 * les élèves transférés ou retirés, qui ont leurs bulletins.
 */
export class StudentNotInResultsError extends Error {
  constructor() {
    super(
      "Résultats indisponibles pour cette inscription : elle est absente des résultats de la salle " +
      '(inscription d\'une autre salle ?). Le bulletin n\'est pas généré.',
    )
    this.name = 'StudentNotInResultsError'
  }
}

const dec = (v: DecimalString | null | undefined): Decimal | null => (v === null || v === undefined ? null : new Decimal(v))
const num = (v: DecimalString | null | undefined): number | null => (v === null || v === undefined ? null : new Decimal(v).toNumber())

/** Ligne du service → entrée du gabarit, à la forme exacte qu'il recevait. */
export function toRubriqueEntry(line: PrintLine): RubriqueEntry {
  // Ligne mère d'une matière dépliée : ni note ni barème (forme historique).
  if (line.isParent) return { name: line.name, isParent: true }
  return {
    name: line.name,
    note: num(line.note),
    coeff: line.maxScore === null ? undefined : new Decimal(line.maxScore).toNumber(),
    isParent: false,
  }
}

export type BulletinFigures = Pick<
  BulletinData,
  | 'rubrique1' | 'moyR1' | 'moyR1Texte' | 'moyClasseR1' | 'moyClasseR1Texte'
  | 'rubrique2' | 'moyR2' | 'moyR2Texte' | 'moyClasseR2' | 'moyClasseR2Texte'
  | 'rubrique3' | 'moyR3' | 'moyR3Texte' | 'moyClasseR3' | 'moyClasseR3Texte'
  | 'moyenneEtape' | 'appreciation' | 'moyenneClasse' | 'moyenneGenerale'
>

/**
 * Chiffres d'un bulletin.
 * @param step       résultats de la salle à l'étape du bulletin (portée du document)
 * @param general    résultats servant à la moyenne générale (même réponse, ou celle
 *                   de la portée « all » pour le bulletin d'examen) ; absent = pas de moyenne générale
 * @param backendMoyenneClasse  moyenne de classe déjà fournie par le profil élève, prioritaire (historique)
 */
export function bulletinFiguresFromResults(params: {
  step: RoomResults
  general?: RoomResults
  enrollmentId: string
  stepId: string
  backendMoyenneClasse?: string
}): BulletinFigures {
  const student = params.step.students.find((s) => s.enrollmentId === params.enrollmentId)
  if (!student) throw new StudentNotInResultsError()
  const st = student.steps.find((s) => s.stepId === params.stepId)
  if (!st) throw new Error(`Étape ${params.stepId} absente des résultats de l'élève.`)

  const rub = (code: RubriqueCode) => st.rubriques[code]?.average ?? null
  const lines = (code: RubriqueCode) => (st.print[code]?.lines ?? []).map(toRubriqueEntry)
  const classe = params.step.classAverages.all

  const moyenneEtapeExact = dec(st.averageOrNull)
  const moyenneClasse =
    params.backendMoyenneClasse && params.backendMoyenneClasse !== '—'
      ? params.backendMoyenneClasse
      : formatAverage(dec(classe.step))

  let moyenneGenerale: string | undefined
  if (params.general) {
    const g = params.general.students.find((s) => s.enrollmentId === params.enrollmentId)
    if (!g) throw new StudentNotInResultsError()
    moyenneGenerale = formatAverage(dec(g.annual))
  }

  return {
    rubrique1: lines('R1'),
    moyR1: num(rub('R1')),
    moyR1Texte: formatAverage(dec(rub('R1'))),
    moyClasseR1: num(classe.rubriques.R1),
    moyClasseR1Texte: formatAverage(dec(classe.rubriques.R1)),

    rubrique2: lines('R2'),
    moyR2: num(rub('R2')),
    moyR2Texte: formatAverage(dec(rub('R2'))),
    moyClasseR2: num(classe.rubriques.R2),
    moyClasseR2Texte: formatAverage(dec(classe.rubriques.R2)),

    rubrique3: lines('R3'),
    moyR3: num(rub('R3')),
    moyR3Texte: formatAverage(dec(rub('R3'))),
    moyClasseR3: num(classe.rubriques.R3),
    moyClasseR3Texte: formatAverage(dec(classe.rubriques.R3)),

    moyenneEtape: formatAverage(moyenneEtapeExact),
    // Même seuils qu'avant, sur la même valeur (moyenne d'étape, ou null si vide).
    appreciation: getBulletinAppreciation(moyenneEtapeExact === null ? null : moyenneEtapeExact.toNumber()),
    moyenneClasse,
    moyenneGenerale,
  }
}
