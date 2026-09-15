/**
 * Calcul du bulletin CPMSL.
 *
 * Reference : docs/CALCUL-BULLETIN.md — regle arbitree par la MOA le 2026-09-09.
 * Ce module fait autorite. La ou une autre implementation diverge, c'est elle
 * qui est fausse.
 *
 * Fonctions pures. AUCUNE dependance React ni DOM : c'est la condition pour
 * deplacer ce module vers le backend sans le reecrire.
 */

import Decimal from 'decimal.js'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type RubriqueCode = 'R1' | 'R2' | 'R3'

/** Etat d'affichage d'une ligne. Pilote directement le gabarit du bulletin. */
export type EntryState =
  | 'noted'      // note presente        -> note affichee, bareme affiche
  | 'missing'    // aucune note saisie   -> trait sur la note, bareme affiche
  | 'exempted'   // eleve dispense       -> trait sur la note ET sur le bareme

/**
 * Mode de notation d'une matiere pour une etape donnee.
 *
 *  'sections' : la note de la matiere est la somme de ses sous-matieres.
 *               C'est le fonctionnement normal a Saint-Leonard : le francais
 *               est decoupe en vocabulaire, orthographe, grammaire, lecture.
 *
 *  'global'   : la note est portee directement par la matiere, les
 *               sous-matieres sont ignorees. Cas des classes d'examen
 *               (9e, NS4) qui passent un examen en blanc en fin d'annee.
 *
 * Le mode est declare par periode, jamais melange. Une matiere qui porte a la
 * fois une note globale et des notes de sous-matieres sur la meme etape est
 * dans un etat invalide : computeSubject le signale au lieu de trancher.
 */
export type GradingMode = 'sections' | 'global'

export interface SectionInput {
  sectionId: string
  name: string
  /** Bareme de la sous-matiere. */
  maxScore: Decimal
  /** Notes saisies. Plusieurs evaluations sont moyennees. Vide = manquante. */
  scores: Decimal[]
  /** Ligne dans enrollment_section_exclusions pour cette sous-matiere. */
  exempted: boolean
}

export interface SubjectInput {
  classSubjectId: string
  name: string
  rubrique: RubriqueCode
  /** subjects.max_score */
  maxScore: Decimal
  /** class_subjects.max_score_override — prime sur maxScore quand il est pose. */
  maxScoreOverride?: Decimal | null
  sections: SectionInput[]
  /** Notes portees directement par la matiere (grades.section_id IS NULL). */
  globalScores: Decimal[]
  /** Dispense au niveau matiere entiere (exclusion a section_id NULL). */
  exempted: boolean
}

export interface SectionOutput {
  sectionId: string
  name: string
  maxScore: Decimal
  /** Moyenne des evaluations, ou null si manquante ou dispensee. */
  score: Decimal | null
  state: EntryState
}

export interface SubjectOutput {
  classSubjectId: string
  name: string
  rubrique: RubriqueCode
  mode: GradingMode
  /** Contribution au numerateur de la rubrique. Zero si manquante. */
  numerator: Decimal
  /** Contribution au denominateur. Zero si dispensee. */
  denominator: Decimal
  /**
   * Moyenne de la matiere ramenee sur DISPLAY_SCALE, ou null si le
   * denominateur est nul (matiere entierement dispensee).
   * C'est CETTE valeur qui est transmise au MENFP : une note par matiere,
   * jamais les notes de sous-matieres.
   */
  average: Decimal | null
  state: EntryState
  sections: SectionOutput[]
  /** Incoherences detectees. Vide si tout va bien. */
  warnings: string[]
}

export interface RubriqueResult {
  code: RubriqueCode
  numerator: Decimal
  denominator: Decimal
  /** (numerateur / denominateur) x 10, ou null si denominateur nul. */
  average: Decimal | null
  subjects: SubjectOutput[]
  warnings: string[]
}

