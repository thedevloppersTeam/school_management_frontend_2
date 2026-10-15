/**
 * Libellés du tableau de bord — constats B et C du lot 8.
 *
 * Vocabulaire du calendrier (lib/calendar/day-detail-state.ts) : « période »,
 * nom de l'année entre guillemets français à espaces insécables, nom jamais
 * modifié, mot « année » jamais répété. Données fictives uniquement.
 */
import {
  calendarCardDescription,
  countTileValue,
  eventsCardDescription,
  eventsEmptyMessage,
  partialDataMessage,
} from './labels'

let pass = 0, fail = 0
const out: string[] = []
function check(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; out.push(`  OK    ${label.padEnd(58)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${label.padEnd(58)} attendu ${w}, obtenu ${g}`) }
}

const NBSP = ' '
// Dates telles que le serveur les envoie (colonnes DATE, minuit UTC).
const PERIODE = { startDate: '2025-09-01T00:00:00.000Z', endDate: '2026-07-10T00:00:00.000Z' }

// -- B. Événements : phrase quand aucune ligne n'est listée -------------------
{
  check('aucun evenement configure',
    eventsEmptyMessage({ configuredCount: 0, today: '2026-01-15', year: PERIODE }),
    'Aucun événement configuré pour cette période.')
  check('periode en cours, aucun a venir',
    eventsEmptyMessage({ configuredCount: 3, today: '2026-01-15', year: PERIODE }),
    'Aucun autre événement d’ici la fin de la période.')
  check('periode finie',
    eventsEmptyMessage({ configuredCount: 3, today: '2026-10-15', year: PERIODE }),
    'La période est terminée : aucun événement à venir.')
  check('periode pas commencee',
    eventsEmptyMessage({ configuredCount: 3, today: '2025-08-01', year: PERIODE }),
    'Aucun événement à venir : la période n’a pas encore commencé.')
  check('dernier jour de la periode : encore en cours',
    eventsEmptyMessage({ configuredCount: 3, today: '2026-07-10', year: PERIODE }),
    'Aucun autre événement d’ici la fin de la période.')
  check('dates illisibles : aucune affirmation sur la periode',
    eventsEmptyMessage({ configuredCount: 3, today: '2026-10-15', year: { startDate: 'x', endDate: '' } }),
    'Aucun événement à venir.')
}

// -- B. Événements : description de la carte ---------------------------------
{
  check('nom contenant « Annee » : pas de repetition',
    eventsCardDescription('Année 2025-2026 (ESSAI)'),
    `Événements de «${NBSP}Année 2025-2026 (ESSAI)${NBSP}»`)
  check('nom de la forme 2025-2026',
    eventsCardDescription('2025-2026'),
    `Événements de «${NBSP}2025-2026${NBSP}»`)
  check('sans annee active : inchange', eventsCardDescription(null), 'Aucune année scolaire active')
}

// -- Lot 9. Calendrier : description de la carte -----------------------------
{
  check('calendrier, nom contenant « Annee » : pas de repetition',
    calendarCardDescription('Année 2025-2026 (ESSAI)'),
    `Jours fériés de «${NBSP}Année 2025-2026 (ESSAI)${NBSP}»`)
  check('calendrier, nom de la forme 2025-2026',
    calendarCardDescription('2025-2026'),
    `Jours fériés de «${NBSP}2025-2026${NBSP}»`)
  check('calendrier, nom avec des guillemets : inchange',
    calendarCardDescription('Année « pilote » 2025'),
    `Jours fériés de «${NBSP}Année « pilote » 2025${NBSP}»`)
  check('calendrier, sans annee active : inchange',
    calendarCardDescription(null), 'Aucune année scolaire active')
}

// -- C. Tuiles Matières et Bulletins archivés --------------------------------
{
  check('appel echoue : indisponible', countTileValue(null, true), 'indisponible')
  check('zero legitime : 0', countTileValue(0, true), 0)
  check('valeur positive', countTileValue(12, true), 12)
  check('sans annee active (aucun appel) : inchange', countTileValue(null, false), 'À vérifier')
}

// -- C. Bandeau « Données partielles » : deux variantes ----------------------
// Raisons telles que lib/dashboard/load-dashboard.ts les rend, dans son ordre.
const R_EFF = 'les effectifs de 1 classe(s)'
const R_MAT = 'le compteur des matières'
const R_AFF = 'les affectations matières / classes'
const R_ARC = 'le compteur des bulletins archivés'
const AUCUN = { students: false, subjects: false, archives: false, assignments: false }
const AVEC_TUILES = (r: string) =>
  `Le serveur n’a pas renvoyé ${r}. Les tuiles concernées affichent «${NBSP}indisponible${NBSP}» ; les lignes concernées, «${NBSP}À vérifier${NBSP}».`
const SANS_TUILE = (r: string) =>
  `Le serveur n’a pas renvoyé ${r}. Les lignes concernées affichent «${NBSP}À vérifier${NBSP}».`
{
  check('effectifs seuls : tuiles + lignes',
    partialDataMessage([R_EFF], { ...AUCUN, students: true }), AVEC_TUILES(R_EFF))
  check('matieres seules : tuiles + lignes',
    partialDataMessage([R_MAT], { ...AUCUN, subjects: true }), AVEC_TUILES(R_MAT))
  check('bulletins seuls : tuiles + lignes',
    partialDataMessage([R_ARC], { ...AUCUN, archives: true }), AVEC_TUILES(R_ARC))
  check('affectations seules : lignes seulement',
    partialDataMessage([R_AFF], { ...AUCUN, assignments: true }), SANS_TUILE(R_AFF))
  check('affectations + matieres : tuiles + lignes',
    partialDataMessage([R_MAT, R_AFF], { ...AUCUN, subjects: true, assignments: true }),
    AVEC_TUILES(`${R_MAT}, ${R_AFF}`))
  check('tous ensemble, raisons dans l ordre recu',
    partialDataMessage([R_EFF, R_MAT, R_AFF, R_ARC], { students: true, subjects: true, archives: true, assignments: true }),
    AVEC_TUILES(`${R_EFF}, ${R_MAT}, ${R_AFF}, ${R_ARC}`))
}

console.log(out.join('\n'))
console.log(`\n${pass} tests OK, ${fail} echec(s)`)
if (fail > 0) process.exit(1)
