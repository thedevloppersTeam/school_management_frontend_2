/**
 * Page « Parcours » — lecture des moyennes calculées par le serveur (lot B, D-03).
 *
 * Fonctions PURES : ni React, ni DOM, ni calcul. Le serveur calcule
 * (`GET /api/results`, ADR-007) ; ces fonctions retrouvent l'élève dans la
 * réponse de la salle, choisissent les champs à afficher et les mettent en
 * forme. Aucun chiffre de repli : une réponse absente ou en échec s'affiche
 * comme telle.
 */
import Decimal from 'decimal.js'
import { formatAverage } from '@/lib/bulletin/compute'
import type {
  DecimalString,
  EntryState,
  ResultStep,
  ResultStepUnavailable,
  ResultStudent,
  RoomResults,
} from '@/lib/api/results'
import { etapeDeReference, type AnneeAvecEtapes, type EtapeAnnee } from './reference'

const TIRET = '—'

// ── Mise en forme ─────────────────────────────────────────────────────────────

/**
 * Moyenne /10 du service → texte. Même arrondi que le bulletin
 * (`formatAverage`, 2 décimales, lib/bulletin/from-results.ts:144), virgule
 * décimale comme le reste de cet écran. null → « — ».
 */
export function formatMoyenne(value: DecimalString | null | undefined): string {
  if (value === null || value === undefined) return TIRET
  return formatAverage(new Decimal(value)).replace('.', ',')
}

/** Note ou barème exact du service → texte à virgule, sans zéro inutile (« 40 », « 12,5 »). */
export function formatValeur(value: DecimalString | null | undefined): string {
  if (value === null || value === undefined) return TIRET
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString().replace('.', ',')
}

/**
 * Valeur à passer à `scoreTone` / `gradeBand`, qui attendent un POURCENTAGE
 * (lib/bulletin/grade-color.ts) : moyenne /10 × 10, valeur exacte comme le
 * bulletin (`colorClass(moy, 10)`). null → null (aucune teinte).
 */
export function pourcentageDeBande(value: DecimalString | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return new Decimal(value).times(10).toNumber()
}

// ── Élève dans la réponse de la salle ─────────────────────────────────────────

export type ResultatEleve =
  | { kind: 'trouve'; eleve: ResultStudent }
  /** Inscription absente de la réponse : cas à signaler, jamais remplacé par un calcul. */
  | { kind: 'absent' }

export function resultatDeLEleve(reponse: RoomResults, enrollmentId: string): ResultatEleve {
  const eleve = reponse.students.find((s) => s.enrollmentId === enrollmentId)
  return eleve ? { kind: 'trouve', eleve } : { kind: 'absent' }
}

// ── Chargement : un appel par inscription ─────────────────────────────────────

export interface InscriptionAParcourir {
  id: string
  classSessionId: string
  academicYearId: string
}

export type MoyennesAnnee =
  | { kind: 'ok'; eleve: ResultStudent; reference: EtapeAnnee }
  /** Appel en échec (ou étapes de l'année illisibles) : « Moyennes indisponibles ». */
  | { kind: 'echec' }
  /** Réponse reçue, mais l'inscription n'y figure pas. */
  | { kind: 'absent' }
  /** L'année n'a aucune étape : rien à demander. */
  | { kind: 'sans-etape' }
  /** Année courante sans étape en cours : aucun appel. */
  | { kind: 'aucune-etape-en-cours' }
  /** Année en préparation : aucun appel. */
  | { kind: 'en-preparation' }

export type FetchResultats = (classSessionId: string, stepId: string) => Promise<RoomResults>

/**
 * Moyennes de chaque inscription : au plus UN appel au service par
 * inscription, à son étape de référence (jamais un par étape), et aucun quand
 * `etapeDeReference` ne rend pas d'étape. `annees` null = la liste des années
 * n'a pas pu être lue : toutes les inscriptions sont en échec.
 */
export async function chargerMoyennes(
  inscriptions: InscriptionAParcourir[],
  annees: AnneeAvecEtapes[] | null,
  fetchResultats: FetchResultats,
  maintenant: Date = new Date(),
): Promise<Map<string, MoyennesAnnee>> {
  const parId = new Map((annees ?? []).map((a) => [a.id, a]))
  const entrees = await Promise.all(
    inscriptions.map(async (e): Promise<[string, MoyennesAnnee]> => {
      const annee = parId.get(e.academicYearId)
      if (!annee) return [e.id, { kind: 'echec' }]
      const ref = etapeDeReference(annee, annee.steps, maintenant)
      if (ref.kind !== 'etape') return [e.id, { kind: ref.kind }]
      const reference = ref.etape
      try {
        const reponse = await fetchResultats(e.classSessionId, reference.id)
        const trouve = resultatDeLEleve(reponse, e.id)
        return [e.id, trouve.kind === 'trouve' ? { kind: 'ok', eleve: trouve.eleve, reference } : { kind: 'absent' }]
      } catch {
        return [e.id, { kind: 'echec' }]
      }
    }),
  )
  return new Map(entrees)
}

