import Decimal from 'decimal.js'
import { computeStep, computeSubject, formatScore, coeffCellValue, stepAverageOrNull } from './compute'
import {
  toSubjectInputs, toScopedSubjectInputs, buildExclusionSet, exclusionKey, rubricIndex, WHOLE_SUBJECT,
  type ApiClassSubjectLike, type ApiGradeLike,
} from './from-api'
import { filterSubjectsByScope, type ApiClassSubject } from '@/lib/api/grades'
import { calculateBulletinAverages } from '@/lib/bulletin-calculations'

const D = (v: string | number) => new Decimal(v)
let pass = 0, fail = 0
const out: string[] = []
function check(l: string, got: unknown, want: unknown) {
  const g = got instanceof Decimal ? got.toFixed(4) : String(got)
  const w = want instanceof Decimal ? want.toFixed(4) : String(want)
  if (g === w) { pass++; out.push(`  OK    ${l.padEnd(58)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${l.padEnd(58)} attendu ${w}, obtenu ${g}`) }
}

const rubrics = [
  { id: 'r1', code: 'R1' }, { id: 'r2', code: 'R2' }, { id: 'r3', code: 'R3' },
]
const idx = rubricIndex(rubrics)

// Francais decoupe en 3 sous-matieres /10, dans la MEME matiere affectee 2 fois
const francais = (csId: string): ApiClassSubjectLike => ({
  id: csId, maxScoreOverride: null,
  subject: {
    id: 'subj-fr', name: 'Francais', maxScore: 30, rubric: { id: 'r1' },
    sections: [
      { id: 'sec-voc', name: 'Vocabulaire', maxScore: 10 },
      { id: 'sec-ort', name: 'Orthographe', maxScore: 10 },
      { id: 'sec-gra', name: 'Grammaire',   maxScore: 10 },
    ],
  },
})

// ═══ LE BUG DE CLE AMPUTEE ════════════════════════════════════════════════
console.log('\n=== BUG DE CLE : meme matiere affectee deux fois ===')
{
  // cs-commun = tronc commun, cs-filiere = examen de filiere. Meme subject,
  // donc MEMES sectionId.
  const classSubjects = [francais('cs-commun'), francais('cs-filiere')]
  const grades: ApiGradeLike[] = [
    { classSubjectId: 'cs-commun',  sectionId: 'sec-voc', studentScore: 8 },
    { classSubjectId: 'cs-commun',  sectionId: 'sec-ort', studentScore: 9 },
    { classSubjectId: 'cs-commun',  sectionId: 'sec-gra', studentScore: 7 },
    { classSubjectId: 'cs-filiere', sectionId: 'sec-voc', studentScore: 6 },
    { classSubjectId: 'cs-filiere', sectionId: 'sec-ort', studentScore: 6 },
    { classSubjectId: 'cs-filiere', sectionId: 'sec-gra', studentScore: 6 },
  ]

  // Dispense de Grammaire UNIQUEMENT sur le tronc commun
  const exclusions = buildExclusionSet([
    { enrollmentId: 'e1', classSubjectId: 'cs-commun', sectionId: 'sec-gra' },
  ])

  const { subjects } = toSubjectInputs({
    classSubjects, grades, rubricCodeById: idx, enrollmentId: 'e1', exclusions,
  })

  const commun  = computeSubject(subjects.find(s => s.classSubjectId === 'cs-commun')!)
  const filiere = computeSubject(subjects.find(s => s.classSubjectId === 'cs-filiere')!)

  check('tronc commun : Grammaire dispensee', commun.sections[2].state, 'exempted')
  check('tronc commun : 8+9 / 10+10', commun.numerator, D(17))
  check('tronc commun : denominateur', commun.denominator, D(20))

  check('filiere : Grammaire NON dispensee', filiere.sections[2].state, 'noted')
  check('filiere : 6+6+6 / 30', filiere.numerator, D(18))
  check('filiere : denominateur', filiere.denominator, D(30))

  // Ce que produisait l ancienne cle Map<enrollmentId, Set<sectionId>>
  const ancienne = new Set(['sec-gra'])
  check('ancienne cle : la filiere aussi excluait', ancienne.has('sec-gra'), true)
  out.push('  NOTE  la cle complete isole les deux affectations : bug corrige')
}

