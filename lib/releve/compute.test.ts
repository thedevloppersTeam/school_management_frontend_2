/**
 * Relevé de notes — règles de calcul pures (R-REL-1 à R-REL-6, couleurs, formats).
 *
 * Référence : docs/GABARIT-RELEVE.md (v0.3). Données entièrement fictives.
 */
import Decimal from 'decimal.js'
import { GRADE_SCALE, gradeBand } from '@/lib/bulletin/grade-color'
import {
  buildDisciplineGroup,
  buildSubjectGroups,
  cellFor,
  choosePhoto,
  formatBirthDate,
  formatCoeff,
  formatNumber,
  formatYearRange,
  legend,
  averageCellFor,
  resolveSteps,
  scopeClassSubjects,
  type SubjectGroupsInput,
} from './compute'
import {
  ReleveUnavailableError,
  type ApiBehaviorRow,
  type ApiClassSubjectRow,
  type ApiExclusionRow,
  type ApiGradeRow,
  type ApiStepRow,
  type ApiYearRow,
  type ReleveGroup,
} from './types'

let pass = 0, fail = 0
const out: string[] = []
function check(l: string, got: unknown, want: unknown) {
  const g = String(got), w = String(want)
  if (g === w) { pass++; out.push(`  OK    ${l.padEnd(64)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${l.padEnd(64)} attendu ${w}, obtenu ${g}`) }
}
/** Exécute `f` et rend la raison de l'erreur typée, ou un libellé d'échec. */
function reasonOf(f: () => unknown): string {
  try {
    f()
    return 'aucune erreur'
  } catch (e) {
    return e instanceof ReleveUnavailableError ? e.reason : `autre erreur : ${String(e)}`
  }
}

const D = (s: string) => new Decimal(s)

// ── Fabriques fictives ──────────────────────────────────────────────────────

function step(n: number, isCurrent = false, name = `Étape ${n}`): ApiStepRow {
  return { id: `st${n}`, name, stepNumber: n, isCurrent }
}
function steps(count: number): ApiStepRow[] {
  return Array.from({ length: count }, (_, i) => step(i + 1))
}
function year(over: Partial<ApiYearRow>): ApiYearRow {
  return {
    id: 'y1',
    yearString: '2000-2001',
    isCurrent: false,
    endDate: '2001-06-30T00:00:00.000Z',
    steps: steps(4),
    ...over,
  }
}
/** Matière sans sous-matière, barème `max`. */
function plain(id: string, name: string, max: string, trackId: string | null = null): ApiClassSubjectRow {
  return { id, trackId, subject: { id: `s-${id}`, name, maxScore: max, rubric: { code: 'R1' }, sections: [] } }
}
/** Matière à sous-matières. */
function sectioned(
  id: string,
  name: string,
  sections: Array<[string, string, string, number | null]>,
): ApiClassSubjectRow {
  const total = sections.reduce((a, s) => a.plus(s[2]), D('0')).toString()
  return {
    id,
    trackId: null,
    subject: {
      id: `s-${id}`,
      name,
      maxScore: total,
      rubric: { code: 'R1' },
      sections: sections.map(([sid, sname, max, order]) => ({ id: sid, name: sname, maxScore: max, displayOrder: order })),
    },
  }
}
function g(cs: string, score: string | number, sectionId: string | null = null): ApiGradeRow {
  return { classSubjectId: cs, sectionId, studentScore: score }
}
function groups(over: Partial<SubjectGroupsInput>): ReleveGroup[] {
  const st = over.steps ?? steps(4)
  return buildSubjectGroups({
    classSubjects: [],
    trackCode: null,
    enrollmentId: 'e1',
    steps: st,
    included: new Set(st.map((s) => s.id)),
    exemptedSteps: new Set(),
    gradesByStep: new Map(),
    exclusionsByStep: new Map(),
    ...over,
  })
}
const cellsText = (gr: ReleveGroup[], gi = 0, li = 0) => gr[gi].lines[li].cells.map((c) => c.text).join('|')
const moy = (gr: ReleveGroup[], gi = 0, li = 0) => gr[gi].lines[li].average.text

