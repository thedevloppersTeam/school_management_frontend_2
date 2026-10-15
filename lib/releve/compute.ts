/**
 * Relevé de notes — règles de calcul et de format (R-REL-1 à R-REL-6).
 *
 * Référence : docs/GABARIT-RELEVE.md (v0.3), hors dépôt. Fonctions PURES, sans
 * React, DOM ni fetch : même parti pris que lib/bulletin/compute.ts.
 *
 * La valeur d'une cellule d'étape est celle du bulletin (R-REL-2) : elle sort de
 * `computeSubject`, pas d'un second calcul. Tout reste en Decimal jusqu'au
 * formatage (R-REL-4) ; l'arrondi est au demi supérieur, posé explicitement.
 */
import Decimal from 'decimal.js'
import {
  PASSING_THRESHOLD,
  computeGeneralAverage,
  computeSubject,
  type SubjectInput,
} from '@/lib/bulletin/compute'
import { buildExclusionSet, exclusionKey } from '@/lib/bulletin/from-api'
import { GRADE_SCALE, gradeBand, type GradeBand } from '@/lib/bulletin/grade-color'
import { deriveAcademicYearStatus } from '@/lib/academic-years/status'
import {
  ReleveUnavailableError,
  TIRET,
  type ApiBehaviorRow,
  type ApiClassSubjectRow,
  type ApiExclusionRow,
  type ApiGradeRow,
  type ApiPromotionPhotoRow,
  type ApiStepRow,
  type ApiYearRow,
  type ReleveCell,
  type ReleveGroup,
  type ReleveLegendEntry,
  type ReleveLine,
} from './types'

// ── Textes fixes du gabarit ─────────────────────────────────────────────────

/** Gabarit §6. */
export const REMARQUE = 'Toute surcharge et / ou rature rend nul le présent relevé de notes'

/** Gabarit §6 : le seuil imprimé est celui du bulletin (BR-002). */
export const SEUIL_REUSSITE = PASSING_THRESHOLD.toFixed(2, Decimal.ROUND_HALF_UP)

export const DISCIPLINE_TITLE = 'Discipline'

const DIX = new Decimal(10)
const CENT = new Decimal(100)

// ── Nombres (R-REL-1, R-REL-4) ──────────────────────────────────────────────

/**
 * Conversion d'une valeur lue dans l'API. Les colonnes Decimal arrivent en
 * chaîne : `new Decimal(String(v))`, jamais par un flottant (E-DEC-1).
 * Absente → null. Illisible → refus : un 0 ou un « - » à la place d'une donnée
 * non lue est interdit (R-REL-7).
 */
export function toDecimal(value: unknown, what: string): Decimal | null {
  if (value === null || value === undefined || value === '') return null
  let d: Decimal
  try {
    d = new Decimal(String(value))
  } catch {
    throw new ReleveUnavailableError('indisponible', `${what} illisible`)
  }
  if (!d.isFinite()) throw new ReleveUnavailableError('indisponible', `${what} illisible`)
  return d
}

/** R-REL-1 — coeff = barème ÷ 10, sans zéro inutile (« 6 », « 0.5 »). */
export function formatCoeff(bareme: Decimal): string {
  return bareme.dividedBy(DIX).toString()
}

/** R-REL-4 — 2 décimales, point décimal, demi supérieur ; absent → « - ». */
export function formatNumber(value: Decimal | null): string {
  return value === null ? TIRET : value.toFixed(2, Decimal.ROUND_HALF_UP)
}

// ── Couleurs (gabarit §5) ───────────────────────────────────────────────────

/**
 * Bande de couleur d'une note : `gradeBand` sur le pourcentage
 * note ÷ barème × 100, comme `colorClass` du bulletin
 * (components/school/bulletin-printable.tsx:25-35) et GRADE_SCALE
 * (lib/bulletin/grade-color.ts:57-66). Valeur EXACTE, jamais le texte arrondi.
 */
function bandOf(score: Decimal, bareme: Decimal): GradeBand {
  return gradeBand(score.dividedBy(bareme).times(CENT).toNumber())
}

/** Cellule d'étape : note exacte formatée, et sa bande ; sans note → « - ». */
export function cellFor(score: Decimal | null, bareme: Decimal): ReleveCell {
  if (score === null) return { text: TIRET, band: null }
  return { text: formatNumber(score), band: bandOf(score, bareme) }
}