// ═══ DISPENSE DE LA MATIERE ENTIERE (mode global, 9e / NS4) ════════════════
console.log('\n=== DISPENSE MATIERE ENTIERE — classes d examen ===')
{
  const classSubjects = [francais('cs-1')]
  const grades: ApiGradeLike[] = [
    { classSubjectId: 'cs-1', sectionId: null, studentScore: 24 }, // examen en blanc
  ]
  const exclusions = buildExclusionSet([
    { enrollmentId: 'e1', classSubjectId: 'cs-1', sectionId: null },
  ])

  const sans = toSubjectInputs({ classSubjects, grades, rubricCodeById: idx, enrollmentId: 'e1' })
  const o1 = computeSubject(sans.subjects[0])
  check('mode global detecte', o1.mode, 'global')
  check('note globale 24/30', o1.numerator, D(24))
  check('moyenne /10', o1.average!, D(8))

  const avec = toSubjectInputs({ classSubjects, grades, rubricCodeById: idx, enrollmentId: 'e1', exclusions })
  const o2 = computeSubject(avec.subjects[0])
  check('dispense globale : numerateur', o2.numerator, D(0))
  check('dispense globale : denominateur', o2.denominator, D(0))
  check('dispense globale : trait sur ponderation', coeffCellValue(o2), '—')
  check('cle sentinelle', exclusionKey('e1', 'cs-1', null), `e1::cs-1::${WHOLE_SUBJECT}`)
}

// ═══ DR-003 : matiere sans rubrique — refus, pas silence ═══════════════════
console.log('\n=== DR-003 — MATIERE SANS RUBRIQUE ===')
{
  const r = toSubjectInputs({
    classSubjects: [
      francais('cs-ok'),
      { id: 'cs-orphan', maxScoreOverride: null,
        subject: { id: 's2', name: 'Dessin', maxScore: 20, rubric: null, sections: [] } },
      { id: 'cs-bad', maxScoreOverride: null,
        subject: { id: 's3', name: 'Musique', maxScore: 20, rubric: { id: 'r9' }, sections: [] } },
    ],
    grades: [], rubricCodeById: idx, enrollmentId: 'e1',
  })
  check('matieres retenues', r.subjects.length, 1)
  check('matieres non mappees signalees', r.unmapped.length, 2)
  check('raison : aucune rubrique', r.unmapped[0].reason.slice(0, 14), 'aucune rubriqu')
  check('raison : rubrique inconnue', r.unmapped[1].reason.slice(0, 8), 'rubrique')
}

// ═══ maxScoreOverride ET plusieurs evaluations ═════════════════════════════
console.log('\n=== maxScoreOverride ET EVALUATIONS MULTIPLES ===')
{
  const r = toSubjectInputs({
    classSubjects: [{
      id: 'cs-m', maxScoreOverride: 40,
      subject: { id: 'sm', name: 'Maths', maxScore: 20, rubric: { id: 'r1' }, sections: [] },
    }],
    grades: [
      { classSubjectId: 'cs-m', sectionId: null, studentScore: 30 },
      { classSubjectId: 'cs-m', sectionId: null, studentScore: 34 },
    ],
    rubricCodeById: idx, enrollmentId: 'e1',
  })
  const o = computeSubject(r.subjects[0])
  check('override 40 prime sur 20', o.denominator, D(40))
  check('deux evaluations moyennees', o.numerator, D(32))
  check('moyenne /10', o.average!, D(8))
}

// ═══ LE CAS PIERRE, DEPUIS DES DONNEES D API ═══════════════════════════════
console.log('\n=== CAS PIERRE, BOUT EN BOUT DEPUIS L API ===')
{
  const cs: ApiClassSubjectLike[] = [
    { id: 'cs-math',   maxScoreOverride: null, subject: { id: 'a', name: 'Math',   maxScore: 20, rubric: { id: 'r1' }, sections: [] } },
    { id: 'cs-franc',  maxScoreOverride: null, subject: { id: 'b', name: 'Franc',  maxScore: 30, rubric: { id: 'r1' }, sections: [] } },
    { id: 'cs-creole', maxScoreOverride: null, subject: { id: 'c', name: 'Creole', maxScore: 30, rubric: { id: 'r1' }, sections: [] } },
  ]
  const grades: ApiGradeLike[] = [
    { classSubjectId: 'cs-math',  sectionId: null, studentScore: '10' },  // chaine, comme l API
    { classSubjectId: 'cs-franc', sectionId: null, studentScore: '10' },
  ]

  const manquante = computeStep(toSubjectInputs({ classSubjects: cs, grades, rubricCodeById: idx, enrollmentId: 'e1' }).subjects)
  check('manquante : R1 = 20/80', manquante.r1.average!, D('2.5'))
  check('manquante : moyenne etape', manquante.average, D('1.75'))

  const dispensee = computeStep(toSubjectInputs({
    classSubjects: cs, grades, rubricCodeById: idx, enrollmentId: 'e1',
    exclusions: buildExclusionSet([{ enrollmentId: 'e1', classSubjectId: 'cs-creole', sectionId: null }]),
  }).subjects)
  check('dispensee : R1 = 20/50', dispensee.r1.average!, D(4))
  check('dispensee : moyenne etape', dispensee.average, D('2.8'))
}

