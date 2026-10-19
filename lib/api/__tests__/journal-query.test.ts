/**
 * Défaut B-3 — Journal : requête de la chronologie selon les filtres
 * (fetchStudentAuditLogs). Le fetch est simulé ; aucune donnée réelle.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { fetchStudentAuditLogs } from '@/lib/api/enrollment-corrections'

const realFetch = globalThis.fetch
let urls: string[] = []
let reply: { status: number; body: unknown } = { status: 200, body: { page: 1, pageSize: 50, total: 0, totalPages: 0, logs: [] } }

beforeEach(() => {
  urls = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    urls.push(String(input))
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
})
afterEach(() => {
  globalThis.fetch = realFetch
  reply = { status: 200, body: { page: 1, pageSize: 50, total: 0, totalPages: 0, logs: [] } }
})

const query = (u: string) => Object.fromEntries(new URL(u, 'http://front').searchParams)

describe('chronologie du journal — paramètres envoyés', () => {
  it('élève seul', async () => {
    await fetchStudentAuditLogs({ studentId: 'stu-1', page: 1, pageSize: 50 })
    expect(query(urls[0])).toEqual({ studentId: 'stu-1', page: '1', pageSize: '50' })
  })

  it('année seule', async () => {
    await fetchStudentAuditLogs({ academicYearId: 'year-2', page: 1, pageSize: 50 })
    expect(query(urls[0])).toEqual({ academicYearId: 'year-2', page: '1', pageSize: '50' })
  })

  it('élève + année, SANS résultat : liste vide, aucune erreur', async () => {
    const page = await fetchStudentAuditLogs({ studentId: 'stu-1', academicYearId: 'year-2', page: 1, pageSize: 50 })
    expect(query(urls[0])).toEqual({ studentId: 'stu-1', academicYearId: 'year-2', page: '1', pageSize: '50' })
    expect(page.logs).toEqual([])
    expect(page.total).toBe(0)
  })

  it('élève + année, AVEC résultat', async () => {
    reply = { status: 200, body: { page: 1, pageSize: 50, total: 1, totalPages: 1, logs: [{ id: 'log-1', action: 'STUDENT_LEFT' }] } }
    const page = await fetchStudentAuditLogs({ studentId: 'stu-1', academicYearId: 'year-1', page: 1, pageSize: 50 })
    expect(page.logs.map((l) => l.id)).toEqual(['log-1'])
  })

  it('filtre absent ou « tous » (undefined) : paramètre non envoyé', async () => {
    await fetchStudentAuditLogs({ studentId: undefined, academicYearId: undefined, page: 1, pageSize: 50 })
    expect(query(urls[0])).toEqual({ page: '1', pageSize: '50' })
  })

  it('vraie erreur serveur : le message du serveur remonte tel quel', async () => {
    reply = { status: 500, body: { message: 'Internal server error' } }
    await expect(fetchStudentAuditLogs({ studentId: 'stu-1' })).rejects.toThrow('Internal server error')
  })
})
