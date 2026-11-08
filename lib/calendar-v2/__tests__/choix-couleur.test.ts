/**
 * Choix « Sans couleur » d'une ligne de légende (SPEC-CAL-2 C-19, C-26 ; D-44,
 * forme (a)). Aucune donnée réelle.
 */
import { describe, expect, it } from 'vitest'
import { SANS_COULEUR, choixDepuisJeton, jetonDepuisChoix } from '@/lib/calendar-v2/choix-couleur'
import { JETONS_CALENDRIER } from '@/lib/calendar-v2/palette'

describe('choix de couleur', () => {
  it('la sentinelle ne peut pas être un nom de jeton de la charte', () => {
    expect(SANS_COULEUR).not.toMatch(/^[a-z0-9-]+$/)
    expect(JETONS_CALENDRIER as readonly string[]).not.toContain(SANS_COULEUR)
  })

  it('rien de choisi : aucune valeur, formulaire incomplet', () => {
    expect(jetonDepuisChoix(null)).toBeUndefined()
  })

  it('« Sans couleur » : null, jamais la sentinelle', () => {
    expect(jetonDepuisChoix(SANS_COULEUR)).toBeNull()
  })

  it('un jeton : le jeton tel quel', () => {
    expect(jetonDepuisChoix('primary-400')).toBe('primary-400')
  })

  it.each([null, undefined])('ligne enregistrée sans jeton (%s) : « Sans couleur » cochée', (jeton) => {
    expect(choixDepuisJeton(jeton)).toBe(SANS_COULEUR)
  })

  it('ligne enregistrée avec un jeton, même inconnu : ce jeton', () => {
    expect(choixDepuisJeton('secondary-700')).toBe('secondary-700')
    expect(choixDepuisJeton('cal-bleu')).toBe('cal-bleu')
  })

  it('aller-retour : un jeton et « Sans couleur » se conservent', () => {
    expect(jetonDepuisChoix(choixDepuisJeton(null))).toBeNull()
    expect(jetonDepuisChoix(choixDepuisJeton('ardoise-profonde'))).toBe('ardoise-profonde')
  })
})
