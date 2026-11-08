/**
 * Avertissement NON BLOQUANT : dates saisies hors des bornes de l'année.
 *
 * Fonctions PURES, sans React ni fetch. Règle unique, à un seul endroit : les
 * composants l'appellent, ils ne la recopient pas.
 *
 * C'est un affichage, pas une règle de calcul ni de validation : le serveur
 * accepte les dates hors bornes, et « Enregistrer » reste actif. Rien n'est
 * stocké.
 *
 * Comparaison sur les chaînes civiles `AAAA-MM-JJ` (ordre lexicographique =
 * ordre chronologique) : aucune `Date`, aucun fuseau. Les bornes sont INCLUSES :
 * le premier et le dernier jour de l'année ne déclenchent rien.
 */
import { formatCivilLong, parseCivil } from '@/lib/calendar/dates'
import type { FormeDates } from './dates'

export interface Bornes {
  /** Premier jour de l'année, `AAAA-MM-JJ`. */
  debut: string
  /** Dernier jour de l'année, `AAAA-MM-JJ`. */
  fin: string
}

const civile = (v: string | null | undefined): v is string => typeof v === 'string' && parseCivil(v) !== null

/**
 * Vrai si le début est avant le premier jour de l'année OU la fin après son
 * dernier jour. Faux dès qu'une valeur manque ou est illisible : on n'avertit
 * pas sur ce qu'on ne sait pas lire (le serveur tranche le format).
 */
export function estHorsBornes(debut: string | null | undefined, fin: string | null | undefined, bornes: Bornes | null | undefined): boolean {
  if (!bornes || !civile(bornes.debut) || !civile(bornes.fin)) return false
  if (!civile(debut) || !civile(fin)) return false
  return debut < bornes.debut || fin > bornes.fin
}

/** Texte de l'avertissement (maquette CAL-2, § 3.3.4). */
export function messageHorsBornes(forme: FormeDates, nomAnnee: string, bornes: Bornes): string {
  const plage = `du ${formatCivilLong(bornes.debut)} au ${formatCivilLong(bornes.fin)}`
  const objet = forme === 'jour' ? 'Cette date est en dehors de' : 'Cette période déborde de'
  return `${objet} l'année scolaire ${nomAnnee} (${plage}). Vous pouvez enregistrer quand même.`
}
