/**
 * Bascule du bulletin sur le service de résultats (SPEC-RESULTATS lot L3).
 *
 * Ces tests remplacent l'écran de comparaison « double calcul » :
 *
 *  1. NON-RÉGRESSION — sur des données SANS marqueur d'examen, l'ANCIEN calcul
 *     client (copie figée : ./legacy/bulletin.legacy.ts, verbatim de develop
 *     avant la bascule) et le NOUVEAU chemin (buildBulletinData → /api/results
 *     simulé à partir des MÊMES données) produisent les MÊMES BulletinData.
 *     Couvre : note manquante, dispense de sous-matière, dispense d'étape,
 *     matière repliée, matière d'examen de filière hors portée, moyenne de
 *     classe avec un élève entièrement dispensé, bulletin d'examen officiel.
 *
 *  2. CLASSE D'EXAMEN — réponses du service écrites à la main (option 1, D2) :
 *     à l'étape ordinaire aucune ligne d'examen et totaux = dénominateurs ; à
 *     l'étape d'examen seules les lignes d'examen ; moyenne générale = celle
 *     du service.
 *
 *  3. UN APPEL par salle et par étape : jamais une requête de résultats ni de
 *     notes par élève.
 *
 * Le service simulé calcule avec lib/bulletin/compute.ts (le duplicata client
 * du moteur serveur, tenu identique par les vecteurs communs) et reproduit la
 * règle des lignes imprimées du serveur (src/lib/results/build.ts, printLines).
 * Aucune base, aucun serveur. Données fictives : aucun nom d'élève réel.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import Decimal from 'decimal.js'
import { buildBulletinData } from '@/lib/api/bulletin'
import { buildBulletinData as buildLegacy } from './legacy/bulletin.legacy'
import { invalidateRoomResults, type PrintLine, type RoomResults } from '@/lib/api/results'
import { invalidateExclusionsCache } from '@/lib/api/step-exclusions'
import { toSubjectInputs } from '@/lib/bulletin/from-api'
import {
  computeAnnualAverage,
  computeClassAverage,
  computeStep,
  stepAverageOrNull,
  type StepResult,
  type SubjectOutput,
} from '@/lib/bulletin/compute'
import { calculateRubriqueTotals } from '@/lib/bulletin-calculations'
import { StepAfterDepartureError } from '@/lib/bulletin/from-results'
import { toMessage } from '@/lib/errors'
import { formatFrenchLongDate } from '@/lib/date-format'

// ── Données de salle (fictives) ──────────────────────────────────────────────

interface TSection { id: string; name: string; maxScore: string }
interface TClassSubject { id: string; name: string; maxScore: string; rubric: 'R1' | 'R2' | 'R3'; sections: TSection[]; trackId?: string | null }
interface TRoom {
  id: string
  yearId: string
  steps: { id: string; name: string; stepNumber: number }[]
  classSubjects: TClassSubject[]
  enrollments: { id: string; studentId: string; trackId?: string | null; status?: 'ACTIVE' | 'GRADUATED' | 'TRANSFERRED' | 'DROPPED' }[]
  grades: { enrollmentId: string; classSubjectId: string; sectionId: string | null; stepId: string; studentScore: string }[]
  exclusions: { enrollmentId: string; classSubjectId: string; sectionId: string | null; stepId: string }[]
  exemptions: { enrollmentId: string; stepId: string }[]
}

const g = (enrollmentId: string, stepId: string, classSubjectId: string, sectionId: string | null, studentScore: string) =>
  ({ enrollmentId, classSubjectId, sectionId, stepId, studentScore })

/** Salle sans marqueur d'examen. */
function room(id: string): TRoom {
  const st1 = 'st-1', st2 = 'st-2'
  return {
    id,
    yearId: `annee-${id}`,
    steps: [
      { id: st1, name: 'Etape 1', stepNumber: 1 },
      { id: st2, name: 'Etape 2', stepNumber: 2 },
    ],
    classSubjects: [
      { id: 'cs-fr', name: 'Français', maxScore: '100', rubric: 'R1', sections: [
        { id: 'fr-a', name: 'Lecture', maxScore: '40' }, { id: 'fr-b', name: 'Grammaire', maxScore: '60' }] },
      { id: 'cs-ma', name: 'Mathématiques', maxScore: '50', rubric: 'R1', sections: [] },
      { id: 'cs-sc', name: 'Sciences', maxScore: '60', rubric: 'R2', sections: [
        { id: 'sc-a', name: 'Biologie', maxScore: '30' }, { id: 'sc-b', name: 'Physique', maxScore: '30' }] },
      { id: 'cs-ar', name: 'Arts', maxScore: '20', rubric: 'R3', sections: [] },
      // Matière d'examen de filière : hors du bulletin normal, sur le bulletin d'examen de la filière.
      { id: 'cs-ex', name: 'Examen de filière', maxScore: '100', rubric: 'R1', sections: [], trackId: 'tr-x' },
    ],
    enrollments: [
      { id: 'e1', studentId: 's1', trackId: 'tr-x' },
      { id: 'e2', studentId: 's2' },
      { id: 'e3', studentId: 's3' },
      { id: 'e4', studentId: 's4' },
    ],
    grades: [
      // Étape 1 : tout le monde noté.
      ...['e1', 'e2', 'e3', 'e4'].flatMap((e, i) => [
        g(e, st1, 'cs-fr', 'fr-a', String(20 + i)), g(e, st1, 'cs-fr', 'fr-b', String(30 + 2 * i)),
        g(e, st1, 'cs-ma', null, String(25 + i)), g(e, st1, 'cs-sc', 'sc-a', '15'), g(e, st1, 'cs-sc', 'sc-b', '18.5'),
        g(e, st1, 'cs-ar', null, '14'),
      ]),
      g('e1', st1, 'cs-ex', null, '60'),
      // Étape 2.
      g('e1', st2, 'cs-fr', 'fr-a', '30'), g('e1', st2, 'cs-fr', 'fr-b', '45'), g('e1', st2, 'cs-ma', null, '40'),
      g('e1', st2, 'cs-sc', 'sc-a', '20'), g('e1', st2, 'cs-sc', 'sc-b', '25'), g('e1', st2, 'cs-ar', null, '15'),
      g('e1', st2, 'cs-ex', null, '80'),
      // e2 : Grammaire MANQUANTE ; Sciences sans aucune note → matière REPLIÉE (barème 60 = 30 + 30).
      g('e2', st2, 'cs-fr', 'fr-a', '28'), g('e2', st2, 'cs-ma', null, '35'), g('e2', st2, 'cs-ar', null, '12'),
      // e3 : Grammaire DISPENSÉE (sous-matière) ; deux évaluations en Mathématiques (moyenne 41,5).
      g('e3', st2, 'cs-fr', 'fr-a', '33'), g('e3', st2, 'cs-ma', null, '40'), g('e3', st2, 'cs-ma', null, '43'),
      g('e3', st2, 'cs-sc', 'sc-a', '22'), g('e3', st2, 'cs-sc', 'sc-b', '21'), g('e3', st2, 'cs-ar', null, '18'),
      // e4 : notes saisies mais toutes ses matières sont dispensées à l'étape 2.
      g('e4', st2, 'cs-fr', 'fr-a', '39'), g('e4', st2, 'cs-ma', null, '49'),
    ],
    exclusions: [
      { enrollmentId: 'e3', classSubjectId: 'cs-fr', sectionId: 'fr-b', stepId: st2 },
      ...['cs-fr', 'cs-ma', 'cs-sc', 'cs-ar'].map((cs) => ({ enrollmentId: 'e4', classSubjectId: cs, sectionId: null, stepId: st2 })),
    ],
    // e3 : DISPENSE D'ÉTAPE sur l'étape 1 → hors moyenne générale.
    exemptions: [{ enrollmentId: 'e3', stepId: st1 }],
  }
}

