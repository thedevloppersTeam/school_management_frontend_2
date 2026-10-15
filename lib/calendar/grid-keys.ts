/**
 * Grille du calendrier — touches Début et Fin (motif ARIA « grid »).
 *
 * Fonction PURE, sans React ni DOM.
 *
 * La semaine suit l'ordre des colonnes de la grille, qui commence le LUNDI
 * (month-grid.ts, `weekdayMondayFirst`) : Début mène au lundi de la semaine de
 * la case focalisée, Fin au dimanche. Si ce jour appartient au mois voisin, le
 * widget bascule sur ce mois, exactement comme les flèches le font déjà.
 *
 * Les flèches et PageHaut / PageBas restent gérés par le widget : cette
 * fonction ne répond qu'à Début et Fin, et rend `null` pour toute autre touche
 * ou une case focalisée vide ou illisible.
 */
import { addDays, parseCivil, weekdayMondayFirst } from './dates'

export function weekEdgeTarget(key: string, focused: string | null | undefined): string | null {
  if (key !== 'Home' && key !== 'End') return null
  if (!focused || !parseCivil(focused)) return null
  const weekday = weekdayMondayFirst(focused)
  return key === 'Home' ? addDays(focused, -weekday) : addDays(focused, 6 - weekday)
}
