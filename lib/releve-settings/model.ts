/**
 * Paramétrage du relevé de notes — modèle de l'écran (fonctions pures).
 *
 * Ordre, colonne imposée et présence des matières d'un niveau, et ordre et
 * présence de leurs sous-matières. Aucune dépendance React ni fetch : l'écran
 * (app/admin/settings/releve/page.tsx) ne fait qu'appeler ces fonctions.
 *
 * Contrat serveur (POST /api/subjects/reorder et
 * POST /api/subjects/:subjectId/sections/reorder) : liste COMPLÈTE exigée,
 * displayOrder distincts et ≥ 1. Les charges utiles numérotent donc 1..n dans
 * l'ordre affiché.
 */

export type ReleveColumnChoice = 'LEFT' | 'RIGHT' | null

export interface SectionSetting {
  id: string
  name: string
  displayOrder: number
  showOnReleve: boolean
  createdAt: string | null
}

export interface SubjectSetting {
  id: string
  name: string
  code: string
  /** Rang enregistré ; null = jamais réglé (placé après les matières réglées). */
  displayOrder: number | null
  releveColumn: ReleveColumnChoice
  showOnReleve: boolean
  sections: SectionSetting[]
}

const texte = (v: unknown): string => (typeof v === 'string' ? v : '')
const rang = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const byNumber = (x: number, y: number) => (x === y ? 0 : x < y ? -1 : 1)
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/** Sous-matières : rang, puis date de création, puis id (même ordre que le relevé). */
function sortSections(list: SectionSetting[]): SectionSetting[] {
  const cree = (s: SectionSetting) => {
    const t = s.createdAt ? Date.parse(s.createdAt) : Number.NaN
    return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t
  }
  return [...list].sort((a, b) => byNumber(a.displayOrder, b.displayOrder) || byNumber(cree(a), cree(b)) || byId(a, b))
}

/** Matières : rang croissant, rang vide en dernier, puis nom. */
function sortSubjects(list: SubjectSetting[]): SubjectSetting[] {
  const r = (s: SubjectSetting) => (s.displayOrder === null ? Number.POSITIVE_INFINITY : s.displayOrder)
  return [...list].sort(
    (a, b) => byNumber(r(a), r(b)) || a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }) || byId(a, b),
  )
}

/**
 * Matières d'un niveau depuis GET /api/subjects, triées pour l'affichage.
 * Champs du relevé absents (serveur antérieur) : visibles, sans rang, colonne
 * automatique.
 */
export function fromApiSubjects(raw: unknown, classTypeId: string): SubjectSetting[] {
  if (!Array.isArray(raw)) return []
  const subjects = raw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object' && (s as Record<string, unknown>).classTypeId === classTypeId)
    .map((s): SubjectSetting => ({
      id: texte(s.id),
      name: texte(s.name),
      code: texte(s.code),
      displayOrder: rang(s.displayOrder),
      releveColumn: s.releveColumn === 'LEFT' || s.releveColumn === 'RIGHT' ? s.releveColumn : null,
      showOnReleve: s.showOnReleve !== false,
      sections: sortSections(
        (Array.isArray(s.sections) ? s.sections : [])
          .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
          .map((x) => ({
            id: texte(x.id),
            name: texte(x.name),
            displayOrder: rang(x.displayOrder) ?? 1,
            showOnReleve: x.showOnReleve !== false,
            createdAt: typeof x.createdAt === 'string' ? x.createdAt : null,
          })),
      ),
    }))
  return sortSubjects(subjects)
}

/** Déplace l'élément `index` d'un rang vers le haut (-1) ou le bas (+1). Hors bornes : liste inchangée (copie). */
export function moveItem<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const copy = [...list]
  const target = index + delta
  if (index < 0 || index >= copy.length || target < 0 || target >= copy.length) return copy
  ;[copy[index], copy[target]] = [copy[target], copy[index]]
  return copy
}

/** Charge utile de POST /api/subjects/reorder : TOUTES les matières, rangs 1..n. */
export function subjectsPayload(classTypeId: string, list: SubjectSetting[]) {
  return {
    classTypeId,
    items: list.map((s, i) => ({
      id: s.id,
      displayOrder: i + 1,
      releveColumn: s.releveColumn,
      showOnReleve: s.showOnReleve,
    })),
  }
}

/** Charge utile de POST /api/subjects/:id/sections/reorder : TOUTES les sous-matières, rangs 1..n. */
export function sectionsPayload(subject: SubjectSetting) {
  return {
    items: subject.sections.map((s, i) => ({ id: s.id, displayOrder: i + 1, showOnReleve: s.showOnReleve })),
  }
}

const sectionsKey = (s: SubjectSetting) => s.sections.map((x) => `${x.id}:${x.showOnReleve}`).join('|')
const subjectsKey = (list: SubjectSetting[]) =>
  list.map((s) => `${s.id}:${s.releveColumn}:${s.showOnReleve}`).join('|')

/** Matières dont l'ordre ou la présence des sous-matières a changé. */
export function changedSectionSubjects(initial: SubjectSetting[], current: SubjectSetting[]): string[] {
  const before = new Map(initial.map((s) => [s.id, sectionsKey(s)]))
  return current.filter((s) => before.get(s.id) !== sectionsKey(s)).map((s) => s.id)
}

/** Vrai si l'ordre, la colonne ou la présence d'une matière ou d'une sous-matière a changé. */
export function hasChanges(initial: SubjectSetting[], current: SubjectSetting[]): boolean {
  return subjectsKey(initial) !== subjectsKey(current) || changedSectionSubjects(initial, current).length > 0
}
