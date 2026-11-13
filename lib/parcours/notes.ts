/**
 * Page « Parcours » — regroupement des notes SAISIES pour l'affichage (lot B).
 *
 * Aucun calcul : les notes lues par `/api/grades/enrollment/:id` sont rangées
 * par affectation (`classSubjectId`, la clé du service de résultats), par
 * sous-matière et par étape, telles qu'elles ont été saisies. Les totaux et
 * les moyennes viennent du serveur (./resultats.ts).
 */
import { parseDecimal } from '@/lib/decimal'

export interface NoteSaisie {
  classSubjectId: string
  sectionId: string | null
  stepId: string
  studentScore: unknown
  classSubject: {
    subject: { name: string; code: string; hasSections?: boolean }
  }
  section: { id: string; name: string; code: string; maxScore: unknown } | null
}

export interface SousMatiereSaisie {
  sectionId: string
  name: string
  code: string
  /** Barème de la sous-matière, tel que lu avec la note. */
  maxScore: number | null
  /** stepId → notes saisies, dans l'ordre de lecture. */
  parEtape: Map<string, number[]>
}

export interface MatiereSaisie {
  classSubjectId: string
  name: string
  code: string
  /** stepId → notes saisies sur la matière entière (mode global). */
  globalParEtape: Map<string, number[]>
  sousMatieres: SousMatiereSaisie[]
}

function pousser(map: Map<string, number[]>, cle: string, valeur: number) {
  const liste = map.get(cle)
  if (liste) liste.push(valeur)
  else map.set(cle, [valeur])
}

/** Notes saisies d'une inscription, par matière, triées par nom de matière. */
export function regrouperNotes(notes: NoteSaisie[]): MatiereSaisie[] {
  const matieres = new Map<string, MatiereSaisie & { sections: Map<string, SousMatiereSaisie> }>()
  for (const n of notes) {
    let m = matieres.get(n.classSubjectId)
    if (!m) {
      m = {
        classSubjectId: n.classSubjectId,
        name: n.classSubject.subject.name,
        code: n.classSubject.subject.code,
        globalParEtape: new Map(),
        sousMatieres: [],
        sections: new Map(),
      }
      matieres.set(n.classSubjectId, m)
    }
    const valeur = parseDecimal(n.studentScore)
    if (valeur === null) continue
    if (!n.sectionId || !n.section) {
      pousser(m.globalParEtape, n.stepId, valeur)
      continue
    }
    let s = m.sections.get(n.sectionId)
    if (!s) {
      s = { sectionId: n.sectionId, name: n.section.name, code: n.section.code, maxScore: parseDecimal(n.section.maxScore), parEtape: new Map() }
      m.sections.set(n.sectionId, s)
    }
    pousser(s.parEtape, n.stepId, valeur)
  }
  return [...matieres.values()]
    .map(({ sections, ...m }) => ({ ...m, sousMatieres: [...sections.values()] }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

const formatteur = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })

/** Notes saisies d'une case, telles quelles (« 12,5 ; 14 »), ou null si aucune. */
export function texteSaisies(valeurs: number[] | undefined): string | null {
  if (!valeurs || valeurs.length === 0) return null
  return valeurs.map((v) => formatteur.format(v)).join(' ; ')
}
