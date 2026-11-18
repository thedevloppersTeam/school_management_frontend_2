/**
 * Garde de rôle des coques /admin et /teacher (lot ID-T-F-1) : logique pure de
 * lib/garde/espace.ts. Réponses de /me fictives uniquement.
 */
import { describe, expect, it } from 'vitest'
import {
  ACCUEIL_ADMIN,
  ACCUEIL_ENSEIGNANT,
  CONNEXION,
  CONNEXION_EXPIREE,
  decisionDeGarde,
  estEnseignant,
  libelleDuRole,
} from '@/lib/garde/espace'

const moi = (roles: string[] | undefined, type?: string) => ({
  id: 'compte-1',
  firstname: 'Alpha',
  lastname: 'Essai',
  username: 'essai.fictif',
  isActive: true,
  ...(type !== undefined && { type }),
  ...(roles !== undefined && { roles }),
})

const AFFICHER = { action: 'afficher' }
const vers = (chemin: string, fermerLaSession = false) => ({ action: 'rediriger', vers: chemin, fermerLaSession })

describe('decisionDeGarde — pas de session valide', () => {
  it('getMe() null → /login?expired=1, sur les deux coques', () => {
    expect(decisionDeGarde('admin', null)).toEqual(vers(CONNEXION_EXPIREE))
    expect(decisionDeGarde('enseignant', null)).toEqual(vers(CONNEXION_EXPIREE))
    expect(CONNEXION_EXPIREE).toBe('/login?expired=1')
  })
  it('réponse illisible → traitée comme absente', () => {
    expect(decisionDeGarde('enseignant', undefined)).toEqual(vers(CONNEXION_EXPIREE))
    expect(decisionDeGarde('admin', [])).toEqual(vers(CONNEXION_EXPIREE))
  })
})

describe('decisionDeGarde — coque /teacher', () => {
  it('TEACHER seul → afficher', () => {
    expect(decisionDeGarde('enseignant', moi(['TEACHER'], 'TEACHER'))).toEqual(AFFICHER)
  })
  it('administrateur, enseignant ou non → /admin/dashboard (D-TF1-4)', () => {
    expect(decisionDeGarde('enseignant', moi(['ADMIN'], 'ADMIN'))).toEqual(vers(ACCUEIL_ADMIN))
    expect(decisionDeGarde('enseignant', moi(['SYSTEM_ADMIN'], 'SYSTEM_ADMIN'))).toEqual(vers(ACCUEIL_ADMIN))
    expect(decisionDeGarde('enseignant', moi(['ADMIN', 'TEACHER'], 'ADMIN'))).toEqual(vers(ACCUEIL_ADMIN))
    expect(ACCUEIL_ADMIN).toBe('/admin/dashboard')
  })
  it('tout autre compte → /login, session fermée', () => {
    expect(decisionDeGarde('enseignant', moi(['PARENT'], 'PARENT'))).toEqual(vers(CONNEXION, true))
    expect(decisionDeGarde('enseignant', moi([]))).toEqual(vers(CONNEXION, true))
    expect(CONNEXION).toBe('/login')
  })
})

describe('decisionDeGarde — coque /admin (E-2)', () => {
  it('ADMIN, SYSTEM_ADMIN → afficher', () => {
    expect(decisionDeGarde('admin', moi(['ADMIN'], 'ADMIN'))).toEqual(AFFICHER)
    expect(decisionDeGarde('admin', moi(['SYSTEM_ADMIN'], 'SYSTEM_ADMIN'))).toEqual(AFFICHER)
  })
  it('cumul ADMIN + TEACHER → reste dans /admin (D-TF1-4)', () => {
    expect(decisionDeGarde('admin', moi(['ADMIN', 'TEACHER'], 'ADMIN'))).toEqual(AFFICHER)
  })
  it('TEACHER seul → /teacher/dashboard', () => {
    expect(decisionDeGarde('admin', moi(['TEACHER'], 'TEACHER'))).toEqual(vers(ACCUEIL_ENSEIGNANT))
    expect(ACCUEIL_ENSEIGNANT).toBe('/teacher/dashboard')
  })
  it('tout autre compte → /login, session fermée', () => {
    expect(decisionDeGarde('admin', moi(['STUDENT'], 'STUDENT'))).toEqual(vers(CONNEXION, true))
  })
  it('`roles` fait foi sur `type`', () => {
    expect(decisionDeGarde('admin', moi([], 'ADMIN'))).toEqual(vers(CONNEXION, true))
    expect(decisionDeGarde('admin', moi(['TEACHER'], 'ADMIN'))).toEqual(vers(ACCUEIL_ENSEIGNANT))
  })
  it('sans `roles` : repli sur `type`', () => {
    expect(decisionDeGarde('admin', moi(undefined, 'ADMIN'))).toEqual(AFFICHER)
    expect(decisionDeGarde('admin', moi(undefined, 'TEACHER'))).toEqual(vers(ACCUEIL_ENSEIGNANT))
    expect(decisionDeGarde('enseignant', moi(undefined, 'TEACHER'))).toEqual(AFFICHER)
  })
})

describe('estEnseignant et libelleDuRole', () => {
  it('estEnseignant : roles, puis type', () => {
    expect(estEnseignant(moi(['TEACHER']))).toBe(true)
    expect(estEnseignant(moi(['ADMIN']))).toBe(false)
    expect(estEnseignant(moi(undefined, 'TEACHER'))).toBe(true)
    expect(estEnseignant(null)).toBe(false)
  })
  it('libellé du rôle', () => {
    expect(libelleDuRole(moi(['TEACHER']))).toBe('Enseignant')
    expect(libelleDuRole(moi(['ADMIN', 'TEACHER']))).toBe('Administrateur')
    expect(libelleDuRole(moi([]))).toBe('Compte')
  })
})
