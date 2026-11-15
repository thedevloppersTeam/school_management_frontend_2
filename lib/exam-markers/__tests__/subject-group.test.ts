/**
 * Case « Matière d'examen » par matière (RS-03, RS-06 ; défaut du 2026-11-15 sur
 * une salle à filières). Un faux serveur en mémoire tient les marqueurs : la
 * case est relue après chaque geste, comme l'écran recharge l'état. Données
 * fictives, aucun élève réel.
 */
import { describe, it, expect } from 'vitest'
import { confirmationText } from '@/lib/exam-markers/markers'
import {
  applyToGroup,
  examGroups,
  failureText,
  mixedMention,
  nextValue,
  targets,
  totalImpact,
  type ExamGroup,
  type ExamRow,
} from '@/lib/exam-markers/subject-group'

const FILIERES = ['LLA', 'SES', 'SMP', 'SVT']

/** Salle fictive à 4 filières : matière « Matière A » (4 affectations) et une matière de tronc commun. */
function salleAFilieres(marquees: string[] = []): ExamRow[] {
  return [
    ...FILIERES.map((f) => ({ id: `cs-a-${f}`, subjectId: 'sub-a', subjectName: 'Matière A', trackCode: f, isExam: marquees.includes(f) })),
    { id: 'cs-tc', subjectId: 'sub-tc', subjectName: 'Matière commune', trackCode: null, isExam: false },
  ]
}

/** Faux serveur : marqueurs en mémoire, appels comptés, échec possible sur le n-ième appel de mise à jour. */
function fauxServeur(rows: ExamRow[], opts: { impacts?: Record<string, number>; echecAppel?: number } = {}) {
  const etat = new Map(rows.map((r) => [r.id, r.isExam]))
  const impacts: string[] = []
  const updates: Array<{ id: string; isExam: boolean }> = []
  return {
    impacts,
    updates,
    calls: {
      impact: async (id: string) => {
        impacts.push(id)
        return { gradeCount: opts.impacts?.[id] ?? 0 }
      },
      update: async (id: string, next: boolean) => {
        updates.push({ id, isExam: next })
        if (updates.length === opts.echecAppel) throw new Error('HTTP 500')
        etat.set(id, next)
      },
    },
    /** Rechargement : la case reflète la base, jamais l'intention. */
    recharger: () => examGroups(rows.map((r) => ({ ...r, isExam: etat.get(r.id) === true }))),
  }
}

const matiere = (groups: ExamGroup[], subjectId = 'sub-a') => groups.find((g) => g.subjectId === subjectId)!

/** Le geste complet de l'écran : impact (confirmation), mises à jour, rechargement. */
async function clic(rows: ExamRow[], srv: ReturnType<typeof fauxServeur>, subjectId = 'sub-a') {
  const g = matiere(examGroups(rows), subjectId)
  const next = nextValue(g)
  const cibles = targets(g, next)
  const notes = await totalImpact(cibles, srv.calls)
  const outcome = await applyToGroup(cibles, next, srv.calls)
  return { next, cibles, notes, outcome, apres: matiere(srv.recharger(), subjectId) }
}

describe('regroupement par matière', () => {
  it('salle à 4 filières : une seule case pour les 4 affectations de la matière', () => {
    const groups = examGroups(salleAFilieres())
    expect(groups.map((g) => [g.subjectId, g.members.length])).toEqual([['sub-a', 4], ['sub-tc', 1]])
    expect(matiere(groups).label).toBe('Matière A')
  })
  it('ordre de première apparition, même si les affectations d\'une matière sont dispersées', () => {
    const [a1, a2, a3, a4, tc] = salleAFilieres()
    const groups = examGroups([a1, tc, a2, a3, a4])
    expect(groups.map((g) => g.subjectId)).toEqual(['sub-a', 'sub-tc'])
    expect(groups[0].members.map((m) => m.id)).toEqual([a1.id, a2.id, a3.id, a4.id])
  })
  it('état : toutes cochées, aucune, mixte', () => {
    expect(matiere(examGroups(salleAFilieres(FILIERES))).state).toBe('checked')
    expect(matiere(examGroups(salleAFilieres())).state).toBe('unchecked')
    const mixte = matiere(examGroups(salleAFilieres(['SMP'])))
    expect(mixte.state).toBe('mixed')
    expect(mixedMention(mixte)).toBe('marquée sur 1 filière(s) sur 4')
  })
  it('pas de mention hors état mixte', () => {
    expect(mixedMention(matiere(examGroups(salleAFilieres())))).toBeNull()
    expect(mixedMention(matiere(examGroups(salleAFilieres(FILIERES))))).toBeNull()
  })
})