// ── T1 à T5 — Moy. Gnle (R-REL-3, R-REL-4) ──────────────────────────────────

{
  const gr = groups({
    classSubjects: [plain('cs1', 'Matière A', '60')],
    gradesByStep: new Map([['st1', [g('cs1', '50')]], ['st2', [g('cs1', '40')]], ['st3', [g('cs1', '45')]]]),
  })
  check('T1 barème 60, [50,40,45,sans note] : cellules', cellsText(gr), '50.00|40.00|45.00|-')
  check('T1 Moy = 7.50 (étape sans note exclue)', moy(gr), '7.50')
}
{
  const gr = groups({
    classSubjects: [plain('cs1', 'Matière A', '60')],
    gradesByStep: new Map([['st1', [g('cs1', '48.75')]]]),
  })
  check('T2 barème 60, une note 48.75 : Moy (demi supérieur)', moy(gr), '8.13')
}
{
  const gr = groups({
    classSubjects: [plain('cs1', 'Matière A', '20')],
    gradesByStep: new Map([['st1', [g('cs1', '18.75')]]]),
  })
  check('T3 barème 20, note 18.75 : Moy (demi supérieur)', moy(gr), '9.38')
}
{
  // Cas trouvé : 0.075 exact. En number, (0.75 + 0) / 2 / 50 × 10 vaut
  // 0.07499999999999999 et s'affiche « 0.07 » ; en Decimal, « 0.08 ».
  const enNumber = ((0.75 + 0) / 2 / 50) * 10
  check('T4 calcul en number : affichage', enNumber.toFixed(2), '0.07')
  const gr = groups({
    classSubjects: [plain('cs1', 'Matière A', '50')],
    gradesByStep: new Map([['st1', [g('cs1', '0.75')]], ['st2', [g('cs1', '0')]]]),
  })
  check('T4 relevé (Decimal) : Moy', moy(gr), '0.08')
  check('T4 une note 0 est une note (cellule)', gr[0].lines[0].cells[1].text, '0.00')
}
{
  const gr = groups({ classSubjects: [plain('cs1', 'Matière A', '60')] })
  check('T5 aucune étape notée : Moy', moy(gr), '-')
  check('T5 aucune étape notée : bande Moy', gr[0].lines[0].average.band, 'null')
  check('T5 aucune étape notée : cellules', cellsText(gr), '-|-|-|-')
}

// ── T6 — Coeff (R-REL-1) ────────────────────────────────────────────────────

check('T6 coeff barème 60', formatCoeff(D('60')), '6')
check('T6 coeff barème 5', formatCoeff(D('5')), '0.5')
check('T6 coeff barème 25', formatCoeff(D('25')), '2.5')
check('T6 coeff barème « 20.00 » (chaîne Decimal)', formatCoeff(D('20.00')), '2')
{
  const gr = groups({ classSubjects: [plain('cs1', 'Matière A', '60')] })
  check('T6 coeff porté par la ligne', gr[0].lines[0].coeff, '6')
}

// ── T7 — cellule = moyenne des évaluations (R-REL-2) ────────────────────────

{
  const gr = groups({
    classSubjects: [sectioned('cs1', 'Matière A', [['sa', 'Sous-matière A', '10', 1]])],
    gradesByStep: new Map([
      ['st1', [g('cs1', '8.5', 'sa'), g('cs1', '8.75', 'sa')]],
      ['st2', [g('cs1', '8.5', 'sa')]],
    ]),
  })
  check('T7 [8.5, 8.75] : cellule 8.625 affichée', gr[0].lines[0].cells[0].text, '8.63')
  // Exact : (8.625 + 8.5) / 2 = 8.5625 → 8.56 ; sur cellules arrondies :
  // (8.63 + 8.50) / 2 = 8.565 → 8.57. Le relevé doit rendre 8.56.
  check('T7 Moy sur la valeur exacte 8.625 (et non 8.63)', moy(gr), '8.56')
}

// ── T8 — dispenses ──────────────────────────────────────────────────────────

