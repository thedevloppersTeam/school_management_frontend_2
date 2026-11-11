/**
 * Validité annuelle des sous-matières — période de vigueur (fonctions pures).
 * SPEC-VALIDITE-SOUS-MATIERES v1.1, D-O5 : deux bornes, années scolaires,
 * « Sans limite ». Données entièrement fictives.
 */
import {
  SANS_LIMITE,
  anneesTriees,
  borneVersChoix,
  choixVersBorne,
  libellePeriode,
  libellePeriodeActuelle,
  validerPeriode,
  type AnneeScolaire,
} from './periode'

let pass = 0, fail = 0
const out: string[] = []
function check(l: string, got: unknown, want: unknown) {
  const g = String(got), w = String(want)
  if (g === w) { pass++; out.push(`  OK    ${l.padEnd(64)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${l.padEnd(64)} attendu ${w}, obtenu ${g}`) }
}

// ── Données fictives (forme de GET /api/academic-years : tri serveur par yearString décroissant) ──
const api = [
  { id: 'a-27', name: 'Année 2027', yearString: '2027-2028', startDate: '2027-09-06T00:00:00.000Z', steps: [] },
  { id: 'a-25', name: 'Année 2025', yearString: '2025-2026', startDate: '2025-09-08T00:00:00.000Z' },
  { id: 'a-26', name: 'Année 2026', yearString: '2026-2027', startDate: '2026-09-07T00:00:00.000Z' },
  { id: 'casse', yearString: '2024-2025' },         // sans date de début : écartée
  null,
  { id: '', yearString: '2023-2024', startDate: '2023-09-04T00:00:00.000Z' }, // sans id : écartée
]

// ── 1) Tri des années ────────────────────────────────────────────────────────
out.push('1) anneesTriees')
const annees: AnneeScolaire[] = anneesTriees(api)
check('trois années valides retenues', annees.length, 3)
check('triées par date de début croissante', annees.map((a) => a.yearString).join(' '), '2025-2026 2026-2027 2027-2028')
check('libellé = yearString', annees[0].libelle, '2025-2026')
check('pas un tableau → liste vide', anneesTriees({ message: 'x' }).length, 0)
const egales = anneesTriees([
  { id: 'b', yearString: '2030-2031', startDate: '2030-09-01' },
  { id: 'a', yearString: '2030-2031', startDate: '2030-09-01' },
])
check('même date : départage stable par id', egales.map((a) => a.id).join(','), 'a,b')

// ── 2) Libellé de période (Paramétrage → Relevé, W3) ─────────────────────────
out.push('2) libellePeriode')
check('sans limite → rien', libellePeriode({ validFromYearId: null, validUntilYearId: null }, annees), '')
check('champs absents (ancien serveur) → rien', libellePeriode({}, annees), '')
check('début seul', libellePeriode({ validFromYearId: 'a-26', validUntilYearId: null }, annees), 'depuis 2026-2027')
check('fin seule', libellePeriode({ validFromYearId: null, validUntilYearId: 'a-25' }, annees), 'jusqu’à 2025-2026')
check('deux bornes', libellePeriode({ validFromYearId: 'a-25', validUntilYearId: 'a-27' }, annees), 'de 2025-2026 à 2027-2028')
check('une seule année', libellePeriode({ validFromYearId: 'a-26', validUntilYearId: 'a-26' }, annees), 'en 2026-2027 seulement')
check('année inconnue : signalée, jamais devinée', libellePeriode({ validFromYearId: 'zz', validUntilYearId: null }, annees), 'depuis une année introuvable')

// ── 3) Période actuelle (fenêtre de la sous-matière, W1) ─────────────────────
out.push('3) libellePeriodeActuelle')
check('sans limite', libellePeriodeActuelle({ validFromYearId: null, validUntilYearId: null }, annees), 'En vigueur toutes les années (sans limite)')
check('bornée', libellePeriodeActuelle({ validFromYearId: 'a-26', validUntilYearId: null }, annees), 'En vigueur depuis 2026-2027')

// ── 4) Choix des listes ↔ bornes envoyées ────────────────────────────────────
out.push('4) choix ↔ bornes')
check('null → « Sans limite »', borneVersChoix(null), SANS_LIMITE)
check('absent → « Sans limite »', borneVersChoix(undefined), SANS_LIMITE)
check('id → id', borneVersChoix('a-26'), 'a-26')
check('« Sans limite » → null', choixVersBorne(SANS_LIMITE), null)
check('id → id (envoi)', choixVersBorne('a-26'), 'a-26')

// ── 5) Validation côté écran : début ≤ fin ───────────────────────────────────
out.push('5) validerPeriode')
check('sans limite : valide', validerPeriode(SANS_LIMITE, SANS_LIMITE, annees), null)
check('début seul : valide', validerPeriode('a-27', SANS_LIMITE, annees), null)
check('fin seule : valide', validerPeriode(SANS_LIMITE, 'a-25', annees), null)
check('début = fin : valide', validerPeriode('a-26', 'a-26', annees), null)
check('début < fin : valide', validerPeriode('a-25', 'a-27', annees), null)
check('début > fin : refusée', validerPeriode('a-27', 'a-25', annees),
  '« En vigueur à partir de » (2027-2028) est postérieure à « jusqu’à » (2025-2026) : choisissez une fin égale ou postérieure au début.')
check('ordre par DATE, pas par position du texte', validerPeriode('a-26', 'a-27', annees), null)
check('année inconnue : refusée', validerPeriode('zz', SANS_LIMITE, annees),
  'Une année choisie n’existe plus : rechargez la page.')

console.log(out.join('\n'))
console.log(`\n${pass} OK, ${fail} ECHEC`)
if (fail > 0) process.exit(1)
