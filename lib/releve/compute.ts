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

/**
 * Colonne « Moy. Gnle » : calcul exact, puis bande sur la valeur AFFICHÉE
 * (arrondie à 2 décimales, demi supérieur) × 10 — gabarit §5, Q-C, comme les
 * moyennes du bulletin. Ex. 6.8958… → « 6.90 » → 69 % → aucune couleur.
 */
export function averageCellFor(cells: Array<Decimal | null>, bareme: Decimal): ReleveCell {
  const avg = lineAverage(cells, bareme)
  if (avg === null) return { text: TIRET, band: null }
  const shown = avg.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  return { text: formatNumber(shown), band: bandOf(shown, DIX) }
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
  /** Sous-matière portée par la ligne ; null pour la ligne de matière. */
  sectionId: string | null
  bareme: Decimal
}

function requireBareme(value: unknown, what: string): Decimal {
  const d = toDecimal(value, what)
  if (d === null || d.lte(0)) throw new ReleveUnavailableError('indisponible', `${what} absent`)
  return d
}

/**
 * G2 + K3 — ordre des sous-matières : displayOrder croissant, puis createdAt
 * croissant, puis id. Les deux départages rendent l'ordre indépendant de celui
 * de l'API, que le serveur ne garantit pas (sections chargées sans orderBy).
 * Une valeur absente ou illisible passe après les valeurs présentes.
 */
function sortedSections(cs: ApiClassSubjectRow) {
  const order = (v: number | null | undefined) => (typeof v === 'number' ? v : Number.POSITIVE_INFINITY)
  const created = (v: string | null | undefined) => {
    const t = typeof v === 'string' ? Date.parse(v) : Number.NaN
    return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t
  }
  const byNumber = (x: number, y: number) => (x === y ? 0 : x < y ? -1 : 1)
  return [...(cs.subject.sections ?? [])].sort(
    (a, b) =>
      byNumber(order(a.displayOrder), order(b.displayOrder)) ||
      byNumber(created(a.createdAt), created(b.createdAt)) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
}

/**
 * Valeurs exactes d'une matière pour UNE étape : une par ligne de sous-matière,
 * puis, si le groupe a une ligne globale, la valeur de cette ligne. null quand
 * la ligne n'est pas notée (sans note, dispensée).
 *
 * Les deux familles de lignes passent chacune par `computeSubject`, donc par
 * les règles du bulletin (lib/bulletin/compute.ts, GradingMode) :
 *  - sous-matières : appel SANS les notes globales → mode 'sections' ;
 *  - ligne globale : appel avec les notes globales et les sous-matières SANS
 *    leurs notes → mode 'global' : moyenne des notes globales sur le barème de
 *    la matière, et dispense de la matière entière (ou de toutes ses
 *    sous-matières) → « - ».
 * Une étape mixte (notes globales ET de sous-matières) est un état que le
 * bulletin signale sans le trancher ; ici chaque note va dans sa ligne (Q-A).
 */
function stepValues(
  cs: ApiClassSubjectRow,
  sectionLines: LineDef[],
  globalLine: LineDef | null,
  grades: ApiGradeRow[],
  exclusions: Set<string>,
  enrollmentId: string,
): Array<Decimal | null> {
  const name = cs.subject.name
  const own = grades.filter((g) => g.classSubjectId === cs.id)
  const known = new Set(sectionLines.map((l) => l.sectionId))
  // Note visant une sous-matière inconnue de la matière : donnée incohérente,
  // refus sans nom de matière dans le message (gabarit §3).
  if (own.some((g) => g.sectionId != null && !known.has(g.sectionId))) {
    throw new ReleveUnavailableError('indisponible')
  }
  const scores = (sectionId: string | null) =>
    own
      .filter((g) => (g.sectionId ?? null) === sectionId)
      .map((g) => {
        const d = toDecimal(g.studentScore, `note de ${name}`)
        if (d === null) throw new ReleveUnavailableError('indisponible', `note de ${name} absente`)
        return d
      })
  const subjectExempted = exclusions.has(exclusionKey(enrollmentId, cs.id, null))
  const input = (withSectionScores: boolean, globalScores: Decimal[], maxScore: Decimal): SubjectInput => ({
    classSubjectId: cs.id,
    name,
    // La rubrique n'est pas imprimée sur le relevé (§8) et n'entre pas dans le
    // calcul d'une ligne : valeur sans effet, requise par le type.
    rubrique: 'R1',
    maxScore,
    maxScoreOverride: null,
    sections: sectionLines.map((l) => ({
      sectionId: l.sectionId as string,
      name: l.label,
      maxScore: l.bareme,
      scores: withSectionScores ? scores(l.sectionId) : [],
      exempted: exclusions.has(exclusionKey(enrollmentId, cs.id, l.sectionId)),
    })),
    globalScores,
    exempted: subjectExempted,
  })

  // Matière sans sous-matière : une ligne, la note porte sur la matière.
  if (sectionLines.length === 0) {
    const bareme = (globalLine as LineDef).bareme
    const r = computeSubject(input(false, scores(null), bareme))
    return [r.state === 'noted' ? r.numerator : null]
  }

  const declared = toDecimal(cs.subject.maxScore, `barème de ${name}`) ?? new Decimal(0)
  const bySection = computeSubject(input(true, [], declared))
  const values = bySection.sections.map((sec) => (sec.state === 'noted' ? sec.score : null))
  if (globalLine) {
    const globals = scores(null)
    const r = globals.length > 0 ? computeSubject(input(false, globals, globalLine.bareme)) : null
    values.push(r && r.state === 'noted' ? r.numerator : null)
  }
  return values
}

export function buildSubjectGroups(params: SubjectGroupsInput): ReleveGroup[] {
  const { classSubjects, trackCode, enrollmentId, steps, included, exemptedSteps } = params

  // K4 — une étape retenue absente d'une table d'entrée est une erreur de
  // l'appelant : la lire comme « sans note » ou « sans dispense » imprimerait
  // des « - » à la place de données non lues (R-REL-7).
  for (const step of steps) {
    if (included.has(step.id) && (!params.gradesByStep.has(step.id) || !params.exclusionsByStep.has(step.id))) {
      throw new ReleveUnavailableError('indisponible')
    }
  }

  const assignments = new Map<string, number>()
  for (const cs of classSubjects) assignments.set(cs.subject.id, (assignments.get(cs.subject.id) ?? 0) + 1)

  const exclusionsFor = new Map<string, Set<string>>()
  for (const step of steps) {
    const rows = (params.exclusionsByStep.get(step.id) ?? []).filter((r) => r.enrollmentId === enrollmentId)
    exclusionsFor.set(step.id, buildExclusionSet(rows))
  }

  return classSubjects.map((cs) => {
    const name = cs.subject.name
    const sectionLines: LineDef[] = sortedSections(cs).map((s) => ({
      label: s.name,
      sectionId: s.id,
      bareme: requireBareme(s.maxScore, `barème de ${s.name}`),
    }))
    // Ligne de la matière : la seule ligne d'une matière sans sous-matière ;
    // sinon, ligne globale en fin de groupe dès qu'une étape RETENUE porte une
    // note au niveau de la matière entière (Q-A).
    // K2 : seules comptent les étapes retenues ET non dispensées pour l'élève
    // (ni dispense d'étape, ni dispense de la matière entière sur l'étape).
    const hasGlobalNote = steps.some(
      (step) =>
        included.has(step.id) &&
        !exemptedSteps.has(step.id) &&
        !exclusionsFor.get(step.id)!.has(exclusionKey(enrollmentId, cs.id, null)) &&
        (params.gradesByStep.get(step.id) ?? []).some((g) => g.classSubjectId === cs.id && g.sectionId == null),
    )
    const subjectLine: LineDef | null =
      sectionLines.length === 0 || hasGlobalNote
        ? { label: name, sectionId: null, bareme: requireBareme(cs.maxScoreOverride ?? cs.subject.maxScore, `barème de ${name}`) }
        : null
    const lines = subjectLine ? [...sectionLines, subjectLine] : sectionLines

    // values[étape][ligne]
    const values = steps.map((step) =>
      !included.has(step.id) || exemptedSteps.has(step.id)
        ? lines.map(() => null)
        : stepValues(cs, sectionLines, subjectLine, params.gradesByStep.get(step.id) ?? [], exclusionsFor.get(step.id)!, enrollmentId),
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
          average: averageCellFor(cells, line.bareme),
        }
      }),
    }
  })
}