/**
 * R-REL-3 — Moy. Gnle sur 10 : moyenne des cellules NOTÉES (valeurs exactes)
 * ÷ barème × 10. Aucune cellule notée → null.
 */
export function lineAverage(cells: Array<Decimal | null>, bareme: Decimal): Decimal | null {
  const mean = computeGeneralAverage(cells.filter((c): c is Decimal => c !== null))
  return mean === null ? null : mean.dividedBy(bareme).times(DIX)
}

/** Colonne « Moy. Gnle » : texte arrondi, bande sur la moyenne exacte. */
export function averageCellFor(cells: Array<Decimal | null>, bareme: Decimal): ReleveCell {
  const avg = lineAverage(cells, bareme)
  if (avg === null) return { text: TIRET, band: null }
  return { text: formatNumber(avg), band: bandOf(avg, DIX) }
}

/** Légende 2 × 4 : reprise telle quelle de GRADE_SCALE. */
export function legend(): ReleveLegendEntry[] {
  return GRADE_SCALE.map(({ mention, label, range, band }) => ({ mention, label, range, band }))
}

// ── Période (R-REL-6) ───────────────────────────────────────────────────────

/**
 * Étapes de l'année, triées par numéro, et celles qui entrent au relevé.
 * L'étape en cours vient du seul `isCurrent` : jamais de repli sur l'étape 1.
 */
export function resolveSteps(
  year: ApiYearRow,
  now: Date = new Date(),
): { steps: ApiStepRow[]; included: Set<string> } {
  const steps = [...(year.steps ?? [])].sort((a, b) => a.stepNumber - b.stepNumber)
  if (steps.length === 0) throw new ReleveUnavailableError('indisponible', 'aucune étape pour l’année')

  const status = deriveAcademicYearStatus({ isCurrent: year.isCurrent, endDate: year.endDate }, now)
  if (status === 'preparation') throw new ReleveUnavailableError('annee-en-preparation')
  if (status === 'archived') return { steps, included: new Set(steps.map((s) => s.id)) }

  const current = steps.find((s) => s.isCurrent)
  if (!current) throw new ReleveUnavailableError('aucune-etape-en-cours')
  return {
    steps,
    included: new Set(steps.filter((s) => s.stepNumber <= current.stepNumber).map((s) => s.id)),
  }
}

// ── Portée (D5) ─────────────────────────────────────────────────────────────

/**
 * Tronc commun + matières de LA filière de l'élève. Même règle que
 * `filterSubjectsByScope(…, 'all', …)` (lib/api/grades.ts:94-106), réécrite
 * sur une forme structurelle : l'original exige `ApiClassSubject`, dont les
 * barèmes sont déjà convertis par parseDecimal.
 */
export function scopeClassSubjects<T extends { trackId: string | null }>(
  rows: T[],
  studentTrackId: string | null,
): T[] {
  return rows.filter((cs) => cs.trackId == null || (!!studentTrackId && cs.trackId === studentTrackId))
}

// ── Groupes de matières (G1, G2, G12, R-REL-2, R-REL-3) ─────────────────────

export interface SubjectGroupsInput {
  /** Matières déjà restreintes à la portée de l'élève, dans l'ordre de l'API. */
  classSubjects: ApiClassSubjectRow[]
  /** Code de la filière de l'élève, pour le suffixe de double affectation. */
  trackCode: string | null
  enrollmentId: string
  /** Étapes de l'année, ordonnées (resolveSteps). */
  steps: ApiStepRow[]
  /** Étapes qui entrent au relevé (R-REL-6). */
  included: ReadonlySet<string>
  /** Étapes dont l'élève est dispensé. */
  exemptedSteps: ReadonlySet<string>
  /** Notes de l'élève, par étape demandée. */
  gradesByStep: ReadonlyMap<string, ApiGradeRow[]>
  /** Dispenses de sous-matière de la salle, par étape (toutes inscriptions). */
  exclusionsByStep: ReadonlyMap<string, ApiExclusionRow[]>
}

interface LineDef {
  label: string
  sectionId: string | null
  bareme: Decimal
}

function requireBareme(value: unknown, what: string): Decimal {
  const d = toDecimal(value, what)
  if (d === null || d.lte(0)) throw new ReleveUnavailableError('indisponible', `${what} absent`)
  return d
}

