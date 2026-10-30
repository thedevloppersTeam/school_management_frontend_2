/**
 * Compte rendu de suppression d'élèves (lib/students/delete-report.ts). Forme
 * de la réponse : POST /api/students/delete du serveur, 200 avec results[].
 * Noms et identifiants fictifs.
 */
import { describe, it, expect } from 'vitest'
import {
  deleteFailures, ACADEMIC_HISTORY_REASON, DECLARE_DEPARTURE_HINT,
} from '@/lib/students/delete-report'

const names: Record<string, string> = { 'id-a': 'ALPHA Test', 'id-b': 'BETA Test' }
const nameOf = (id: string) => names[id] ?? null

describe('deleteFailures', () => {
  it('ignore les succès', () => {
    expect(deleteFailures({ results: [{ studentId: 'id-a', status: 'success' }] }, nameOf)).toEqual([])
  })

  it('historique scolaire : nom, motif du serveur, invitation au départ', () => {
    const motif = "Suppression refusée : l'élève a un historique scolaire (2 note(s), 0 bulletin(s) archivé(s), 0 décision(s) de promotion). Déclarez plutôt son départ."
    const r = deleteFailures({
      results: [{ studentId: 'id-a', status: 'error', code: 'STUDENT_HAS_ACADEMIC_HISTORY', message: motif }],
    }, nameOf)
    expect(r).toEqual([{ studentId: 'id-a', name: 'ALPHA Test', reason: motif, hint: DECLARE_DEPARTURE_HINT }])
  })

  it('historique scolaire sans message : motif français par défaut', () => {
    const r = deleteFailures({ results: [{ studentId: 'id-a', status: 'error', code: 'STUDENT_HAS_ACADEMIC_HISTORY' }] }, nameOf)
    expect(r[0].reason).toBe(ACADEMIC_HISTORY_REASON)
    expect(r[0].hint).toBe(DECLARE_DEPARTURE_HINT)
  })

  it('autre échec : le motif reçu, sans invitation', () => {
    const r = deleteFailures({ results: [{ studentId: 'id-b', status: 'error', message: 'Élève introuvable' }] }, nameOf)
    expect(r).toEqual([{ studentId: 'id-b', name: 'BETA Test', reason: 'Élève introuvable' }])
  })

  it("élève absent de la liste : identifiant à la place du nom", () => {
    const r = deleteFailures({ results: [{ studentId: 'id-z', status: 'error', message: 'x' }] }, nameOf)
    expect(r[0].name).toBe('id-z')
  })

  it('corps sans results : aucun échec détaillé', () => {
    expect(deleteFailures(null, nameOf)).toEqual([])
    expect(deleteFailures({ message: 'x' }, nameOf)).toEqual([])
  })
})