// ── Discipline (R-REL-5) ────────────────────────────────────────────────────

/**
 * Pas de dispenses d'étape ici : elles ne s'appliquent PAS à la discipline
 * (R-REL-5, Q-B) — les fiches de toutes les étapes retenues sont comptées.
 */
export interface DisciplineInput {
  steps: ApiStepRow[]
  included: ReadonlySet<string>
  /** Fiche de l'étape ; null = pas de fiche (404). Chaque étape retenue doit y figurer (K4). */
  behaviorsByStep: ReadonlyMap<string, ApiBehaviorRow | null>
}

const DISCIPLINE_LINES: Array<{ field: keyof ApiBehaviorRow; label: string; mode: 'total' | 'moyenne' }> = [
  { field: 'retards', label: 'Nbre de retards', mode: 'total' },
  { field: 'absences', label: 'Nbre d\'absences', mode: 'total' },
  { field: 'devoirsManques', label: 'Nbre de devoirs non remis', mode: 'total' },
  { field: 'leconsNonSues', label: 'Nbre de leçons non sues', mode: 'total' },
  { field: 'respectUniforme', label: 'Respect des prescrits de l\'uniforme', mode: 'moyenne' },
]

/**
 * Compteurs = total des étapes renseignées, entiers ; uniforme = moyenne, et
 * cellules comme moyenne sur 2 décimales (« 8.00 ») ; aucune couleur.
 */
export function buildDisciplineGroup(params: DisciplineInput): ReleveGroup {
  const { steps, included, behaviorsByStep } = params
  return {
    title: DISCIPLINE_TITLE,
    kind: 'discipline',
    lines: DISCIPLINE_LINES.map(({ field, label, mode }): ReleveLine => {
      const values = steps.map((step) => {
        if (!included.has(step.id)) return null
        // K4 : null = fiche absente (404) ; clé absente = étape non lue → refus.
        if (!behaviorsByStep.has(step.id)) throw new ReleveUnavailableError('indisponible')
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
        cells: values.map((v) => ({
          text: v === null ? TIRET : mode === 'total' ? v.toString() : formatNumber(v),
          band: null,
        })),
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
