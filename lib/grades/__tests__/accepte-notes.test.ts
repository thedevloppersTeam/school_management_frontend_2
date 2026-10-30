/**
 * Saisissabilité d'une affectation : champ `accepteNotes` fourni par le serveur.
 * Données entièrement fictives.
 */
import { describe, expect, it } from 'vitest'
import {
  MESSAGE_FILIERE_HORS_CLASSE,
  accepteNotes,
  normaliserAccepteNotes,
  retirerOperationsNonSaisissables,
} from '@/lib/grades/accepte-notes'
import { diffSaisieEleve, type SaisieCase } from '@/lib/grades/student-diff'

describe('normaliserAccepteNotes (lecteur tolérant)', () => {
  it('absent (ancien serveur) ou null : saisissable', () => {
    expect(normaliserAccepteNotes(undefined)).toBe(true)
    expect(normaliserAccepteNotes(null)).toBe(true)
    expect(accepteNotes({})).toBe(true)
  })
  it('booléens : tels quels', () => {
    expect(normaliserAccepteNotes(true)).toBe(true)
    expect(normaliserAccepteNotes(false)).toBe(false)
  })
  it('valeur non booléenne : saisissable, le serveur reste le garde', () => {
    expect(normaliserAccepteNotes('false')).toBe(true)
    expect(normaliserAccepteNotes(0)).toBe(true)
    expect(normaliserAccepteNotes({})).toBe(true)
  })
  it('message exact de l’infobulle', () => {
    expect(MESSAGE_FILIERE_HORS_CLASSE).toBe('Matière de filière : ne compte pas dans cette classe')
  })
})

describe('retirerOperationsNonSaisissables (grille par matière)', () => {
  const classSubjects = [
    { id: 'cs-tc' },                          // champ absent
    { id: 'cs-ouverte', accepteNotes: true },
    { id: 'cs-fermee', accepteNotes: false },
  ]
  const existing = [
    { id: 'g-tc', classSubjectId: 'cs-tc' },
    { id: 'g-fermee-1', classSubjectId: 'cs-fermee' },
    { id: 'g-fermee-2', classSubjectId: 'cs-fermee' },
  ]
  const ops = {
    toCreate: [
      { classSubjectId: 'cs-tc', studentScore: 7 },
      { classSubjectId: 'cs-ouverte', studentScore: 8 },
      { classSubjectId: 'cs-fermee', studentScore: 9 },
    ],
    toUpdate: [{ gradeId: 'g-tc', studentScore: 5 }, { gradeId: 'g-fermee-1', studentScore: 6 }],
    toDelete: ['g-tc', 'g-fermee-2', 'g-inconnue'],
  }

  it('false : ni create, ni update, ni delete', () => {
    const r = retirerOperationsNonSaisissables(ops, classSubjects, existing)
    expect(r.toCreate.map((c) => c.classSubjectId)).toEqual(['cs-tc', 'cs-ouverte'])
    expect(r.toUpdate.map((u) => u.gradeId)).toEqual(['g-tc'])
    // Une note dont l'affectation est inconnue n'est pas retirée.
    expect(r.toDelete).toEqual(['g-tc', 'g-inconnue'])
  })
  it('aucune affectation fermée (champ absent partout) : lot inchangé', () => {
    const r = retirerOperationsNonSaisissables(ops, [{ id: 'cs-tc' }, { id: 'cs-fermee' }], existing)
    expect(r).toBe(ops)
  })
})

describe('diffSaisieEleve (saisie par élève)', () => {
  const subject = (id: string, sections: Array<{ id: string }> = []) => ({
    id,
    name: id,
    code: id,
    maxScore: 10,
    coefficient: 1,
    hasSections: sections.length > 0,
    sections: sections.map((s, i) => ({ id: s.id, name: s.id, code: s.id, maxScore: 5, displayOrder: i })),
  })
  const ok = (value: string): SaisieCase => ({ value, isValid: true })
  const base = {
    excludedSections: new Set<string>(),
    enrollmentId: 'insc-1',
    stepId: 'st-1',
  }

  it('accepteNotes absent : saisissable (create, update, delete comme avant)', () => {
    const r = diffSaisieEleve({
      ...base,
      subjects: [{ id: 'cs-a', subject: subject('s-a') }, { id: 'cs-b', subject: subject('s-b') }, { id: 'cs-c', subject: subject('s-c') }],
      entries: new Map([['cs-a', ok('7,5')], ['cs-b', ok('6')], ['cs-c', ok('')]]),
      existingGrades: [
        { id: 'g-b', classSubjectId: 'cs-b', sectionId: null, studentScore: 4 },
        { id: 'g-c', classSubjectId: 'cs-c', sectionId: null, studentScore: 3 },
      ],
    })
    expect(r.toCreate).toEqual([
      { enrollmentId: 'insc-1', classSubjectId: 'cs-a', stepId: 'st-1', studentScore: 7.5, gradeType: 'EXAM' },
    ])
    expect(r.toUpdate).toEqual([{ gradeId: 'g-b', studentScore: 6 }])
    expect(r.toDelete).toEqual(['g-c'])
  })

  it('accepteNotes true : identique au champ absent', () => {
    const r = diffSaisieEleve({
      ...base,
      subjects: [{ id: 'cs-a', subject: subject('s-a'), accepteNotes: true }],
      entries: new Map([['cs-a', ok('7')]]),
      existingGrades: [],
    })
    expect(r.toCreate).toHaveLength(1)
  })

  it('accepteNotes false : rien n’est envoyé, note globale ni sous-matières', () => {
    const r = diffSaisieEleve({
      ...base,
      subjects: [
        { id: 'cs-f', subject: subject('s-f'), accepteNotes: false },
        { id: 'cs-fs', subject: subject('s-fs', [{ id: 'sec-1' }, { id: 'sec-2' }]), accepteNotes: false },
        { id: 'cs-o', subject: subject('s-o'), accepteNotes: true },
      ],
      entries: new Map([
        ['cs-f', ok('8')],          // création ignorée
        ['cs-fs::sec-1', ok('4')],  // modification ignorée
        ['cs-fs::sec-2', ok('')],   // suppression ignorée
        ['cs-o', ok('9')],
      ]),
      existingGrades: [
        { id: 'g-fs-1', classSubjectId: 'cs-fs', sectionId: 'sec-1', studentScore: 2 },
        { id: 'g-fs-2', classSubjectId: 'cs-fs', sectionId: 'sec-2', studentScore: 3 },
      ],
    })
    expect(r.toCreate.map((c) => c.classSubjectId)).toEqual(['cs-o'])
    expect(r.toUpdate).toEqual([])
    expect(r.toDelete).toEqual([])
  })
})