{
  const cs = sectioned('cs1', 'Matière A', [['sa', 'Sous-matière A', '10', 1], ['sb', 'Sous-matière B', '10', 2]])
  const notes = (n: string) => [g('cs1', n, 'sa'), g('cs1', n, 'sb')]
  const gradesByStep = new Map([['st1', notes('6')], ['st2', notes('9')], ['st3', notes('8')]])
  const excl: ApiExclusionRow[] = [{ enrollmentId: 'e1', classSubjectId: 'cs1', sectionId: 'sb' }]
  const autre: ApiExclusionRow[] = [{ enrollmentId: 'e2', classSubjectId: 'cs1', sectionId: 'sa' }]

  const gr = groups({ classSubjects: [cs], gradesByStep, exclusionsByStep: new Map([['st2', [...excl, ...autre]]]) })
  check('T8 sous-matière B dispensée à l’étape 2 : cellules', cellsText(gr, 0, 1), '6.00|-|8.00|-')
  check('T8 sous-matière B : Moy sans l’étape 2 = (6+8)/2', moy(gr, 0, 1), '7.00')
  check('T8 dispense d’un autre élève : sans effet', cellsText(gr, 0, 0), '6.00|9.00|8.00|-')

  const whole: ApiExclusionRow[] = [{ enrollmentId: 'e1', classSubjectId: 'cs1', sectionId: null }]
  const gr2 = groups({ classSubjects: [cs], gradesByStep, exclusionsByStep: new Map([['st2', whole]]) })
  check('T8 matière entière dispensée à l’étape 2 : ligne A', cellsText(gr2, 0, 0), '6.00|-|8.00|-')
  check('T8 matière entière dispensée à l’étape 2 : ligne B', cellsText(gr2, 0, 1), '6.00|-|8.00|-')

  const gr3 = groups({ classSubjects: [cs, plain('cs2', 'Matière B', '20')], gradesByStep: new Map([
    ...gradesByStep, ['st2', [...notes('9'), g('cs2', '20')]],
  ]), exemptedSteps: new Set(['st2']) })
  check('T8 étape dispensée : « - » sur la ligne A', cellsText(gr3, 0, 0), '6.00|-|8.00|-')
  check('T8 étape dispensée : « - » sur la matière B', cellsText(gr3, 1, 0), '-|-|-|-')
  check('T8 étape dispensée : exclue de la Moy (6+8)/2', moy(gr3, 0, 0), '7.00')
  check('T8 étape dispensée : Moy matière B sans note', moy(gr3, 1, 0), '-')
}

// ── T9 — discipline (R-REL-5) ───────────────────────────────────────────────

function discipline(rows: Array<ApiBehaviorRow | null>, exemptedSteps: Set<string> = new Set()) {
  const st = steps(rows.length)
  return buildDisciplineGroup({
    steps: st,
    included: new Set(st.map((s) => s.id)),
    exemptedSteps,
    behaviorsByStep: new Map(rows.map((r, i) => [st[i].id, r])),
  })
}
{
  const d = discipline([{ retards: 2 }, { retards: null }, null, { retards: 1 }])
  check('T9 titre du groupe', d.title, 'Discipline')
  check('T9 libellés', d.lines.map((l) => l.label).join(' / '),
    'Nbre de retards / Nbre d\'absences / Nbre de devoirs non remis / Nbre de leçons non sues / Respect des prescrits de l\'uniforme')
  check('T9 coeff 1 partout', d.lines.map((l) => l.coeff).join(','), '1,1,1,1,1')
  check('T9 retards [2, vide, absente, 1] : cellules', d.lines[0].cells.map((c) => c.text).join('|'), '2|-|-|1')
  check('T9 retards [2, vide, absente, 1] : total', d.lines[0].average.text, '3')
}
{
  const zero = { retards: 0, absences: 0, devoirsManques: 0, leconsNonSues: 0, respectUniforme: 0 }
  const d = discipline([zero, zero, zero, zero])
  check('T9 [0,0,0,0] : total retards', d.lines[0].average.text, '0')
  check('T9 [0,0,0,0] : cellule', d.lines[0].cells[0].text, '0')
  check('T9 [0,0,0,0] : uniforme moyenne', d.lines[4].average.text, '0.00')
}
{
  const d = discipline([{}, { retards: null }, null, null])
  check('T9 tout vide : total', d.lines[0].average.text, '-')
  check('T9 tout vide : uniforme', d.lines[4].average.text, '-')
}
{
  const u = (v: number | null) => ({ respectUniforme: v })
  check('T9 uniforme [8,8,8,8]', discipline([u(8), u(8), u(8), u(8)]).lines[4].average.text, '8.00')
  const d = discipline([u(8), u(null), u(7), null])
  check('T9 uniforme [8, vide, 7, absente]', d.lines[4].average.text, '7.50')
  check('T9 uniforme : cellules', d.lines[4].cells.map((c) => c.text).join('|'), '8|-|7|-')
  const bands = d.lines.flatMap((l) => [...l.cells, l.average]).filter((c) => c.band !== null).length
  check('T9 aucune bande de couleur en discipline', bands, 0)
}
{
  const full = { retards: 1, absences: 2, devoirsManques: 3, leconsNonSues: 4, respectUniforme: 9 }
  const d = discipline([full, full, full, full], new Set(['st2']))
  check('T9 étape dispensée : « - » en discipline aussi', d.lines[0].cells.map((c) => c.text).join('|'), '1|-|1|1')
  check('T9 étape dispensée : total sans elle', d.lines[1].average.text, '6')
}

