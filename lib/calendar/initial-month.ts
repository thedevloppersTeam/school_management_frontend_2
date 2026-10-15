/**
 * Calendrier du tableau de bord — le mois affiché à l'ouverture.
 *
 * Fonction PURE, sans React ni horloge : `today` est passé en argument.
 *
 * Décision du 2026-10-15 : le calendrier ne montre que les jours fériés de
 * l'année active. Quand aujourd'hui est hors de cette année, il s'ouvre donc
 * sur le mois de l'année le plus proche — le DERNIER si l'année est finie, le
 * PREMIER si elle n'a pas commencé — plutôt que sur un mois sans données.
 * Sans année active, ou si ses dates sont illisibles : le mois d'aujourd'hui.
 *
 * Le bouton « Aujourd'hui » n'utilise PAS cette fonction : il mène au mois
 * d'aujourd'hui même hors de l'année, et le widget l'annonce (option 2).
 */
import { civilFromApi } from './dates'

export interface CalendarMonth {
  year: number
  /** 1 à 12. */
  month: number
}

const monthOf = (civil: string): CalendarMonth => ({
  year: Number(civil.slice(0, 4)),
  month: Number(civil.slice(5, 7)),
})

export function initialMonth(
  today: string,
  year: { startDate: string; endDate: string } | null,
): CalendarMonth {
  if (!year) return monthOf(today)
  const start = civilFromApi(year.startDate)
  const end = civilFromApi(year.endDate)
  if (start === null || end === null) return monthOf(today)
  // Comparaison lexicale : sûre sur des dates civiles `YYYY-MM-DD`.
  if (today < start) return monthOf(start)
  if (today > end) return monthOf(end)
  return monthOf(today)
}
