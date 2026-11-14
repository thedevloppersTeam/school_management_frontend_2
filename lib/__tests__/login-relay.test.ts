/**
 * POST /api/auth/login (app/api/auth/login/route.ts) : le relais de connexion,
 * appelé avec un vrai NextRequest vers un petit serveur HTTP local qui tient
 * le rôle de l'API.
 *
 * Vérifie que l'adresse du visiteur est transmise à l'API, et qu'une réponse
 * 429 de l'API arrive telle quelle à la page de connexion.
 * Adresses de documentation (RFC 5737), identifiants fictifs.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { NextRequest } from 'next/server'

const TOO_MANY = {
  code: 'IDENTITE_TROP_DE_TENTATIVES',
  message: 'Trop de tentatives de connexion. Réessayez dans 15 minute(s).',
}

let server: http.Server
let seen: { headers: http.IncomingHttpHeaders; body: string }[] = []

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      seen.push({ headers: req.headers, body })
      const { username } = JSON.parse(body) as { username: string }
      if (username === 'vt-bloque') {
        res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '900' })
        res.end(JSON.stringify(TOO_MANY))
      } else {
        res.writeHead(200, { 'content-type': 'application/json', 'set-cookie': 'connect.sid=fictif; Path=/; HttpOnly' })
        res.end(JSON.stringify({ message: 'ok', session: { userId: 'u1', type: 'ADMIN' } }))
      }
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
  process.env.BACKEND_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => new Promise<void>((r) => server.close(() => r())))

async function login(username: string, headers: Record<string, string>) {
  seen = []
  const { POST } = await import('@/app/api/auth/login/route')
  const res = await POST(
    new NextRequest('http://front.test/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ username, password: 'Motdepasse-fictif-1' }),
    }),
  )
  return { status: res.status, body: await res.json(), setCookie: res.headers.get('set-cookie'), api: seen[0] }
}

describe("POST /api/auth/login — relais vers l'API", () => {
  it("l'adresse du visiteur est transmise à l'API dans X-Forwarded-For", async () => {
    const r = await login('vt-admin', { 'x-forwarded-for': '203.0.113.21' })
    expect(r.status).toBe(200)
    expect(r.setCookie).toContain('connect.sid=fictif')
    expect(r.api?.headers['x-forwarded-for']).toBe('203.0.113.21')
    expect(JSON.parse(r.api!.body)).toEqual({ username: 'vt-admin', password: 'Motdepasse-fictif-1' })
  })

  it('plusieurs adresses reçues : la première, celle du visiteur', async () => {
    const r = await login('vt-admin', { 'x-forwarded-for': '203.0.113.22, 198.51.100.1' })
    expect(r.api?.headers['x-forwarded-for']).toBe('203.0.113.22')
  })

  it("adresse du visiteur inconnue : aucun en-tête d'adresse n'est envoyé", async () => {
    const r = await login('vt-admin', {})
    expect(r.status).toBe(200)
    expect(r.api?.headers['x-forwarded-for']).toBeUndefined()
  })

  it("429 de l'API : statut, code et message relayés tels quels, aucun cookie", async () => {
    const r = await login('vt-bloque', { 'x-forwarded-for': '203.0.113.23' })
    expect(r.status).toBe(429)
    expect(r.body).toEqual(TOO_MANY)
    expect(r.setCookie).toBeNull()
  })
})
