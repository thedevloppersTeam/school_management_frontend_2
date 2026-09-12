import Decimal from 'decimal.js'
import {
  computeSubject, computeRubrique, computeStep, computeStepAverage,
  isPassing, checkMaxScoreCoherence, isValidGrade, detectMode,
  formatScore, formatMaxScore, formatAverage,
  type SubjectInput, type SectionInput, type RubriqueCode,
} from './compute'

const D = (v: string | number) => new Decimal(v)

let pass = 0, fail = 0
const results: string[] = []

function check(label: string, got: unknown, want: unknown) {
  const g = got instanceof Decimal ? got.toFixed(4) : String(got)
  const w = want instanceof Decimal ? want.toFixed(4) : String(want)
  if (g === w) { pass++; results.push(`  OK    ${label.padEnd(58)} = ${g}`) }
  else { fail++; results.push(`  ECHEC ${label.padEnd(58)} attendu ${w}, obtenu ${g}`) }
}

// Fabriques
const sec = (name: string, max: number, scores: number[], exempted = false): SectionInput => ({
  sectionId: `sec-${name}`, name, maxScore: D(max),
  scores: scores.map(D), exempted,
})

const subj = (
  name: string, rubrique: RubriqueCode, max: number,
  o: Partial<SubjectInput> = {},
): SubjectInput => ({
  classSubjectId: `cs-${name}`, name, rubrique, maxScore: D(max),
  maxScoreOverride: null, sections: [], globalScores: [], exempted: false, ...o,
})

// ════════════════════════════════════════════════════════════════════════════
// CAS 1 et 2 — l'exemple Pierre, reference de la specification
// ════════════════════════════════════════════════════════════════════════════
console.log('\n=== CAS PIERRE — note manquante vs dispense ===')
{
  const pierre = (creoleExempted: boolean): SubjectInput[] => [
    subj('Math', 'R1', 20, { globalScores: [D(10)] }),
    subj('Franc', 'R1', 30, { globalScores: [D(10)] }),
    subj('Creole', 'R1', 30, { globalScores: [], exempted: creoleExempted }),
  ]

  const manquante = computeRubrique('R1', pierre(false))
  check('manquante  : numerateur', manquante.numerator, D(20))
  check('manquante  : denominateur', manquante.denominator, D(80))
  check('manquante  : moyenne /10', manquante.average!, D('2.5'))

  const dispensee = computeRubrique('R1', pierre(true))
  check('dispensee  : numerateur', dispensee.numerator, D(20))
  check('dispensee  : denominateur', dispensee.denominator, D(50))
  check('dispensee  : moyenne /10', dispensee.average!, D(4))

  const c = manquante.subjects.find((s) => s.name === 'Creole')!
  const d = dispensee.subjects.find((s) => s.name === 'Creole')!
  check('manquante  : etat Creole', c.state, 'missing')
  check('manquante  : colonne note', formatScore(c), '—')
  check('manquante  : colonne ponderation', formatMaxScore(c), '30')
  check('dispensee  : etat Creole', d.state, 'exempted')
  check('dispensee  : colonne note', formatScore(d), '—')
  check('dispensee  : colonne ponderation', formatMaxScore(d), '—')
}

// ════════════════════════════════════════════════════════════════════════════
// CAS 3 — AUCUNE RENORMALISATION : rubrique absente = zero
// ════════════════════════════════════════════════════════════════════════════
console.log('\n=== AUCUNE RENORMALISATION DES POIDS ===')
{
  const s = [
    subj('Maths', 'R1', 20, { globalScores: [D(16)] }),
    subj('Francais', 'R1', 60, { globalScores: [D(45)] }),
  ]
  const step = computeStep(s)
  check('R1 = (61/80) x 10', step.r1.average!, D('7.625'))
  check('R2 absente -> average null', String(step.r2.average), 'null')
  check('R3 absente -> average null', String(step.r3.average), 'null')
  check('moyenne etape = 7,625 x 0,70', step.average, D('5.3375'))
  check('verdict BR-002', step.passing, false)
  check('le bulletin actuel renormalisait a', D('7.625').toFixed(4), D('7.6250').toFixed(4))
}

// ════════════════════════════════════════════════════════════════════════════
// CAS 4 — rubrique entierement dispensee / entierement manquante
// ════════════════════════════════════════════════════════════════════════════
console.log('\n=== RUBRIQUE ENTIEREMENT DISPENSEE OU MANQUANTE ===')
{
  const tousDispenses = computeRubrique('R2', [
    subj('Anglais', 'R2', 20, { exempted: true }),
    subj('Histoire', 'R2', 20, { exempted: true }),
  ])
  check('denominateur nul', tousDispenses.denominator, D(0))
  check('average null (pas de division par zero)', String(tousDispenses.average), 'null')

  const tousManquants = computeRubrique('R2', [
    subj('Anglais', 'R2', 20, { globalScores: [] }),
    subj('Histoire', 'R2', 20, { globalScores: [] }),
  ])
  check('manquants : denominateur conserve', tousManquants.denominator, D(40))
  check('manquants : moyenne = 0', tousManquants.average!, D(0))
}