// ── T10 à T13 — étapes et période (R-REL-6) ─────────────────────────────────

{
  const y = year({ steps: steps(5) })
  const r = resolveSteps(y)
  check('T10 année à 5 étapes : 5 étapes', r.steps.length, 5)
  const gr = groups({
    steps: r.steps,
    included: r.included,
    classSubjects: [plain('cs1', 'Matière A', '10')],
    gradesByStep: new Map([['st1', [g('cs1', '6')]], ['st5', [g('cs1', '9')]]]),
  })
  check('T10 5 cellules', gr[0].lines[0].cells.length, 5)
  check('T10 Moy sur les étapes notées parmi les 5', moy(gr), '7.50')
}
{
  const st = [step(4, false, 'Étape 4 & 5'), step(2), step(1), step(3)]
  const r = resolveSteps(year({ steps: st }))
  check('T11 4 étapes, ordre stepNumber', r.steps.map((s) => s.stepNumber).join(','), '1,2,3,4')
  check('T11 en-tête « Étape 4 & 5 » repris tel quel', r.steps[3].name, 'Étape 4 & 5')
}
{
  const st = [step(1), step(2, true), step(3), step(4)]
  const r = resolveSteps(year({ isCurrent: true, steps: st, endDate: '2999-06-30T00:00:00.000Z' }))
  check('T12 année active, étape 2 en cours : étapes retenues', [...r.included].sort().join(','), 'st1,st2')
  const gr = groups({
    steps: r.steps,
    included: r.included,
    classSubjects: [plain('cs1', 'Matière A', '10')],
    gradesByStep: new Map([['st1', [g('cs1', '6')]], ['st2', [g('cs1', '8')]], ['st3', [g('cs1', '10')]], ['st4', [g('cs1', '10')]]]),
  })
  check('T12 étapes 3 et 4 « - » malgré des notes', cellsText(gr), '6.00|8.00|-|-')
  check('T12 étapes 3 et 4 exclues de la Moy', moy(gr), '7.00')
  const d = buildDisciplineGroup({
    steps: r.steps,
    included: r.included,
    exemptedSteps: new Set(),
    behaviorsByStep: new Map([['st3', { retards: 5 }], ['st1', { retards: 1 }]]),
  })
  check('T12 discipline : étapes 3 et 4 « - »', d.lines[0].cells.map((c) => c.text).join('|'), '1|-|-|-')
  check('T12 discipline : total sans l’étape 3', d.lines[0].average.text, '1')
}
{
  check('T13 année active sans étape en cours : refus',
    reasonOf(() => resolveSteps(year({ isCurrent: true, endDate: '2999-06-30T00:00:00.000Z' }))), 'aucune-etape-en-cours')
  try {
    resolveSteps(year({ isCurrent: true }))
  } catch (e) {
    check('T13 message « aucune étape en cours définie »', String((e as Error).message).includes('aucune étape en cours définie'), true)
  }
  check('T13 année en préparation : refus',
    reasonOf(() => resolveSteps(year({ isCurrent: false, endDate: '2999-06-30T00:00:00.000Z' }))), 'annee-en-preparation')
  const r = resolveSteps(year({ steps: [step(1, true), step(2), step(3), step(4)] }))
  check('T13 année archivée avec une étape isCurrent : toutes', [...r.included].sort().join(','), 'st1,st2,st3,st4')
  check('T13 date de fin illisible, non active : préparation (refus)',
    reasonOf(() => resolveSteps(year({ endDate: 'illisible' }))), 'annee-en-preparation')
  check('T13 année sans étape : indisponible', reasonOf(() => resolveSteps(year({ steps: [] }))), 'indisponible')
}

