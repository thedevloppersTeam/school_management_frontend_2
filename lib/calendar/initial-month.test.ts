/**
 * Calendrier du tableau de bord — le mois affiché à l'ouverture.
 *
 * Décision du 2026-10-15 : quand aujourd'hui est hors de l'année active, le
 * calendrier s'ouvre sur le mois de l'année le plus proche — le dernier si
 * l'année est finie, le premier si elle n'a pas commencé. Sans année active,
 * ou si ses dates sont illisibles : le mois d'aujourd'hui. Données fictives.
 */
import { initialMonth } from './initial-month'

let pass = 0, fail = 0
const out: string[] = []
function check(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; out.push(`  OK    ${label.padEnd(58)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${label.padEnd(58)} attendu ${w}, obtenu ${g}`) }
}

// Dates telles que le serveur les envoie (colonnes DATE, minuit UTC).
const ANNEE = { startDate: '2025-09-01T00:00:00.000Z', endDate: '2026-07-10T00:00:00.000Z' }
function mois(year: number, month: number) {
  return { year, month }
}

// -- Aujourd'hui dans l'année : le mois d'aujourd'hui ------------------------
{
  check('dans l annee', initialMonth('2026-01-15', ANNEE), mois(2026, 1))
  check('premier jour de l annee', initialMonth('2025-09-01', ANNEE), mois(2025, 9))
  check('dernier jour de l annee', initialMonth('2026-07-10', ANNEE), mois(2026, 7))
}

// -- Année finie : son dernier mois ------------------------------------------
{
  check('lendemain de la fin -> juillet 2026', initialMonth('2026-07-11', ANNEE), mois(2026, 7))
  check('trois mois apres la fin -> juillet 2026', initialMonth('2026-10-15', ANNEE), mois(2026, 7))
}

// -- Année pas commencée : son premier mois ----------------------------------
{
  check('veille du debut -> septembre 2025', initialMonth('2025-08-31', ANNEE), mois(2025, 9))
  check('six mois avant -> septembre 2025', initialMonth('2025-03-01', ANNEE), mois(2025, 9))
}

// -- Sans année active, ou dates illisibles : le mois d'aujourd'hui ----------
{
  check('sans annee active', initialMonth('2026-10-15', null), mois(2026, 10))
  check('debut illisible', initialMonth('2026-10-15', { ...ANNEE, startDate: 'pas-une-date' }), mois(2026, 10))
  check('fin illisible', initialMonth('2026-10-15', { ...ANNEE, endDate: '' }), mois(2026, 10))
}

console.log(out.join('\n'))
console.log(`\n${pass} tests OK, ${fail} echec(s)`)
if (fail > 0) process.exit(1)
