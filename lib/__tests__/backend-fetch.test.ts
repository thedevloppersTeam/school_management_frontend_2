/**
 * Défaut B-3 — relais Next.js (lib/backend.ts, backendFetch). Le relais est
 * appelé avec un vrai NextRequest vers un petit serveur HTTP local.
 *
 * Avant B-3, trois cas où le serveur avait répondu (204, 304, corps
 * interrompu) s'affichaient « Backend unreachable » ; le 304 survient dès
 * qu'une requête est conditionnelle (ETag d'Express), typiquement sur une
 * réponse identique — une liste vide.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { NextRequest } from 'next/server'

let server: http.Server
let seen: { url: string; headers: http.IncomingHttpHeaders } | null = null

beforeAll(async () => {
  server = http.createServer((req, res) => {
    seen = { url: req.url ?? '', headers: req.headers }
    const u = new URL(req.url ?? '/', 'http://local')
    const mode = u.searchParams.get('mode') ?? 'ok'
    if (mode === 'empty-list') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ page: 1, pageSize: 50, total: 0, totalPages: 0, logs: [] }))
    } else if (mode === 'no-content' || mode === 'not-modified') {
      res.writeHead(mode === 'no-content' ? 204 : 304)
      res.end()
    } else if (mode === 'bad-request' || mode === 'server-error') {
      res.writeHead(mode === 'bad-request' ? 400 : 500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ message: mode === 'bad-request' ? 'studentId must be a valid id' : 'Internal server error' }))
    } else if (mode === 'cut-body') {
      res.writeHead(200, { 'content-type': 'application/json', 'content-length': '500' })
      res.write('{"logs":[')
      setTimeout(() => res.socket?.destroy(), 20)
    } else {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true, query: Object.fromEntries(u.searchParams) }))
    }
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
  process.env.BACKEND_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => new Promise<void>((r) => server.close(() => r())))

async function relay(query: string) {
  const { backendFetch } = await import('@/lib/backend')
  const res = await backendFetch(new NextRequest(`http://front.test/api/student-audit-logs?${query}`), '/api/student-audit-logs', 'GET')
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

describe('backendFetch — ce que le serveur répond est relayé', () => {
  it('filtre sans résultat : 200 et la liste vide, telle quelle', async () => {
    expect(await relay('mode=empty-list')).toEqual({
      status: 200,
      body: { page: 1, pageSize: 50, total: 0, totalPages: 0, logs: [] },
    })
  })

  it("vraie erreur serveur (400, 500) : le statut et le message DU SERVEUR, jamais « Backend unreachable »", async () => {
    expect(await relay('mode=bad-request')).toEqual({ status: 400, body: { message: 'studentId must be a valid id' } })
    expect(await relay('mode=server-error')).toEqual({ status: 500, body: { message: 'Internal server error' } })
  })

  it('réponses sans corps (204, 304) : relayées, plus de faux 503', async () => {
    expect(await relay('mode=no-content')).toEqual({ status: 204, body: null })
    expect(await relay('mode=not-modified')).toEqual({ status: 304, body: null })
  })

  it('corps interrompu après la réponse : 502 qui dit le statut reçu, pas « injoignable »', async () => {
    const r = await relay('mode=cut-body')
    expect(r.status).toBe(502)
    expect(r.body.message).toBe('Réponse du serveur interrompue (statut 200). Réessayez.')
  })

  it('requête jamais conditionnelle : Cache-Control no-cache (Express ne répond alors jamais 304)', async () => {
    await relay('mode=ok')
    expect(seen?.headers['cache-control']).toBe('no-cache')
  })

  it('filtres élève + année : les deux paramètres arrivent au serveur', async () => {
    const r = await relay('studentId=stu-1&academicYearId=year-2&page=1&pageSize=50')
    expect(r.body.query).toEqual({ studentId: 'stu-1', academicYearId: 'year-2', page: '1', pageSize: '50' })
  })
})

describe('backendFetch — vraie panne de transmission', () => {
  it('serveur arrêté : 503 « Serveur injoignable » en français, avec un code', async () => {
    const prev = process.env.BACKEND_URL
    const closed = http.createServer()
    await new Promise<void>((r) => closed.listen(0, '127.0.0.1', () => r()))
    const port = (closed.address() as AddressInfo).port
    await new Promise<void>((r) => closed.close(() => r()))
    // env est lu au chargement du module : on vise le port fermé par l'URL absolue du chemin.
    const { backendFetch } = await import('@/lib/backend')
    const res = await backendFetch(new NextRequest('http://front.test/api/x'), `http://127.0.0.1:${port}/api/x`, 'GET')
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({
      message: "Serveur injoignable : la requête n'a pas pu lui être transmise. Réessayez dans un instant.",
      code: 'BACKEND_UNREACHABLE',
    })
    process.env.BACKEND_URL = prev
  })
})
