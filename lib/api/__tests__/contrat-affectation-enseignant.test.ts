/**
 * Validateur généré de la réponse 200 de POST /api/class-subjects/teacher/:id
 * (lot ID-T-F-3, lot A serveur), tiré de la copie épinglée du contrat
 * (contract/openapi.json, ADR-007 § 2). Fixtures FICTIVES uniquement.
 *
 *  - la réponse du contrat est acceptée, retrait compris (`teacherId: null`) ;
 *  - un geste inconnu, un identifiant mal formé ou un champ manquant sont refusés ;
 *  - lecteur tolérant : un champ supplémentaire est accepté.
 */
import { describe, expect, it } from 'vitest'
import { PostApiClassSubjectsTeacherId200Response as schema } from '@/lib/api/menfp/contract.gen'

const AFF = '00000000-0000-0000-0000-000000000001'
const FICHE = '00000000-0000-0000-0000-000000000002'

const accepte = (v: unknown) => schema.safeParse(v).success

describe('contrat — réponse 200 de POST /api/class-subjects/teacher/:id', () => {
  it('le validateur est généré depuis la copie épinglée', () => {
    expect(schema).toBeDefined()
  })

  it('accepte les trois gestes du contrat', () => {
    expect(accepte({ classSubjectId: AFF, teacherId: FICHE, geste: 'AFFECTATION' })).toBe(true)
    expect(accepte({ classSubjectId: AFF, teacherId: FICHE, geste: 'REMPLACEMENT' })).toBe(true)
    expect(accepte({ classSubjectId: AFF, teacherId: null, geste: 'RETRAIT' })).toBe(true)
  })

  it('refuse un geste inconnu, un identifiant mal formé ou un champ manquant', () => {
    expect(accepte({ classSubjectId: AFF, teacherId: FICHE, geste: 'AUTRE' })).toBe(false)
    expect(accepte({ classSubjectId: AFF, teacherId: 'pas-un-uuid', geste: 'AFFECTATION' })).toBe(false)
    expect(accepte({ classSubjectId: AFF, geste: 'RETRAIT' })).toBe(false)
  })

  it('lecteur tolérant : un champ supplémentaire est accepté', () => {
    expect(accepte({ classSubjectId: AFF, teacherId: null, geste: 'RETRAIT', ajout: 1 })).toBe(true)
  })
})
