/**
 * Ce que le calendrier du tableau de bord a le droit d'affirmer sur un jour ou
 * un mois.
 *
 * Fonctions PURES, sans React ni fetch.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 * « Aucun jour férié » est une AFFIRMATION. Elle n'est permise que si la liste
 * a été lue (`ready`) et seulement pour une période couverte par l'année
 * active — le serveur ne renvoie que les jours fériés de cette année. Sinon :
 *  - période hors de l'année active → « hors de la période de « <nom> » : non
 *    chargé » ;
 *  - lecture en cours → « chargement… » ;
 *  - lecture échouée → « jours fériés indisponibles » ;
 *  - plage de l'année illisible → on ne sait pas ce qui est couvert, on le dit.
 *
 * « Hors de l'année » prime sur le chargement et l'erreur : pour cette période,
 * aucune donnée ne viendra de toute façon, et c'est vrai dans tous les états.
 *
 * Une période qui chevauche l'année (premier ou dernier mois) est traitée
 * comme couverte : son décompte porte sur ses jours inclus dans l'année.
 */
import { civilFromApi } from './dates'

export type HolidaysLoad = 'loading' | 'error' | 'ready'

export interface HolidayCoverageInput {
  load: HolidaysLoad
  /** Période interrogée, dates civiles `YYYY-MM-DD`, bornes incluses. */
  period: { from: string; to: string }
  /** Année active telle que lue (AcademicYearContext), ou `null`. */
  year: { name: string; startDate: string; endDate: string } | null
  /** Jours fériés LISIBLES trouvés dans la période. */
  count: number
}

export type HolidayCoverage =
  | { kind: 'no-year' }
  | { kind: 'range-unknown' }
  | { kind: 'outside-year'; yearName: string }
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'none' }
  | { kind: 'some'; count: number }

export function describeHolidayCoverage(input: HolidayCoverageInput): HolidayCoverage {
  const { load, period, year, count } = input
  if (!year) return { kind: 'no-year' }

  const start = civilFromApi(year.startDate)
  const end = civilFromApi(year.endDate)
  if (start === null || end === null) return { kind: 'range-unknown' }

  // Comparaison lexicale : sûre sur des dates civiles `YYYY-MM-DD`.
  if (period.to < start || period.from > end) {
    return { kind: 'outside-year', yearName: year.name }
  }

  if (load === 'loading') return { kind: 'loading' }
  if (load === 'error') return { kind: 'unavailable' }
  return count > 0 ? { kind: 'some', count } : { kind: 'none' }
}

export function formatHolidayCoverage(coverage: HolidayCoverage): string {
  switch (coverage.kind) {
    case 'no-year':
      return 'aucune année scolaire active'
    case 'range-unknown':
      return 'période de l’année illisible'
    case 'outside-year':
      // « période de », pas « année » : le nom de l'année contient souvent
      // déjà le mot (« Année 2025-2026 »). Guillemets à espaces insécables.
      return `hors de la période de « ${coverage.yearName} » : non chargé`
    case 'loading':
      return 'chargement…'
    case 'unavailable':
      return 'jours fériés indisponibles'
    case 'none':
      return 'aucun jour férié'
    case 'some':
      return coverage.count > 1 ? `${coverage.count} jours fériés` : '1 jour férié'
  }
}
