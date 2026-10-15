/**
 * Libellé du statut de l'année sur la carte « Année scolaire active » du
 * tableau de bord.
 *
 * Le statut vient de `deriveAcademicYearStatus` (lib/academic-years/status.ts),
 * seule source de la règle ; ce module ne fait que le traduire en libellé.
 * Données fictives uniquement.
 */
import { yearStatusLabel } from './year-status-label'

let pass = 0, fail = 0
const out: string[] = []
function check(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; out.push(`  OK    ${label.padEnd(58)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${label.padEnd(58)} attendu ${w}, obtenu ${g}`) }
}

const MAINTENANT = new Date('2026-10-15T12:00:00.000Z')
function annee(isCurrent: boolean, endDate: string) {
  return { isCurrent, endDate }
}

// -- Les trois statuts de status.ts ------------------------------------------
{
  check('active (isCurrent)', yearStatusLabel(annee(true, '2027-07-09T00:00:00.000Z'), MAINTENANT), 'Active')
  check('active meme si la fin est passee', yearStatusLabel(annee(true, '2026-07-10T00:00:00.000Z'), MAINTENANT), 'Active')
  check('archivee (fin passee, non courante)', yearStatusLabel(annee(false, '2025-07-11T00:00:00.000Z'), MAINTENANT), 'Archivée')
  check('en preparation (fin future, non courante)', yearStatusLabel(annee(false, '2027-07-09T00:00:00.000Z'), MAINTENANT), 'En préparation')
}

// -- Année absente ------------------------------------------------------------
{
  check('annee absente : libelle actuel conserve', yearStatusLabel(null, MAINTENANT), 'À faire')
}

// -- Dates illisibles : la règle de status.ts, pas une règle locale ----------
{
  check('date illisible, courante : active', yearStatusLabel(annee(true, 'pas-une-date'), MAINTENANT), 'Active')
  check('date illisible, non courante : en preparation', yearStatusLabel(annee(false, 'pas-une-date'), MAINTENANT), 'En préparation')
}

console.log(out.join('\n'))
console.log(`\n${pass} tests OK, ${fail} echec(s)`)
if (fail > 0) process.exit(1)
