/**
 * Total d'élèves du tableau de bord — la règle « indisponible ».
 *
 * Un comptage qui échoue n'est pas un zéro. Dès qu'un seul manque, le total
 * n'est pas connu : il vaut `null`, et l'écran affiche « indisponible ». Ni
 * sous-total, ni « au moins N ». Aucune salle, en revanche, est un 0 légitime.
 */
import { sumEnrollmentCounts, toEnrollmentCount } from './students-total'

let pass = 0, fail = 0
const out: string[] = []
function check(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; out.push(`  OK    ${label.padEnd(58)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${label.padEnd(58)} attendu ${w}, obtenu ${g}`) }
}

// ── Agrégation ──────────────────────────────────────────────────────────────
{
  check('liste vide (aucune salle) : 0 legitime', sumEnrollmentCounts([]), 0)
  check('tous valides : la somme', sumEnrollmentCounts([12, 30, 8]), 50)
  check('un zero legitime parmi des valides', sumEnrollmentCounts([12, 0, 8]), 20)
  check('que des zeros legitimes', sumEnrollmentCounts([0, 0]), 0)
  check('un echec parmi des succes : null', sumEnrollmentCounts([12, null, 8]), null)
  check('tous en echec : null, jamais 0', sumEnrollmentCounts([null, null]), null)
  check('echec en derniere position : null', sumEnrollmentCounts([12, 30, null]), null)
  check('echec en premiere position : null', sumEnrollmentCounts([null, 30, 8]), null)
}

// ── Valeur rendue par un comptage ───────────────────────────────────────────
{
  check('entier positif garde', toEnrollmentCount(14), 14)
  check('zero garde', toEnrollmentCount(0), 0)
  check('undefined (reponse non-liste) : null', toEnrollmentCount(undefined), null)
  check('NaN : null', toEnrollmentCount(Number.NaN), null)
  check('negatif : null', toEnrollmentCount(-1), null)
  check('decimal : null', toEnrollmentCount(2.5), null)
}

console.log(out.join('\n'))
console.log(`\n${pass} tests OK, ${fail} echec(s)`)
if (fail > 0) process.exit(1)
