/**
 * Aides d'affichage de l'écran de promotion. Elles ne décident rien (le
 * serveur recontrôle), mais elles ne doivent proposer que ce que le serveur
 * acceptera. Données fictives.
 */
import { describe, expect, it } from 'vitest'
import { destinationFor, needsTrackChoice, nextYearOf, requiredFields, type SessionInfo } from '../screen'

const L = {
  c8: { id: 'ct-8', name: '8ème AF', levelOrder: 8, hasTrack: false },
  c9: { id: 'ct-9', name: '9ème AF', levelOrder: 9, hasTrack: false },
  ns2: { id: 'ct-ns2', name: 'NS2', levelOrder: 11, hasTrack: false },
  ns3: { id: 'ct-ns3', name: 'NS3', levelOrder: 12, hasTrack: true },
  ns4: { id: 'ct-ns4', name: 'NS4', levelOrder: 13, hasTrack: true },
  libre: { id: 'ct-x', name: 'Libre', levelOrder: null, hasTrack: false },
}
const S = (id: string, ct: SessionInfo['classType']): SessionInfo => ({ id, label: `${ct.name} A`, classType: ct })
const N1 = [S('s-9', L.c9), S('s-ns3', L.ns3), S('s-ns4', L.ns4), S('s-8', L.c8)]

describe('écran de promotion — aides d\'affichage', () => {
  it('RP-04 / RP-23 / RP-09 : champs de motif demandés', () => {
    expect(requiredFields({ proposedOutcome: 'ADMIS', state: 'ready' }, 'ADMIS')).toEqual({ overrideReason: false, conditionText: false, unblockReason: false })
    expect(requiredFields({ proposedOutcome: 'ADMIS', state: 'ready' }, 'REDOUBLE').overrideReason).toBe(true)
    // RP-23 : la condition tient lieu de motif.
    expect(requiredFields({ proposedOutcome: 'ADMIS', state: 'ready' }, 'ADMIS_SOUS_CONDITION')).toEqual({ overrideReason: false, conditionText: true, unblockReason: false })
    expect(requiredFields({ proposedOutcome: null, state: 'blocked' }, 'ADMIS')).toEqual({ overrideReason: true, conditionText: false, unblockReason: true })
  })

  it('RP-19 / RP-06 / RP-20 : salles proposées', () => {
    expect(destinationFor('ADMIS', L.c8, N1)).toEqual({ kind: 'session', sessions: [N1[0]] })
    expect(destinationFor('REDOUBLE', L.c8, N1)).toEqual({ kind: 'session', sessions: [N1[3]] })
    expect(destinationFor('ADMIS_AILLEURS', L.c8, N1)).toEqual({ kind: 'none' })
    expect(destinationFor('ADMIS', L.ns4, N1)).toEqual({ kind: 'graduate' })
    expect(destinationFor('REDOUBLE', L.ns4, N1)).toEqual({ kind: 'session', sessions: [N1[2]] })
    // +1 exact : NS2 (11) → NS3 (12) ; 9ème AF (9) → NS1 (10) absent → aucune salle, pas de saut.
    expect(destinationFor('ADMIS', L.ns2, N1)).toEqual({ kind: 'session', sessions: [N1[1]] })
    expect(destinationFor('ADMIS', L.c9, N1)).toEqual({ kind: 'session', sessions: [] })
    expect(destinationFor('ADMIS', L.libre, N1)).toEqual({ kind: 'session', sessions: [] })
  })

  it('RP-11b : filière à choisir seulement pour NS2 → NS3 admis', () => {
    expect(needsTrackChoice('ADMIS', L.ns2, N1[1])).toBe(true)
    expect(needsTrackChoice('ADMIS_SOUS_CONDITION', L.ns2, N1[1])).toBe(true)
    expect(needsTrackChoice('ADMIS', L.ns3, N1[2])).toBe(false) // RP-11 : reprise
    expect(needsTrackChoice('REDOUBLE', L.ns3, N1[1])).toBe(false)
    expect(needsTrackChoice('ADMIS', L.c8, N1[0])).toBe(false) // RP-12
    expect(needsTrackChoice('ADMIS', L.ns2, undefined)).toBe(false)
  })

  it('Année N+1 : la première qui commence après N', () => {
    const y = [
      { id: 'a', startDate: '2026-09-01' },
      { id: 'b', startDate: '2025-09-01' },
      { id: 'c', startDate: '2027-09-01' },
    ]
    expect(nextYearOf(y, y[1])?.id).toBe('a')
    expect(nextYearOf(y, y[2])).toBeUndefined()
  })
})
