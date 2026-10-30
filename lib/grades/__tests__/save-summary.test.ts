/**
 * Compte rendu de bulk-create (lib/grades/save-summary.ts) : compteurs
 * `created` / `replaced` du serveur, et repli sur l'ancien message quand ils
 * manquent (serveur antérieur). Données fictives uniquement.
 */
import { describe, it, expect } from 'vitest'
import { readBulkCreateCounts, bulkCreateParts } from '@/lib/grades/save-summary'

describe('readBulkCreateCounts', () => {
  it('lit created et replaced', () => {
    expect(readBulkCreateCounts({ message: 'x', created: 3, replaced: 1, grades: [] }))
      .toEqual({ created: 3, replaced: 1 })
  })
  it('null si un champ manque (ancien serveur)', () => {
    expect(readBulkCreateCounts({ message: 'x', grades: [] })).toBeNull()
    expect(readBulkCreateCounts({ created: 3 })).toBeNull()
    expect(readBulkCreateCounts(null)).toBeNull()
  })
  it("null si un champ n'est pas un entier positif", () => {
    expect(readBulkCreateCounts({ created: '3', replaced: 0 })).toBeNull()
    expect(readBulkCreateCounts({ created: -1, replaced: 0 })).toBeNull()
    expect(readBulkCreateCounts({ created: 1.5, replaced: 0 })).toBeNull()
  })
})

describe('bulkCreateParts, grille par matière (avec le nom)', () => {
  it("ancien serveur : exactement l'ancien texte", () => {
    expect(bulkCreateParts(3, null, true)).toEqual(['3 notes créées'])
    expect(bulkCreateParts(1, null, true)).toEqual(['1 note créée'])
    expect(bulkCreateParts(0, null, true)).toEqual([])
  })
  it('créées et remplacées, accords', () => {
    expect(bulkCreateParts(4, { created: 3, replaced: 1 }, true)).toEqual(['3 notes créées', '1 note remplacée'])
    expect(bulkCreateParts(3, { created: 1, replaced: 2 }, true)).toEqual(['1 note créée', '2 notes remplacées'])
  })
  it('la partie à 0 est omise', () => {
    expect(bulkCreateParts(2, { created: 0, replaced: 2 }, true)).toEqual(['2 notes remplacées'])
    expect(bulkCreateParts(2, { created: 2, replaced: 0 }, true)).toEqual(['2 notes créées'])
  })
})

describe('bulkCreateParts, saisie par élève (sans le nom)', () => {
  it("ancien serveur : exactement l'ancien texte", () => {
    expect(bulkCreateParts(3, null, false)).toEqual(['3 créées'])
    expect(bulkCreateParts(1, null, false)).toEqual(['1 créée'])
  })
  it('créées et remplacées', () => {
    expect(bulkCreateParts(3, { created: 2, replaced: 1 }, false)).toEqual(['2 créées', '1 remplacée'])
  })
})
