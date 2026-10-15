/**
 * Grille mensuelle, semaines du LUNDI au dimanche.
 *
 * Fonction PURE : `today` est passé en argument, jamais lu dans l'horloge,
 * pour que la grille soit testable et identique d'un rendu à l'autre.
 */
import { addDays, daysInMonth, toCivil, weekdayMondayFirst } from './dates'
import type { CalendarDayEvent } from './types'

export interface MonthGridDay {
  date: string
  inMonth: boolean
  isToday: boolean
  isWeekend: boolean
  events: CalendarDayEvent[]
}

export function buildMonthGrid(
  year: number,
  month: number,
  events: readonly CalendarDayEvent[],
  today: string,
): MonthGridDay[][] {
  const byDate = new Map<string, CalendarDayEvent[]>()
  for (const event of events) {
    const list = byDate.get(event.date)
    if (list) list.push(event)
    else byDate.set(event.date, [event])
  }

  const first = toCivil(year, month, 1)
  const last = toCivil(year, month, daysInMonth(year, month))
  const start = addDays(first, -weekdayMondayFirst(first))
  const end = addDays(last, 6 - weekdayMondayFirst(last))
  const prefix = toCivil(year, month, 1).slice(0, 7)

  const weeks: MonthGridDay[][] = []
  for (let date = start; date <= end; date = addDays(date, 1)) {
    if (weekdayMondayFirst(date) === 0) weeks.push([])
    weeks[weeks.length - 1].push({
      date,
      inMonth: date.startsWith(prefix),
      isToday: date === today,
      isWeekend: weekdayMondayFirst(date) >= 5,
      events: byDate.get(date) ?? [],
    })
  }
  return weeks
}

/** Les `count` prochains éléments datés, aujourd'hui compris. */
export function upcomingEvents<T extends { date: string }>(
  events: readonly T[],
  today: string,
  count = 3,
): T[] {
  return events
    .filter((event) => event.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, count)
}
