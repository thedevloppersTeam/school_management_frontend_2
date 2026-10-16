/**
 * Relevé de notes — répartition des groupes en deux colonnes (G3, O6).
 *
 * Référence : docs/GABARIT-RELEVE.md §3. « Discipline » est toujours en fin de
 * colonne gauche (disposition du scan).
 *
 * - Aucune colonne imposée (O1, comportement d'avant) : les groupes gardent
 *   leur ordre ; la gauche prend les premiers, la droite le reste ; le point
 *   de coupe rend l'écart de rangées minimal.
 * - Au moins une colonne imposée (O6) : chaque groupe imposé va dans sa
 *   colonne ; les groupes automatiques, dans l'ordre, vont dans la colonne la
 *   moins remplie en rangées (Discipline comptée à gauche dès le départ ;
 *   égalité → gauche). L'ordre relatif des groupes d'une colonne est l'ordre
 *   reçu (O2).
 */
import type { ReleveGroup } from './types'

/** Rangées occupées par un groupe : une rangée de titre, puis une par ligne. */
export function groupRowCount(group: ReleveGroup): number {
  return 1 + group.lines.length
}

export function splitColumns(
  groups: ReleveGroup[],
  discipline: ReleveGroup,
): { left: ReleveGroup[]; right: ReleveGroup[] } {
  if (groups.some((g) => g.column === 'LEFT' || g.column === 'RIGHT')) {
    return fillColumns(groups, discipline)
  }
  const total = groups.reduce((a, g) => a + groupRowCount(g), 0)
  let leftRows = groupRowCount(discipline)
  let best = 0
  let bestGap = Math.abs(leftRows - total)

  // k = nombre de groupes à gauche. À écart égal, la coupe la plus tardive
  // gagne : la colonne gauche est remplie d'abord (G3).
  for (let k = 1; k <= groups.length; k++) {
    leftRows += groupRowCount(groups[k - 1])
    const gap = Math.abs(leftRows - (total - leftRows + groupRowCount(discipline)))
    if (gap <= bestGap) {
      best = k
      bestGap = gap
    }
  }

  return { left: [...groups.slice(0, best), discipline], right: groups.slice(best) }
}

/** O6 — placement par remplissage, colonnes imposées respectées. */
function fillColumns(
  groups: ReleveGroup[],
  discipline: ReleveGroup,
): { left: ReleveGroup[]; right: ReleveGroup[] } {
  const left: ReleveGroup[] = []
  const right: ReleveGroup[] = []
  let leftRows = groupRowCount(discipline)
  let rightRows = 0
  for (const g of groups) {
    const toLeft = g.column === 'LEFT' || (g.column !== 'RIGHT' && leftRows <= rightRows)
    if (toLeft) {
      left.push(g)
      leftRows += groupRowCount(g)
    } else {
      right.push(g)
      rightRows += groupRowCount(g)
    }
  }
  return { left: [...left, discipline], right }
}
