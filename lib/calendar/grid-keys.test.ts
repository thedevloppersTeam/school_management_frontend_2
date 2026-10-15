/**
 * Grille du calendrier — touches Début et Fin.
 *
 * La grille commence le LUNDI (month-grid.ts, weekdayMondayFirst) : Début mène
 * au lundi de la semaine de la case focalisée, Fin au dimanche. Une semaine à
 * cheval sur deux mois mène dans le mois voisin, comme le font déjà les
 * flèches. Données fictives.
 */
import { weekEdgeTarget } from './grid-keys'

let pass = 0, fail = 0
const out: string[] = []
function check(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; out.push(`  OK    ${label.padEnd(58)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${label.padEnd(58)} attendu ${w}, obtenu ${g}`) }
}

// Octobre 2026 : le 1er est un jeudi, le 31 un samedi.
{
  check('Debut depuis un mercredi -> lundi', weekEdgeTarget('Home', '2026-10-14'), '2026-10-12')
  check('Fin depuis un mercredi -> dimanche', weekEdgeTarget('End', '2026-10-14'), '2026-10-18')
  check('Debut depuis un lundi -> lui-meme', weekEdgeTarget('Home', '2026-10-12'), '2026-10-12')
  check('Fin depuis un dimanche -> lui-meme', weekEdgeTarget('End', '2026-10-18'), '2026-10-18')
}

// ── Premier et dernier jour du mois, semaines à cheval ─────────────────────
{
  check('Debut depuis le 1er (jeudi) -> lundi 28 sept.', weekEdgeTarget('Home', '2026-10-01'), '2026-09-28')
  check('Fin depuis le 1er (jeudi) -> dimanche 4 oct.', weekEdgeTarget('End', '2026-10-01'), '2026-10-04')
  check('Debut depuis le 31 (samedi) -> lundi 26 oct.', weekEdgeTarget('Home', '2026-10-31'), '2026-10-26')
  check('Fin depuis le 31 (samedi) -> dimanche 1er nov.', weekEdgeTarget('End', '2026-10-31'), '2026-11-01')
  check('passage d annee : Fin depuis le 31 dec. 2026', weekEdgeTarget('End', '2026-12-31'), '2027-01-03')
}

// ── Case focalisée vide ou illisible, autres touches ───────────────────────
{
  check('case focalisee vide', weekEdgeTarget('Home', ''), null)
  check('case focalisee absente', weekEdgeTarget('End', null), null)
  check('case focalisee illisible', weekEdgeTarget('Home', '2026-02-30'), null)
  check('autre touche : pas pour cette fonction', weekEdgeTarget('ArrowLeft', '2026-10-14'), null)
}

console.log(out.join('\n'))
console.log(`\n${pass} tests OK, ${fail} echec(s)`)
if (fail > 0) process.exit(1)