// ── Service de résultats simulé (même règle que le serveur, sans marqueur) ──

const s = (d: Decimal | null) => (d === null ? null : d.toFixed())
type Scope = 'common' | 'exam' | 'all'

function inScope(cs: TClassSubject, scope: Scope, trackId: string | null) {
  const common = (cs.trackId ?? null) === null
  const own = !common && trackId !== null && cs.trackId === trackId
  return scope === 'common' ? common : scope === 'exam' ? own : common || own
}

function printLines(o: SubjectOutput): PrintLine[] {
  if (o.state === 'exempted') return []
  if (o.mode === 'sections' && o.sections.some((x) => x.state === 'noted')) {
    return [
      { classSubjectId: o.classSubjectId, sectionId: null, name: o.name, isParent: true, note: null, maxScore: null },
      ...o.sections.filter((x) => x.state !== 'exempted').map((x) => ({
        classSubjectId: o.classSubjectId, sectionId: x.sectionId, name: x.name, isParent: false, note: s(x.score), maxScore: s(x.maxScore),
      })),
    ]
  }
  return [{
    classSubjectId: o.classSubjectId, sectionId: null, name: o.name, isParent: false,
    note: o.mode === 'global' && o.state === 'noted' ? s(o.numerator) : null, maxScore: s(o.denominator),
  }]
}

