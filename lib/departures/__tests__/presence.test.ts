/**
 * D-22 — élèves partis visibles : filtre de liste et présence par étape
 * (saisie des notes et du comportement, bulletins par salle et en lot).
 * Fonctions pures ; données fictives, aucun élève réel.
 */
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PRESENCE_FILTER,
  PRESENCE_FILTERS,
  hasEntrySteps,
  leftLabel,
  matchesPresence,
  presentAtStep,
  stepsForEnrollment,
} from '@/lib/departures/presence'
import { formatFrenchLongDate } from '@/lib/date-format'

const STEPS = [
  { id: 'st-1', name: 'Etape 1', stepNumber: 1, startDate: '2025-09-01T00:00:00.000Z' },
  { id: 'st-2', name: 'Etape 2', stepNumber: 2, startDate: '2025-11-17T00:00:00.000Z' },
  { id: 'st-3', name: 'Etape 3', stepNumber: 3, startDate: '2026-02-02T00:00:00.000Z' },
  { id: 'st-4', name: 'Etape 4', stepNumber: 4, startDate: '2026-04-13T00:00:00.000Z' },
]

// Une salle fictive, telle que la reçoivent les écrans de saisie et de bulletins.
const ROOM = [
  { id: 'e-actif', status: 'ACTIVE', lastAttendedStepId: null },
  { id: 'e-parti', status: 'DROPPED', lastAttendedStepId: 'st-2' },
  { id: 'e-a-completer', status: 'DROPPED', lastAttendedStepId: null },
  { id: 'e-diplome', status: 'GRADUATED', lastAttendedStepId: null },
  { id: 'e-transfere', status: 'TRANSFERRED', lastAttendedStepId: 'st-4' },
]
const atStep = (stepId: string) => ROOM.filter((e) => presentAtStep(e, stepId, STEPS)).map((e) => e.id)

describe('filtre Actifs / Partis / Tous', () => {
  const statuses = ['ACTIVE', 'DROPPED', 'GRADUATED', 'TRANSFERRED', undefined]
  const keep = (f: Parameters<typeof matchesPresence>[1]) => statuses.filter((s) => matchesPresence(s, f))

  it('défaut : Tous — les élèves partis restent listés', () => {
    expect(DEFAULT_PRESENCE_FILTER).toBe('ALL')
    expect(keep('ALL')).toEqual(statuses)
  })

  it('Actifs : ACTIVE seulement ; Partis : DROPPED seulement', () => {
    expect(keep('ACTIVE')).toEqual(['ACTIVE'])
    expect(keep('LEFT')).toEqual(['DROPPED'])
  })

  it('libellés dans l\'ordre « Tous, Actifs, Partis »', () => {
    expect(PRESENCE_FILTERS.map((f) => f.label)).toEqual(['Tous', 'Actifs', 'Partis'])
  })
})

describe('présence par étape — saisie (notes, comportement) et bulletins', () => {
  it('étapes suivies (1 et 2) : l\'élève parti est proposé, avec les actifs', () => {
    expect(atStep('st-1')).toEqual(['e-actif', 'e-parti'])
    expect(atStep('st-2')).toEqual(['e-actif', 'e-parti'])
  })

  it('étapes postérieures au départ (3 et 4) : il est absent', () => {
    expect(atStep('st-3')).toEqual(['e-actif'])
    expect(atStep('st-4')).toEqual(['e-actif'])
  })

  it('départ non complété, diplômé, TRANSFERRED : jamais proposés', () => {
    for (const s of STEPS) {
      expect(atStep(s.id)).not.toContain('e-a-completer')
      expect(atStep(s.id)).not.toContain('e-diplome')
      expect(atStep(s.id)).not.toContain('e-transfere')
    }
  })

  it("aucune étape choisie : les actifs seuls (comme avant)", () => {
    expect(atStep('')).toEqual(['e-actif'])
  })

  it("ordre des DATES de début, pas des numéros d'étape", () => {
    const shuffled = STEPS.map((s) => (s.id === 'st-3' ? { ...s, startDate: '2025-10-01' } : s))
    expect(presentAtStep(ROOM[1], 'st-3', shuffled)).toBe(true)
    expect(presentAtStep(ROOM[1], 'st-4', shuffled)).toBe(false)
  })

  it('saisie par élève : étapes proposées et inscriptions saisissables', () => {
    expect(stepsForEnrollment(ROOM[1], STEPS).map((s) => s.id)).toEqual(['st-1', 'st-2'])
    expect(stepsForEnrollment(ROOM[0], STEPS)).toHaveLength(4)
    expect(stepsForEnrollment(ROOM[2], STEPS)).toEqual([])
    expect(ROOM.filter(hasEntrySteps).map((e) => e.id)).toEqual(['e-actif', 'e-parti'])
  })
})

describe('badge « Parti le … »', () => {
  it('avec date, sans date', () => {
    expect(leftLabel('2026-01-20')).toBe(`Parti le ${formatFrenchLongDate('2026-01-20')}`)
    expect(leftLabel(null)).toBe('Parti')
  })
})
