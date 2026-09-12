import Decimal from 'decimal.js'
import {
  computeSubject, computeRubrique, computeGeneralAverage, computeClassAverage,
  formatScore, formatMaxScore, coeffCellValue, isPassing,
  type SubjectInput, type SectionInput, type RubriqueCode, type SubjectOutput,
} from './compute'

const D = (v: string | number) => new Decimal(v)
let pass = 0, fail = 0
const out: string[] = []
function check(label: string, got: unknown, want: unknown) {
  const g = got instanceof Decimal ? got.toFixed(4) : String(got)
  const w = want instanceof Decimal ? want.toFixed(4) : String(want)
  if (g === w) { pass++; out.push(`  OK    ${label.padEnd(56)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${label.padEnd(56)} attendu ${w}, obtenu ${g}`) }
}
const subj = (name: string, r: RubriqueCode, max: number, o: Partial<SubjectInput> = {}): SubjectInput =>
  ({ classSubjectId: `cs-${name}`, name, rubrique: r, maxScore: D(max),
     maxScoreOverride: null, sections: [], globalScores: [], exempted: false, ...o })
const sec = (n: string, max: number, sc: number[], ex = false): SectionInput =>
  ({ sectionId: `s-${n}`, name: n, maxScore: D(max), scores: sc.map(D), exempted: ex })

// ── LES 3 ECHECS DU RAPPORT D EDY ──────────────────────────────────────────
{
  const max = computeSubject(subj('Maths', 'R1', 20, { globalScores: [D(20)] }))
  check('note maximale : numerateur', max.numerator, D(20))
  check('note maximale : denominateur', max.denominator, D(20))
  check('note maximale : moyenne /10', max.average!, D(10))          // etait undefined
  check('note maximale : format 0 decimale', formatScore(max, 0), '20') // etait 20.00
  check('note maximale : format 2 decimales', formatScore(max, 2), '20.00')
  check('note maximale : format bareme', formatMaxScore(max), '20')

  const vide = computeSubject(subj('Maths', 'R1', 20, { globalScores: [] }))
  check('sans note : moyenne = 0', vide.average!, D(0))               // etait undefined
  check('sans note : format note', formatScore(vide), '—')
  check('sans note : bareme conserve', formatMaxScore(vide), '20')
}

// ── LA MOYENNE PAR MATIERE — la note transmise au MENFP ────────────────────
{
  const fr = computeSubject(subj('Francais', 'R1', 30, {
    sections: [sec('Vocabulaire', 10, [8]), sec('Orthographe', 10, [9]), sec('Grammaire', 10, [7])],
  }))
  check('MENFP : Francais 24/30 -> /10', fr.average!, D(8))
  check('MENFP : note dans son bareme', fr.numerator, D(24))

  const disp = computeSubject(subj('Sport', 'R3', 20, { exempted: true }))
  check('matiere dispensee : moyenne null', String(disp.average), 'null')
}

// ── LE TRAIT SANS TOUCHER AU GABARIT ───────────────────────────────────────
{
  const manquante = computeSubject(subj('Creole', 'R1', 30, { globalScores: [] }))
  const dispensee = computeSubject(subj('Creole', 'R1', 30, { exempted: true }))
  check('coeff cell manquante = bareme', coeffCellValue(manquante), '30')
  check('coeff cell dispensee = trait', coeffCellValue(dispensee), '—')
}

// ── BR-002 : moyenne generale = moyenne des etapes ─────────────────────────
{
  const g = computeGeneralAverage([D('7.50'), D('6.50'), D('7.00')])
  check('moyenne generale 3 etapes', g!, D(7))
  check('verdict BR-002', isPassing(g!), true)
  const g2 = computeGeneralAverage([D('6.99'), D('7.00'), D('7.00')])
  check('moyenne generale sous le seuil', isPassing(g2!), false)
  check('aucune etape -> null', String(computeGeneralAverage([])), 'null')
}

// ── MOYENNE DE CLASSE : 27 et non 30 ───────────────────────────────────────
{
  const eleves: SubjectOutput[] = []
  for (let i = 0; i < 27; i++)
    eleves.push(computeSubject(subj(`E${i}`, 'R1', 20, { globalScores: [D(15)] })))
  for (let i = 0; i < 3; i++)
    eleves.push(computeSubject(subj(`D${i}`, 'R1', 20, { exempted: true })))

  check('30 eleves fournis', eleves.length, 30)
  check('dispenses exclus -> 27 retenus', eleves.filter(e => e.average !== null).length, 27)
  check('moyenne de classe = 7,50', computeClassAverage(eleves)!, D('7.5'))

  const avecManquant = [...eleves.slice(0, 26),
    computeSubject(subj('Absent', 'R1', 20, { globalScores: [] }))]
  check('un manquant compte (0) -> 27 retenus', avecManquant.filter(e => e.average !== null).length, 27)
  check('moyenne de classe avec un 0', computeClassAverage(avecManquant)!, D('7.2222222222222222222'))
}

console.log(out.join('\n'))
console.log('\n' + '='.repeat(74))
console.log(`  ${pass} tests OK, ${fail} echec(s)`)
console.log('='.repeat(74))
process.exit(fail === 0 ? 0 : 1)
