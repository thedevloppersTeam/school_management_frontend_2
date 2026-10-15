/**
 * Réponse de `GET /api/academic-years/:id/events` → événements à afficher.
 *
 * Forme constatée le 2026-10-15 (modèle `SchoolEvent`, serveur) :
 * `{ id, academicYearId, title, date, type, createdAt, updatedAt }`, une date
 * UNIQUE (colonne `DATE`, même règle que les jours fériés : voir `dates.ts`).
 *
 * Un élément sans date ou sans titre lisible est écarté et COMPTÉ. Un type
 * inconnu n'écarte pas l'événement : il s'affiche « Autre ».
 */
import { civilFromApi } from './dates'

export const SCHOOL_EVENT_TYPES = ['exam', 'holiday', 'meeting', 'other', 'ceremony', 'trip'] as const
export type SchoolEventType = (typeof SCHOOL_EVENT_TYPES)[number]

/** Libellés repris de l'écran de configuration (`cpmsl-calendar-management.tsx`). */
export const SCHOOL_EVENT_TYPE_LABELS: Record<SchoolEventType, string> = {
  exam: 'Examen',
  holiday: 'Congé',
  meeting: 'Réunion',
  other: 'Autre',
  ceremony: 'Cérémonie',
  trip: 'Sortie',
}

export interface SchoolEventItem {
  /** Date civile `YYYY-MM-DD`. */
  date: string
  title: string
  type: SchoolEventType
}

export interface EventsConversion {
  events: SchoolEventItem[]
  ignored: number
}

const isEventType = (value: unknown): value is SchoolEventType =>
  typeof value === 'string' && (SCHOOL_EVENT_TYPES as readonly string[]).includes(value)

export function schoolEventsToItems(items: readonly unknown[]): EventsConversion {
  const events: SchoolEventItem[] = []
  let ignored = 0

  for (const item of items) {
    if (!item || typeof item !== 'object') {
      ignored++
      continue
    }
    const { title, date, type } = item as { title?: unknown; date?: unknown; type?: unknown }
    const civil = civilFromApi(date)
    const label = typeof title === 'string' ? title.trim() : ''
    if (civil === null || label === '') {
      ignored++
      continue
    }
    events.push({ date: civil, title: label, type: isEventType(type) ? type : 'other' })
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'fr'))
  return { events, ignored }
}
