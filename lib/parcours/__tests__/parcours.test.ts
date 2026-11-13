/**
 * Page « Parcours » — lot B (D-03) : moyennes lues au serveur.
 *
 * Tests des helpers purs de lib/parcours avec des réponses `/api/results`
 * écrites à la main (forme de src/lib/results/types.ts, sérialisée). Aucune
 * base, aucun serveur. Données entièrement fictives et neutres.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { ResultStep, ResultStudent, ResultSubject, RoomResults } from '@/lib/api/results'
import { gradeBand } from '@/lib/bulletin/grade-color'
import { etapeDeReference, type EtapeAnnee } from '../reference'
import {
  cartesEtapes,
  celluleMatiere,
  chargerMoyennes,
  etatSousMatiere,
  formatMoyenne,
  moyenneAnnuelle,
  pourcentageDeBande,
  resultatDeLEleve,
  type FetchResultats,
} from '../resultats'
import { regrouperNotes, texteSaisies, type NoteSaisie } from '../notes'

// ── Fabriques ────────────────────────────────────────────────────────────────

const etape = (n: number, extra: Partial<EtapeAnnee> = {}): EtapeAnnee => ({
  id: `st-${n}`,
  name: `Étape ${n}`,
  stepNumber: n,
  isCurrent: false,
  isExamBlanc: false,
  ...extra,
})

const rubriques = {
  R1: { code: 'R1' as const, numerator: '0', denominator: '0', average: null },
  R2: { code: 'R2' as const, numerator: '0', denominator: '0', average: null },
  R3: { code: 'R3' as const, numerator: '0', denominator: '0', average: null },
}
const print = {
  R1: { code: 'R1' as const, lines: [], totalNote: '0', totalMaxScore: '0' },
  R2: { code: 'R2' as const, lines: [], totalNote: '0', totalMaxScore: '0' },
  R3: { code: 'R3' as const, lines: [], totalNote: '0', totalMaxScore: '0' },
}

function matiere(extra: Partial<ResultSubject>): ResultSubject {
  return {
    classSubjectId: 'cs-a',
    subjectId: 'sub-a',
    trackId: null,
    name: 'Matière A',
    rubrique: 'R1',
    isExam: false,
    mode: 'global',
    numerator: '15',
    denominator: '20',
    average: '7.5',
    state: 'noted',
    sections: [],
    ...extra,
  }
}

function step(n: number, extra: Partial<ResultStep> = {}): ResultStep {
  return {
    stepId: `st-${n}`,
    stepNumber: n,
    isExamBlanc: false,
    exempted: false,
    examMode: false,
    subjects: [matiere({})],
    rubriques,
    average: '7.5',
    averageOrNull: '7.5',
    print,
    ...extra,
  }
}

function eleve(extra: Partial<ResultStudent> = {}): ResultStudent {
  return {
    enrollmentId: 'enr-1',
    studentId: 'stu-1',
    trackId: null,
    status: 'ACTIVE',
    departure: null,
    countedInClassAverage: true,
    unavailable: null,
    steps: [step(1), step(2)],
    annual: '7.5',
    ...extra,
  }
}

function salle(students: ResultStudent[], stepId = 'st-4'): RoomResults {
  const vide = { enrollmentCount: 0, subjects: {}, rubriques: { R1: null, R2: null, R3: null }, step: null, annual: null }
  return { classSessionId: 'cls-1', stepId, scope: null, students, classAverages: { all: vide, byTrack: {} }, warnings: [] }
}

const noms = new Map([['st-1', 'Étape 1'], ['st-2', 'Étape 2'], ['st-3', 'Étape 3'], ['st-4', 'Étape 4']])

// ── 1. Étape de référence ────────────────────────────────────────────────────

/** Date de référence fixe : les statuts d'année ne dépendent pas du jour du test. */
const MAINTENANT = new Date('2026-11-13T12:00:00Z')
const ARCHIVEE = { isCurrent: false, endDate: '2025-07-31' }
const COURANTE = { isCurrent: true, endDate: '2027-07-31' }
const EN_PREPARATION = { isCurrent: false, endDate: '2027-07-31' }

