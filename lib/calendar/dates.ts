/**
 * Dates civiles « YYYY-MM-DD » — un JOUR, pas un instant.
 *
 * Fonctions PURES, sans React ni fetch.
 *
 * ── POURQUOI PAS `new Date('YYYY-MM-DD')` ───────────────────────────────────
 * Le moteur JavaScript lit cette forme comme minuit UTC. Affichée ou découpée
 * à Port-au-Prince (UTC-5), elle devient la VEILLE à 19 h. Toute l'arithmétique
 * ci-dessous passe donc par `Date.UTC` et les accesseurs `getUTC*`, qui ne
 * dépendent d'aucun fuseau.
 */

const CIVIL = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Date renvoyée par l'API (colonne Postgres `DATE`).
 *
 * RÈGLE CONSTATÉE le 2026-10-15 (lecture du code serveur, `schoolCalendar.ts`
 * et migration `add_school_calendar`) : Prisma rend une colonne `DATE` comme un
 * `Date` à minuit UTC, et Express le sérialise en `2026-10-17T00:00:00.000Z`.
 * La date civile est donc les dix premiers caractères, SANS conversion de
 * fuseau — convertir en heure locale donnerait le 16.
 */
const API_DATE = /^(\d{4}-\d{2}-\d{2})(?:T[0-9:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/

export const MONTH_NAMES_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
] as const

export const WEEKDAY_SHORT_FR = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'] as const
export const WEEKDAY_LONG_FR = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

/** Construit `YYYY-MM-DD`. `month` va de 1 à 12. Ne valide pas. */
export function toCivil(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`
}

/** Décompose une date civile, ou `null` si elle n'existe pas (30 février…). */
export function parseCivil(value: string): { year: number; month: number; day: number } | null {
  const m = CIVIL.exec(value)
  if (!m) return null
  const year = Number(m[1]), month = Number(m[2]), day = Number(m[3])
  if (month < 1 || month > 12 || day < 1) return null
  if (day > daysInMonth(year, month)) return null
  return { year, month, day }
}

/** Date civile tirée d'une valeur de l'API, ou `null` si elle est illisible. */
export function civilFromApi(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const m = API_DATE.exec(value.trim())
  if (!m) return null
  return parseCivil(m[1]) ? m[1] : null
}

/** Le jour civil LOCAL de l'instant donné — « aujourd'hui » pour l'utilisatrice. */
export function todayCivil(now: Date): string {
  return toCivil(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

const toUtcTime = (civil: string): number => {
  const p = parseCivil(civil)
  if (!p) throw new RangeError('date civile invalide')
  return Date.UTC(p.year, p.month - 1, p.day)
}

const fromUtcTime = (time: number): string => {
  const d = new Date(time)
  return toCivil(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

export function addDays(civil: string, days: number): string {
  return fromUtcTime(toUtcTime(civil) + days * 86_400_000)
}

/** Jour de la semaine, LUNDI = 0 … dimanche = 6. */
export function weekdayMondayFirst(civil: string): number {
  return (new Date(toUtcTime(civil)).getUTCDay() + 6) % 7
}

/** Mois décalé de `delta` mois. `month` va de 1 à 12. */
export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

/** « octobre 2026 ». */
export function formatMonthTitle(year: number, month: number): string {
  return `${MONTH_NAMES_FR[month - 1]} ${year}`
}

/** « 17 octobre 2026 », « 1er novembre 2026 ». */
export function formatCivilLong(civil: string): string {
  const p = parseCivil(civil)
  if (!p) return civil
  return `${p.day === 1 ? '1er' : p.day} ${MONTH_NAMES_FR[p.month - 1]} ${p.year}`
}
