/**
 * Dates d'une entrée du calendrier v2, lues par civilFromApi (SPEC-CAL-2 C-32,
 * C-59, C-62, C-63). Aucune donnée réelle.
 */
import { describe, expect, it } from 'vitest'
import { libelleDates, lireDatesEntree } from '@/lib/calendar-v2/dates'

describe('lireDatesEntree', () => {
  it('lit un jour (début = fin)', () => {
    expect(lireDatesEntree('2027-05-18', '2027-05-18')).toEqual({ debut: '2027-05-18', fin: '2027-05-18', forme: 'jour' })
  })

  it('lit une période à cheval sur deux années civiles', () => {
    expect(lireDatesEntree('2026-12-20', '2027-01-05')).toEqual({ debut: '2026-12-20', fin: '2027-01-05', forme: 'periode' })
  })

  it('accepte l\'ancienne sérialisation à minuit UTC sans décaler d\'un jour', () => {
    expect(lireDatesEntree('2026-10-17T00:00:00.000Z', '2026-10-17T00:00:00.000Z')?.debut).toBe('2026-10-17')
  })

  it.each([
    ['date inexistante', '2027-02-30', '2027-02-30'],
    ['format JJ/MM', '18/05/2027', '18/05/2027'],
    ['valeur absente', undefined, '2027-05-18'],
    ['type inattendu', 20270518, '2027-05-18'],
    ['fin avant début', '2027-01-05', '2026-12-20'],
  ])('rend null : %s', (_l, debut, fin) => {
    expect(lireDatesEntree(debut, fin)).toBeNull()
  })
})

describe('libelleDates', () => {
  it('un jour : sa seule date', () => {
    expect(libelleDates({ debut: '2027-05-18', fin: '2027-05-18', forme: 'jour' })).toBe('18 mai 2027')
  })

  it('une période : du … au …, avec « 1er »', () => {
    expect(libelleDates({ debut: '2026-11-01', fin: '2027-01-05', forme: 'periode' })).toBe('du 1er novembre 2026 au 5 janvier 2027')
  })
})