// ════════════════════════════════════════════════════════════════════════════
// CAS 5 — le seuil BR-002 exact : la ou le flottant echoue
// ════════════════════════════════════════════════════════════════════════════
console.log('\n=== SEUIL BR-002 A 7,00 EXACT ===')
{
  const r = (code: RubriqueCode, v: string) =>
    ({ code, numerator: D(0), denominator: D(1), average: D(v), subjects: [], warnings: [] })

  const avg = computeStepAverage(r('R1', '7.00'), r('R2', '7.00'), r('R3', '7.00'))
  check('Decimal : 7,00/7,00/7,00', avg, D('7.00'))
  check('Decimal : verdict', isPassing(avg), true)

  const flottant = 7.0 * 0.70 + 7.0 * 0.25 + 7.0 * 0.05
  check('flottant : meme calcul', flottant, 6.999999999999999)
  check('flottant : verdict >= 7', flottant >= 7, false)
  results.push('  NOTE  le flottant declare ECHEC un eleve que BR-002 declare REUSSI')

  const a2 = computeStepAverage(r('R1', '7.25'), r('R2', '6.50'), r('R3', '6.50'))
  check('Decimal : 7,25/6,50/6,50 affiche', formatAverage(a2), '7.03')
  check('flottant : le meme affiche', (7.25 * 0.7 + 6.5 * 0.25 + 6.5 * 0.05).toFixed(2), '7.02')
}

// ════════════════════════════════════════════════════════════════════════════
// CAS 6 — sous-matieres, plusieurs evaluations, dispense partielle
// ════════════════════════════════════════════════════════════════════════════
console.log('\n=== MODE SOUS-MATIERES ===')
{
  const francais = subj('Francais', 'R1', 30, {
    sections: [
      sec('Vocabulaire', 10, [8, 6]),   // moyenne 7
      sec('Orthographe', 10, [9]),
      sec('Grammaire', 10, []),         // manquante -> 0, bareme conserve
    ],
  })
  const o = computeSubject(francais)
  check('mode detecte', o.mode, 'sections')
  check('numerateur 7 + 9 + 0', o.numerator, D(16))
  check('denominateur 10+10+10', o.denominator, D(30))
  check('Vocabulaire : moyenne de 8 et 6', o.sections[0].score!, D(7))
  check('Grammaire : manquante', o.sections[2].state, 'missing')
  check('aucun avertissement de bareme', o.warnings.length, 0)

  const avecDispense = computeSubject(subj('Francais', 'R1', 30, {
    sections: [
      sec('Vocabulaire', 10, [8]),
      sec('Orthographe', 10, [9]),
      sec('Grammaire', 10, [], true),   // dispensee -> sort des deux
    ],
  }))
  check('dispense partielle : numerateur', avecDispense.numerator, D(17))
  check('dispense partielle : denominateur', avecDispense.denominator, D(20))
}

// ════════════════════════════════════════════════════════════════════════════
// CAS 7 — mode global des classes d'examen, et modes melanges
// ════════════════════════════════════════════════════════════════════════════
console.log('\n=== MODE GLOBAL (classes d examen 9e / NS4) ===')
{
  const examen = subj('Francais', 'R1', 30, {
    sections: [sec('Vocabulaire', 10, []), sec('Orthographe', 10, [])],
    globalScores: [D(24)],
  })
  const o = computeSubject(examen)
  check('mode detecte', o.mode, 'global')
  check('numerateur = la note globale', o.numerator, D(24))
  check('denominateur = bareme matiere', o.denominator, D(30))
  check('sous-matieres ignorees', o.sections.length, 0)

  const melange = computeSubject(subj('Francais', 'R1', 30, {
    sections: [sec('Vocabulaire', 10, [8])],
    globalScores: [D(24)],
  }))
  check('modes melanges : signale', melange.warnings.length >= 1, true)
  check('modes melanges : sections priment', melange.mode, 'sections')

  const globalDispense = computeSubject(subj('Francais', 'R1', 30, {
    globalScores: [D(24)], exempted: true,
  }))
  check('dispense en mode global : numerateur', globalDispense.numerator, D(0))
  check('dispense en mode global : denominateur', globalDispense.denominator, D(0))
}

// ════════════════════════════════════════════════════════════════════════════
// CAS 8 — maxScoreOverride et incoherence de bareme
// ════════════════════════════════════════════════════════════════════════════
console.log('\n=== maxScoreOverride ET GARDE-FOU DE BAREME ===')
{
  const o = computeSubject(subj('Maths', 'R1', 20, {
    maxScoreOverride: D(40), globalScores: [D(32)],
  }))
  check('override prime sur le bareme', o.denominator, D(40))

  const incoherent = computeSubject(subj('Francais', 'R1', 60, {
    sections: [sec('A', 40, [30]), sec('B', 40, [30])],  // total 80 != 60
  }))
  check('incoherence 60 vs 80 detectee', incoherent.warnings.length, 1)
  check('denominateur = somme des sections', incoherent.denominator, D(80))
  results.push(`  NOTE  ${incoherent.warnings[0]}`)

  check('bareme a 0 : refuse', String(checkMaxScoreCoherence(D(0), D(30))!.slice(0, 26)),
    'Bareme de la matiere inval')
}

// ════════════════════════════════════════════════════════════════════════════
// CAS 9 — DR-004, pas de 0,25
// ════════════════════════════════════════════════════════════════════════════
console.log('\n=== DR-004 — PAS DE 0,25 ===')
{
  check('15,75 valide', isValidGrade(D('15.75'), D(20)), true)
  check('15,25 valide', isValidGrade(D('15.25'), D(20)), true)
  check('15,10 refusee', isValidGrade(D('15.10'), D(20)), false)
  check('15,33 refusee', isValidGrade(D('15.33'), D(20)), false)
  check('hors bareme refusee', isValidGrade(D(21), D(20)), false)
  check('negative refusee', isValidGrade(D('-1'), D(20)), false)
  check('0 valide', isValidGrade(D(0), D(20)), true)
}

// ────────────────────────────────────────────────────────────────────────────
console.log(results.join('\n'))
console.log('\n' + '='.repeat(78))
console.log(`  ${pass} tests OK, ${fail} echec(s)`)
console.log('='.repeat(78))
process.exit(fail === 0 ? 0 : 1)
