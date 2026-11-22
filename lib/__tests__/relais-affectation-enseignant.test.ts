/**
 * Relais Next.js de l'affectation d'un enseignant (lot ID-T-F-3, partie frontend) :
 *
 *  - POST /api/class-subjects/teacher/[id] transmet le cookie et le corps, encode
 *    l'identifiant en un seul segment, relaie les refus du serveur avec leur code,
 *    et VALIDE la réponse 200 contre le contrat épinglé (ADR-007 § 2) ;
 *  - GET /api/class-subjects retire la clé `teacher` de chaque élément (décision
 *    Q-2 d'Edy, minimisation : de l'enseignant, seul `teacherId` va au
 *    navigateur), et garde tout le reste.
 *
 * Le serveur est simulé par un petit serveur HTTP local ; valeurs fictives.
 * `?reponse=<statut>` choisit le statut, `&forme=hors-contrat` une réponse 200 invalide.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { NextRequest } from 'next/server'

const AFF = '00000000-0000-0000-0000-000000000001'
const FICHE = '00000000-0000-0000-0000-000000000002'

interface Recu {
  method: string
  path: string
  query: Record<string, string>
  cookie: string | undefined
  body: string
}

let server: http.Server
let recu: Recu | null = null

const AFFECTATIONS = [
  {
    id: AFF,
    subjectId: '00000000-0000-0000-0000-000000000003',
    teacherId: FICHE,
    // Jeu fictif volontairement chargé : la projection doit retirer tout l'objet, quel qu'en soit le contenu.
    teacher: {
      id: FICHE,
      user: {
        firstname: 'Fictif',
        lastname: 'ESSAI',
        birthDate: '1990-01-15',
        email: 'essai@exemple.test',
        password: '$2b$10$empreinte.fictive.de.test',
      },
    },
    subject: { name: 'Matière fictive', code: 'MF' },
    isExam: false,
  },
  { id: '00000000-0000-0000-0000-000000000004', subjectId: '00000000-0000-0000-0000-000000000005', teacherId: null, teacher: null },
]

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
        body: Buffer.concat(chunks).toString('utf8'),
      }
      const statut = Number(u.searchParams.get('reponse') ?? '200')
      let corps: unknown
      if (statut === 409) corps = { code: 'PROGRAMME_FICHE_INACTIVE', message: 'Fiche inactive' }
      else if (statut === 403) corps = { message: 'Forbidden' }
      else if (req.method === 'GET') corps = AFFECTATIONS
      else if (u.searchParams.get('forme') === 'hors-contrat') corps = { classSubjectId: 'x', geste: 'AUTRE' }
      else corps = { classSubjectId: AFF, teacherId: FICHE, geste: 'AFFECTATION' }
      res.writeHead(statut, { 'content-type': 'application/json' })
      res.end(JSON.stringify(corps))
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
  process.env.BACKEND_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => new Promise<void>((r) => server.close(() => r())))

const COOKIE = 'connect.sid=s%3Afictif.signature'

/** Toutes les clés d'objet d'une valeur JSON, à toute profondeur. */
function clesProfondes(valeur: unknown, cles = new Set<string>()): Set<string> {
  if (Array.isArray(valeur)) valeur.forEach((v) => clesProfondes(v, cles))
  else if (valeur && typeof valeur === 'object') {
    for (const [cle, v] of Object.entries(valeur)) {
      cles.add(cle)
      clesProfondes(v, cles)
    }
  }
  return cles
}

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

