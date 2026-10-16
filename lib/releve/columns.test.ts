/**
 * Relevé de notes — répartition des groupes en deux colonnes (G3).
 *
 * Référence : docs/GABARIT-RELEVE.md §3. Données entièrement fictives.
 */
import { groupRowCount, splitColumns } from './columns'
import type { ReleveGroup } from './types'

let pass = 0, fail = 0
const out: string[] = []
function check(l: string, got: unknown, want: unknown) {
  const g = String(got), w = String(want)
  if (g === w) { pass++; out.push(`  OK    ${l.padEnd(64)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${l.padEnd(64)} attendu ${w}, obtenu ${g}`) }
}

function group(
  title: string,
  lines: number,
  kind: ReleveGroup['kind'] = 'matiere',
  column: ReleveGroup['column'] = null,
): ReleveGroup {
  return {
    title,
    kind,
    column,
    lines: Array.from({ length: lines }, (_, i) => ({
      label: `${title}-${i + 1}`,
      coeff: '1',
      cells: [],
      average: { text: '-', band: null },
    })),
  }
}
const titles = (gs: ReleveGroup[]) => gs.map((x) => x.title).join(',')
const rows = (gs: ReleveGroup[]) => gs.reduce((a, x) => a + groupRowCount(x), 0)

/** Écart minimal possible, calculé par force brute, sans le code testé. */
function bestGap(sizes: number[], disciplineRows: number): number {
  let best = Infinity
  for (let k = 0; k <= sizes.length; k++) {
    const left = sizes.slice(0, k).reduce((a, x) => a + x + 1, 0) + disciplineRows
    const right = sizes.slice(k).reduce((a, x) => a + x + 1, 0)
    best = Math.min(best, Math.abs(left - right))
  }
  return best
}

const DISC = group('Discipline', 5, 'discipline')

check('rangées d’un groupe = titre + lignes', groupRowCount(group('G', 3)), 4)
check('rangées du groupe Discipline', groupRowCount(DISC), 6)

{
  // Rangées : G1 4, G2 3, G3 5, G4 2, G5 3 (17) ; Discipline 6.
  const gs = [group('G1', 3), group('G2', 2), group('G3', 4), group('G4', 1), group('G5', 2)]
  const { left, right } = splitColumns(gs, DISC)
  check('T19 colonne gauche', titles(left), 'G1,G2,Discipline')
  check('T19 colonne droite', titles(right), 'G3,G4,G5')
  check('T19 Discipline en fin de colonne gauche', left[left.length - 1].kind, 'discipline')
  check('T19 ordre des groupes conservé', titles([...left.slice(0, -1), ...right]), titles(gs))
  check('T19 écart minimal', Math.abs(rows(left) - rows(right)), bestGap([3, 2, 4, 1, 2], 6))
}
{
  const { left, right } = splitColumns([], DISC)
  check('T19 aucun groupe : Discipline seule à gauche', titles(left), 'Discipline')
  check('T19 aucun groupe : droite vide', right.length, 0)
}
{
  // Égalité d'écart (2 contre 4 ou 4 contre 2) : la gauche est remplie d'abord.
  const d = group('Discipline', 1, 'discipline')
  const { left, right } = splitColumns([group('G1', 1), group('G2', 1)], d)
  check('T19 égalité : gauche remplie d’abord', titles(left), 'G1,Discipline')
  check('T19 égalité : droite', titles(right), 'G2')
}
{
  // Balayage déterministe : 40 listes, chaque répartition vérifiée.
  let ok = 0
  for (let n = 0; n < 40; n++) {
    const sizes = Array.from({ length: 1 + (n % 9) }, (_, i) => 1 + ((n * 7 + i * 5) % 6))
    const gs = sizes.map((s, i) => group(`G${i + 1}`, s))
    const { left, right } = splitColumns(gs, DISC)
    const disciplineLast = left[left.length - 1] === DISC && !right.includes(DISC)
    const ordre = titles([...left.slice(0, -1), ...right]) === titles(gs)
    const ecart = Math.abs(rows(left) - rows(right)) === bestGap(sizes, 6)
    if (disciplineLast && ordre && ecart) ok++
  }
  check('T19 balayage 40 listes : Discipline, ordre, écart minimal', ok, 40)
}

// ── T-O7 — colonnes imposées, groupes auto dans la colonne la moins remplie ──
{
  // Rangées : G1 4 (gauche imposée), G2 3, G3 5 (droite imposée), G4 2, G5 3 ;
  // Discipline 6, comptée à gauche dès le départ.
  // G1 → gauche 10 ; G2 → droite 3 ; G3 → droite 8 ; G4 → droite 10 ;
  // G5 : égalité 10/10 → gauche.
  const gs = [group('G1', 3, 'matiere', 'LEFT'), group('G2', 2), group('G3', 4, 'matiere', 'RIGHT'), group('G4', 1), group('G5', 2)]
  const { left, right } = splitColumns(gs, DISC)
  check('T-O7 colonne gauche', titles(left), 'G1,G5,Discipline')
  check('T-O7 colonne droite', titles(right), 'G2,G3,G4')
  check('T-O7 Discipline en fin de colonne gauche', left[left.length - 1].kind, 'discipline')
  check('T-O7 imposé gauche respecté', left.some((x) => x.title === 'G1'), true)
  check('T-O7 imposé droite respecté', right.some((x) => x.title === 'G3'), true)
}
{
  const gs = [group('G1', 3, 'matiere', 'RIGHT'), group('G2', 2, 'matiere', 'RIGHT')]
  const { left, right } = splitColumns(gs, DISC)
  check('T-O7 tout imposé à droite : gauche = Discipline seule', titles(left), 'Discipline')
  check('T-O7 tout imposé à droite : ordre conservé', titles(right), 'G1,G2')
}
{
  // Une seule colonne imposée suffit à passer en placement par remplissage :
  // les groupes auto vont dans la colonne la moins remplie, dans l'ordre.
  const gs = [group('G1', 1), group('G2', 1, 'matiere', 'LEFT'), group('G3', 1), group('G4', 1)]
  const { left, right } = splitColumns(gs, group('Discipline', 1, 'discipline'))
  // Gauche 2 (Discipline) ; G1 → droite 2 ; G2 → gauche 4 ; G3 → droite 4 ; G4 → gauche 6.
  check('T-O7 auto dans la moins remplie (gauche)', titles(left), 'G2,G4,Discipline')
  check('T-O7 auto dans la moins remplie (droite)', titles(right), 'G1,G3')
}

console.log(out.join('\n'))
console.log(`\n${pass} OK, ${fail} ECHEC`)
if (fail > 0) process.exit(1)