describe('etapeDeReference', () => {
  const etapes = [etape(3), etape(1), etape(4, { isExamBlanc: true }), etape(2)]
  const ref = (annee: { isCurrent: boolean; endDate: string }, liste: EtapeAnnee[] | null) =>
    etapeDeReference(annee, liste, MAINTENANT)

  it('année archivée : dernière étape (numéro le plus haut), examen blanc compris', () => {
    expect(ref(ARCHIVEE, etapes)).toEqual({ kind: 'etape', etape: etapes[2] })
  })

  it("année archivée : l'étape marquée en cours est ignorée", () => {
    const avecEnCours = [etape(1), etape(2, { isCurrent: true }), etape(3)]
    expect(ref(ARCHIVEE, avecEnCours)).toEqual({ kind: 'etape', etape: avecEnCours[2] })
  })

  it("année courante avec étape en cours : l'étape en cours", () => {
    const avecEnCours = [etape(1), etape(2, { isCurrent: true }), etape(3), etape(4)]
    expect(ref(COURANTE, avecEnCours)).toEqual({ kind: 'etape', etape: avecEnCours[1] })
  })

  it("année courante, étape d'examen blanc en cours : elle-même", () => {
    const exam = [etape(1), etape(2), etape(3, { isExamBlanc: true, isCurrent: true }), etape(4)]
    expect(ref(COURANTE, exam)).toEqual({ kind: 'etape', etape: exam[2] })
  })

  it('année courante sans étape en cours : aucune étape de référence', () => {
    expect(ref(COURANTE, etapes)).toEqual({ kind: 'aucune-etape-en-cours' })
    expect(ref(COURANTE, [])).toEqual({ kind: 'aucune-etape-en-cours' })
  })

  it("année en préparation : aucune étape de référence, même avec une étape en cours", () => {
    expect(ref(EN_PREPARATION, etapes)).toEqual({ kind: 'en-preparation' })
    expect(ref(EN_PREPARATION, [etape(1, { isCurrent: true })])).toEqual({ kind: 'en-preparation' })
  })

  it('date de fin illisible : « en préparation », comme deriveAcademicYearStatus', () => {
    expect(ref({ isCurrent: false, endDate: 'illisible' }, etapes)).toEqual({ kind: 'en-preparation' })
  })

  it('plusieurs étapes en cours (donnée incohérente) : la première par numéro, comme le relevé', () => {
    const deux = [etape(3, { isCurrent: true }), etape(1), etape(2, { isCurrent: true })]
    expect(ref(COURANTE, deux)).toEqual({ kind: 'etape', etape: deux[2] })
  })

  it('année archivée sans étape : « sans-etape »', () => {
    expect(ref(ARCHIVEE, [])).toEqual({ kind: 'sans-etape' })
    expect(ref(ARCHIVEE, null)).toEqual({ kind: 'sans-etape' })
  })

  it("ne modifie pas l'ordre de l'entrée", () => {
    const entree = [etape(2), etape(1)]
    ref(ARCHIVEE, entree)
    expect(entree.map((s) => s.id)).toEqual(['st-2', 'st-1'])
  })
})

// ── 2. Mise en forme ─────────────────────────────────────────────────────────

describe('formatMoyenne', () => {
  it('averageOrNull null → « — »', () => {
    expect(formatMoyenne(null)).toBe('—')
    expect(formatMoyenne(undefined)).toBe('—')
  })

  it('valeur exacte → 2 décimales à virgule, arrondi du bulletin (demi supérieur)', () => {
    expect(formatMoyenne('6.6666666666666666667')).toBe('6,67')
    expect(formatMoyenne('7.005')).toBe('7,01')
    expect(formatMoyenne('7')).toBe('7,00')
  })
})

