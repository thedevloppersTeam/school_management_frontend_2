/**
 * Libellés du journal pour les gestes du calendrier v2 (SPEC-CAL-2 C-50, CT-47).
 */
import { describe, expect, it } from 'vitest'
import { AUDIT_ACTION_LABELS, type StudentAuditAction } from '@/lib/api/enrollment-corrections'

const ACTIONS_C50: StudentAuditAction[] = [
  'CALENDAR_ENTRY_CREATED',
  'CALENDAR_ENTRY_UPDATED',
  'CALENDAR_ENTRY_DELETED',
  'CALENDAR_CATEGORY_CREATED',
  'CALENDAR_CATEGORY_UPDATED',
  'CALENDAR_CATEGORY_DEACTIVATED',
  'CALENDAR_CATEGORY_REACTIVATED',
  'CALENDAR_CATEGORY_DELETED',
  'CALENDAR_LEGEND_ADDED',
  'CALENDAR_LEGEND_UPDATED',
  'CALENDAR_LEGEND_REMOVED',
]

describe('libellés CALENDAR_* du journal', () => {
  it.each(ACTIONS_C50)('%s a un libellé non vide, sans point final', (action) => {
    const l = AUDIT_ACTION_LABELS[action]
    expect(l.trim()).not.toBe('')
    expect(l.endsWith('.')).toBe(false)
  })

  it('aucun libellé de CAL-2.6 n\'est ajouté', () => {
    expect(Object.keys(AUDIT_ACTION_LABELS)).not.toContain('CALENDAR_ENTRY_VALIDATED')
    expect(Object.keys(AUDIT_ACTION_LABELS)).not.toContain('CALENDAR_COPIED')
  })

  it('les libellés existants sont inchangés', () => {
    expect(AUDIT_ACTION_LABELS.ASSIGNMENT_CORRECTED).toBe("Correction d'affectation")
    expect(AUDIT_ACTION_LABELS.ENROLLMENT_REACTIVATED).toBe('Inscription réactivée')
  })

  it('aucun libellé n\'est partagé entre deux actions', () => {
    const tous = Object.values(AUDIT_ACTION_LABELS)
    expect(new Set(tous).size).toBe(tous.length)
  })
})
