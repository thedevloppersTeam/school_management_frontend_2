/**
 * Vecteurs communs du moteur de calcul du bulletin.
 *
 * Ce test et compute.vectors.json existent dans les DEUX dépôts :
 *   - school_management_frontend_2/lib/bulletin/__tests__/
 *   - school_management_server/src/lib/bulletin/__tests__/
 * Le JSON est identique octet pour octet ; chaque dépôt l'exécute contre SA
 * copie de compute.ts (duplicata intentionnel côté serveur). Une divergence
 * entre les deux copies fait échouer l'un des deux.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import Decimal from 'decimal.js'
import {
  computeAnnualAverage,
  computeStep,
  computeSubject,
  isPassing,
  type RubriqueCode,
  type SubjectInput,
} from '../compute'

type Num = string | null

interface SectionJson {
  sectionId: string
  name: string
  maxScore: string
  scores: string[]
  exempted: boolean
}

interface SubjectJson {
  classSubjectId: string
  name: string
  rubrique: RubriqueCode
  maxScore: string
  maxScoreOverride: string | null
  sections: SectionJson[]
  globalScores: string[]
  exempted: boolean
}

type Vector =
  | { id: string; kind: 'step'; calcul: string; subjects: SubjectJson[]; expect: { r1: Num; r2: Num; r3: Num; average: string; passing: boolean } }
  | {
      id: string
      kind: 'subject'
      calcul: string
      subject: SubjectJson
      expect: { state: string; numerator: string; denominator: string; average: Num; sections?: { sectionId: string; state: string; score: Num }[] }
    }
  | { id: string; kind: 'annual'; calcul: string; steps: SubjectJson[][]; expect: { average: Num; passing: boolean } }
  | { id: string; kind: 'passing'; calcul: string; value: string; expect: { passing: boolean } }

const { vectors } = JSON.parse(readFileSync(join(__dirname, 'compute.vectors.json'), 'utf8')) as { vectors: Vector[] }

const d = (v: string) => new Decimal(v)

function toInput(s: SubjectJson): SubjectInput {
  return {
    classSubjectId: s.classSubjectId,
    name: s.name,
    rubrique: s.rubrique,
    maxScore: d(s.maxScore),
    maxScoreOverride: s.maxScoreOverride === null ? null : d(s.maxScoreOverride),
    sections: s.sections.map((x) => ({
      sectionId: x.sectionId,
      name: x.name,
      maxScore: d(x.maxScore),
      scores: x.scores.map(d),
      exempted: x.exempted,
    })),
    globalScores: s.globalScores.map(d),
    exempted: s.exempted,
  }
}

/** Égalité exacte en Decimal ; null attendu ⇔ null obtenu. */
function expectDec(actual: Decimal | null, expected: Num) {
  if (expected === null) {
    expect(actual).toBeNull()
  } else {
    expect(actual, `attendu ${expected}, obtenu ${actual?.toString()}`).not.toBeNull()
    expect((actual as Decimal).equals(d(expected)), `attendu ${expected}, obtenu ${actual?.toString()}`).toBe(true)
  }
}

describe('compute.vectors.json', () => {
  it('contient des vecteurs', () => {
    expect(vectors.length).toBeGreaterThan(0)
  })

  for (const v of vectors) {
    it(`${v.id} — ${v.calcul}`, () => {
      switch (v.kind) {
        case 'step': {
          const step = computeStep(v.subjects.map(toInput))
          expectDec(step.r1.average, v.expect.r1)
          expectDec(step.r2.average, v.expect.r2)
          expectDec(step.r3.average, v.expect.r3)
          expectDec(step.average, v.expect.average)
          expect(step.passing).toBe(v.expect.passing)
          break
        }
        case 'subject': {
          const out = computeSubject(toInput(v.subject))
          expect(out.state).toBe(v.expect.state)
          expectDec(out.numerator, v.expect.numerator)
          expectDec(out.denominator, v.expect.denominator)
          expectDec(out.average, v.expect.average)
          for (const s of v.expect.sections ?? []) {
            const got = out.sections.find((x) => x.sectionId === s.sectionId)
            expect(got, `sous-matière ${s.sectionId}`).toBeDefined()
            expect(got?.state).toBe(s.state)
            expectDec(got?.score ?? null, s.score)
          }
          break
        }
        case 'annual': {
          const annual = computeAnnualAverage(v.steps.map((subjects) => computeStep(subjects.map(toInput))))
          expectDec(annual, v.expect.average)
          expect(annual !== null && isPassing(annual)).toBe(v.expect.passing)
          break
        }
        case 'passing': {
          expect(isPassing(d(v.value))).toBe(v.expect.passing)
          break
        }
      }
    })
  }
})