// ── 3. Bande de couleur × 10 ─────────────────────────────────────────────────

describe('pourcentageDeBande', () => {
  it('moyenne /10 → pourcentage', () => {
    expect(pourcentageDeBande('6.8')).toBe(68)
    expect(pourcentageDeBande(null)).toBeNull()
  })

  it("la bande est celle du pourcentage, pas de la valeur /10 (P6-15)", () => {
    expect(gradeBand(pourcentageDeBande('4.5') as number)).toBe(gradeBand(45))
    expect(gradeBand(pourcentageDeBande('8.5') as number)).not.toBe(gradeBand(8.5))
  })
})

// ── 4. Élève dans la réponse ─────────────────────────────────────────────────

describe('resultatDeLEleve', () => {
  it("retrouve l'inscription", () => {
    const r = resultatDeLEleve(salle([eleve()]), 'enr-1')
    expect(r.kind).toBe('trouve')
  })

  it('inscription absente : « absent », sans repli', () => {
    expect(resultatDeLEleve(salle([eleve()]), 'enr-x')).toEqual({ kind: 'absent' })
  })
})

// ── 5. Cartes d'étape et annuelle ────────────────────────────────────────────

describe('cartesEtapes / moyenneAnnuelle', () => {
  it("cartes = steps[] du service, dans l'ordre, averageOrNull formaté", () => {
    const e = eleve({ steps: [step(2, { averageOrNull: '6.25' }), step(1, { averageOrNull: null })] })
    const cartes = cartesEtapes(e, noms)
    expect(cartes.map((c) => c.stepId)).toEqual(['st-1', 'st-2'])
    expect(cartes.map((c) => c.moyenne)).toEqual(['—', '6,25'])
    expect(cartes[0].bande).toBeNull()
    expect(cartes[1].bande).toBe(62.5)
  })

  it('« Moy. générale » = annual du service', () => {
    expect(moyenneAnnuelle(eleve({ annual: '5.123' }))).toEqual({ texte: '5,12', bande: 51.23 })
    expect(moyenneAnnuelle(eleve({ annual: null }))).toEqual({ texte: '—', bande: null })
  })

  it('étape exempted : marquée, sans chiffre ni teinte', () => {
    const e = eleve({ steps: [step(1), step(2, { exempted: true, averageOrNull: '3' })] })
    const c = cartesEtapes(e, noms)[1]
    expect(c.exempted).toBe(true)
    expect(c.moyenne).toBe('—')
    expect(c.bande).toBeNull()
  })

  it("nom d'étape inconnu : repli sur le numéro", () => {
    expect(cartesEtapes(eleve({ steps: [step(3)] }), new Map())[0].stepName).toBe('Étape 3')
  })

  it("élève parti : seules les étapes rendues par le service, motif dans unavailable", () => {
    const parti = eleve({
      status: 'DROPPED',
      steps: [step(1), step(2)],
      unavailable: { code: 'ETAPE_APRES_DEPART', message: 'Élève parti.', lastAttendedStepId: 'st-2', lastAttendedStepName: 'Étape 2' },
    })
    expect(cartesEtapes(parti, noms).map((c) => c.stepId)).toEqual(['st-1', 'st-2'])
    expect(parti.unavailable?.code).toBe('ETAPE_APRES_DEPART')
  })
})

// ── 6. Cellules de la grille ─────────────────────────────────────────────────

