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
function rawGroups(over: Partial<SubjectGroupsInput>): ReleveGroup[] {
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
/**
 * Comme `rawGroups`, mais chaque étape reçoit une entrée vide dans les tables
 * de notes et de dispenses quand le test n'en fournit pas : depuis K4, une
 * étape retenue ABSENTE d'une table est un refus, pas « sans note ».
 */
function groups(over: Partial<SubjectGroupsInput>): ReleveGroup[] {
  const st = over.steps ?? steps(4)
  const fill = <T,>(given: ReadonlyMap<string, T[]> | undefined) =>
    new Map(st.map((x) => [x.id, given?.get(x.id) ?? []] as [string, T[]]))
  return rawGroups({
    ...over,
    gradesByStep: fill(over.gradesByStep),
    exclusionsByStep: fill(over.exclusionsByStep),
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
  // `exemptedSteps` ne fait plus partie du contrat (C2, Q-B) : il est passé par
  // une variable, hors du contrôle de propriété en trop, pour vérifier qu'une
  // dispense d'étape transmise quand même reste SANS effet sur la discipline.
  const input = {
    steps: st,
    included: new Set(st.map((s) => s.id)),
    exemptedSteps,
    behaviorsByStep: new Map(rows.map((r, i) => [st[i].id, r])),
  }
  return buildDisciplineGroup(input)
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
  check('T9 uniforme : cellules (C5, 2 décimales)', d.lines[4].cells.map((c) => c.text).join('|'), '8.00|-|7.00|-')
  const bands = d.lines.flatMap((l) => [...l.cells, l.average]).filter((c) => c.band !== null).length
  check('T9 aucune bande de couleur en discipline', bands, 0)
}
{
  const full = { retards: 1, absences: 2, devoirsManques: 3, leconsNonSues: 4, respectUniforme: 9 }
  const d = discipline([full, full, full, full], new Set(['st2']))
  check('U6 étape dispensée : fiche comptée en discipline (Q-B)', d.lines[0].cells.map((c) => c.text).join('|'), '1|1|1|1')
  check('U6 étape dispensée : total avec elle', d.lines[1].average.text, '8')
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
    behaviorsByStep: new Map([['st3', { retards: 5 }], ['st1', { retards: 1 }], ['st2', null]]),
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
  // Moy. Gnle colorée sur la valeur AFFICHÉE ×10 (Q-C) : 41.375/60 ×10 = 6.8958…
  // affichée 6.90 → 69 % → bande « neutre » (aucune couleur).
  const m = averageCellFor([D('41.5'), D('41.25')], D('60'))
  check('T18/U7 Moy exacte 6.8958… : texte', m.text, '6.90')
  check('T18/U7 Moy exacte 6.8958… : bande sur l’affiché (aucune couleur)', m.band, 'neutre')
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

// ── Lot 1b — U1 à U5 : ligne globale (C1, Q-A) ──────────────────────────────

/** Comme `groups`, mais rend la raison d'un refus au lieu de l'exception. */
function tryGroups(over: Partial<SubjectGroupsInput>): { gr: ReleveGroup[] | null; err: string; msg: string } {
  try {
    return { gr: groups(over), err: 'aucune erreur', msg: '' }
  } catch (e) {
    return {
      gr: null,
      err: e instanceof ReleveUnavailableError ? e.reason : `autre : ${String(e)}`,
      msg: e instanceof Error ? e.message : '',
    }
  }
}
const labels = (gr: ReleveGroup[] | null) => (gr ? gr[0].lines.map((l) => l.label).join(',') : 'refus')
const lineCells = (gr: ReleveGroup[] | null, li: number) =>
  gr ? (gr[0].lines[li]?.cells.map((c) => c.text).join('|') ?? 'absente') : 'refus'
const csAB = () => sectioned('cs1', 'Matière A', [['sa', 'Sous-matière A', '10', 1], ['sb', 'Sous-matière B', '10', 2]])
{
  const r = tryGroups({ classSubjects: [csAB()], gradesByStep: new Map([['st1', [g('cs1', '15')]]]) })
  check('U1 note globale seule : aucun refus', r.err, 'aucune erreur')
  check('U1 3 lignes, la globale en dernier', labels(r.gr), 'Sous-matière A,Sous-matière B,Matière A')
  check('U1 coeff ligne globale = barème matière 20 ÷ 10', r.gr?.[0].lines[2]?.coeff, '2')
  check('U1 cellules ligne globale', lineCells(r.gr, 2), '15.00|-|-|-')
  check('U1 Moy ligne globale 15/20 × 10', r.gr?.[0].lines[2]?.average.text, '7.50')
  check('U1 bande cellule globale 75 %', r.gr?.[0].lines[2]?.cells[0].band, 'neutre')
  check('U1 sous-matières sans note', lineCells(r.gr, 0), '-|-|-|-')
}
{
  const r = tryGroups({
    classSubjects: [csAB()],
    gradesByStep: new Map([['st1', [g('cs1', '16'), g('cs1', '8', 'sa'), g('cs1', '6', 'sb')]]]),
  })
  check('U2 étape mixte : aucun refus', r.err, 'aucune erreur')
  check('U2 sous-matière A', lineCells(r.gr, 0), '8.00|-|-|-')
  check('U2 sous-matière B', lineCells(r.gr, 1), '6.00|-|-|-')
  check('U2 ligne globale', lineCells(r.gr, 2), '16.00|-|-|-')
}
{
  const r = tryGroups({ classSubjects: [csAB()], gradesByStep: new Map([['st1', [g('cs1', '8', 'sa')]]]) })
  check('U3 aucune note globale : pas de ligne globale', labels(r.gr), 'Sous-matière A,Sous-matière B')
  const etapeNonRetenue = tryGroups({
    classSubjects: [csAB()],
    included: new Set(['st1', 'st2']),
    gradesByStep: new Map([['st3', [g('cs1', '15')]]]),
  })
  check('U3 note globale sur une étape NON retenue : pas de ligne', labels(etapeNonRetenue.gr), 'Sous-matière A,Sous-matière B')
}
{
  const r = tryGroups({ classSubjects: [csAB()], gradesByStep: new Map([['st1', [g('cs1', '8', 'inconnue')]]]) })
  check('U4 sous-matière inconnue : refus « indisponible »', r.err, 'indisponible')
  check('U4 message sans nom de matière', r.msg.includes('Matière A'), false)
}
{
  const notes = (n: string) => [g('cs1', n), g('cs1', n, 'sa'), g('cs1', n, 'sb')]
  const r = tryGroups({
    classSubjects: [csAB()],
    gradesByStep: new Map([['st1', notes('6')], ['st2', notes('9')]]),
    exclusionsByStep: new Map([['st2', [{ enrollmentId: 'e1', classSubjectId: 'cs1', sectionId: null }]]]),
  })
  check('U5 dispense matière entière étape 2 : ligne A', lineCells(r.gr, 0), '6.00|-|-|-')
  check('U5 dispense matière entière étape 2 : ligne B', lineCells(r.gr, 1), '6.00|-|-|-')
  check('U5 dispense matière entière étape 2 : ligne globale', lineCells(r.gr, 2), '6.00|-|-|-')
}

// ── Lot 1c — G-1 à G-6, G-11, G-12, K2 à K4 ─────────────────────────────────

{
  // G-1 : toutes les sous-matières dispensées à l'étape 2, ligne globale présente.
  const both: ApiExclusionRow[] = [
    { enrollmentId: 'e1', classSubjectId: 'cs1', sectionId: 'sa' },
    { enrollmentId: 'e1', classSubjectId: 'cs1', sectionId: 'sb' },
  ]
  const r = tryGroups({
    classSubjects: [csAB()],
    gradesByStep: new Map([
      ['st1', [g('cs1', '15'), g('cs1', '8', 'sa'), g('cs1', '6', 'sb')]],
      ['st2', [g('cs1', '12'), g('cs1', '9', 'sa'), g('cs1', '9', 'sb')]],
    ]),
    exclusionsByStep: new Map([['st2', both]]),
  })
  check('G-1 sous-matière A : étape 2 « - »', lineCells(r.gr, 0), '8.00|-|-|-')
  check('G-1 sous-matière B : étape 2 « - »', lineCells(r.gr, 1), '6.00|-|-|-')
  check('G-1 ligne globale : étape 2 « - » (règle du bulletin)', lineCells(r.gr, 2), '15.00|-|-|-')
  check('G-1 Moy ligne globale sur l’étape 1 seule', r.gr?.[0].lines[2]?.average.text, '7.50')
}
{
  // G-2 / K2 : seule note globale sur une étape dispensée pour l'élève.
  const r = tryGroups({
    classSubjects: [csAB()],
    gradesByStep: new Map([['st1', [g('cs1', '8', 'sa')]], ['st2', [g('cs1', '15')]]]),
    exemptedSteps: new Set(['st2']),
  })
  check('G-2/K2 note globale sur étape dispensée seule : pas de ligne', labels(r.gr), 'Sous-matière A,Sous-matière B')
  // G-2 bis / K2 : seule note globale sur une étape où la matière entière est dispensée.
  const r2 = tryGroups({
    classSubjects: [csAB()],
    gradesByStep: new Map([['st2', [g('cs1', '15')]]]),
    exclusionsByStep: new Map([['st2', [{ enrollmentId: 'e1', classSubjectId: 'cs1', sectionId: null }]]]),
  })
  check('G-2 bis/K2 note globale sous WHOLE_SUBJECT seule : pas de ligne', labels(r2.gr), 'Sous-matière A,Sous-matière B')
  // Dispense WHOLE_SUBJECT d'un AUTRE élève : sans effet sur le déclencheur.
  const r3 = tryGroups({
    classSubjects: [csAB()],
    gradesByStep: new Map([['st2', [g('cs1', '15')]]]),
    exclusionsByStep: new Map([['st2', [{ enrollmentId: 'e2', classSubjectId: 'cs1', sectionId: null }]]]),
  })
  check('K2 dispense d’un autre élève : la ligne existe', labels(r3.gr), 'Sous-matière A,Sous-matière B,Matière A')
  // G-2 ter : une note globale sur étape normale ET une sur étape dispensée.
  const r4 = tryGroups({
    classSubjects: [csAB()],
    gradesByStep: new Map([['st1', [g('cs1', '14')]], ['st2', [g('cs1', '18')]]]),
    exemptedSteps: new Set(['st2']),
  })
  check('G-2 ter ligne présente, étape dispensée « - »', lineCells(r4.gr, 2), '14.00|-|-|-')
}
{
  // G-3 : année à 5 étapes avec ligne globale.
  const st = steps(5)
  const r = tryGroups({
    steps: st,
    included: new Set(st.map((x) => x.id)),
    classSubjects: [csAB()],
    gradesByStep: new Map([['st1', [g('cs1', '12'), g('cs1', '7', 'sa')]], ['st5', [g('cs1', '16')]]]),
  })
  check('G-3 5 étapes : cellules ligne globale', lineCells(r.gr, 2), '12.00|-|-|-|16.00')
  check('G-3 5 étapes : Moy ligne globale (12+16)/2/20×10', r.gr?.[0].lines[2]?.average.text, '7.00')
  check('G-3 5 étapes : sous-matière A', lineCells(r.gr, 0), '7.00|-|-|-|-')
}
{
  // G-4 : maxScoreOverride (barème de la classe) sur matière simple et sur ligne globale.
  const simple: ApiClassSubjectRow = { ...plain('cs-o', 'Matière O', '20'), maxScoreOverride: '40' }
  const r = tryGroups({ classSubjects: [simple], gradesByStep: new Map([['st1', [g('cs-o', '20')]]]) })
  check('G-4 override 40 : coeff', r.gr?.[0].lines[0].coeff, '4')
  check('G-4 override 40 : Moy 20/40×10', r.gr?.[0].lines[0].average.text, '5.00')
  check('G-4 override 40 : bande cellule 50 %', r.gr?.[0].lines[0].cells[0].band, 'echec')
  const glob: ApiClassSubjectRow = { ...csAB(), maxScoreOverride: '40' }
  const r2 = tryGroups({ classSubjects: [glob], gradesByStep: new Map([['st1', [g('cs1', '30')]]]) })
  check('G-4 override 40 : coeff ligne globale', r2.gr?.[0].lines[2]?.coeff, '4')
  check('G-4 override 40 : Moy ligne globale 30/40×10', r2.gr?.[0].lines[2]?.average.text, '7.50')
  check('G-4 override : sous-matières inchangées', r2.gr?.[0].lines[0].coeff, '1')
}
{
  // G-5 : notes et barèmes illisibles.
  const one = (cs: ApiClassSubjectRow, score: unknown) =>
    tryGroups({ classSubjects: [cs], gradesByStep: new Map([['st1', [{ classSubjectId: cs.id, sectionId: null, studentScore: score }]]]) }).err
  check('G-5 note « abc » : refus', one(plain('cs1', 'M', '20'), 'abc'), 'indisponible')
  check('G-5 note null : refus', one(plain('cs1', 'M', '20'), null), 'indisponible')
  const bareme = (max: unknown) => tryGroups({ classSubjects: [{ ...plain('cs1', 'M', '20'), subject: { ...plain('cs1', 'M', '20').subject, maxScore: max } }] }).err
  check('G-5 barème absent : refus', bareme(null), 'indisponible')
  check('G-5 barème nul : refus', bareme('0'), 'indisponible')
  check('G-5 barème négatif : refus', bareme('-5'), 'indisponible')
  check('G-5 barème illisible : refus', bareme('dix'), 'indisponible')
  // G-6 : note avec sectionId sur une matière SANS sous-matière.
  check('G-6 sectionId sur matière sans sous-matière : refus',
    tryGroups({ classSubjects: [plain('cs1', 'M', '20')], gradesByStep: new Map([['st1', [g('cs1', '5', 'sx')]]]) }).err, 'indisponible')
}
{
  // G-11 / K3 : départage à displayOrder égal — createdAt, puis id.
  const sec = (id: string, name: string, createdAt?: string) =>
    ({ id, name, maxScore: '5', displayOrder: 1, ...(createdAt ? { createdAt } : {}) })
  const cs = (sections: ReturnType<typeof sec>[]): ApiClassSubjectRow =>
    ({ id: 'cs1', trackId: null, subject: { id: 's1', name: 'Matière', maxScore: '10', rubric: { code: 'R1' }, sections } })
  const ordre = (sections: ReturnType<typeof sec>[]) => labels(tryGroups({ classSubjects: [cs(sections)] }).gr)
  check('G-11/K3 displayOrder égal : createdAt croissant',
    ordre([sec('s-a', 'Créée 2e', '2020-01-02T00:00:00.000Z'), sec('s-b', 'Créée 1re', '2020-01-01T00:00:00.000Z')]), 'Créée 1re,Créée 2e')
  check('G-11/K3 createdAt égal : id croissant',
    ordre([sec('s-b', 'Id b', '2020-01-01T00:00:00.000Z'), sec('s-a', 'Id a', '2020-01-01T00:00:00.000Z')]), 'Id a,Id b')
  check('G-11/K3 sans createdAt : id croissant', ordre([sec('s-z', 'Id z'), sec('s-m', 'Id m')]), 'Id m,Id z')
  check('G-11/K3 displayOrder prime sur createdAt',
    labels(tryGroups({ classSubjects: [cs([{ ...sec('s-a', 'Ordre 2', '2020-01-01T00:00:00.000Z'), displayOrder: 2 }, sec('s-b', 'Ordre 1', '2021-01-01T00:00:00.000Z')])] }).gr),
    'Ordre 1,Ordre 2')
  check('G-11/K3 ordre stable, entrée inversée',
    ordre([sec('s-a', 'Id a'), sec('s-b', 'Id b')]) === ordre([sec('s-b', 'Id b'), sec('s-a', 'Id a')]), true)
}
{
  // G-12 : l'affectation de filière précède celle du tronc commun dans l'ordre API.
  const tc = plain('cs-tc', 'Physique fictive', '10')
  const smp: ApiClassSubjectRow = { ...plain('cs-smp', 'Physique fictive', '10', 'track-smp'), subject: { ...tc.subject } }
  const r = tryGroups({ classSubjects: [smp, tc], trackCode: 'SMP' })
  check('G-12 filière d’abord : suffixe sur le groupe de filière', r.gr?.map((x) => x.title).join(' / '),
    'Physique fictive (SMP) / Physique fictive')
}
{
  // K4 : étape retenue ABSENTE d'une table d'entrée → refus, jamais « sans note ».
  const sansNotes = new Map([['st1', []], ['st2', []], ['st3', []]]) as Map<string, ApiGradeRow[]>
  const pleines = new Map(steps(4).map((x) => [x.id, []])) as Map<string, ApiExclusionRow[]>
  const reasonRaw = (over: Partial<SubjectGroupsInput>) => reasonOf(() => rawGroups({ classSubjects: [plain('cs1', 'M', '20')], ...over }))
  check('K4 étape retenue absente des notes : refus',
    reasonRaw({ gradesByStep: sansNotes, exclusionsByStep: pleines }), 'indisponible')
  check('K4 étape retenue absente des dispenses : refus',
    reasonRaw({ gradesByStep: new Map(steps(4).map((x) => [x.id, []])), exclusionsByStep: new Map([['st1', []]]) }), 'indisponible')
  check('K4 étape NON retenue absente des tables : admis', reasonRaw({
    included: new Set(['st1', 'st2']),
    gradesByStep: new Map([['st1', []], ['st2', []]]),
    exclusionsByStep: new Map([['st1', []], ['st2', []]]),
  }), 'aucune erreur')
  const st = steps(4)
  const disc = (map: Map<string, ApiBehaviorRow | null>) =>
    reasonOf(() => buildDisciplineGroup({ steps: st, included: new Set(st.map((x) => x.id)), behaviorsByStep: map }))
  check('K4 discipline : étape retenue absente des fiches : refus',
    disc(new Map([['st1', null], ['st2', null], ['st3', null]])), 'indisponible')
  check('K4 discipline : null = fiche absente (404), admis',
    disc(new Map([['st1', null], ['st2', null], ['st3', null], ['st4', null]])), 'aucune erreur')
}

// ── Lot 1b — U7, U8 : couleurs (C3, Q-C) ────────────────────────────────────

{
  const cas: Array<[string, string, string]> = [
    ['5.995', '6.00', 'assez-bien'],
    ['5.9949', '5.99', 'deficient'],
    ['4.996', '5.00', 'echec'],
  ]
  for (const [exact, texte, bande] of cas) {
    const c = averageCellFor([D(exact)], D('10'))
    check(`U7 Moy exacte ${exact} : texte`, c.text, texte)
    check(`U7 Moy exacte ${exact} : bande sur l’affiché`, c.band, bande)
  }
  const cell = cellFor(D('34.4'), D('60'))
  check('U8 cellule 34.4/60 (57.33 %) : bande exacte inchangée', cell.band, 'deficient')
}

// ── Lot 1b — U10 : uniforme et compteurs (C5) ───────────────────────────────

{
  const d = discipline([{ respectUniforme: 8, retards: 2 }, { respectUniforme: 7.5, retards: 0 }])
  check('U10 uniforme [8, 7.5] : cellules', d.lines[4].cells.map((c) => c.text).join('|'), '8.00|7.50')
  check('U10 uniforme [8, 7.5] : Moy', d.lines[4].average.text, '7.75')
  check('U10 retards [2, 0] : cellules', d.lines[0].cells.map((c) => c.text).join('|'), '2|0')
  check('U10 retards [2, 0] : total', d.lines[0].average.text, '2')
}

console.log(out.join('\n'))
console.log(`\n${pass} OK, ${fail} ECHEC`)
if (fail > 0) process.exit(1)