function sortedSections(cs: ApiClassSubjectRow) {
  const order = (v: number | null | undefined) => (typeof v === 'number' ? v : Number.POSITIVE_INFINITY)
  return [...(cs.subject.sections ?? [])].sort((a, b) => order(a.displayOrder) - order(b.displayOrder))
}

/**
 * Valeurs exactes d'une matière pour UNE étape, une par ligne, ou null quand
 * la ligne n'est pas notée (sans note, dispensée). La valeur est celle de
 * `computeSubject`, donc celle du bulletin.
 */
function stepValues(
  cs: ApiClassSubjectRow,
  lines: LineDef[],
  grades: ApiGradeRow[],
  exclusions: Set<string>,
  enrollmentId: string,
): Array<Decimal | null> {
  const name = cs.subject.name
  const own = grades.filter((g) => g.classSubjectId === cs.id)
  const sectioned = lines.some((l) => l.sectionId !== null)
  const known = new Set(lines.map((l) => l.sectionId))
  if (own.some((g) => g.sectionId !== null && !known.has(g.sectionId))) {
    throw new ReleveUnavailableError('notes-non-representables', name)
  }
  const scores = (sectionId: string | null) =>
    own
      .filter((g) => (g.sectionId ?? null) === sectionId)
      .map((g) => {
        const d = toDecimal(g.studentScore, `note de ${name}`)
        if (d === null) throw new ReleveUnavailableError('indisponible', `note de ${name} absente`)
        return d
      })

  const input: SubjectInput = {
    classSubjectId: cs.id,
    name,
    // La rubrique n'est pas imprimée sur le relevé (§8) et n'entre pas dans le
    // calcul d'une ligne : valeur sans effet, requise par le type.
    rubrique: 'R1',
    maxScore: sectioned ? (toDecimal(cs.subject.maxScore, `barème de ${name}`) ?? new Decimal(0)) : lines[0].bareme,
    maxScoreOverride: null,
    sections: lines
      .filter((l) => l.sectionId !== null)
      .map((l) => ({
        sectionId: l.sectionId as string,
        name: l.label,
        maxScore: l.bareme,
        scores: scores(l.sectionId),
        exempted: exclusions.has(exclusionKey(enrollmentId, cs.id, l.sectionId)),
      })),
    globalScores: scores(null),
    exempted: exclusions.has(exclusionKey(enrollmentId, cs.id, null)),
  }
  const result = computeSubject(input)

  if (!sectioned) return [result.state === 'noted' ? result.numerator : null]

  // Une note globale sur une matière à sous-matières n'a pas de ligne où
  // s'afficher : la taire fausserait le relevé, on refuse (cf. rapport).
  if (result.state !== 'exempted' && input.globalScores.length > 0) {
    throw new ReleveUnavailableError('notes-non-representables', name)
  }
  return result.sections.map((s) => (s.state === 'noted' ? s.score : null))
}

export function buildSubjectGroups(params: SubjectGroupsInput): ReleveGroup[] {
  const { classSubjects, trackCode, enrollmentId, steps, included, exemptedSteps } = params

  const assignments = new Map<string, number>()
  for (const cs of classSubjects) assignments.set(cs.subject.id, (assignments.get(cs.subject.id) ?? 0) + 1)

  const exclusionsFor = new Map<string, Set<string>>()
  for (const step of steps) {
    const rows = (params.exclusionsByStep.get(step.id) ?? []).filter((r) => r.enrollmentId === enrollmentId)
    exclusionsFor.set(step.id, buildExclusionSet(rows))
  }

  return classSubjects.map((cs) => {
    const name = cs.subject.name
    const sections = sortedSections(cs)
    const lines: LineDef[] =
      sections.length > 0
        ? sections.map((s) => ({ label: s.name, sectionId: s.id, bareme: requireBareme(s.maxScore, `barème de ${s.name}`) }))
        : [{
            label: name,
            sectionId: null,
            bareme: requireBareme(cs.maxScoreOverride ?? cs.subject.maxScore, `barème de ${name}`),
          }]

    // values[étape][ligne]
    const values = steps.map((step) =>
      !included.has(step.id) || exemptedSteps.has(step.id)
        ? lines.map(() => null)
        : stepValues(cs, lines, params.gradesByStep.get(step.id) ?? [], exclusionsFor.get(step.id)!, enrollmentId),
    )

    const doubled = (assignments.get(cs.subject.id) ?? 0) > 1 && cs.trackId !== null && !!trackCode
    return {
      title: doubled ? `${name} (${trackCode})` : name,
      kind: 'matiere' as const,
      lines: lines.map((line, li): ReleveLine => {
        const cells = values.map((v) => v[li])
        return {
          label: line.label,
          coeff: formatCoeff(line.bareme),
          cells: cells.map((c) => cellFor(c, line.bareme)),
          blank: TIRET,
          average: averageCellFor(cells, line.bareme),
        }
      }),
    }
  })
}