describe('celluleMatiere / etatSousMatiere', () => {
  it('total lu au serveur, rapproché par classSubjectId', () => {
    const e = eleve({ steps: [step(1, { subjects: [matiere({ numerator: '12.5', denominator: '40' })] })] })
    expect(celluleMatiere(e, 'st-1', 'cs-a')).toEqual({ etat: 'noted', note: '12,5', bareme: '40', bande: 31.25 })
  })

  it("matière dispensée entière : marquée, ni note, ni barème, ni teinte", () => {
    const dispensee = matiere({
      mode: 'sections',
      numerator: '0',
      denominator: '0',
      average: null,
      state: 'exempted',
      sections: [{ sectionId: 'sec-1', name: 'Partie 1', isExam: false, maxScore: '20', score: null, state: 'exempted' }],
    })
    const e = eleve({ steps: [step(1, { subjects: [dispensee] })] })
    expect(celluleMatiere(e, 'st-1', 'cs-a')).toEqual({ etat: 'exempted', note: '—', bareme: null, bande: null })
    expect(etatSousMatiere(e, 'st-1', 'cs-a', 'sec-1')).toBe('exempted')
  })

  it('matière dispensée entière : la note saisie n\'entre dans aucun chiffre affiché', () => {
    // La note brute existe (lue par /api/grades), mais la carte d'étape et
    // l'annuelle ne lisent que le service : elles ne changent pas.
    const dispensee = matiere({ numerator: '0', denominator: '0', average: null, state: 'exempted' })
    const e = eleve({ steps: [step(1, { subjects: [dispensee], averageOrNull: '8' })], annual: '8' })
    expect(cartesEtapes(e, noms)[0].moyenne).toBe('8,00')
    expect(moyenneAnnuelle(e).texte).toBe('8,00')
    expect(celluleMatiere(e, 'st-1', 'cs-a').note).toBe('—')
  })

  it('note manquante : « — » sur le barème retenu', () => {
    const e = eleve({ steps: [step(1, { subjects: [matiere({ numerator: '0', state: 'missing', average: '0' })] })] })
    expect(celluleMatiere(e, 'st-1', 'cs-a')).toEqual({ etat: 'missing', note: '—', bareme: '20', bande: null })
  })

  it('matière absente de la réponse : hors calcul', () => {
    expect(celluleMatiere(eleve(), 'st-1', 'cs-z').etat).toBe('hors-calcul')
    expect(celluleMatiere(eleve(), 'st-9', 'cs-a').etat).toBe('hors-calcul')
    expect(etatSousMatiere(eleve(), 'st-1', 'cs-a', 'sec-z')).toBe('hors-calcul')
  })

  it('sous-matière dispensée seule', () => {
    const m = matiere({
      mode: 'sections',
      sections: [
        { sectionId: 'sec-1', name: 'Partie 1', isExam: false, maxScore: '20', score: '10', state: 'noted' },
        { sectionId: 'sec-2', name: 'Partie 2', isExam: false, maxScore: '20', score: null, state: 'exempted' },
      ],
    })
    const e = eleve({ steps: [step(1, { subjects: [m] })] })
    expect(etatSousMatiere(e, 'st-1', 'cs-a', 'sec-1')).toBe('noted')
    expect(etatSousMatiere(e, 'st-1', 'cs-a', 'sec-2')).toBe('exempted')
  })
})

// ── 7. Chargement : un appel par inscription, échec sans repli ───────────────

