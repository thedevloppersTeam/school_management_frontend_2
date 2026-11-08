/**
 * Palette du calendrier v2 : table des jetons et rendu neutre, pour une ligne
 * sans jeton comme pour un jeton inconnu (SPEC-CAL-2 C-19, C-26, C-28, C-65,
 * CT-39 ; D-44, forme (a)). Aucune donnée réelle.
 */
import { describe, expect, it } from 'vitest'
import { JETONS_CALENDRIER, PALETTE_CALENDRIER, REPLI_NEUTRE, estJetonConnu, estSansJeton, renduJeton } from '@/lib/calendar-v2/palette'

describe('palette du calendrier', () => {
  it('porte exactement les trois noms confirmés, dans l\'ordre', () => {
    expect([...JETONS_CALENDRIER]).toEqual(['ardoise-profonde', 'primary-400', 'secondary-700'])
  })

  it('associe chaque jeton à sa classe de rampe de la charte', () => {
    expect(PALETTE_CALENDRIER['ardoise-profonde'].classe).toBe('bg-primary-800')
    expect(PALETTE_CALENDRIER['primary-400'].classe).toBe('bg-primary-400')
    expect(PALETTE_CALENDRIER['secondary-700'].classe).toBe('bg-secondary-700')
  })

  it('couvre chaque jeton connu, avec un nom affiché', () => {
    for (const j of JETONS_CALENDRIER) {
      expect(PALETTE_CALENDRIER[j].jeton).toBe(j)
      expect(PALETTE_CALENDRIER[j].nomAffiche.trim()).not.toBe('')
    }
    expect(Object.keys(PALETTE_CALENDRIER)).toHaveLength(JETONS_CALENDRIER.length)
  })

  it('n\'écrit aucune couleur en hexadécimal ni en valeur arbitraire', () => {
    const classes = [...Object.values(PALETTE_CALENDRIER).map((c) => c.classe), REPLI_NEUTRE.classe]
    for (const c of classes) expect(c).not.toMatch(/#|\[/)
  })

  it('rend un jeton connu avec sa classe et son nom affiché', () => {
    expect(renduJeton('secondary-700')).toEqual({
      connu: true, jeton: 'secondary-700', nomAffiche: 'Bronze', classe: 'bg-secondary-700',
    })
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('sans jeton (%s) : rendu neutre, sans erreur', (_l, valeur) => {
    expect(() => renduJeton(valeur)).not.toThrow()
    expect(renduJeton(valeur)).toEqual({ connu: false, motif: 'sans-jeton', classe: REPLI_NEUTRE.classe })
    expect(estSansJeton(valeur)).toBe(true)
    expect(estJetonConnu(valeur)).toBe(false)
  })

  it.each([
    ['nom inconnu', 'cal-bleu'],
    ['casse différente', 'Primary-400'],
    ['chaîne vide (un jeton, pas une absence)', ''],
    ['nombre', 400],
    ['clé héritée', 'toString'],
  ])('jeton inconnu (%s) : rendu neutre, sans erreur', (_l, valeur) => {
    expect(() => renduJeton(valeur)).not.toThrow()
    expect(renduJeton(valeur)).toEqual({ connu: false, motif: 'inconnu', classe: REPLI_NEUTRE.classe })
    expect(estSansJeton(valeur)).toBe(false)
    expect(estJetonConnu(valeur)).toBe(false)
  })

  it('sans jeton et jeton inconnu donnent exactement le même rendu', () => {
    expect(renduJeton(null).classe).toBe(renduJeton('cal-bleu').classe)
    expect(renduJeton(undefined).classe).toBe(renduJeton('').classe)
  })

  it("aucun nom de jeton « neutre » n'existe", () => {
    for (const j of JETONS_CALENDRIER) expect(j).not.toMatch(/neutr|neutral|gris|sans/i)
  })

  it('le repli est un contour en muted-foreground, sans remplissage', () => {
    expect(REPLI_NEUTRE.classe).toContain('border-muted-foreground')
    expect(REPLI_NEUTRE.classe).toContain('bg-transparent')
    expect(REPLI_NEUTRE.variableCss).toBe('--muted-foreground')
  })
})
