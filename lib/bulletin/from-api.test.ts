import Decimal from 'decimal.js'
import { computeStep, computeSubject, formatScore, coeffCellValue, stepAverageOrNull, formatAverage } from './compute'
import { afficherMoyenne, bandePourcent, moyenneColonne, moyenneClasse } from './grades-view'
import { gradeMention } from './grade-color'
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

// ═══ C1 / C3 — moyennes de l'ecran Consultation en Decimal ════════════════
console.log('\n=== C1 / C3 : moyennes de colonne et de classe, arrondi ===')
{
  const matiere = (id: string, max: number, rubric: string): ApiClassSubject => ({
    id, subjectId: `s-${id}`, classSessionId: 'cls', coefficientOverride: null,
    maxScoreOverride: null, trackId: null,
    subject: { id: `s-${id}`, name: id, maxScore: max, rubric: { id: rubric }, sections: [] },
  } as unknown as ApiClassSubject)

  // C3 — R1 60/100, R2 36/40, R3 19/20 : moyenne exacte 6,925, le bulletin imprime 6,93
  const salle = [matiere('a', 100, 'r1'), matiere('b', 40, 'r2'), matiere('c', 20, 'r3')]
  const step = computeStep(toSubjectInputs({
    classSubjects: salle, rubricCodeById: idx, enrollmentId: 'e1',
    grades: [
      { classSubjectId: 'a', sectionId: null, studentScore: 60 },
      { classSubjectId: 'b', sectionId: null, studentScore: 36 },
      { classSubjectId: 'c', sectionId: null, studentScore: 19 },
    ],
  }).subjects)
  const exacte = stepAverageOrNull(step)
  check('C3 : moyenne exacte', exacte!, D('6.925'))
  check('C3 : affichage ecran = bulletin', afficherMoyenne(exacte), formatAverage(exacte))
  check('C3 : affichage 6,93', afficherMoyenne(exacte), '6.93')
  out.push(`  NOTE  ancien chemin ecran (toNumber().toFixed) : ${exacte!.toNumber().toFixed(2)}`)

  // Bande et mention sur la valeur EXACTE : 6,8999... reste en C, pas C+
  // 20 chiffres significatifs : la precision par defaut de decimal.js, celle des
  // moyennes produites par compute.ts.
  const presque = D('6.8999999999999999999')
  check('bande exacte : 6,8999… -> C', gradeMention(bandePourcent(presque)), 'C')
  out.push(`  NOTE  ancien chemin ecran (toNumber() x 10) : ${gradeMention(presque.toNumber() * 10)}`)
  check('bande exacte : 6,90 -> C+', gradeMention(bandePourcent(D('6.9'))), 'C+')
  check('bande exacte : 5,00 -> E (borne <=)', gradeMention(bandePourcent(D('5'))), 'E')
  check('bande exacte : 5,0001 -> D', gradeMention(bandePourcent(D('5.0001'))), 'D')
  check('bande : pas de moyenne', String(bandePourcent(null)), 'null')

  // Regle 3 — colonne : dispense exclue, manquante comptee 0
  const sortie = (state: 'noted' | 'missing' | 'exempted', score: number, max: number) =>
    computeSubject({
      classSubjectId: 'm', name: 'm', rubrique: 'R1', maxScore: D(max), maxScoreOverride: null,
      sections: [], globalScores: state === 'noted' ? [D(score)] : [], exempted: state === 'exempted',
    })
  const colonne = moyenneColonne(
    [sortie('noted', 8, 10), sortie('missing', 0, 10), sortie('exempted', 0, 10), undefined],
    D(10),
  )
  check('regle 3 : colonne = (8 + 0) / 2 eleves', colonne!, D(4))
  check('regle 3 : tous dispenses -> pas de moyenne', String(moyenneColonne([sortie('exempted', 0, 10)], D(10))), 'null')

  // C1 — dispense PARTIELLE : chaque eleve compte par SA moyenne, sur /10
  const fr = (dispenseS4: boolean, v: number) => computeSubject({
    classSubjectId: 'fr', name: 'fr', rubrique: 'R1', maxScore: D(40), maxScoreOverride: null,
    globalScores: [], exempted: false,
    sections: [1, 2, 3, 4].map((i) => ({
      sectionId: `s${i}`, name: `s${i}`, maxScore: D(10),
      scores: i === 4 && dispenseS4 ? [] : [D(v)], exempted: i === 4 && dispenseS4,
    })),
  })
  const c1 = moyenneColonne([fr(true, 10), fr(false, 5), fr(false, 5)], D(40))
  check('C1 : colonne /40 = moyenne(10 ; 5 ; 5)/10 x 40', c1!.toFixed(2), '26.67')
  out.push('  NOTE  ancien calcul en ligne (notes brutes 30, 20, 20) : 23.33')

  // Regle 3 — classe : eleve sans rien d'exploitable exclu, eleve a 0 compte
  const classe = moyenneClasse([D('7.005'), D('6.995'), null, D(0)])
  check('regle 3 : classe = (7,005 + 6,995 + 0) / 3', classe!.toFixed(4), '4.6667')
  check('classe vide -> pas de moyenne', String(moyenneClasse([null, null])), 'null')
}

console.log(out.join('\n'))
console.log('\n' + '='.repeat(76))
console.log(`  ${pass} tests OK, ${fail} echec(s)`)
console.log('='.repeat(76))
process.exit(fail === 0 ? 0 : 1)