describe('chargerMoyennes', () => {
  const annees = [
    { id: 'y-archivee', ...ARCHIVEE, steps: [etape(1), etape(2), etape(3), etape(4)] },
    { id: 'y-courante', ...COURANTE, steps: [etape(1), etape(2, { isCurrent: true }), etape(3)] },
    { id: 'y-sans-en-cours', ...COURANTE, steps: [etape(1), etape(2), etape(3)] },
    { id: 'y-preparation', ...EN_PREPARATION, steps: [etape(1), etape(2)] },
  ]
  const charger = (inscriptions: Parameters<typeof chargerMoyennes>[0], liste: typeof annees | null, fetch: FetchResultats) =>
    chargerMoyennes(inscriptions, liste, fetch, MAINTENANT)

  it("un appel par inscription, à l'étape de référence, jamais un par étape", async () => {
    const fetch = vi.fn(async (_cls: string, stepId: string) =>
      salle([eleve({ enrollmentId: 'enr-1' }), eleve({ enrollmentId: 'enr-2' }), eleve({ enrollmentId: 'enr-3' })], stepId),
    )
    const res = await charger(
      [
        { id: 'enr-1', classSessionId: 'cls-1', academicYearId: 'y-archivee' },
        { id: 'enr-2', classSessionId: 'cls-2', academicYearId: 'y-courante' },
        { id: 'enr-3', classSessionId: 'cls-3', academicYearId: 'y-archivee' },
      ],
      annees,
      fetch,
    )
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch.mock.calls).toEqual([['cls-1', 'st-4'], ['cls-2', 'st-2'], ['cls-3', 'st-4']])
    expect([...res.values()].map((m) => m.kind)).toEqual(['ok', 'ok', 'ok'])
  })

  it('année courante sans étape en cours : aucun appel, « aucune-etape-en-cours »', async () => {
    const fetch = vi.fn(async () => salle([eleve()]))
    const res = await charger([{ id: 'enr-1', classSessionId: 'cls-1', academicYearId: 'y-sans-en-cours' }], annees, fetch)
    expect(fetch).not.toHaveBeenCalled()
    expect(res.get('enr-1')).toEqual({ kind: 'aucune-etape-en-cours' })
  })

  it('année en préparation : aucun appel, « en-preparation »', async () => {
    const fetch = vi.fn(async () => salle([eleve()]))
    const res = await charger([{ id: 'enr-1', classSessionId: 'cls-1', academicYearId: 'y-preparation' }], annees, fetch)
    expect(fetch).not.toHaveBeenCalled()
    expect(res.get('enr-1')).toEqual({ kind: 'en-preparation' })
  })

  it('les quatre cas ensemble : appels seulement pour les années archivée et courante avec étape en cours', async () => {
    const fetch = vi.fn(async () => salle([eleve({ enrollmentId: 'enr-1' }), eleve({ enrollmentId: 'enr-2' })]))
    const res = await charger(
      [
        { id: 'enr-1', classSessionId: 'cls-1', academicYearId: 'y-archivee' },
        { id: 'enr-2', classSessionId: 'cls-2', academicYearId: 'y-courante' },
        { id: 'enr-3', classSessionId: 'cls-3', academicYearId: 'y-sans-en-cours' },
        { id: 'enr-4', classSessionId: 'cls-4', academicYearId: 'y-preparation' },
      ],
      annees,
      fetch,
    )
    expect(fetch.mock.calls).toEqual([['cls-1', 'st-4'], ['cls-2', 'st-2']])
    expect([...res.values()].map((m) => m.kind)).toEqual(['ok', 'ok', 'aucune-etape-en-cours', 'en-preparation'])
  })

  it("échec de l'appel : « echec » pour cette année seulement, aucun chiffre", async () => {
    const fetch = vi.fn(async (cls: string) => {
      if (cls === 'cls-2') throw new Error('panne')
      return salle([eleve({ enrollmentId: 'enr-1' })])
    })
    const res = await charger(
      [
        { id: 'enr-1', classSessionId: 'cls-1', academicYearId: 'y-archivee' },
        { id: 'enr-2', classSessionId: 'cls-2', academicYearId: 'y-courante' },
      ],
      annees,
      fetch,
    )
    expect(res.get('enr-1')?.kind).toBe('ok')
    expect(res.get('enr-2')).toEqual({ kind: 'echec' })
  })

  it('liste des années illisible : toutes en échec, aucun appel', async () => {
    const fetch = vi.fn(async () => salle([eleve()]))
    const res = await charger([{ id: 'enr-1', classSessionId: 'cls-1', academicYearId: 'y-archivee' }], null, fetch)
    expect(fetch).not.toHaveBeenCalled()
    expect(res.get('enr-1')).toEqual({ kind: 'echec' })
  })

  it("année archivée sans étape : « sans-etape », aucun appel", async () => {
    const fetch = vi.fn(async () => salle([eleve()]))
    const res = await charger(
      [{ id: 'enr-1', classSessionId: 'cls-1', academicYearId: 'y-vide' }],
      [{ id: 'y-vide', ...ARCHIVEE, steps: [] }],
      fetch,
    )
    expect(fetch).not.toHaveBeenCalled()
    expect(res.get('enr-1')).toEqual({ kind: 'sans-etape' })
  })

  it("inscription absente de la réponse : « absent »", async () => {
    const res = await charger(
      [{ id: 'enr-9', classSessionId: 'cls-1', academicYearId: 'y-archivee' }],
      annees,
      async () => salle([eleve({ enrollmentId: 'enr-1' })]),
    )
    expect(res.get('enr-9')).toEqual({ kind: 'absent' })
  })
})

