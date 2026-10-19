/**
 * Départ en cours d'année — préremplissage de la dernière étape suivie d'après
 * la date (SPEC-RESULTATS v0.3 RS-08). Fonctions pures, aucune donnée réelle.
 */
import { describe, it, expect } from 'vitest'
import { DEPARTURE_REASONS, departureReasonLabel, inferLastAttendedStep, isWithinYear, orderSteps } from '@/lib/departures/departures'

// Année 2025-2026 : quatre étapes, avec des vacances entre l'étape 2 et l'étape 3.
const STEPS = [
  { id: 'st-1', name: 'Etape 1', stepNumber: 1, startDate: '2025-09-01T00:00:00.000Z' },
  { id: 'st-2', name: 'Etape 2', stepNumber: 2, startDate: '2025-11-17T00:00:00.000Z' },
  { id: 'st-3', name: 'Etape 3', stepNumber: 3, startDate: '2026-02-02T00:00:00.000Z' },
  { id: 'st-4', name: 'Etape 4', stepNumber: 4, startDate: '2026-04-13T00:00:00.000Z' },
]

describe('inferLastAttendedStep — dernière étape suivie préremplie d\'après la date', () => {
  it("départ pendant une étape : cette étape (elle est commencée, donc suivie)", () => {
    expect(inferLastAttendedStep(STEPS, '2025-12-10')).toBe('st-2')
    expect(inferLastAttendedStep(STEPS, '2026-05-20')).toBe('st-4')
  })

  it("départ le jour même du début d'une étape : cette étape", () => {
    expect(inferLastAttendedStep(STEPS, '2026-02-02')).toBe('st-3')
    expect(inferLastAttendedStep(STEPS, '2026-02-01')).toBe('st-2')
  })

  it("départ entre deux étapes (vacances) : l'étape précédente", () => {
    expect(inferLastAttendedStep(STEPS, '2026-01-25')).toBe('st-2')
  })

  it('date antérieure à la première étape, vide ou invalide : rien de prérempli', () => {
    expect(inferLastAttendedStep(STEPS, '2025-08-31')).toBeNull()
    expect(inferLastAttendedStep(STEPS, '')).toBeNull()
    expect(inferLastAttendedStep(STEPS, '10/12/2025')).toBeNull()
  })

  it("ordre des DATES de début, pas des numéros d'étape (RS-09)", () => {
    // L'étape n° 3 commence avant l'étape n° 2.
    const shuffled = [
      { id: 'a', name: 'n° 1', stepNumber: 1, startDate: '2025-09-01' },
      { id: 'b', name: 'n° 2', stepNumber: 2, startDate: '2026-01-05' },
      { id: 'c', name: 'n° 3', stepNumber: 3, startDate: '2025-11-03' },
    ]
    expect(orderSteps(shuffled).map((s) => s.id)).toEqual(['a', 'c', 'b'])
    expect(inferLastAttendedStep(shuffled, '2025-12-01')).toBe('c')
    expect(inferLastAttendedStep(shuffled, '2026-01-10')).toBe('b')
  })

  it("une étape sans date de début n'est jamais devinée ; elle se classe après les étapes datées", () => {
    const undated = [...STEPS.slice(0, 2), { id: 'st-x', name: 'Etape x', stepNumber: 3, startDate: null }]
    expect(inferLastAttendedStep(undated, '2026-06-01')).toBe('st-2')
    expect(orderSteps(undated).map((s) => s.id)).toEqual(['st-1', 'st-2', 'st-x'])
  })
})

describe('isWithinYear — même contrôle que le serveur, bornes incluses', () => {
  const year = { startDate: '2025-09-01T00:00:00.000Z', endDate: '2026-06-30T00:00:00.000Z' }
  it('bornes incluses ; dehors refusé ; année incomplète refusée', () => {
    expect(isWithinYear('2025-09-01', year)).toBe(true)
    expect(isWithinYear('2026-06-30', year)).toBe(true)
    expect(isWithinYear('2025-08-31', year)).toBe(false)
    expect(isWithinYear('2026-07-01', year)).toBe(false)
    expect(isWithinYear('2026-01-10', { startDate: null, endDate: year.endDate })).toBe(false)
  })
})

describe('motifs (D-19)', () => {
  it('trois motifs, libellés en français ; motif inconnu : tiret', () => {
    expect(DEPARTURE_REASONS.map((r) => r.value)).toEqual(['TRANSFER_OTHER_SCHOOL', 'DROPOUT', 'OTHER'])
    expect(departureReasonLabel('TRANSFER_OTHER_SCHOOL')).toBe('Transfert vers un autre établissement')
    expect(departureReasonLabel(null)).toBe('—')
  })
})