function simulate(r: TRoom, stepId: string, scope: Scope): RoomResults {
  const requested = r.steps.find((x) => x.id === stepId)!
  const steps = r.steps.filter((x) => x.stepNumber <= requested.stepNumber).sort((a, b) => a.stepNumber - b.stepNumber)
  const rubricCodeById = { 'rub-R1': 'R1', 'rub-R2': 'R2', 'rub-R3': 'R3' }
  const students = r.enrollments.map((e) => {
    const trackId = e.trackId ?? null
    const computed = steps.map((st) => {
      const selected = r.classSubjects.filter((cs) => inScope(cs, scope, trackId)).map((cs) => ({
        id: cs.id, maxScoreOverride: null,
        subject: { id: `sub-${cs.id}`, name: cs.name, maxScore: cs.maxScore, rubric: { id: `rub-${cs.rubric}`, code: cs.rubric }, sections: cs.sections },
      }))
      const exclusions = new Set(r.exclusions.filter((x) => x.enrollmentId === e.id && x.stepId === st.id)
        .map((x) => `${e.id}::${x.classSubjectId}::${x.sectionId ?? '*'}`))
      const grades = r.grades.filter((x) => x.enrollmentId === e.id && x.stepId === st.id)
      const result: StepResult = computeStep(toSubjectInputs({ classSubjects: selected, grades, rubricCodeById, enrollmentId: e.id, exclusions }).subjects)
      const outputs = [result.r1, result.r2, result.r3].flatMap((rb) => rb.subjects)
      const ordered = selected.map((cs) => outputs.find((o) => o.classSubjectId === cs.id)!).filter(Boolean)
      const rubriques = Object.fromEntries([result.r1, result.r2, result.r3].map((rb) =>
        [rb.code, { code: rb.code, numerator: s(rb.numerator), denominator: s(rb.denominator), average: s(rb.average) }]))
      const print = Object.fromEntries((['R1', 'R2', 'R3'] as const).map((code) => {
        const subj = ordered.filter((o) => o.rubrique === code)
        return [code, {
          code, lines: subj.flatMap(printLines),
          totalNote: s(subj.reduce((a, o) => a.plus(o.numerator), new Decimal(0))),
          totalMaxScore: s(subj.reduce((a, o) => a.plus(o.denominator), new Decimal(0))),
        }]
      }))
      return {
        result,
        out: {
          stepId: st.id, stepNumber: st.stepNumber, isExamBlanc: false,
          exempted: r.exemptions.some((x) => x.enrollmentId === e.id && x.stepId === st.id), examMode: false,
          subjects: [], rubriques, average: s(result.average), averageOrNull: s(stepAverageOrNull(result)), print,
        },
      }
    })
    const forAnnual = computed.filter((c) => !c.out.exempted).map((c) => c.result)
    return {
      enrollmentId: e.id, studentId: e.studentId, trackId, status: e.status ?? 'ACTIVE',
      steps: computed.map((c) => c.out),
      annual: forAnnual.length === 0 ? null : s(computeAnnualAverage(forAnnual)),
    }
  })
  // D-17 (serveur, build.ts) : moyennes de classe sur ACTIVE + GRADUATED seulement.
  const counted = students.filter((x) => x.status === 'ACTIVE' || x.status === 'GRADUATED')
  const atStep = counted.map((st) => st.steps.find((x) => x.stepId === stepId)!)
  const dec = (v: string | null) => (v === null ? null : new Decimal(v))
  const classAverage = (vals: (string | null)[]) => s(computeClassAverage(vals.map((v) => ({ average: dec(v) }))))
  const all = {
    enrollmentCount: counted.length,
    subjects: {},
    rubriques: Object.fromEntries((['R1', 'R2', 'R3'] as const).map((c) => [c, classAverage(atStep.map((x) => x.rubriques[c].average))])),
    step: classAverage(atStep.map((x) => x.averageOrNull)),
    annual: classAverage(counted.map((x) => x.annual)),
  }
  return { classSessionId: r.id, stepId, scope, students, classAverages: { all, byTrack: {} }, warnings: [] } as unknown as RoomResults
}