// ── 8. Notes saisies : regroupement sans calcul ──────────────────────────────

describe('regrouperNotes', () => {
  const note = (extra: Partial<NoteSaisie>): NoteSaisie => ({
    classSubjectId: 'cs-a',
    sectionId: null,
    stepId: 'st-1',
    studentScore: '12.5',
    classSubject: { subject: { name: 'Matière A', code: 'MA' } },
    section: null,
    ...extra,
  })

  it('range par affectation et garde chaque note saisie telle quelle', () => {
    const sec = { id: 'sec-1', name: 'Partie 1', code: 'P1', maxScore: '20' }
    const m = regrouperNotes([
      note({}),
      note({ studentScore: '14' }),
      note({ sectionId: 'sec-1', section: sec, studentScore: '9.75' }),
      note({ classSubjectId: 'cs-b', classSubject: { subject: { name: 'Autre', code: 'AU' } } }),
    ])
    expect(m.map((x) => x.classSubjectId)).toEqual(['cs-b', 'cs-a'])
    const a = m[1]
    expect(a.globalParEtape.get('st-1')).toEqual([12.5, 14])
    expect(a.sousMatieres[0].parEtape.get('st-1')).toEqual([9.75])
    expect(a.sousMatieres[0].maxScore).toBe(20)
  })

  it('deux affectations de la même matière restent distinctes', () => {
    const m = regrouperNotes([note({ classSubjectId: 'cs-1' }), note({ classSubjectId: 'cs-2' })])
    expect(m).toHaveLength(2)
  })

  it('texte des notes saisies', () => {
    expect(texteSaisies([12.5, 14])).toBe('12,5 ; 14')
    expect(texteSaisies([])).toBeNull()
    expect(texteSaisies(undefined)).toBeNull()
  })
})

// ── 9. La page n'importe aucune fonction de calcul ───────────────────────────

describe('page Parcours : aucun calcul local', () => {
  const source = readFileSync(
    join(process.cwd(), 'app', 'admin', 'all-students', '[studentId]', 'transcript', 'page.tsx'),
    'utf8',
  )

  it("n'importe ni le moteur de calcul ni ses adaptateurs", () => {
    for (const chemin of [
      '@/lib/bulletin/compute',
      '@/lib/bulletin/from-api',
      '@/lib/bulletin-calculations',
      '@/lib/releve/compute',
      '@/lib/decimal',
    ]) {
      expect(source).not.toContain(`from "${chemin}"`)
      expect(source).not.toContain(`from '${chemin}'`)
    }
  })

  it("plus d'ancienne agrégation ni de moyenne globale", () => {
    expect(source).not.toContain('buildEnrollmentSummary')
    expect(source).not.toContain('generalAverage')
    expect(source).not.toContain('Moyenne globale')
    expect(source).not.toContain('Coef.')
    expect(source).not.toContain('.coefficient')
  })

  it('lit les moyennes par le cache du service de résultats', () => {
    expect(source).toContain('fetchRoomResults')
    expect(source).toContain('Moyennes calculées selon les règles du bulletin')
  })
})
