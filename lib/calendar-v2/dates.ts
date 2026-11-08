/**
 * Dates d'une entrée du calendrier v2 : lecture de la réponse et libellé.
 *
 * Fonctions PURES, sans React ni fetch. Elles réutilisent lib/calendar/dates.ts
 * (civilFromApi, formatCivilLong) sans le recopier : jamais `new Date(valeur)`
 * sur une date civile, qui décalerait d'un jour à Port-au-Prince (UTC-5).
 */
import { civilFromApi, formatCivilLong } from '@/lib/calendar/dates'

/** Un jour : début et fin égaux. Une période : fin postérieure au début. */
export type FormeDates = 'jour' | 'periode'

export interface DatesEntree {
  /** `AAAA-MM-JJ`. */
  debut: string
  /** `AAAA-MM-JJ`. */
  fin: string
  forme: FormeDates
}

/**
 * Dates civiles d'une entrée reçue du serveur, ou `null` si l'une est illisible
 * ou si la fin précède le début (réponse hors contrat : rien n'est deviné).
 * La comparaison porte sur les chaînes `AAAA-MM-JJ`, dont l'ordre
 * lexicographique est l'ordre chronologique.
 */
export function lireDatesEntree(startDate: unknown, endDate: unknown): DatesEntree | null {
  const debut = civilFromApi(startDate)
  const fin = civilFromApi(endDate)
  if (!debut || !fin) return null
  if (fin < debut) return null
  return { debut, fin, forme: debut === fin ? 'jour' : 'periode' }
}

/** « 18 mai 2027 » pour un jour ; « du 20 décembre 2026 au 5 janvier 2027 » pour une période. */
export function libelleDates(dates: DatesEntree): string {
  if (dates.forme === 'jour') return formatCivilLong(dates.debut)
  return `du ${formatCivilLong(dates.debut)} au ${formatCivilLong(dates.fin)}`
}