// ── Cartes d'étape ────────────────────────────────────────────────────────────

export interface CarteEtape {
  stepId: string
  stepName: string
  stepNumber: number
  /** Étape dispensée pour l'élève : hors annuelle (RS-01). */
  exempted: boolean
  /** `averageOrNull` mis en forme, « — » s'il est null. */
  moyenne: string
  /** Pourcentage pour la teinte, null = aucune teinte. */
  bande: number | null
}

/**
 * Cartes d'étape = `steps[]` de la réponse, dans l'ordre des numéros. Pour un
 * élève parti, le service n'y met que les étapes suivies (RS-09).
 */
export function cartesEtapes(eleve: ResultStudent, nomsEtapes: Map<string, string>): CarteEtape[] {
  return [...eleve.steps]
    .sort((a, b) => a.stepNumber - b.stepNumber)
    .map((s) => ({
      stepId: s.stepId,
      stepName: nomsEtapes.get(s.stepId) ?? `Étape ${s.stepNumber}`,
      stepNumber: s.stepNumber,
      exempted: s.exempted,
      moyenne: s.exempted ? TIRET : formatMoyenne(s.averageOrNull),
      bande: s.exempted ? null : pourcentageDeBande(s.averageOrNull),
    }))
}

export interface MoyenneAnnuelle {
  texte: string
  bande: number | null
}

/** « Moy. générale » de l'année = `annual` du service. */
export function moyenneAnnuelle(eleve: ResultStudent): MoyenneAnnuelle {
  return { texte: formatMoyenne(eleve.annual), bande: pourcentageDeBande(eleve.annual) }
}

/** Départ : motif du service quand l'étape de référence est postérieure au départ (RS-09). */
export function indisponibilite(eleve: ResultStudent): ResultStepUnavailable | null {
  return eleve.unavailable
}

// ── Cellules de la grille ─────────────────────────────────────────────────────

export type EtatCellule = EntryState | 'hors-calcul'

export interface CelluleMatiere {
  etat: EtatCellule
  /** Note retenue par le serveur (numérateur), « — » si manquante, dispensée ou hors calcul. */
  note: string
  /** Barème retenu (dénominateur), null si dispensée ou hors calcul. */
  bareme: string | null
  /** Pourcentage pour la teinte, null si aucune note retenue. */
  bande: number | null
}

const stepDe = (eleve: ResultStudent, stepId: string): ResultStep | undefined =>
  eleve.steps.find((s) => s.stepId === stepId)

/**
 * Total d'une matière à une étape, lu au serveur et rapproché par
 * `classSubjectId`. Une matière absente de la réponse (hors portée RS-03,
 * rubrique non rattachée, hors vigueur) est « hors calcul ».
 */
export function celluleMatiere(eleve: ResultStudent, stepId: string, classSubjectId: string): CelluleMatiere {
  const subject = stepDe(eleve, stepId)?.subjects.find((s) => s.classSubjectId === classSubjectId)
  if (!subject) return { etat: 'hors-calcul', note: TIRET, bareme: null, bande: null }
  if (subject.state === 'exempted') return { etat: 'exempted', note: TIRET, bareme: null, bande: null }
  const bareme = formatValeur(subject.denominator)
  if (subject.state === 'missing') return { etat: 'missing', note: TIRET, bareme, bande: null }
  const den = new Decimal(subject.denominator)
  const bande = den.isZero() ? null : new Decimal(subject.numerator).dividedBy(den).times(100).toNumber()
  return { etat: 'noted', note: formatValeur(subject.numerator), bareme, bande }
}

/** État d'une sous-matière à une étape selon le serveur ; « hors calcul » si elle n'y figure pas. */
export function etatSousMatiere(
  eleve: ResultStudent,
  stepId: string,
  classSubjectId: string,
  sectionId: string,
): EtatCellule {
  const subject = stepDe(eleve, stepId)?.subjects.find((s) => s.classSubjectId === classSubjectId)
  if (!subject) return 'hors-calcul'
  if (subject.state === 'exempted') return 'exempted'
  return subject.sections.find((s) => s.sectionId === sectionId)?.state ?? 'hors-calcul'
}