// ── Faux fetch : les deux chemins lisent les MÊMES données ──────────────────

let current: TRoom
let resultsOverride: ((stepId: string, scope: string | null) => RoomResults) | null = null
const calls = { results: 0, grades: 0 }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const realFetch = globalThis.fetch

beforeAll(() => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://test')
    const p = url.pathname, q = url.searchParams, r = current
    if (p === '/api/results') {
      calls.results++
      const scope = q.get('scope')
      if (resultsOverride) return json(resultsOverride(q.get('stepId')!, scope))
      return json(simulate(r, q.get('stepId')!, (scope as Scope) ?? 'common'))
    }
    let m: RegExpMatchArray | null
    if ((m = p.match(/^\/api\/students\/(.+)$/))) return json({ user: { firstname: 'Test', lastname: `ELEVE-${m[1]}` }, studentCode: `T-${m[1]}`, nisu: '' })
    if (p === '/api/class-subjects') {
      return json(r.classSubjects.map((cs) => ({
        id: cs.id, subjectId: `sub-${cs.id}`, classSessionId: r.id, coefficientOverride: null, maxScoreOverride: null, trackId: cs.trackId ?? null,
        subject: { id: `sub-${cs.id}`, name: cs.name, maxScore: cs.maxScore, coefficient: '1', hasSections: cs.sections.length > 0,
          rubric: { id: `rub-${cs.rubric}`, code: cs.rubric }, sections: cs.sections },
      })))
    }
    if ((m = p.match(/^\/api\/grades\/enrollment\/(.+)$/))) {
      calls.grades++
      return json(r.grades.filter((x) => x.enrollmentId === m![1] && x.stepId === q.get('stepId')))
    }
    if (p === '/api/enrollments/excluded-sections') return json(r.exclusions.filter((x) => x.stepId === q.get('stepId')))
    if ((m = p.match(/^\/api\/enrollments\/([^/]+)\/step-exemptions$/))) return json(r.exemptions.filter((x) => x.enrollmentId === m![1]).map((x) => ({ stepId: x.stepId })))
    if (p === '/api/enrollments') return json(r.enrollments.map((e) => ({ id: e.id, trackId: e.trackId ?? null })))
    if ((m = p.match(/^\/api\/enrollments\/([^/]+)$/))) {
      const e = r.enrollments.find((x) => x.id === m![1])
      return json({ trackId: e?.trackId ?? null, track: null, classSession: { academicYear: { yearString: '2025-2026' } } })
    }
    if (p === `/api/academic-years/${r.yearId}/steps`) return json(r.steps)
    if (p === `/api/academic-years/${r.yearId}`) return json({ yearString: '2025-2026' })
    return json({ message: 'absent' }, 404) // données accessoires : repli de safeFetch
  }) as typeof fetch
})
afterAll(() => { globalThis.fetch = realFetch })
beforeEach(() => {
  invalidateRoomResults()
  invalidateExclusionsCache()
  resultsOverride = null
  calls.results = 0
  calls.grades = 0
})

const params = (r: TRoom, enrollmentId: string, studentId: string, extra: Record<string, unknown> = {}) => ({
  enrollmentId, studentId, classSessionId: r.id, stepId: 'st-2', stepName: 'Etape 2',
  className: '6ème AF A', yearId: r.yearId, includeGeneralAverage: true, ...extra,
})

// ── 1. Non-régression ───────────────────────────────────────────────────────