export interface StepResult {
  r1: RubriqueResult
  r2: RubriqueResult
  r3: RubriqueResult
  /** R1 x 0,70 + R2 x 0,25 + R3 x 0,05. Une rubrique sans moyenne compte 0. */
  average: Decimal
  passing: boolean
  warnings: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de la regle
// ─────────────────────────────────────────────────────────────────────────────

/** BR-001 — ponderation des rubriques. Chaines, jamais de litteraux flottants. */
export const RUBRIQUE_WEIGHTS: Record<RubriqueCode, Decimal> = {
  R1: new Decimal('0.70'),
  R2: new Decimal('0.25'),
  R3: new Decimal('0.05'),
}

/** BR-002 — seuil de reussite. */
export const PASSING_THRESHOLD = new Decimal('7.00')

/** Echelle d'affichage des moyennes. */
export const DISPLAY_SCALE = new Decimal('10')

/** DR-004 — pas de saisie des notes. */
export const GRADE_STEP = new Decimal('0.25')

const ZERO = new Decimal(0)

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Moyenne arithmetique des evaluations d'une meme sous-matiere. */
function meanOf(scores: Decimal[]): Decimal | null {
  if (scores.length === 0) return null
  const sum = scores.reduce<Decimal>((acc, s) => acc.plus(s), ZERO)
  return sum.dividedBy(scores.length)
}

/** (numerateur / denominateur) x 10, ou null si le denominateur est nul. */
function toScale(numerator: Decimal, denominator: Decimal): Decimal | null {
  if (denominator.isZero()) return null
  return numerator.dividedBy(denominator).times(DISPLAY_SCALE)
}

/** Bareme effectif d'une matiere : l'override de la classe prime. */
export function effectiveMaxScore(subject: SubjectInput): Decimal {
  return subject.maxScoreOverride ?? subject.maxScore
}

/**
 * Recupere de lib/bulletin-subject-entries.ts (module mort), ou il etait le
 * seul garde-fou du calcul. Detecte qu'une matiere declaree /60 a des
 * sous-matieres totalisant /80 : le denominateur du calcul devient douteux.
 */
export function checkMaxScoreCoherence(
  subjectMax: Decimal,
  sectionsMax: Decimal,
): string | undefined {
  if (subjectMax.lte(0)) return `Bareme de la matiere invalide : /${subjectMax}`
  if (sectionsMax.lte(0)) return `Somme des baremes de sous-matieres nulle`
  if (subjectMax.equals(sectionsMax)) return undefined
  return `Bareme a verifier : matiere /${subjectMax}, sous-matieres /${sectionsMax}`
}

/** DR-004 — une note doit etre un multiple de 0,25 et tenir dans le bareme. */
export function isValidGrade(score: Decimal, maxScore: Decimal): boolean {
  if (score.isNegative()) return false
  if (score.greaterThan(maxScore)) return false
  return score.dividedBy(GRADE_STEP).isInteger()
}

/**
 * Determine le mode de notation d'une matiere pour une etape.
 * Le mode est declare par periode et ne se melange pas : la presence
 * simultanee de notes globales et de notes de sous-matieres est un etat
 * invalide, signale et non tranche en silence.
 */
export function detectMode(subject: SubjectInput): {
  mode: GradingMode
  warning?: string
} {
  const hasGlobal = subject.globalScores.length > 0
  const hasSectionScores = subject.sections.some((s) => s.scores.length > 0)

  if (hasGlobal && hasSectionScores) {
    return {
      mode: 'sections',
      warning:
        `${subject.name} : notes globales ET notes de sous-matieres sur la meme ` +
        `etape. Les deux modes ne se melangent pas — saisie a corriger.`,
    }
  }
  if (hasGlobal) return { mode: 'global' }
  if (subject.sections.length > 0) return { mode: 'sections' }
  return { mode: 'global' }
}

// ─────────────────────────────────────────────────────────────────────────────
// Niveau 1 — la matiere
// ─────────────────────────────────────────────────────────────────────────────

export function computeSubject(subject: SubjectInput): SubjectOutput {
  const warnings: string[] = []
  const { mode, warning } = detectMode(subject)
  if (warning) warnings.push(warning)

  const maxScore = effectiveMaxScore(subject)

  // ── Dispense de la matiere entiere : sort du numerateur ET du denominateur
  if (subject.exempted) {
    return {
      classSubjectId: subject.classSubjectId,
      name: subject.name,
      rubrique: subject.rubrique,
      mode,
      numerator: ZERO,
      denominator: ZERO,
      average: null,
      state: 'exempted',
      sections: subject.sections.map((s) => ({
        sectionId: s.sectionId,
        name: s.name,
        maxScore: s.maxScore,
        score: null,
        state: 'exempted' as EntryState,
      })),
      warnings,
    }
  }

  // ── Mode global : la note porte sur le bareme de la matiere
  if (mode === 'global') {
    const score = meanOf(subject.globalScores)
    return {
      classSubjectId: subject.classSubjectId,
      name: subject.name,
      rubrique: subject.rubrique,
      mode,
      numerator: score ?? ZERO,
      denominator: maxScore,
      average: toScale(score ?? ZERO, maxScore),
      state: score === null ? 'missing' : 'noted',
      sections: [],
      warnings,
    }
  }

  // ── Mode sections : la matiere est la somme de ses sous-matieres
  const sections: SectionOutput[] = []
  let numerator = ZERO
  let denominator = ZERO
  let declaredSectionsMax = ZERO

  for (const s of subject.sections) {
    declaredSectionsMax = declaredSectionsMax.plus(s.maxScore)

    if (s.exempted) {
      sections.push({
        sectionId: s.sectionId,
        name: s.name,
        maxScore: s.maxScore,
        score: null,
        state: 'exempted',
      })
      continue // ni numerateur ni denominateur
    }

    const score = meanOf(s.scores)
    denominator = denominator.plus(s.maxScore) // le bareme reste, meme manquante
    if (score !== null) numerator = numerator.plus(score)

    sections.push({
      sectionId: s.sectionId,
      name: s.name,
      maxScore: s.maxScore,
      score,
      state: score === null ? 'missing' : 'noted',
    })
  }

  const coherence = checkMaxScoreCoherence(maxScore, declaredSectionsMax)
  if (coherence) warnings.push(`${subject.name} — ${coherence}`)

  const anyNoted = sections.some((s) => s.state === 'noted')
  const allExempted =
    subject.sections.length > 0 && sections.every((s) => s.state === 'exempted')

  return {
    classSubjectId: subject.classSubjectId,
    name: subject.name,
    rubrique: subject.rubrique,
    mode,
    numerator,
    denominator,
    average: toScale(numerator, denominator),
    state: allExempted ? 'exempted' : anyNoted ? 'noted' : 'missing',
    sections,
    warnings,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Niveau 2 — la rubrique
// ─────────────────────────────────────────────────────────────────────────────

export function computeRubrique(
  code: RubriqueCode,
  subjects: SubjectInput[],
): RubriqueResult {
  const outputs = subjects
    .filter((s) => s.rubrique === code)
    .map(computeSubject)

  const numerator = outputs.reduce<Decimal>((a, o) => a.plus(o.numerator), ZERO)
  const denominator = outputs.reduce<Decimal>((a, o) => a.plus(o.denominator), ZERO)

  const average = toScale(numerator, denominator)

  return {
    code,
    numerator,
    denominator,
    average,
    subjects: outputs,
    warnings: outputs.flatMap((o) => o.warnings),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Niveau 3 — l'etape
// ─────────────────────────────────────────────────────────────────────────────

/**
 * BR-001. Une rubrique sans denominateur exploitable compte ZERO.
 * AUCUNE RENORMALISATION DES POIDS. Jamais.
 */
export function computeStepAverage(
  r1: RubriqueResult,
  r2: RubriqueResult,
  r3: RubriqueResult,
): Decimal {
  const contrib = (r: RubriqueResult) =>
    (r.average ?? ZERO).times(RUBRIQUE_WEIGHTS[r.code])

  return contrib(r1).plus(contrib(r2)).plus(contrib(r3))
}

/** BR-002 — Reussi si la moyenne est superieure ou egale a 7,00. */
export function isPassing(stepAverage: Decimal): boolean {
  return stepAverage.gte(PASSING_THRESHOLD)
}

export function computeStep(subjects: SubjectInput[]): StepResult {
  const r1 = computeRubrique('R1', subjects)
  const r2 = computeRubrique('R2', subjects)
  const r3 = computeRubrique('R3', subjects)
  const average = computeStepAverage(r1, r2, r3)

  return {
    r1,
    r2,
    r3,
    average,
    passing: isPassing(average),
    warnings: [...r1.warnings, ...r2.warnings, ...r3.warnings],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Affichage
// ─────────────────────────────────────────────────────────────────────────────

/** Arrondi a l'affichage uniquement. Le calcul reste en Decimal. */
export function formatAverage(value: Decimal | null, decimals = 2): string {
  if (value === null) return '—'
  return value.toFixed(decimals)
}

/**
 * Colonne « note » du gabarit. Trait pour manquante ET dispensee.
 *
 * `decimals` n'a PAS de valeur par defaut imposee au gabarit : le bulletin
 * imprime 2 decimales, le rapport de classe 1. Le branchement doit conserver
 * le format existant de chaque document — le design ne se modifie pas.
 */
export function formatScore(
  entry: SectionOutput | SubjectOutput,
  decimals = 2,
): string {
  if (entry.state !== 'noted') return '—'
  const score = 'score' in entry ? entry.score : entry.numerator
  return score === null ? '—' : score.toFixed(decimals)
}

/** Colonne « ponderation » du gabarit. Trait uniquement pour dispensee. */
export function formatMaxScore(
  entry: SectionOutput | SubjectOutput,
  decimals = 0,
): string {
  if (entry.state === 'exempted') return '—'
  const max = 'maxScore' in entry ? entry.maxScore : entry.denominator
  return max.toFixed(decimals)
}

/**
 * Valeur a placer dans la colonne « ponderation » d'un gabarit qui rend
 * `{entry.coeff ?? ''}`. Renvoie la chaine deja formatee, trait compris, de
 * sorte que le composant d'affichage n'ait PAS a etre modifie.
 */
export function coeffCellValue(
  entry: SectionOutput | SubjectOutput,
  decimals = 0,
): string {
  return formatMaxScore(entry, decimals)
}

// ─────────────────────────────────────────────────────────────────────────────
// Moyennes d'agregation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * BR-002 — moyenne generale = moyenne ARITHMETIQUE des moyennes d'etapes.
 * Le SRS dit « moyenne des moyennes d'etapes » : aucune ponderation entre
 * etapes.
 */
export function computeGeneralAverage(stepAverages: Decimal[]): Decimal | null {
  if (stepAverages.length === 0) return null
  const sum = stepAverages.reduce<Decimal>((a, v) => a.plus(v), ZERO)
  return sum.dividedBy(stepAverages.length)
}

/**
 * Moyenne de classe sur une matiere.
 *
 * Regle arbitree par Edy le 2026-09-12 : les eleves DISPENSES sont exclus du
 * calcul. Sur 30 eleves dont 3 dispenses, la moyenne porte sur 27.
 *
 * Le filtre est `average === null`, qui vaut exactement « denominateur nul »,
 * donc exactement « dispense ». Un eleve dont la note manque a une moyenne de
 * 0 et reste compte — coherent avec la regle des notes manquantes.
 */
export function computeClassAverage(
  entries: { average: Decimal | null }[],
): Decimal | null {
  const usable = entries.filter((e) => e.average !== null)
  if (usable.length === 0) return null
  const sum = usable.reduce<Decimal>((a, e) => a.plus(e.average as Decimal), ZERO)
  return sum.dividedBy(usable.length)
}