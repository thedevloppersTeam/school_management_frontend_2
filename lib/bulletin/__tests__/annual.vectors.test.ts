/**
 * Vecteurs communs de la moyenne annuelle (« Moy. générale » du bulletin).
 *
 * annual.vectors.json existe, identique octet pour octet, dans les DEUX dépôts.
 * Côté serveur, il est la non-régression du service de résultats (RS-05).
 * Ici, il garde le moteur CLIENT (lib/bulletin/compute.ts + from-api) aligné sur
 * le serveur tant que le rapport et l'écran de consultation l'utilisent (lot
 * L4). Depuis la bascule du bulletin sur le service (lot L3), ce chemin client
 * n'est plus celui du bulletin : il est joué par la COPIE FIGÉE de l'ancien
 * bulletin (lib/api/__tests__/legacy/bulletin.legacy.ts), qui l'appelle
 * exactement comme avant : buildBulletinData({ includeGeneralAverage: true })
 * → calculateGeneralAverageForEnrollment → from-api → compute.
 *
 * Les requêtes passent par un `fetch` simulé qui sert les lignes du vecteur ;
 * il reproduit le filtre du serveur sur les dispenses (stepId EXACT,
 * GET /api/enrollments/excluded-sections). Aucune base, données fictives.
 *
 * `missingCount` (RP-09) est une notion de délibération : vérifié côté serveur
 * seulement.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildBulletinData } from '@/lib/api/__tests__/legacy/bulletin.legacy'

interface Vector {
  id: string
  calcul: string
  enrollmentId: string
  steps: { id: string; name: string; stepNumber: number }[]
  exemptedStepIds: string[]
  classSubjects: any[]
  grades: { enrollmentId: string; classSubjectId: string; sectionId: string | null; stepId: string; studentScore: string }[]
  exclusions: { enrollmentId: string; classSubjectId: string | null; sectionId: string | null; stepId: string | null }[]
  expect: { exact: string | null; printed: string | null; passing: boolean; missingCount: number }
}

const { vectors } = JSON.parse(readFileSync(join(__dirname, 'annual.vectors.json'), 'utf8')) as { vectors: Vector[] }

const YEAR = 'annee-v'
let current: Vector
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const realFetch = globalThis.fetch
beforeAll(() => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://test')
    const p = url.pathname
    const q = url.searchParams
    const v = current
    if (p === `/api/academic-years/${YEAR}/steps`) return json(v.steps)
    if (p === `/api/enrollments/${v.enrollmentId}/step-exemptions`) return json(v.exemptedStepIds.map((stepId) => ({ stepId })))
    if (p === `/api/grades/enrollment/${v.enrollmentId}`) {
      return json(v.grades.filter((g) => g.enrollmentId === v.enrollmentId && g.stepId === q.get('stepId')))
    }
    if (p === '/api/enrollments/excluded-sections') return json(v.exclusions.filter((x) => x.stepId === q.get('stepId')))
    if (p === '/api/class-subjects') {
      return json(v.classSubjects.map((cs) => ({ ...cs, subjectId: cs.subject.id, classSessionId: q.get('classSessionId'), coefficientOverride: null })))
    }
    if (p === '/api/enrollments') return json([{ id: v.enrollmentId, trackId: null }])
    if (p.startsWith('/api/students/')) return json({ user: { firstname: 'Alpha', lastname: 'ESSAI' }, nisu: '', studentCode: 'ESSAI-001' })
    return json({ message: 'absent' }, 404) // données accessoires : repli de safeFetch
  }) as typeof fetch
})
afterAll(() => {
  globalThis.fetch = realFetch
})

describe('annual.vectors.json — chemin du bulletin', () => {
  it('contient des vecteurs', () => {
    expect(vectors.length).toBeGreaterThan(0)
  })

  for (const v of vectors) {
    it(`${v.id} — ${v.calcul}`, async () => {
      current = v
      const last = [...v.steps].sort((a, b) => b.stepNumber - a.stepNumber)[0]
      const data = await buildBulletinData({
        enrollmentId: v.enrollmentId,
        studentId: 'st-v',
        // Une salle par vecteur : les caches de module sont clés par salle.
        classSessionId: `salle-${v.id}`,
        stepId: last.id,
        stepName: last.name,
        className: '1ere AF A',
        yearId: YEAR,
        includeGeneralAverage: true,
      })
      expect(data.moyenneGenerale).toBe(v.expect.printed ?? '—')
    })
  }
})