describe('salle à 4 filières', () => {
  it('matière non marquée → un clic → 4 appels isExam: true, case cochée après rechargement', async () => {
    const rows = salleAFilieres()
    const srv = fauxServeur(rows)
    const r = await clic(rows, srv)
    expect(srv.updates).toEqual(FILIERES.map((f) => ({ id: `cs-a-${f}`, isExam: true })))
    expect(srv.impacts).toHaveLength(4)
    expect(r.outcome.failed).toEqual([])
    expect(r.apres.state).toBe('checked')
  })
  it('matière marquée partout → un clic → 4 appels isExam: false, case vide après rechargement', async () => {
    const rows = salleAFilieres(FILIERES)
    const srv = fauxServeur(rows)
    const r = await clic(rows, srv)
    expect(srv.updates).toEqual(FILIERES.map((f) => ({ id: `cs-a-${f}`, isExam: false })))
    expect(r.apres.state).toBe('unchecked')
  })
  it('état mixte (1 sur 4) → un clic coche tout : 3 appels true (l\'affectation déjà marquée n\'est pas touchée)', async () => {
    const rows = salleAFilieres(['SMP'])
    const srv = fauxServeur(rows)
    const r = await clic(rows, srv)
    expect(r.next).toBe(true)
    expect(srv.updates).toEqual(['LLA', 'SES', 'SVT'].map((f) => ({ id: `cs-a-${f}`, isExam: true })))
    expect(srv.impacts).toEqual(['cs-a-LLA', 'cs-a-SES', 'cs-a-SVT'])
    expect(r.apres.state).toBe('checked')
  })
  it('la matière de tronc commun de la même salle n\'est pas touchée', async () => {
    const rows = salleAFilieres()
    const srv = fauxServeur(rows)
    await clic(rows, srv)
    expect(srv.updates.some((u) => u.id === 'cs-tc')).toBe(false)
    expect(matiere(srv.recharger(), 'sub-tc').state).toBe('unchecked')
  })
})

describe('confirmation', () => {
  it('le total des notes touchées est la somme des 4 impacts', async () => {
    const rows = salleAFilieres()
    const srv = fauxServeur(rows, { impacts: { 'cs-a-LLA': 3, 'cs-a-SES': 0, 'cs-a-SMP': 5, 'cs-a-SVT': 2 } })
    const g = matiere(examGroups(rows))
    const total = await totalImpact(targets(g, true), srv.calls)
    expect(total).toBe(10)
    const text = confirmationText({ kind: 'classSubject', id: 'cs-a-LLA', label: g.label, next: true }, { gradeCount: total })
    expect(text?.body).toContain('10 notes')
  })
  it('aucune note sur les 4 affectations → pas de confirmation', async () => {
    const rows = salleAFilieres()
    const srv = fauxServeur(rows)
    const total = await totalImpact(targets(matiere(examGroups(rows)), true), srv.calls)
    expect(confirmationText({ kind: 'classSubject', id: 'x', label: 'Matière A', next: true }, { gradeCount: total })).toBeNull()
  })
  it('échec d\'un décompte → erreur rendue, aucune mise à jour', async () => {
    const calls = {
      impact: async () => { throw new Error('HTTP 500') },
      update: async () => { throw new Error('ne doit pas être appelé') },
    }
    await expect(totalImpact(salleAFilieres().slice(0, 4), calls)).rejects.toThrow('HTTP 500')
  })
})

describe('échec partiel', () => {
  it('échec du 3e appel → filière nommée, les autres appels faits, case indéterminée après rechargement', async () => {
    const rows = salleAFilieres()
    const srv = fauxServeur(rows, { echecAppel: 3 })
    const r = await clic(rows, srv)
    expect(srv.updates).toHaveLength(4)
    expect(r.outcome.failed.map((f) => f.row.trackCode)).toEqual(['SMP'])
    expect(r.outcome.updated.map((u) => u.trackCode)).toEqual(['LLA', 'SES', 'SVT'])
    const message = failureText('Matière A', r.outcome.failed.map((f) => f.row))
    expect(message).toContain('la filière SMP')
    expect(r.apres.state).toBe('mixed')
    expect(mixedMention(r.apres)).toBe('marquée sur 3 filière(s) sur 4')
  })
  it('plusieurs filières en échec : toutes nommées', () => {
    const rows = salleAFilieres()
    expect(failureText('Matière A', [rows[1], rows[3]])).toContain('les filières SES, SVT')
  })
})

describe('salle sans filière (non-régression)', () => {
  const salle: ExamRow[] = [
    { id: 'cs-1', subjectId: 'sub-1', subjectName: 'Matière 1', trackCode: null, isExam: false },
    { id: 'cs-2', subjectId: 'sub-2', subjectName: 'Matière 2', trackCode: null, isExam: true },
  ]
  it('une case par affectation, ordre inchangé', () => {
    expect(examGroups(salle).map((g) => g.members.map((m) => m.id))).toEqual([['cs-1'], ['cs-2']])
  })
  it('cocher : 1 appel d\'impact, 1 appel de mise à jour', async () => {
    const srv = fauxServeur(salle)
    const r = await clic(salle, srv, 'sub-1')
    expect(srv.impacts).toEqual(['cs-1'])
    expect(srv.updates).toEqual([{ id: 'cs-1', isExam: true }])
    expect(r.apres.state).toBe('checked')
  })
  it('décocher : 1 appel d\'impact, 1 appel de mise à jour', async () => {
    const srv = fauxServeur(salle)
    const r = await clic(salle, srv, 'sub-2')
    expect(srv.impacts).toEqual(['cs-2'])
    expect(srv.updates).toEqual([{ id: 'cs-2', isExam: false }])
    expect(r.apres.state).toBe('unchecked')
  })
  it('échec : pas de phrase de filière (message d\'erreur inchangé)', () => {
    expect(failureText('Matière 1', [salle[0]])).toBeNull()
  })
})