describe('POST /api/class-subjects/teacher/[id]', () => {
  const corps = JSON.stringify({ teacherId: FICHE })
  const params = (id: string) => ({ params: Promise.resolve({ id }) })

  it("vise l'affectation de l'adresse, transmet le cookie et le corps, rend la réponse du contrat", async () => {
    const { POST } = await import('@/app/api/class-subjects/teacher/[id]/route')
    const r = await lire(await POST(requete(`/api/class-subjects/teacher/${AFF}`, { method: 'POST', body: corps }), params(AFF)))
    expect(recu).toMatchObject({ method: 'POST', path: `/api/class-subjects/teacher/${AFF}`, cookie: COOKIE, body: corps })
    expect(r).toEqual({ status: 200, body: { classSubjectId: AFF, teacherId: FICHE, geste: 'AFFECTATION' } })
  })

  it('un identifiant hostile reste un seul segment de chemin', async () => {
    const { POST } = await import('@/app/api/class-subjects/teacher/[id]/route')
    await POST(requete('/api/class-subjects/teacher/x', { method: 'POST', body: corps }), params('../users/create'))
    expect(recu?.path).toBe('/api/class-subjects/teacher/..%2Fusers%2Fcreate')
  })

  it('409 relayé avec son code', async () => {
    const { POST } = await import('@/app/api/class-subjects/teacher/[id]/route')
    const r = await lire(await POST(requete(`/api/class-subjects/teacher/${AFF}?reponse=409`, { method: 'POST', body: corps }), params(AFF)))
    expect(r).toEqual({ status: 409, body: { code: 'PROGRAMME_FICHE_INACTIVE', message: 'Fiche inactive' } })
  })

  it('403 relayé tel quel', async () => {
    const { POST } = await import('@/app/api/class-subjects/teacher/[id]/route')
    const r = await lire(await POST(requete(`/api/class-subjects/teacher/${AFF}?reponse=403`, { method: 'POST', body: corps }), params(AFF)))
    expect(r).toEqual({ status: 403, body: { message: 'Forbidden' } })
  })

  it('une réponse 200 hors contrat devient 502 CONTRAT_REPONSE_INVALIDE', async () => {
    const { POST } = await import('@/app/api/class-subjects/teacher/[id]/route')
    const r = await lire(
      await POST(requete(`/api/class-subjects/teacher/${AFF}?forme=hors-contrat`, { method: 'POST', body: corps }), params(AFF)),
    )
    expect(r.status).toBe(502)
    expect(r.body.code).toBe('CONTRAT_REPONSE_INVALIDE')
  })
})

describe('GET /api/class-subjects (projection Q-2)', () => {
  it('transmet la requête et ne renvoie plus la clé « teacher »', async () => {
    const { GET } = await import('@/app/api/class-subjects/route')
    const r = await lire(await GET(requete('/api/class-subjects?classSessionId=00000000-0000-0000-0000-000000000006')))
    expect(recu).toMatchObject({ method: 'GET', path: '/api/class-subjects/', cookie: COOKIE })
    expect(recu?.query).toEqual({ classSessionId: '00000000-0000-0000-0000-000000000006' })
    expect(r.status).toBe(200)
    expect(r.body).toHaveLength(2)
    for (const element of r.body) expect(element).not.toHaveProperty('teacher')
    expect(JSON.stringify(r.body)).not.toContain('birthDate')
  })

  it('ne contient, à aucune profondeur, ni « teacher », ni « user », ni « password »', async () => {
    expect([...clesProfondes(AFFECTATIONS)]).toEqual(expect.arrayContaining(['teacher', 'user', 'password']))
    const { GET } = await import('@/app/api/class-subjects/route')
    const r = await lire(await GET(requete('/api/class-subjects')))
    const cles = clesProfondes(r.body)
    expect(cles.has('teacher')).toBe(false)
    expect(cles.has('user')).toBe(false)
    expect(cles.has('password')).toBe(false)
    expect(JSON.stringify(r.body)).not.toContain('empreinte.fictive')
  })

  it('garde teacherId et tous les autres champs', async () => {
    const { GET } = await import('@/app/api/class-subjects/route')
    const r = await lire(await GET(requete('/api/class-subjects')))
    const attendu = AFFECTATIONS.map((a) => Object.fromEntries(Object.entries(a).filter(([cle]) => cle !== 'teacher')))
    expect(r.body).toEqual(attendu)
    expect(attendu[0]).toHaveProperty('teacherId', FICHE)
  })

  it('un refus du serveur est relayé tel quel', async () => {
    const { GET } = await import('@/app/api/class-subjects/route')
    const r = await lire(await GET(requete('/api/class-subjects?reponse=403')))
    expect(r).toEqual({ status: 403, body: { message: 'Forbidden' } })
  })
})