describe('L3 — non-régression : ancien calcul client = service (sans marqueur)', () => {
  const cases: [string, string, string][] = [
    ['e1 : tout noté ; matière d\'examen de filière hors bulletin normal', 'e1', 's1'],
    ['e2 : note manquante (Grammaire) ; matière repliée (Sciences, aucune note)', 'e2', 's2'],
    ['e3 : dispense de sous-matière (Grammaire) ; dispense d\'étape (étape 1 hors générale) ; deux évaluations', 'e3', 's3'],
    ['e4 : toutes matières dispensées à l\'étape → exclu de la moyenne de classe', 'e4', 's4'],
  ]
  let n = 0
  for (const [label, enr, stu] of cases) {
    it(`BulletinData identiques — ${label}`, async () => {
      // Une salle par cas : le cache de module de l'ancien chemin est clé par salle.
      current = room(`salle-nr-${++n}`)
      const before = await buildLegacy(params(current, enr, stu))
      const after = await buildBulletinData(params(current, enr, stu))
      expect(after).toEqual(before)
    })
  }

  it('BulletinData identiques — bulletin d\'EXAMEN officiel (filière) avec moyenne générale', async () => {
    current = room('salle-nr-exam')
    const before = await buildLegacy(params(current, 'e1', 's1', { scope: 'exam' }))
    const after = await buildBulletinData(params(current, 'e1', 's1', { scope: 'exam' }))
    expect(after).toEqual(before)
  })

  it('la non-régression n\'est pas vide : les cas couverts sont bien présents dans les données comparées', async () => {
    current = room('salle-nr-controle')
    const e2 = await buildBulletinData(params(current, 'e2', 's2'))
    expect(e2.rubrique1.find((x) => x.name === 'Grammaire')).toEqual({ name: 'Grammaire', note: null, coeff: 60, isParent: false })
    expect(e2.rubrique2).toEqual([{ name: 'Sciences', note: null, coeff: 60, isParent: false }])
    const e3 = await buildBulletinData(params(current, 'e3', 's3'))
    expect(e3.rubrique1.map((x) => x.name)).not.toContain('Grammaire')
    expect(e3.rubrique1.find((x) => x.name === 'Mathématiques')?.note).toBe(41.5)
    const e4 = await buildBulletinData(params(current, 'e4', 's4'))
    expect(e4.moyenneEtape).toBe('—')
    expect(e4.rubrique1).toEqual([])
    const e1 = await buildBulletinData(params(current, 'e1', 's1'))
    expect(e1.rubrique1.map((x) => x.name)).not.toContain('Examen de filière')
    expect(e1.moyenneClasse).not.toBe('—')
  })
})

// ── 2. Classe d'examen (réponses du service écrites à la main) ──────────────

/**
 * Communication Créole 640 = 340 (5 sous-matières ordinaires) + 300 (Créole,
 * composant d'examen). Étape 1 ordinaire : 48+48+48+48+80 = 272 / 340 → 8 ;
 * étape 1 = 8 × 0,70 = 5,6. Étape 5 (examen blanc) : Créole 240 / 300 → 8 ;
 * 5,6. Annuelle 5,6. (Vecteurs R1/R2 de results.vectors.json côté serveur.)
 */
function examResults(stepId: 'st-1' | 'st-5'): RoomResults {
  const ordinary = [
    ['sec-co', 'Communication orale', '48', '60'], ['sec-lv', 'Lecture', '48', '60'], ['sec-oc', 'Orthographe', '48', '60'],
    ['sec-gc', 'Grammaire', '48', '60'], ['sec-pe', "Production d'écrits", '80', '100'],
  ]
  const lineSet = stepId === 'st-1'
    ? ordinary.map(([id, name, note, max]) => ({ classSubjectId: 'cs-cc', sectionId: id, name, isParent: false, note, maxScore: max }))
    : [{ classSubjectId: 'cs-cc', sectionId: 'sec-cr', name: 'Créole', isParent: false, note: '240', maxScore: '300' }]
  const denominator = stepId === 'st-1' ? '340' : '300'
  const numerator = stepId === 'st-1' ? '272' : '240'
  const empty = (code: string) => ({ code, lines: [], totalNote: '0', totalMaxScore: '0' })
  const step = (id: string, n: number, exam: boolean, lines: unknown[], num: string, den: string) => ({
    stepId: id, stepNumber: n, isExamBlanc: exam, exempted: false, examMode: exam, subjects: [],
    rubriques: { R1: { code: 'R1', numerator: num, denominator: den, average: '8' }, R2: { code: 'R2', numerator: '0', denominator: '0', average: null }, R3: { code: 'R3', numerator: '0', denominator: '0', average: null } },
    average: '5.6', averageOrNull: '5.6',
    print: {
      R1: { code: 'R1', lines: [{ classSubjectId: 'cs-cc', sectionId: null, name: 'Communication Créole', isParent: true, note: null, maxScore: null }, ...lines], totalNote: num, totalMaxScore: den },
      R2: empty('R2'), R3: empty('R3'),
    },
  })
  const steps = [step('st-1', 1, false, stepId === 'st-1' ? lineSet : [], '272', '340')]
  if (stepId === 'st-5') steps.push(step('st-5', 5, true, lineSet, numerator, denominator))
  return {
    classSessionId: 'salle-exam', stepId, scope: null,
    students: [{ enrollmentId: 'e1', studentId: 's1', trackId: null, status: 'ACTIVE', steps, annual: '5.6' }],
    classAverages: { all: { enrollmentCount: 1, subjects: {}, rubriques: { R1: '8', R2: null, R3: null }, step: '5.6', annual: '5.6' }, byTrack: {} },
    warnings: [],
  } as unknown as RoomResults
}

