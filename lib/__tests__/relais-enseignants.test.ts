/**
 * Relais Next.js de l'écran « Enseignants » (lot ID-T-F) : chaque route handler
 * transmet le cookie de session et le corps, et rend le statut et le corps du
 * serveur SANS les transformer. Le serveur est simulé par un petit serveur HTTP
 * local ; valeurs fictives uniquement.
 *
 * Le serveur simulé répond le statut demandé par `?reponse=<statut>` (le relais
 * transmet les paramètres de requête), avec un corps qui rappelle ce qu'il a reçu.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { NextRequest } from 'next/server'

interface Recu {
  method: string
  path: string
  query: Record<string, string>
  cookie: string | undefined
  contentType: string | undefined
  body: string
}

let server: http.Server
let recu: Recu | null = null

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const u = new URL(req.url ?? '/', 'http://local')
      recu = {
        method: req.method ?? '',
        path: u.pathname,
        query: Object.fromEntries(u.searchParams),
        cookie: req.headers.cookie,
        contentType: req.headers['content-type'],
        body: Buffer.concat(chunks).toString('utf8'),
      }
      const statut = Number(u.searchParams.get('reponse') ?? '200')
      const corps =
        statut === 409
          ? { code: 'IDENTITE_ENSEIGNANT_FICHE_EXISTANTE', message: 'Teacher already exists' }
          : statut === 403
            ? { code: 'IDENTITE_ROLE_DE_SOI', message: 'Forbidden' }
            : u.pathname === '/api/teachers/candidats'
              ? [{ id: 'c1', firstname: 'Alpha', lastname: 'Essai', username: 'aessai', isActive: true }]
              : { message: 'ok', echo: recu.body }
      res.writeHead(statut, { 'content-type': 'application/json' })
      res.end(JSON.stringify(corps))
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
  process.env.BACKEND_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => new Promise<void>((r) => server.close(() => r())))

const COOKIE = 'connect.sid=s%3Afictif.signature'

function requete(url: string, init: { method: string; body?: string } = { method: 'GET' }) {
  return new NextRequest(`http://front.test${url}`, {
    method: init.method,
    headers: init.body !== undefined ? { cookie: COOKIE, 'content-type': 'application/json' } : { cookie: COOKIE },
    body: init.body,
  })
}

async function lire(res: Response) {
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

describe('POST /api/teachers (liste des fiches, relais existant)', () => {
  it('transmet le cookie et le corps ; rend la réponse du serveur telle quelle', async () => {
    const { POST } = await import('@/app/api/teachers/route')
    const r = await lire(await POST(requete('/api/teachers', { method: 'POST', body: '{}' })))
    expect(recu).toMatchObject({ method: 'POST', path: '/api/teachers/', cookie: COOKIE, body: '{}' })
    expect(r).toEqual({ status: 200, body: { message: 'ok', echo: '{}' } })
  })
})

describe('GET /api/teachers/candidats', () => {
  it('transmet le cookie et la recherche q ; rend la liste du serveur telle quelle', async () => {
    const { GET } = await import('@/app/api/teachers/candidats/route')
    const r = await lire(await GET(requete('/api/teachers/candidats?q=ess%20al')))
    expect(recu).toMatchObject({ method: 'GET', path: '/api/teachers/candidats', cookie: COOKIE, query: { q: 'ess al' } })
    expect(r).toEqual({
      status: 200,
      body: [{ id: 'c1', firstname: 'Alpha', lastname: 'Essai', username: 'aessai', isActive: true }],
    })
  })

  it('403 du serveur relayé avec son code', async () => {
    const { GET } = await import('@/app/api/teachers/candidats/route')
    const r = await lire(await GET(requete('/api/teachers/candidats?reponse=403')))
    expect(r).toEqual({ status: 403, body: { code: 'IDENTITE_ROLE_DE_SOI', message: 'Forbidden' } })
  })
})

describe('POST /api/teachers/create', () => {
  const corps = JSON.stringify({ userId: '00000000-0000-4000-8000-000000000000', role: 'Titulaire' })

  it('transmet le cookie et le corps à l’octet près', async () => {
    const { POST } = await import('@/app/api/teachers/create/route')
    const r = await lire(await POST(requete('/api/teachers/create?reponse=201', { method: 'POST', body: corps })))
    expect(recu).toMatchObject({ method: 'POST', path: '/api/teachers/create', cookie: COOKIE, body: corps, contentType: 'application/json' })
    expect(r).toEqual({ status: 201, body: { message: 'ok', echo: corps } })
  })

  it('409 du serveur relayé sans transformation', async () => {
    const { POST } = await import('@/app/api/teachers/create/route')
    const r = await lire(await POST(requete('/api/teachers/create?reponse=409', { method: 'POST', body: corps })))
    expect(r).toEqual({ status: 409, body: { code: 'IDENTITE_ENSEIGNANT_FICHE_EXISTANTE', message: 'Teacher already exists' } })
  })
})

describe('POST /api/teachers/fiche-status/[id]', () => {
  const corps = JSON.stringify({ isActive: false })
  const params = (id: string) => ({ params: Promise.resolve({ id }) })

  it("vise la fiche de l'adresse, transmet le cookie et le corps", async () => {
    const { POST } = await import('@/app/api/teachers/fiche-status/[id]/route')
    const r = await lire(await POST(requete('/api/teachers/fiche-status/fiche-1', { method: 'POST', body: corps }), params('fiche-1')))
    expect(recu).toMatchObject({ method: 'POST', path: '/api/teachers/fiche-status/fiche-1', cookie: COOKIE, body: corps })
    expect(r).toEqual({ status: 200, body: { message: 'ok', echo: corps } })
  })

  it('un identifiant hostile reste un seul segment de chemin', async () => {
    const { POST } = await import('@/app/api/teachers/fiche-status/[id]/route')
    await POST(requete('/api/teachers/fiche-status/x', { method: 'POST', body: corps }), params('../users/create'))
    expect(recu?.path).toBe('/api/teachers/fiche-status/..%2Fusers%2Fcreate')
  })

  it('403 (sa propre fiche) relayé avec son code', async () => {
    const { POST } = await import('@/app/api/teachers/fiche-status/[id]/route')
    const r = await lire(await POST(requete('/api/teachers/fiche-status/fiche-1?reponse=403', { method: 'POST', body: corps }), params('fiche-1')))
    expect(r).toEqual({ status: 403, body: { code: 'IDENTITE_ROLE_DE_SOI', message: 'Forbidden' } })
  })
})
