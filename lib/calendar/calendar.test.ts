/**
 * Calendrier du tableau de bord : dates civiles, conversion de la réponse des
 * jours fériés, grille mensuelle.
 *
 * Le test qui compte est le contrôle UTC : un jour férié daté
 * `2026-10-17T00:00:00.000Z` doit tomber sur la case du 17, pas du 16.
 * Données fictives uniquement.
 */
import { addDays, civilFromApi, formatCivilLong, formatMonthTitle, todayCivil, weekdayMondayFirst } from './dates'
import { holidaysToEvents } from './from-holidays'
import { SCHOOL_EVENT_TYPE_LABELS, schoolEventsToItems } from './from-events'
import { buildMonthGrid, upcomingEvents } from './month-grid'

let pass = 0, fail = 0
const out: string[] = []
function check(label: string, got: unknown, want: unknown) {
  const g = String(got), w = String(want)
  if (g === w) { pass++; out.push(`  OK    ${label.padEnd(58)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${label.padEnd(58)} attendu ${w}, obtenu ${g}`) }
}

function ferie(date: string, name = 'Jour fictif') {
  return { id: 'x', academicYearId: 'y', name, date }
}

// ── Dates civiles ───────────────────────────────────────────────────────────
{
  check('API minuit UTC -> date civile', civilFromApi('2026-10-17T00:00:00.000Z'), '2026-10-17')
  check('API date seule', civilFromApi('2026-10-17'), '2026-10-17')
  check('30 fevrier : illisible', civilFromApi('2026-02-30T00:00:00.000Z'), null)
  check('format JJ/MM : illisible', civilFromApi('17/10'), null)
  check('non-chaine : illisible', civilFromApi(null), null)
  check('1er octobre 2026 est un jeudi (lundi = 0)', weekdayMondayFirst('2026-10-01'), 3)
  check('passage d annee', addDays('2026-12-31', 1), '2027-01-01')
  check('titre du mois', formatMonthTitle(2026, 10), 'octobre 2026')
  check('date longue, 1er', formatCivilLong('2026-11-01'), '1er novembre 2026')
  check('aujourd hui = jour local', todayCivil(new Date(2026, 9, 15, 23, 30)), '2026-10-15')
}

// ── Conversion de la réponse ────────────────────────────────────────────────
{
  const { events, ignored } = holidaysToEvents([
    ferie('2026-11-01T00:00:00.000Z', 'B'),
    ferie('2026-10-17T00:00:00.000Z', 'A'),
    ferie('17/10'),
    ferie('pas-une-date'),
    { name: '   ', date: '2026-10-18T00:00:00.000Z' },
    null,
  ])
  check('elements valides gardes', events.length, 2)
  check('elements mal formes comptes', ignored, 4)
  check('tri par date', events.map((e) => e.date).join(','), '2026-10-17,2026-11-01')
  check('type unique : ferie', events.every((e) => e.kind === 'ferie'), true)
}

// ── Grille d'octobre 2026 ───────────────────────────────────────────────────
{
  const { events } = holidaysToEvents([ferie('2026-10-17T00:00:00.000Z', 'Fictif')])
  const grid = buildMonthGrid(2026, 10, events, '2026-10-15')
  const days = grid.flat()
  check('premiere case : lundi 28 septembre', days[0].date, '2026-09-28')
  check('derniere case : dimanche 1er novembre', days[days.length - 1].date, '2026-11-01')
  check('5 semaines de 7 jours', grid.map((w) => w.length).join(','), '7,7,7,7,7')
  check('isToday vrai une seule fois', days.filter((d) => d.isToday).length, 1)
  check('isToday sur le 15', days.find((d) => d.isToday)?.date, '2026-10-15')
  check('evenement sur la case du 17', days.find((d) => d.date === '2026-10-17')?.events.length, 1)
  check('rien sur la case du 16 (controle UTC)', days.find((d) => d.date === '2026-10-16')?.events.length, 0)
  check('28 septembre hors du mois', days[0].inMonth, false)
  check('samedi 17 = week-end', days.find((d) => d.date === '2026-10-17')?.isWeekend, true)
  check('vendredi 16 hors week-end', days.find((d) => d.date === '2026-10-16')?.isWeekend, false)
}

// ── Prochains jours ─────────────────────────────────────────────────────────
{
  const { events } = holidaysToEvents([
    ferie('2026-10-01T00:00:00.000Z', 'Passe'),
    ferie('2026-10-15T00:00:00.000Z', 'Aujourd hui'),
    ferie('2026-11-01T00:00:00.000Z', 'Deux'),
    ferie('2026-12-25T00:00:00.000Z', 'Trois'),
    ferie('2027-01-01T00:00:00.000Z', 'Quatre'),
  ])
  check('3 prochains, aujourd hui compris',
    upcomingEvents(events, '2026-10-15').map((e) => e.label).join(','), 'Aujourd hui,Deux,Trois')
}

// ── Événements scolaires ────────────────────────────────────────────────────
{
  const { events, ignored } = schoolEventsToItems([
    { title: 'Examen fictif', date: '2026-11-03T00:00:00.000Z', type: 'exam' },
    { title: 'Sortie fictive', date: '2026-10-17T00:00:00.000Z', type: 'trip' },
    { title: 'Type inconnu', date: '2026-10-20T00:00:00.000Z', type: 'xyz' },
    { title: 'Date illisible', date: '17/10', type: 'meeting' },
    { title: '', date: '2026-10-21T00:00:00.000Z', type: 'other' },
    42,
  ])
  check('evenements valides gardes', events.length, 3)
  check('evenements mal formes comptes', ignored, 3)
  check('tri par date', events.map((e) => e.date).join(','), '2026-10-17,2026-10-20,2026-11-03')
  check('date civile sans decalage UTC', events[0].date, '2026-10-17')
  check('type inconnu -> other', events[1].type, 'other')
  check('libelle du type', SCHOOL_EVENT_TYPE_LABELS[events[2].type], 'Examen')
  check('prochains evenements (generique)',
    upcomingEvents(events, '2026-10-18', 5).map((e) => e.title).join(','), 'Type inconnu,Examen fictif')
}

console.log(out.join('\n'))
console.log(`\n${pass} tests OK, ${fail} echec(s)`)
if (fail > 0) process.exit(1)