describe('L3 — classe d\'examen marquée (option 1, D2)', () => {
  const exam = (stepId: 'st-1' | 'st-5') => ({
    enrollmentId: 'e1', studentId: 's1', classSessionId: 'salle-exam', stepId, stepName: stepId,
    className: '9ème AF A', yearId: 'annee-exam', includeGeneralAverage: true,
  })

  it("étape ordinaire : aucune ligne d'examen imprimée ; total imprimé = dénominateur (340)", async () => {
    current = room('salle-exam')
    resultsOverride = (stepId) => examResults(stepId as 'st-1')
    const d = await buildBulletinData(exam('st-1'))
    expect(d.rubrique1.map((x) => x.name)).not.toContain('Créole')
    expect(d.rubrique1.map((x) => x.name)).toEqual(['Communication Créole', 'Communication orale', 'Lecture', 'Orthographe', 'Grammaire', "Production d'écrits"])
    const totals = calculateRubriqueTotals(d.rubrique1) // la fonction même du gabarit
    expect(totals).toEqual({ note: 272, coeff: 340 })
    expect(d.moyR1Texte).toBe('8.00')
    expect(d.moyenneEtape).toBe('5.60')
  })

  it("étape d'examen blanc : seules les lignes d'examen ; total imprimé = 300 ; moyenne générale = celle du service", async () => {
    current = room('salle-exam')
    resultsOverride = (stepId) => examResults(stepId as 'st-5')
    const d = await buildBulletinData(exam('st-5'))
    expect(d.rubrique1).toEqual([
      { name: 'Communication Créole', isParent: true },
      { name: 'Créole', note: 240, coeff: 300, isParent: false },
    ])
    expect(calculateRubriqueTotals(d.rubrique1)).toEqual({ note: 240, coeff: 300 })
    expect(d.moyenneGenerale).toBe('5.60') // formatAverage(annual du service), aucun calcul client
  })
})

// ── 3. Aucune requête par élève ─────────────────────────────────────────────

describe('L3 — un appel par salle et par étape', () => {
  it('lot de 4 bulletins : 1 seule requête de résultats, 0 requête de notes', async () => {
    current = room('salle-lot')
    await Promise.all(current.enrollments.map((e) => buildBulletinData(params(current, e.id, e.studentId))))
    expect(calls.results).toBe(1)
    expect(calls.grades).toBe(0)
  })

  it("bulletin d'examen avec moyenne générale : 2 requêtes pour tout le lot (portées « exam » et « all »)", async () => {
    current = room('salle-lot-exam')
    await Promise.all(current.enrollments.map((e) => buildBulletinData(params(current, e.id, e.studentId, { scope: 'exam' }))))
    expect(calls.results).toBe(2)
    expect(calls.grades).toBe(0)
  })

  it("service en échec : le bulletin échoue en entier (aucun bulletin partiel, aucune moyenne de repli)", async () => {
    // Remplace l'ancien lib/api/bulletin.test.ts (moyenne de classe client, reprise,
    // ClassAverageUnavailableError) : ce calcul n'existe plus côté client.
    current = room('salle-panne')
    resultsOverride = () => { throw new Error('panne simulée') }
    await expect(buildBulletinData(params(current, 'e1', 's1'))).rejects.toThrow()
  })

  it("élève absent de la réponse (inscription d'une autre salle) : erreur explicite, pas de bulletin faux", async () => {
    current = room('salle-absent')
    await expect(buildBulletinData(params(current, 'e-inconnu', 's9'))).rejects.toThrow(/Résultats indisponibles/)
  })
})