// ═══ C2 — PORTEE FILIERE : l'ecran doit egaler le bulletin ════════════════
console.log('\n=== C2 : portee filiere, ecran = bulletin ===')
{
  // Salle a deux filieres : tronc commun + un examen par filiere, tout en R1 /10.
  const matiere = (id: string, trackId: string | null): ApiClassSubject => ({
    id, subjectId: `s-${id}`, classSessionId: 'cls', coefficientOverride: null,
    maxScoreOverride: null, trackId,
    subject: { id: `s-${id}`, name: id, maxScore: 10, rubric: { id: 'r1' }, sections: [] },
  } as unknown as ApiClassSubject)
  const salle = [matiere('tronc', null), matiere('examA', 'tA'), matiere('examB', 'tB')]
  // Eleve de la filiere A : tronc 8/10, examen A 9/10, rien en examen B (pas sa filiere)
  const grades: ApiGradeLike[] = [
    { classSubjectId: 'tronc', sectionId: null, studentScore: 8 },
    { classSubjectId: 'examA', sectionId: null, studentScore: 9 },
  ]

  // Reference : le chemin EXACT du bulletin (bulletin.ts:722 puis :732)
  const bulletin = (scope: 'common' | 'exam', trackId: string | null) =>
    calculateBulletinAverages(toSubjectInputs({
      classSubjects: filterSubjectsByScope(salle, scope, trackId),
      grades, rubricCodeById: idx, enrollmentId: 'e1',
    }).subjects).exact.moyenneEtape
  const ecran = (scope: 'common' | 'exam', trackId: string | null) =>
    stepAverageOrNull(computeStep(toScopedSubjectInputs({
      classSubjects: salle, grades, rubricCodeById: idx, enrollmentId: 'e1',
      scope, trackId,
    }).subjects))

  check('normal : bulletin = 8/10 x 0,70', bulletin('common', 'tA')!, D('5.6'))
  check('normal : ecran = bulletin', ecran('common', 'tA')!, bulletin('common', 'tA')!)
  check('examen : bulletin = 9/10 x 0,70', bulletin('exam', 'tA')!, D('6.3'))
  check('examen : ecran = bulletin', ecran('exam', 'tA')!, bulletin('exam', 'tA')!)
  check('examen B jamais compte pour un eleve de A',
    toScopedSubjectInputs({ classSubjects: salle, grades, rubricCodeById: idx, enrollmentId: 'e1', scope: 'exam', trackId: 'tA' })
      .subjects.some((s) => s.classSubjectId === 'examB'), false)
  check('examen, eleve sans filiere : rien a moyenner', String(ecran('exam', null)), String(bulletin('exam', null)))

  // Salle sans filiere : la portee normale ne change rien
  const fondamental = [matiere('m1', null), matiere('m2', null)]
  const g2: ApiGradeLike[] = [
    { classSubjectId: 'm1', sectionId: null, studentScore: 6 },
    { classSubjectId: 'm2', sectionId: null, studentScore: 7 },
  ]
  const avant = computeStep(toSubjectInputs({ classSubjects: fondamental, grades: g2, rubricCodeById: idx, enrollmentId: 'e1' }).subjects)
  const apres = computeStep(toScopedSubjectInputs({ classSubjects: fondamental, grades: g2, rubricCodeById: idx, enrollmentId: 'e1', scope: 'common', trackId: null }).subjects)
  check('sans filiere : moyenne inchangee', apres.average, avant.average)
}

console.log(out.join('\n'))
console.log('\n' + '='.repeat(76))
console.log(`  ${pass} tests OK, ${fail} echec(s)`)
console.log('='.repeat(76))
process.exit(fail === 0 ? 0 : 1)
