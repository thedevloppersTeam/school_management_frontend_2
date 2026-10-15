/**
 * Réponse de `GET /api/academic-years/:id/holidays` → jours du calendrier.
 *
 * Forme constatée le 2026-10-15 : `{ id, academicYearId, name, date,
 * createdAt, updatedAt }`, une date UNIQUE par élément (pas de plage), sans
 * champ de type.
 *
 * Un élément mal formé — date illisible, libellé vide — est écarté et COMPTÉ.
 * Le widget ne compense pas une saisie fausse : il l'ignore et le dit.
 */
import { civilFromApi } from './dates'
import type { CalendarDayEvent } from './types'

export interface HolidaysConversion {
  events: CalendarDayEvent[]
  /** Éléments écartés, faute de date ou de libellé lisible. */
  ignored: number
}

export function holidaysToEvents(items: readonly unknown[]): HolidaysConversion {
  const events: CalendarDayEvent[] = []
  let ignored = 0

  for (const item of items) {
    if (!item || typeof item !== 'object') {
      ignored++
      continue
    }
    const { name, date } = item as { name?: unknown; date?: unknown }
    const civil = civilFromApi(date)
    const label = typeof name === 'string' ? name.trim() : ''
    if (civil === null || label === '') {
      ignored++
      continue
    }
    events.push({ date: civil, label, kind: 'ferie' })
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label, 'fr'))
  return { events, ignored }
}
