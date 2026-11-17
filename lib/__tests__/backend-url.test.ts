import { describe, expect, it } from 'vitest'
import { BACKEND_URL_MANQUANTE, resolveBackendUrl } from '../backend-url.mjs'

describe('resolveBackendUrl — adresse du backend pour next.config.mjs (A11)', () => {
  it('BACKEND_URL posée : elle est utilisée', () => {
    expect(resolveBackendUrl({ BACKEND_URL: 'https://backend.exemple.test' }))
      .toBe('https://backend.exemple.test')
  })

  it('NEXT_PUBLIC_BACKEND_URL posée : elle est utilisée', () => {
    expect(resolveBackendUrl({ NEXT_PUBLIC_BACKEND_URL: 'http://localhost:4000' }))
      .toBe('http://localhost:4000')
  })

  it('les deux posées : NEXT_PUBLIC_BACKEND_URL a la priorité', () => {
    expect(resolveBackendUrl({
      NEXT_PUBLIC_BACKEND_URL: 'https://a.exemple.test',
      BACKEND_URL: 'https://b.exemple.test',
    })).toBe('https://a.exemple.test')
  })

  it('barre oblique finale retirée', () => {
    expect(resolveBackendUrl({ BACKEND_URL: 'https://backend.exemple.test/' }))
      .toBe('https://backend.exemple.test')
  })

  it('NEXT_PUBLIC_BACKEND_URL vide : on passe à BACKEND_URL', () => {
    expect(resolveBackendUrl({ NEXT_PUBLIC_BACKEND_URL: '  ', BACKEND_URL: 'https://b.exemple.test' }))
      .toBe('https://b.exemple.test')
  })

  it('aucune variable : erreur explicite', () => {
    expect(() => resolveBackendUrl({})).toThrow(BACKEND_URL_MANQUANTE)
  })

  it('variables vides : erreur, jamais d’adresse par défaut', () => {
    expect(() => resolveBackendUrl({ NEXT_PUBLIC_BACKEND_URL: '', BACKEND_URL: '   ' }))
      .toThrow(BACKEND_URL_MANQUANTE)
  })

  it('le message nomme les deux variables et ne contient aucune adresse', () => {
    expect(BACKEND_URL_MANQUANTE).toContain('BACKEND_URL')
    expect(BACKEND_URL_MANQUANTE).toContain('NEXT_PUBLIC_BACKEND_URL')
    expect(BACKEND_URL_MANQUANTE).not.toMatch(/https?:\/\//)
  })
})