// ── T14 à T17 — portée, double affectation, groupes, ordre ──────────────────

{
  const all = [
    plain('cs-tc', 'Matière TC', '10'),
    plain('cs-smp', 'Matière SMP', '10', 'track-smp'),
    plain('cs-lla', 'Matière LLA', '10', 'track-lla'),
  ]
  check('T14 élève SMP : tronc commun + SMP', scopeClassSubjects(all, 'track-smp').map((c) => c.id).join(','), 'cs-tc,cs-smp')
  check('T14 élève sans filière : tronc commun seul', scopeClassSubjects(all, null).map((c) => c.id).join(','), 'cs-tc')
}
{
  const tc = plain('cs-ph', 'Physique fictive', '10')
  const smp: ApiClassSubjectRow = { ...plain('cs-ph-smp', 'Physique fictive', '10', 'track-smp'), subject: { ...tc.subject } }
  const gr = groups({ classSubjects: [tc, plain('cs-x', 'Matière X', '10'), smp], trackCode: 'SMP' })
  check('T15 double affectation : deux groupes suffixés', gr.map((x) => x.title).join(' / '),
    'Physique fictive / Matière X / Physique fictive (SMP)')
  const single = groups({ classSubjects: [plain('cs-y', 'Matière Y', '10', 'track-smp')], trackCode: 'SMP' })
  check('T15 matière de filière seule : pas de suffixe', single[0].title, 'Matière Y')
}
{
  const gr = groups({ classSubjects: [plain('cs1', 'Matière sans sous-matière', '20')] })
  check('T16 un groupe d’une ligne', gr[0].lines.length, 1)
  check('T16 ligne au nom de la matière', gr[0].lines[0].label, 'Matière sans sous-matière')
  check('T16 type du groupe', gr[0].kind, 'matiere')
}
{
  const cs = sectioned('cs1', 'Matière A', [['s3', 'Troisième', '5', 3], ['s1', 'Première', '5', 1], ['s2', 'Deuxième', '5', 2]])
  const gr = groups({ classSubjects: [plain('cs-z', 'Matière Z', '10'), cs, plain('cs-b', 'Matière B', '10')] })
  check('T17 matières dans l’ordre API', gr.map((x) => x.title).join(','), 'Matière Z,Matière A,Matière B')
  check('T17 sous-matières triées par displayOrder', gr[1].lines.map((l) => l.label).join(','), 'Première,Deuxième,Troisième')
  check('T17 coeff des sous-matières (barème 5)', gr[1].lines[0].coeff, '0.5')
}

// ── T18 — couleurs : bornes de GRADE_SCALE (grade-color.ts:57-66) ──────────

