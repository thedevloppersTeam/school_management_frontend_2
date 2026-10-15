/**
 * Libellés du tableau de bord — constats B et C du lot 8.
 *
 * Fonctions PURES, sans React ni horloge : la date du jour est passée en
 * argument.
 *
 * Vocabulaire repris du calendrier (lib/calendar/day-detail-state.ts) :
 * « période », nom de l'année entre guillemets français à espaces insécables,
 * nom jamais modifié. Le mot « année » n'est jamais placé devant le nom, qui
 * le contient souvent déjà (« Année 2025-2026 »).
 */
import { civilFromApi } from '../calendar/dates'

const NBSP = ' '
const guillemets = (texte: string) => `«${NBSP}${texte}${NBSP}»`

/**
 * Phrase du widget « Événements à venir » quand aucune ligne n'est listée.
 * La période est lue sur les dates de l'année active ; des dates illisibles
 * ne permettent aucune affirmation sur la période.
 */
export function eventsEmptyMessage(input: {
  /** Événements configurés et lisibles pour l'année, passés compris. */
  configuredCount: number
  /** Date civile du jour, `YYYY-MM-DD`. */
  today: string
  year: { startDate: string; endDate: string }
}): string {
  if (input.configuredCount === 0) return 'Aucun événement configuré pour cette période.'

  const debut = civilFromApi(input.year.startDate)
  const fin = civilFromApi(input.year.endDate)
  if (debut === null || fin === null) return 'Aucun événement à venir.'

  // Comparaison lexicale : sûre sur des dates civiles `YYYY-MM-DD`.
  if (input.today > fin) return 'La période est terminée : aucun événement à venir.'
  if (input.today < debut) return 'Aucun événement à venir : la période n’a pas encore commencé.'
  return 'Aucun autre événement d’ici la fin de la période.'
}

/** Description de la carte « Événements à venir ». */
export function eventsCardDescription(yearName: string | null): string {
  return yearName ? `Événements de ${guillemets(yearName)}` : 'Aucune année scolaire active'
}

/**
 * Description de la carte « Calendrier de l'école » (lot 9). Même règle que
 * `eventsCardDescription` : nom entre guillemets, jamais « année » devant.
 */
export function calendarCardDescription(yearName: string | null): string {
  return yearName ? `Jours fériés de ${guillemets(yearName)}` : 'Aucune année scolaire active'
}

/**
 * Valeur d'une tuile de compteur (Élèves, Matières, Bulletins archivés).
 *
 * `null` avec une année active = l'appel a échoué → « indisponible », jamais
 * 0. Un 0 reçu est un 0 légitime et s'affiche tel quel. Sans année active,
 * aucun appel n'a eu lieu : le libellé d'origine « À vérifier » est conservé.
 */
export function countTileValue(count: number | null, hasActiveYear: boolean): number | string {
  if (count !== null) return count
  return hasActiveYear ? 'indisponible' : 'À vérifier'
}

/** Données manquantes, lues sur ce que page.tsx reçoit (valeurs à `null`). */
export interface MissingDashboardData {
  students: boolean
  subjects: boolean
  archives: boolean
  assignments: boolean
}

/**
 * Texte du bandeau « Données partielles ». Les raisons gardent l'ordre où le
 * chargement les rend.
 *
 * Deux variantes : une tuile n'est concernée que par les effectifs, les
 * matières ou les bulletins archivés. Si seules les affectations manquent,
 * aucune tuile n'affiche « indisponible » : le bandeau ne parle que des lignes.
 */
export function partialDataMessage(reasons: readonly string[], missing: MissingDashboardData): string {
  const debut = `Le serveur n’a pas renvoyé ${reasons.join(', ')}. `
  const tuileConcernee = missing.students || missing.subjects || missing.archives
  return tuileConcernee
    ? `${debut}Les tuiles concernées affichent ${guillemets('indisponible')} ; ` +
        `les lignes concernées, ${guillemets('À vérifier')}.`
    : `${debut}Les lignes concernées affichent ${guillemets('À vérifier')}.`
}
