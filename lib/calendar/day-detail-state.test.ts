/**
 * Calendrier du tableau de bord — ce que le détail d'un jour ou d'un mois a le
 * droit d'affirmer.
 *
 * « Aucun jour férié » est une affirmation : elle n'est permise que si la
 * liste a été lue, et seulement pour une période couverte par l'année active.
 * Pendant le chargement, en erreur, ou hors de l'année : on le dit, on
 * n'affirme rien. Données fictives uniquement.
 */
import { describeHolidayCoverage, formatHolidayCoverage, type HolidayCoverageInput } from './day-detail-state'
import { holidaysToEvents } from './from-holidays'

let pass = 0, fail = 0
const out: string[] = []
function check(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; out.push(`  OK    ${label.padEnd(58)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${label.padEnd(58)} attendu ${w}, obtenu ${g}`) }
}

// Année fictive : du 1er septembre 2025 au 31 juillet 2026, dates telles que
// le serveur les envoie (colonnes DATE, minuit UTC).
const ANNEE = {
  name: 'Année fictive A',
  startDate: '2025-09-01T00:00:00.000Z',
  endDate: '2026-07-31T00:00:00.000Z',
}
const jour = (date: string) => ({ from: date, to: date })
const base = (over: Partial<HolidayCoverageInput>): HolidayCoverageInput => ({
  load: 'ready', period: jour('2025-10-17'), year: ANNEE, count: 0, ...over,
})
const texte = (over: Partial<HolidayCoverageInput>) => formatHolidayCoverage(describeHolidayCoverage(base(over)))

// ── Chaque état ─────────────────────────────────────────────────────────────
{
  check('chargement : jamais « aucun »', texte({ load: 'loading' }), 'chargement…')
  check('erreur : indisponible, jamais « aucun »', texte({ load: 'error' }), 'jours fériés indisponibles')
  check('pret, dans l annee, aucun : aucun', texte({}), 'aucun jour férié')
  check('pret, dans l annee, 1', texte({ count: 1 }), '1 jour férié')
  check('pret, dans l annee, 3', texte({ count: 3 }), '3 jours fériés')
  check('sans annee active', texte({ year: null }), 'aucune année scolaire active')
}

// ── Bornes de l'année ───────────────────────────────────────────────────────
{
  check('premier jour de l annee : dans l annee', texte({ period: jour('2025-09-01') }), 'aucun jour férié')
  check('dernier jour de l annee : dans l annee', texte({ period: jour('2026-07-31') }), 'aucun jour férié')
  check('veille du premier jour : hors de l annee', texte({ period: jour('2025-08-31') }),
    'hors de l’année Année fictive A : non chargé')
  check('lendemain du dernier jour : hors de l annee', texte({ period: jour('2026-08-01') }),
    'hors de l’année Année fictive A : non chargé')
  check('mois juste avant (aout 2025)', texte({ period: { from: '2025-08-01', to: '2025-08-31' } }),
    'hors de l’année Année fictive A : non chargé')
  check('mois juste apres (aout 2026)', texte({ period: { from: '2026-08-01', to: '2026-08-31' } }),
    'hors de l’année Année fictive A : non chargé')
  check('premier mois (septembre 2025) : dans l annee', texte({ period: { from: '2025-09-01', to: '2025-09-30' } }),
    'aucun jour férié')
  check('dernier mois (juillet 2026) : dans l annee', texte({ period: { from: '2026-07-01', to: '2026-07-31' } }),
    'aucun jour férié')
  check('hors de l annee prime sur le chargement', texte({ load: 'loading', period: jour('2026-08-01') }),
    'hors de l’année Année fictive A : non chargé')
  check('hors de l annee prime sur l erreur', texte({ load: 'error', period: jour('2025-08-31') }),
    'hors de l’année Année fictive A : non chargé')
}

// ── Plage d'année illisible : aucune affirmation ────────────────────────────
{
  check('debut illisible', texte({ year: { ...ANNEE, startDate: 'pas-une-date' } }),
    'période de l’année illisible')
  check('fin illisible', texte({ year: { ...ANNEE, endDate: '' } }), 'période de l’année illisible')
}

// ── Entrées illisibles : ignorées, jamais comptées ──────────────────────────
{
  const { events, ignored } = holidaysToEvents([
    { name: 'Fictif valide', date: '2025-10-17T00:00:00.000Z' },
    { name: 'Date illisible', date: '17/10' },
    { name: '', date: '2025-10-18T00:00:00.000Z' },
  ])
  const duJour = events.filter((e) => e.date === '2025-10-17').length
  check('compte des ignores inchange', ignored, 2)
  check('le jour ne compte que les entrees lisibles', texte({ count: duJour }), '1 jour férié')
}

console.log(out.join('\n'))
console.log(`\n${pass} tests OK, ${fail} echec(s)`)
if (fail > 0) process.exit(1)