{
  // Copie de contrôle de `colorClass` (bulletin-printable.tsx:25-35), réécrite
  // ici pour comparer sans importer le composant protégé.
  const colorClassRef = (pct: number) => (pct <= 50 ? 'echec' : pct < 60 ? 'deficient' : pct < 69 ? 'assez-bien' : 'neutre')
  const cas: Array<[string, string]> = [
    ['0', 'echec'], ['49.75', 'echec'], ['50', 'echec'], ['50.25', 'deficient'],
    ['59.75', 'deficient'], ['60', 'assez-bien'], ['68.75', 'assez-bien'], ['69', 'neutre'],
    ['74.75', 'neutre'], ['75', 'neutre'], ['77.75', 'neutre'], ['78', 'neutre'],
    ['84.75', 'neutre'], ['85', 'neutre'], ['89.75', 'neutre'], ['90', 'neutre'], ['100', 'neutre'],
  ]
  for (const [note, attendu] of cas) {
    const c = cellFor(D(note), D('100'))
    check(`T18 note ${note}/100 : bande`, c.band, attendu)
    check(`T18 note ${note}/100 : = gradeBand`, c.band, gradeBand(Number(note)))
    check(`T18 note ${note}/100 : = colorClass du bulletin`, c.band, colorClassRef(Number(note)))
  }
  check('T18 même pourcentage sur barème 20 : 10/20 = 50 %', cellFor(D('10'), D('20')).band, 'echec')
  check('T18 même pourcentage sur barème 20 : 10.25/20 = 51.25 %', cellFor(D('10.25'), D('20')).band, 'deficient')
  check('T18 cellule sans note : aucune bande', cellFor(null, D('20')).band, 'null')
  check('T18 cellule sans note : « - »', cellFor(null, D('20')).text, '-')
  // Moy. Gnle colorée sur la valeur EXACTE ×10 : 41.375/60 ×10 = 6.8958…
  // affichée 6.90 (≥ 69 % si on colorait le texte), bande « assez-bien ».
  const m = averageCellFor([D('41.5'), D('41.25')], D('60'))
  check('T18 Moy exacte 6.8958… : texte', m.text, '6.90')
  check('T18 Moy exacte 6.8958… : bande sur la valeur exacte', m.band, 'assez-bien')
  check('T18 légende : 8 entrées reprises de GRADE_SCALE', legend().length, GRADE_SCALE.length)
  check('T18 légende : mentions', legend().map((e) => e.mention).join(','), 'E,D,C,C+,B,B+,A,A+')
  check('T18 légende : plages', legend()[1].range, GRADE_SCALE[1].range)
}

// ── T22 — photo (pure) ──────────────────────────────────────────────────────

check('T22 photo de promotion de l’année : prise',
  choosePhoto([{ academicYearId: 'y0', photoUrl: '/p0.jpg' }, { academicYearId: 'y1', photoUrl: '/p1.jpg' }], 'y1', '/profil.jpg'), '/p1.jpg')
check('T22 sans photo de promotion : profil', choosePhoto([], 'y1', '/profil.jpg'), '/profil.jpg')
check('T22 sans aucune photo : null', choosePhoto([], 'y1', null), 'null')
check('T22 photo d’une AUTRE année seulement : null', choosePhoto([{ academicYearId: 'y0', photoUrl: '/p0.jpg' }], 'y1', null), 'null')
check('T22 photo de l’année vide : profil', choosePhoto([{ academicYearId: 'y1', photoUrl: '' }], 'y1', '/profil.jpg'), '/profil.jpg')

// ── T24 — date de naissance, année scolaire, nombres ────────────────────────

check('T24 date ISO minuit UTC', formatBirthDate('2010-03-05T00:00:00.000Z'), '05 Mars 2010')
check('T24 31 décembre UTC : pas de décalage', formatBirthDate('2010-12-31T00:00:00.000Z'), '31 Décembre 2010')
check('T24 1er janvier UTC : pas de décalage', formatBirthDate('2011-01-01T00:00:00.000Z'), '01 Janvier 2011')
check('T24 date seule', formatBirthDate('2009-08-15'), '15 Août 2009')
check('T24 date absente', formatBirthDate(null), '-')
check('T24 date illisible', formatBirthDate('pas une date'), '-')
check('T24 date impossible (31 février)', formatBirthDate('2010-02-31'), '-')
check('année « AAAA-AAAA » → « AAAA - AAAA »', formatYearRange('2025-2026'), '2025 - 2026')
check('année « AAAA – AAAA » (demi-cadratin)', formatYearRange('2025 – 2026'), '2025 - 2026')
check('nombre : 2 décimales, point', formatNumber(D('58')), '58.00')
check('nombre : demi supérieur', formatNumber(D('0.125')), '0.13')
check('nombre absent : tiret simple', formatNumber(null), '-')

console.log(out.join('\n'))
console.log(`\n${pass} OK, ${fail} ECHEC`)
if (fail > 0) process.exit(1)
