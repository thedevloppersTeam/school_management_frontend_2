/**
 * Relais Next.js de la modification du profil élève (lot frontend « profil
 * élève », D-95) : POST /api/students/update/[id] transmet le cookie et le corps
 * à l'octet près, encode l'identifiant en un seul segment (D-9), relaie les
 * refus du serveur avec leur code, et VALIDE la réponse 200 contre le contrat
 * épinglé (ADR-007 § 2).
 *
 * Le serveur est simulé par un petit serveur HTTP local ; valeurs fictives.
 * `?reponse=<statut>` choisit le statut, `&forme=hors-contrat` une réponse 200 invalide.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { NextRequest } from 'next/server'

const ELEVE = '00000000-0000-4000-8000-000000000001'
const COMPTE = '00000000-0000-4000-8000-000000000002'

interface Recu {
  method: string
  path: string
  cookie: string | undefined
  body: string
}

let server: http.Server
let recu: Recu | null = null

const REPONSE_200 = {
  message: 'Student updated successfully',
  student: { id: ELEVE, address: '1 rue Fictive', user: { id: COMPTE, email: 'eleve@exemple.test', gender: null } },
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const u = new URL(req.url ?? '/', 'http://local')
      recu = {
        method: req.method ?? '',
        path: u.pathname,
        cookie: req.headers.cookie,
        body: Buffer.concat(chunks).toString('utf8'),
      }
      const statut = Number(u.searchParams.get('reponse') ?? '200')
      let corps: unknown
      if (statut === 409) corps = { code: 'ELEVE_PROFIL_NISU_PRIS', message: 'Texte du serveur' }
      else if (statut === 400) corps = { code: 'ELEVE_PROFIL_CHAMP_OBLIGATOIRE', message: 'Texte du serveur' }
      else if (statut === 403) corps = { message: 'Forbidden' }
      else if (u.searchParams.get('forme') === 'hors-contrat') corps = { message: 'ok', student: { id: 'pas-un-uuid' } }
      else corps = REPONSE_200
      res.writeHead(statut, { 'content-type': 'application/json' })
      res.end(JSON.stringify(corps))
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
  process.env.BACKEND_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => new Promise<void>((r) => server.close(() => r())))

const COOKIE = 'connect.sid=s%3Afictif.signature'

function requete(url: string, body: string) {
  return new NextRequest(`http://front.test${url}`, {
    method: 'POST',
    headers: { cookie: COOKIE, 'content-type': 'application/json' },
    body,
  })
}

async function lire(res: Response) {
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })
const corps = JSON.stringify({ phone1: '+50900000001', fatherName: null })

describe('POST /api/students/update/[id]', () => {
  it("vise l'élève de l'adresse, transmet le cookie et le corps (null compris), rend la réponse du contrat", async () => {
    const { POST } = await import('@/app/api/students/update/[id]/route')
    const r = await lire(await POST(requete(`/api/students/update/${ELEVE}`, corps), params(ELEVE)))
    expect(recu).toMatchObject({ method: 'POST', path: `/api/students/update/${ELEVE}`, cookie: COOKIE, body: corps })
    expect(r).toEqual({ status: 200, body: REPONSE_200 })
  })

  it('un identifiant hostile reste un seul segment de chemin', async () => {
    const { POST } = await import('@/app/api/students/update/[id]/route')
    await POST(requete('/api/students/update/x', corps), params('../users/create'))
    expect(recu?.path).toBe('/api/students/update/..%2Fusers%2Fcreate')
  })

  it.each([
    [400, { code: 'ELEVE_PROFIL_CHAMP_OBLIGATOIRE', message: 'Texte du serveur' }],
    [409, { code: 'ELEVE_PROFIL_NISU_PRIS', message: 'Texte du serveur' }],
    [403, { message: 'Forbidden' }],
  ])('%i relayé tel quel, avec son code', async (statut, attendu) => {
    const { POST } = await import('@/app/api/students/update/[id]/route')
    const r = await lire(await POST(requete(`/api/students/update/${ELEVE}?reponse=${statut}`, corps), params(ELEVE)))
    expect(r).toEqual({ status: statut, body: attendu })
  })

  it('une réponse 200 hors contrat devient 502 CONTRAT_REPONSE_INVALIDE', async () => {
    const { POST } = await import('@/app/api/students/update/[id]/route')
    const r = await lire(await POST(requete(`/api/students/update/${ELEVE}?forme=hors-contrat`, corps), params(ELEVE)))
    expect(r.status).toBe(502)
    expect(r.body.code).toBe('CONTRAT_REPONSE_INVALIDE')
  })
})