// ── 4. D-17 : élève transféré ou retiré ─────────────────────────────────────

/** La salle de référence + un élève RETIRÉ (e5), aux notes très éloignées des autres. */
function roomWithDropped(id: string, status: 'DROPPED' | 'TRANSFERRED' | 'ACTIVE' = 'DROPPED'): TRoom {
  const r = room(id)
  r.enrollments.push({ id: 'e5', studentId: 's5', status })
  for (const st of ['st-1', 'st-2']) {
    r.grades.push(
      g('e5', st, 'cs-fr', 'fr-a', '2'), g('e5', st, 'cs-fr', 'fr-b', '3'), g('e5', st, 'cs-ma', null, '1'),
      g('e5', st, 'cs-sc', 'sc-a', '0'), g('e5', st, 'cs-sc', 'sc-b', '1'), g('e5', st, 'cs-ar', null, '2'),
    )
  }
  return r
}
const CLASS_FIELDS = ['moyenneClasse', 'moyClasseR1', 'moyClasseR1Texte', 'moyClasseR2', 'moyClasseR2Texte', 'moyClasseR3', 'moyClasseR3Texte'] as const
const classFigures = (d: Record<string, unknown>) => Object.fromEntries(CLASS_FIELDS.map((k) => [k, d[k]]))

describe("L3-bis / D-17 — bulletin d'un élève parti", () => {
  it("élève DROPPED : bulletin généré, avec ses propres chiffres (aucune StudentNotInResultsError)", async () => {
    current = roomWithDropped('salle-d17-a')
    const d = await buildBulletinData(params(current, 'e5', 's5'))
    // 5/100 Français, 1/50 Maths, 1/60 Sciences, 2/20 Arts : chiffres individuels présents.
    expect(d.rubrique1.map((x) => x.name)).toEqual(['Français', 'Lecture', 'Grammaire', 'Mathématiques'])
    expect(d.rubrique1.find((x) => x.name === 'Lecture')).toEqual({ name: 'Lecture', note: 2, coeff: 40, isParent: false })
    expect(d.moyenneEtape).not.toBe('—')
    expect(d.moyenneGenerale).not.toBe('—')
    expect(calls.results).toBe(1)
  })

  it("ses chiffres individuels sont ceux de l'ancien calcul (même élève, compté comme actif)", async () => {
    current = roomWithDropped('salle-d17-b')
    const after = await buildBulletinData(params(current, 'e5', 's5'))
    current = roomWithDropped('salle-d17-b-legacy', 'ACTIVE')
    const before = await buildLegacy(params(current, 'e5', 's5'))
    const own = (d: Record<string, unknown>) => Object.fromEntries(Object.entries(d).filter(([k]) => !(CLASS_FIELDS as readonly string[]).includes(k)))
    expect(own(after as unknown as Record<string, unknown>)).toEqual(own(before as unknown as Record<string, unknown>))
  })

  it('la moyenne de classe imprimée sur son bulletin est celle des élèves actifs', async () => {
    current = roomWithDropped('salle-d17-c')
    const dropped = await buildBulletinData(params(current, 'e5', 's5'))
    const activeSameRoom = await buildBulletinData(params(current, 'e1', 's1'))
    current = room('salle-d17-c-sans')
    const withoutHim = await buildBulletinData(params(current, 'e1', 's1'))

    const expected = classFigures(withoutHim as unknown as Record<string, unknown>)
    expect(classFigures(dropped as unknown as Record<string, unknown>)).toEqual(expected)
    expect(classFigures(activeSameRoom as unknown as Record<string, unknown>)).toEqual(expected)

    // Témoin : compté comme actif, le même élève ferait baisser la moyenne de classe.
    current = roomWithDropped('salle-d17-c-temoin', 'ACTIVE')
    const counted = await buildBulletinData(params(current, 'e5', 's5'))
    expect(counted.moyenneClasse).not.toBe(expected.moyenneClasse)
  })

  it('élève TRANSFERRED : même traitement', async () => {
    current = roomWithDropped('salle-d17-t', 'TRANSFERRED')
    const d = await buildBulletinData(params(current, 'e5', 's5'))
    current = room('salle-d17-t-sans')
    const ref = await buildBulletinData(params(current, 'e1', 's1'))
    expect(classFigures(d as unknown as Record<string, unknown>)).toEqual(classFigures(ref as unknown as Record<string, unknown>))
  })
})

