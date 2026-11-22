/**
 * Libellé du journal pour la modification du profil d'un élève (lot serveur
 * « profil élève », D-95 : valeur STUDENT_PROFILE_UPDATED de StudentAuditAction).
 */
import { describe, expect, it } from 'vitest'
import { AUDIT_ACTION_LABELS } from '@/lib/api/enrollment-corrections'

describe('libellé STUDENT_PROFILE_UPDATED du journal', () => {
  it('a un libellé en français, sans point final', () => {
    const labels: Record<string, string> = AUDIT_ACTION_LABELS
    expect(labels.STUDENT_PROFILE_UPDATED).toBe("Profil de l'élève modifié")
  })

  it('aucun libellé n’est partagé entre deux actions', () => {
    const tous = Object.values(AUDIT_ACTION_LABELS)
    expect(new Set(tous).size).toBe(tous.length)
  })
})
