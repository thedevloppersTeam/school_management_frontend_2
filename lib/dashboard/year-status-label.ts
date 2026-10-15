/**
 * Libellé du statut de l'année sur la carte « Année scolaire active » du
 * tableau de bord.
 *
 * Fonction PURE, sans React ni fetch.
 *
 * La RÈGLE vient de `deriveAcademicYearStatus` (lib/academic-years/status.ts),
 * seule source du statut d'une année : ce module ne fait que la traduire.
 * Libellés repris de `CPMSLYearCard` (components/school/cpmsl-year-card.tsx),
 * pour qu'une même année porte le même mot partout.
 *
 * L'année du tableau de bord vient de `/api/academic-years/current`, qui ne
 * renvoie qu'une année `isCurrent` : en pratique le libellé est « Active ».
 * « En préparation » et « Archivée » ne paraîtraient que sur une réponse hors
 * contrat — mieux vaut alors dire ce que la règle constate que d'afficher
 * « Active » par défaut.
 *
 * Sans année : « À faire », libellé inchangé. Ce n'est pas un statut d'année,
 * c'est l'absence d'année.
 */
import {
  deriveAcademicYearStatus,
  type AcademicYearStatus,
  type AcademicYearStatusInput,
} from '../academic-years/status'

const LIBELLES: Record<AcademicYearStatus, string> = {
  active: 'Active',
  preparation: 'En préparation',
  archived: 'Archivée',
}

export const LIBELLE_SANS_ANNEE = 'À faire'

export function yearStatusLabel(year: AcademicYearStatusInput | null, maintenant?: Date): string {
  if (!year) return LIBELLE_SANS_ANNEE
  return LIBELLES[deriveAcademicYearStatus(year, maintenant)]
}
