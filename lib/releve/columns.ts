/**
 * Relevé de notes — répartition des groupes en deux colonnes (G3).
 *
 * Référence : docs/GABARIT-RELEVE.md §3. Les groupes gardent leur ordre ; la
 * colonne gauche prend les premiers, puis « Discipline » en dernier (disposition
 * du scan) ; la droite prend le reste. Le point de coupe est celui qui rend
 * l'écart de rangées entre les deux colonnes minimal.
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
