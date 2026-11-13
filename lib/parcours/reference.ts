/**
 * Page « Parcours » — étape de référence d'une inscription (lot B, D-03).
 *
 * L'appel `GET /api/results` se fait à UNE étape par inscription : la réponse
 * contient alors toutes les étapes de numéro ≤ cette étape et l'annuelle
 * calculée sur elles (serveur, src/lib/results/build.ts:288-290). Règle
 * décidée par Edy (2026-11-13), alignée sur le relevé (lib/releve/compute.ts,
 * resolveSteps) par le statut de `deriveAcademicYearStatus`
 * (lib/academic-years/status.ts:32-50) :
 *  - 'archived'    : dernière étape ;
 *  - 'active'      : l'étape en cours (`AcademicYearStep.isCurrent`) ; sans
 *                    étape en cours, AUCUN appel ;
 *  - 'preparation' : AUCUN appel.
 *
 * Mêmes conventions que le relevé : étapes triées par numéro, étape en cours
 * lue du seul `isCurrent` (la première dans l'ordre des numéros si la base en
 * portait plusieurs), étape d'examen blanc traitée comme les autres.
 * « Dernière étape » = le numéro d'étape le plus haut.
 */
import { deriveAcademicYearStatus } from '@/lib/academic-years/status'

export interface EtapeAnnee {
  id: string
  name: string
  stepNumber: number
  isCurrent: boolean
  isExamBlanc?: boolean
}

export interface AnneeAvecEtapes {
  id: string
  isCurrent: boolean
  endDate: string
  steps?: EtapeAnnee[] | null
}

export type Reference =
  | { kind: 'etape'; etape: EtapeAnnee }
  /** Année sans aucune étape : rien à demander. */
  | { kind: 'sans-etape' }
  /** Année courante sans étape marquée en cours. */
  | { kind: 'aucune-etape-en-cours' }
  /** Année en préparation (ni courante, ni terminée). */
  | { kind: 'en-preparation' }

/** Étapes de l'année triées par numéro, sans modifier l'entrée. */
export function etapesTriees(etapes: EtapeAnnee[] | null | undefined): EtapeAnnee[] {
  return [...(etapes ?? [])].sort((a, b) => a.stepNumber - b.stepNumber)
}

/** Étape à demander au service de résultats, ou la raison de ne rien demander. */
export function etapeDeReference(
  annee: Pick<AnneeAvecEtapes, 'isCurrent' | 'endDate'>,
  etapes: EtapeAnnee[] | null | undefined,
  maintenant: Date = new Date(),
): Reference {
  const statut = deriveAcademicYearStatus({ isCurrent: annee.isCurrent, endDate: annee.endDate }, maintenant)
  if (statut === 'preparation') return { kind: 'en-preparation' }
  const triees = etapesTriees(etapes)
  if (statut === 'active') {
    const enCours = triees.find((s) => s.isCurrent)
    return enCours ? { kind: 'etape', etape: enCours } : { kind: 'aucune-etape-en-cours' }
  }
  if (triees.length === 0) return { kind: 'sans-etape' }
  return { kind: 'etape', etape: triees[triees.length - 1] }
}
