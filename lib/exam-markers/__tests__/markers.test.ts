/**
 * Marqueurs d'examen (SPEC-RESULTATS RS-03, RS-06, RS-07 ; D3 ; lot M1) —
 * règles d'écran pures. Données fictives, aucun élève réel.
 */
import { describe, it, expect } from 'vitest'
import {
  confirmationText,
  impactUrl,
  showExamSubjectCheckbox,
  updateRequest,
  warningsBanner,
  type ExamWarning,
} from '@/lib/exam-markers/markers'

describe('case « Matière d\'examen » : visible selon le niveau', () => {
  it('niveau is_terminal (classe d\'examen) : visible', () => {
    expect(showExamSubjectCheckbox({ isTerminal: true })).toBe(true)
  })
  it('autres niveaux, niveau inconnu, aucune salle choisie : masquée', () => {
    expect(showExamSubjectCheckbox({ isTerminal: false })).toBe(false)
    expect(showExamSubjectCheckbox({})).toBe(false)
    expect(showExamSubjectCheckbox(undefined)).toBe(false)
    expect(showExamSubjectCheckbox(null)).toBe(false)
  })
})

describe('bandeau RS-07', () => {
  const W: ExamWarning[] = [
    { classSessionId: 'cs-9a', className: '9e AF A', code: 'TERMINAL_SANS_EXAMEN_BLANC', message: "Classe d'examen sans étape d'examen blanc." },
    { classSessionId: 'cs-ns4', className: 'NS4 A', code: 'EXAMEN_BLANC_SANS_COMPOSANT', message: "Étape d'examen blanc sans composant d'examen." },
  ]
  it('aucun avertissement : pas de bandeau', () => {
    expect(warningsBanner([])).toBeNull()
    expect(warningsBanner(null)).toBeNull()
    expect(warningsBanner(undefined)).toBeNull()
  })
  it('avertissements : un titre au bon nombre, une ligne par salle', () => {
    expect(warningsBanner(W)).toEqual({
      title: "2 avertissements d'examen (RS-07)",
      lines: ["9e AF A — Classe d'examen sans étape d'examen blanc.", "NS4 A — Étape d'examen blanc sans composant d'examen."],
    })
    expect(warningsBanner([W[0]])?.title).toBe("1 avertissement d'examen (RS-07)")
  })
})

describe('confirmation avant changement', () => {
  it('aucune note touchée : pas de confirmation, quel que soit le marqueur', () => {
    for (const kind of ['step', 'classSubject', 'section'] as const) {
      expect(confirmationText({ kind, id: 'x', label: 'X', next: true }, { gradeCount: 0, byYear: [] })).toBeNull()
    }
  })
  it('étape notée : nombre de notes de l\'étape', () => {
    const t = confirmationText({ kind: 'step', id: 'st-5', label: 'Étape 5', next: true }, { gradeCount: 42 })!
    expect(t.title).toBe("Marquer l'étape comme examen blanc ?")
    expect(t.body).toContain('« Étape 5 » est déjà notée (42 notes)')
    expect(t.years).toEqual([])
  })
  it('affectation notée : nombre de notes de l\'affectation ; retrait formulé à l\'inverse', () => {
    const pose = confirmationText({ kind: 'classSubject', id: 'cs', label: 'Créole', next: true }, { gradeCount: 1 })!
    expect(pose.body).toContain('« Créole » porte déjà 1 note.')
    expect(pose.body).toContain('ne compte plus')
    const retrait = confirmationText({ kind: 'classSubject', id: 'cs', label: 'Créole', next: false }, { gradeCount: 3 })!
    expect(retrait.title).toMatch(/^Retirer/)
    expect(retrait.body).toContain('compte de nouveau')
  })
  it('sous-matière (référentiel) : nomme CHAQUE année déjà notée et son nombre de notes', () => {
    const t = confirmationText(
      { kind: 'section', id: 'sec', label: 'Créole', next: true },
      {
        gradeCount: 130,
        byYear: [
          { academicYearId: 'y1', yearString: '2024-2025', gradeCount: 30 },
          { academicYearId: 'y2', yearString: '2025-2026', gradeCount: 100 },
        ],
      },
    )!
    expect(t.body).toContain('TOUTES les années de ce niveau')
    expect(t.body).toContain('130 notes au total')
    expect(t.years).toEqual(['2024-2025 : 30 notes', '2025-2026 : 100 notes'])
  })
})

describe('requêtes', () => {
  it('décompte et mise à jour : un endpoint existant par marqueur', () => {
    expect(impactUrl('step', 'st-1')).toBe('/api/exam-markers/impact?stepId=st-1')
    expect(impactUrl('classSubject', 'cs-1')).toBe('/api/exam-markers/impact?classSubjectId=cs-1')
    expect(impactUrl('section', 'sec-1')).toBe('/api/exam-markers/impact?sectionId=sec-1')
    expect(updateRequest({ kind: 'step', id: 'st-1', next: true })).toEqual({ url: '/api/academic-years/steps/update/st-1', body: { isExamBlanc: true } })
    expect(updateRequest({ kind: 'classSubject', id: 'cs-1', next: false })).toEqual({ url: '/api/class-subjects/update/cs-1', body: { isExam: false } })
    expect(updateRequest({ kind: 'section', id: 'sec-1', next: true })).toEqual({ url: '/api/subjects/sections/update/sec-1', body: { isExam: true } })
  })
})
