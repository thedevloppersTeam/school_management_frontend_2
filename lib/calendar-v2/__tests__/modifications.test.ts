/**
 * Champs modifiés d'un formulaire (SPEC-CAL-2 C-27, C-42). Aucune donnée réelle.
 */
import { describe, expect, it } from 'vitest'
import { aDesModifications, champsModifies } from '@/lib/calendar-v2/modifications'

const initial = { label: 'Congés', colorToken: 'jeton-retire', sortOrder: 0, note: null as string | null }

describe('champsModifies', () => {
  it('rien de changé : objet vide, aucune modification', () => {
    expect(champsModifies(initial, { ...initial })).toEqual({})
    expect(aDesModifications(initial, { ...initial })).toBe(false)
  })

  it('libellé seul changé : le jeton n\'est pas renvoyé', () => {
    expect(champsModifies(initial, { ...initial, label: 'Vacances' })).toEqual({ label: 'Vacances' })
  })

  it('note effacée : null est renvoyé', () => {
    const avant: typeof initial = { ...initial, note: 'texte' }
    expect(champsModifies(avant, { ...avant, note: null })).toEqual({ note: null })
  })

  it('ne normalise pas les espaces ; un ordre changé compte', () => {
    expect(champsModifies(initial, { ...initial, label: 'Congés ' })).toEqual({ label: 'Congés ' })
    expect(aDesModifications(initial, { ...initial, sortOrder: 1 })).toBe(true)
  })
})