// ── 5. L5 / RS-09 : étape postérieure au départ ─────────────────────────────

/**
 * Réponse du service pour une salle où e5 est parti après l'étape 1 (forme
 * serveur, départ déclaré) : à l'étape 2, e5 n'a que l'étape 1 et un motif.
 */
function withDeparture(r: TRoom, stepId: string): RoomResults {
  const base = simulate(r, stepId, 'common')
  const after = stepId === 'st-2'
  const students = base.students.map((st) => {
    if (st.enrollmentId !== 'e5') return { ...st, departure: null, countedInClassAverage: true, unavailable: null }
    return {
      ...st,
      departure: { leftAt: '2026-01-20', lastAttendedStepId: 'st-1', reason: 'DROPOUT' as const, complete: true },
      countedInClassAverage: !after,
      unavailable: after
        ? { code: 'ETAPE_APRES_DEPART' as const, message: 'motif serveur', lastAttendedStepId: 'st-1', lastAttendedStepName: 'Etape 1' }
        : null,
      steps: st.steps.filter((x) => x.stepId === 'st-1'),
    }
  })
  return { ...base, students }
}

describe("L5 — bulletin d'une étape postérieure au départ (RS-09)", () => {
  it('message clair à la place du bulletin : StepAfterDepartureError, rendu tel quel par toMessage', async () => {
    current = roomWithDropped('salle-l5-a')
    resultsOverride = (stepId) => withDeparture(current, stepId)
    const err = await buildBulletinData(params(current, 'e5', 's5')).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(StepAfterDepartureError)
    const message = (err as Error).message
    expect(message).toBe(
      `Bulletin indisponible : l'élève a quitté l'établissement le ${formatFrenchLongDate('2026-01-20')}. ` +
      "Sa dernière étape suivie est « Etape 1 » ; aucun bulletin n'est produit pour une étape postérieure à son départ.",
    )
    expect(toMessage(err, 'lors de la génération du bulletin')).toBe(message)
  })

  it("étape suivie (la dernière) : bulletin généré normalement", async () => {
    current = roomWithDropped('salle-l5-b')
    resultsOverride = (stepId) => withDeparture(current, stepId)
    const d = await buildBulletinData(params(current, 'e5', 's5', { stepId: 'st-1', stepName: 'Etape 1' }))
    expect(d.moyenneEtape).not.toBe('—')
    expect(d.rubrique1.find((x) => x.name === 'Lecture')).toEqual({ name: 'Lecture', note: 2, coeff: 40, isParent: false })
  })

  it("en lot : le refus ne touche que l'élève parti ; les autres bulletins sortent, une seule requête", async () => {
    current = roomWithDropped('salle-l5-c')
    resultsOverride = (stepId) => withDeparture(current, stepId)
    const settled = await Promise.allSettled(current.enrollments.map((e) => buildBulletinData(params(current, e.id, e.studentId))))
    expect(settled.map((x) => x.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled', 'fulfilled', 'rejected'])
    expect((settled[4] as PromiseRejectedResult).reason).toBeInstanceOf(StepAfterDepartureError)
    expect(calls.results).toBe(1)
  })

  it("élève absent de la réponse : toujours StudentNotInResultsError, jamais le message de départ", async () => {
    current = roomWithDropped('salle-l5-d')
    resultsOverride = (stepId) => withDeparture(current, stepId)
    const err = await buildBulletinData(params(current, 'e-inconnu', 's9')).catch((e: unknown) => e)
    expect(err).not.toBeInstanceOf(StepAfterDepartureError)
    expect((err as Error).message).toMatch(/Résultats indisponibles/)
  })
})
