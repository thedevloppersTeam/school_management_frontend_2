/**
 * Contrôle de clôture d'étape (computeClassroomStatuses) : une affectation que
 * le serveur déclare non saisissable (`accepteNotes === false`) n'est pas une
 * note attendue. Le fetch est simulé ; données fictives.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { computeClassroomStatuses } from '@/lib/api/close-readiness'

const realFetch = globalThis.fetch
let routes: Record<string, unknown> = {}
let urls: string[] = []

beforeEach(() => {
  urls = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    urls.push(url)
    if (!(url in routes)) return new Response('{}', { status: 404 })
    return new Response(JSON.stringify(routes[url]), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
})
afterEach(() => {
  globalThis.fetch = realFetch
  routes = {}
})

const SESSION = 'sess-1'
const STEP = 'step-1'
const subject = (id: string, extra: Record<string, unknown> = {}) => ({
  id, classSessionId: SESSION, subjectId: `sub-${id}`, coefficient: 1,
  subject: { id: `sub-${id}`, name: `Matière ${id}`, code: id, rubric: 'R1' },
  ...extra,
})
const enrollment = (id: string) => ({ id, status: 'ACTIVE', student: { nisu: null } })
const grade = (enrollmentId: string, classSubjectId: string) => ({
  id: `g-${enrollmentId}-${classSubjectId}`, enrollmentId, classSubjectId, sectionId: null, stepId: STEP, studentScore: 5,
})

function setup(subjects: unknown[], grades: Record<string, unknown[]>) {
  routes[`/api/class-subjects?classSessionId=${SESSION}`] = subjects
  routes[`/api/enrollments?classSessionId=${SESSION}`] = [enrollment('e1'), enrollment('e2')]
  for (const [csId, list] of Object.entries(grades)) {
    routes[`/api/grades/class-subject/${csId}/step/${STEP}`] = list
  }
}

const run = async () => {
  const [s] = await computeClassroomStatuses([{ id: SESSION, name: 'NS1 A', levelId: 'lvl' }], [{ id: 'lvl', name: 'NS1' }], STEP)
  return s
}

describe('close-readiness — matière non saisissable', () => {
  it("une matière fermée ne produit aucune note manquante : la salle est complète", async () => {
    setup(
      [subject('cs-a'), subject('cs-filiere', { accepteNotes: false })],
      { 'cs-a': [grade('e1', 'cs-a'), grade('e2', 'cs-a')] },
    )
    const s = await run()
    expect(s.totalGrades).toBe(2)
    expect(s.gradesEntered).toBe(2)
    expect(s.status).toBe('complete')
    expect(urls.some(u => u.includes('/cs-filiere/'))).toBe(false)
  })

  it("les notes existantes d'une matière fermée ne gonflent pas le compte des saisies", async () => {
    setup(
      [subject('cs-a'), subject('cs-filiere', { accepteNotes: false })],
      {
        'cs-a': [grade('e1', 'cs-a')],
        'cs-filiere': [grade('e1', 'cs-filiere'), grade('e2', 'cs-filiere')],
      },
    )
    const s = await run()
    expect(s.totalGrades).toBe(2)
    expect(s.gradesEntered).toBe(1)
    expect(s.status).toBe('incomplete')
  })

  it('une matière au champ absent reste attendue', async () => {
    setup(
      [subject('cs-a'), subject('cs-b')],
      { 'cs-a': [grade('e1', 'cs-a'), grade('e2', 'cs-a')], 'cs-b': [] },
    )
    const s = await run()
    expect(s.totalGrades).toBe(4)
    expect(s.gradesEntered).toBe(2)
    expect(s.status).toBe('incomplete')
  })

  it('accepteNotes à true reste attendue', async () => {
    setup([subject('cs-a', { accepteNotes: true })], { 'cs-a': [] })
    const s = await run()
    expect(s.totalGrades).toBe(2)
    expect(s.status).toBe('not-started')
  })

  it("seules des matières fermées : rien d'attendu, non commencée", async () => {
    setup([subject('cs-filiere', { accepteNotes: false })], {})
    const s = await run()
    expect(s.totalGrades).toBe(0)
    expect(s.gradesEntered).toBe(0)
    expect(s.status).toBe('not-started')
  })
})
