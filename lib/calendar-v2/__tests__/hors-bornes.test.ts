/**
 * Avertissement hors bornes, non bloquant (SPEC-CAL-2 C-34, CT-21). Bornes
 * incluses. Années fictives.
 */
import { describe, expect, it } from 'vitest'
import { estHorsBornes, messageHorsBornes } from '@/lib/calendar-v2/hors-bornes'

const bornes = { debut: '2026-09-01', fin: '2027-06-30' }

describe('estHorsBornes', () => {
  it.each([
    ['premier jour inclus', '2026-09-01', '2026-09-01'],
    ['dernier jour inclus', '2027-06-30', '2027-06-30'],
    ['période égale à l\'année', '2026-09-01', '2027-06-30'],
    ['jour au milieu', '2027-01-15', '2027-01-15'],
  ])('aucun avertissement : %s', (_l, debut, fin) => {
    expect(estHorsBornes(debut, fin, bornes)).toBe(false)
  })

  it.each([
    ['veille du premier jour', '2026-08-31', '2026-08-31'],
    ['lendemain du dernier jour', '2027-07-01', '2027-07-01'],
    ['période qui commence avant', '2026-08-25', '2026-09-05'],
    ['période qui finit après', '2027-06-20', '2027-07-10'],
    ['période qui englobe l\'année', '2026-08-01', '2027-07-31'],
  ])('avertissement : %s', (_l, debut, fin) => {
    expect(estHorsBornes(debut, fin, bornes)).toBe(true)
  })

  it('compare des dates civiles, pas des chaînes quelconques : changement d\'année', () => {
    expect(estHorsBornes('2026-12-31', '2027-01-01', bornes)).toBe(false)
  })

  it.each([
    ['début vide', '', '2027-01-01', bornes],
    ['fin absente', '2027-01-01', null, bornes],
    ['date illisible', '2027-13-01', '2027-13-01', bornes],
    ['bornes absentes', '2020-01-01', '2020-01-01', null],
    ['bornes illisibles', '2020-01-01', '2020-01-01', { debut: 'x', fin: '2027-06-30' }],
  ])('aucun avertissement sur ce qui ne se lit pas : %s', (_l, debut, fin, b) => {
    expect(estHorsBornes(debut, fin, b)).toBe(false)
  })
})

describe('messageHorsBornes', () => {
  it('un jour', () => {
    expect(messageHorsBornes('jour', 'Année A', bornes)).toBe(
      "Cette date est en dehors de l'année scolaire Année A (du 1er septembre 2026 au 30 juin 2027). Vous pouvez enregistrer quand même.",
    )
  })

  it('une période', () => {
    expect(messageHorsBornes('periode', 'Année A', bornes)).toBe(
      "Cette période déborde de l'année scolaire Année A (du 1er septembre 2026 au 30 juin 2027). Vous pouvez enregistrer quand même.",
    )
  })
})