// ── Discipline (R-REL-5) ────────────────────────────────────────────────────

export interface DisciplineInput {
  steps: ApiStepRow[]
  included: ReadonlySet<string>
  exemptedSteps: ReadonlySet<string>
  /** Fiche de l'étape ; null ou absente de la table = pas de fiche (404). */
  behaviorsByStep: ReadonlyMap<string, ApiBehaviorRow | null>
}

const DISCIPLINE_LINES: Array<{ field: keyof ApiBehaviorRow; label: string; mode: 'total' | 'moyenne' }> = [
  { field: 'retards', label: 'Nbre de retards', mode: 'total' },
  { field: 'absences', label: 'Nbre d\'absences', mode: 'total' },
  { field: 'devoirsManques', label: 'Nbre de devoirs non remis', mode: 'total' },
  { field: 'leconsNonSues', label: 'Nbre de leçons non sues', mode: 'total' },
  { field: 'respectUniforme', label: 'Respect des prescrits de l\'uniforme', mode: 'moyenne' },
]

/** Compteurs = total des étapes renseignées ; uniforme = moyenne ; aucune couleur. */
export function buildDisciplineGroup(params: DisciplineInput): ReleveGroup {
  const { steps, included, exemptedSteps, behaviorsByStep } = params
  return {
    title: DISCIPLINE_TITLE,
    kind: 'discipline',
    lines: DISCIPLINE_LINES.map(({ field, label, mode }): ReleveLine => {
      const values = steps.map((step) => {
        if (!included.has(step.id) || exemptedSteps.has(step.id)) return null
        const row = behaviorsByStep.get(step.id)
        return row ? toDecimal(row[field], label) : null
      })
      const filled = values.filter((v): v is Decimal => v !== null)
      let average = TIRET
      if (filled.length > 0) {
        const total = filled.reduce((a, v) => a.plus(v), new Decimal(0))
        average = mode === 'total' ? total.toString() : formatNumber(total.dividedBy(filled.length))
      }
      return {
        label,
        coeff: '1',
        cells: values.map((v) => ({ text: v === null ? TIRET : v.toString(), band: null })),
        blank: TIRET,
        average: { text: average, band: null },
      }
    }),
  }
}

// ── Identité (gabarit §2) ───────────────────────────────────────────────────

const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

/**
 * « JJ Mois AAAA ». La date est lue sur ses chiffres AAAA-MM-JJ, sans passer
 * par un objet Date local : une date stockée à minuit UTC ne recule pas d'un
 * jour à l'ouest de Greenwich.
 */
export function formatBirthDate(value: unknown): string {
  if (typeof value !== 'string') return TIRET
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/)
  if (!m) return TIRET
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (mo < 1 || mo > 12 || d < 1 || d > new Date(Date.UTC(y, mo, 0)).getUTCDate()) return TIRET
  return `${m[3]} ${MOIS[mo - 1]} ${m[1]}`
}

/** « AAAA-AAAA » (ou tiret long, barre) → « AAAA - AAAA ». */
export function formatYearRange(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return TIRET
  const m = value.match(/(\d{4})\s*[-–—/]\s*(\d{4})/)
  return m ? `${m[1]} - ${m[2]}` : value.trim()
}

const nonEmpty = (v: string | null | undefined): v is string => typeof v === 'string' && v.trim() !== ''

/**
 * G8 — photo de promotion de L'ANNÉE du relevé, sinon photo de profil, sinon
 * null. Jamais la photo d'une autre année (le bulletin, lui, y retombe).
 */
export function choosePhoto(
  photos: ApiPromotionPhotoRow[],
  academicYearId: string,
  profilePhoto: string | null | undefined,
): string | null {
  const ofYear = photos.find((p) => p.academicYearId === academicYearId && nonEmpty(p.photoUrl))
  if (ofYear && nonEmpty(ofYear.photoUrl)) return ofYear.photoUrl
  return nonEmpty(profilePhoto) ? profilePhoto : null
}
