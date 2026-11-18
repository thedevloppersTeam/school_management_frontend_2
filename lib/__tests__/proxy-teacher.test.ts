/**
 * proxy.ts (lot ID-T-F-1) : /teacher est protégé comme /admin. Le contrôle ne
 * porte que sur la PRÉSENCE du cookie de session ; le rôle est vérifié par la
 * coque (lib/garde/espace.ts) puis par le serveur. Cookie fictif.
 */
import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'

const ORIGINE = 'http://localhost'

const requete = (chemin: string, avecSession: boolean) =>
  new NextRequest(new URL(chemin, ORIGINE), {
    headers: avecSession ? { cookie: 'connect.sid=valeur-fictive' } : {},
  })

const destination = (r: Response) => {
  const lieu = r.headers.get('location')
  return lieu ? new URL(lieu).pathname + new URL(lieu).search : null
}

describe('proxy — espace enseignant', () => {
  it('sans session : /teacher/dashboard → /login?from=/teacher/dashboard', () => {
    const r = proxy(requete('/teacher/dashboard', false))
    expect(r.status).toBe(307)
    expect(destination(r)).toBe('/login?from=%2Fteacher%2Fdashboard')
  })

  it('sans session : /teacher seul est protégé aussi', () => {
    expect(destination(proxy(requete('/teacher', false)))).toBe('/login?from=%2Fteacher')
  })

  it('avec session : /teacher/dashboard passe (la coque décide du rôle)', () => {
    const r = proxy(requete('/teacher/dashboard', true))
    expect(destination(r)).toBeNull()
    expect(r.headers.get('x-middleware-next')).toBe('1')
  })

  it('un chemin qui commence seulement par « /teacher » n’est pas capté', () => {
    expect(destination(proxy(requete('/teachers-fictif', false)))).toBeNull()
  })

  it('inchangé : /login avec session → /admin/dashboard (E-2 renvoie ensuite l’enseignant)', () => {
    expect(destination(proxy(requete('/login', true)))).toBe('/admin/dashboard')
  })

  it('inchangé : /admin sans session → /login', () => {
    expect(destination(proxy(requete('/admin/enseignants', false)))).toBe('/login?from=%2Fadmin%2Fenseignants')
  })
})
