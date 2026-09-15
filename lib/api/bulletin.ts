// lib/api/bulletin.ts
// Logique partagée de construction des données bulletin (individuel + lot)
// IMPORTANT : ce fichier ne contient aucun JSX — extension .ts correcte
import { clientFetch as apiFetch } from '@/lib/client-fetch'
import {
  fetchClassSubjects,
  filterSubjectsByScope,
  type ApiClassSubject,
  type ApiGrade,
} from "@/lib/api/grades"
import { fetchSteps } from "@/lib/api/dashboard"
import { parseDecimal } from "@/lib/decimal"
import { formatFrenchLongDate } from "@/lib/date-format"
import type { BulletinData, RubriqueEntry, ComportementItem } from "@/components/BulletinScolaire"
import {
  calculateBulletinAverages,
  calculateClassAverages,
  formatBulletinNumber,
  normalizeBulletinLevel,
  normalizeRubriqueLabel,
  type BulletinClassAverages,
} from "@/lib/bulletin-calculations"
import { toSubjectInputs, WHOLE_SUBJECT } from "@/lib/bulletin/from-api"
import type { SubjectInput } from "@/lib/bulletin/compute"

// ── Types internes ────────────────────────────────────────────────────────────

type GradeBucket = { direct: number[]; sections: Map<string, number[]> }
type GradeIndex  = Map<string, GradeBucket>

type RubriqueSet = {
  r1: RubriqueEntry[]; r1Name: string
  r2: RubriqueEntry[]; r2Name: string
  r3: RubriqueEntry[]; r3Name: string
}

type SchoolInfoPayload = {
  name?: string | null
  nom?: string | null
  schoolName?: string | null
  address?: string | null
  adresse?: string | null
  phone?: string | null
  telephone?: string | null
  email?: string | null
  logo?: string | null
  logoUrl?: string | null
}

type PromotionPhotoPayload = {
  academicYearId?: string | null
  studentId?: string | null
  photoUrl?: string | null
}

type EnrollmentForClassAverage = {
  id: string
  trackId?: string | null
}

type StudentPayload = {
  user?: {
    firstname?: string | null
    lastname?: string | null
    gender?: string | null
    birth_date?: string | null
    birthDate?: string | null
    profilePhoto?: string | null
  } | null
  filiere?: string | null
  studentCode?: string | null
  nisu?: string | null
}

type AcademicYearPayload = {
  yearString?: string | null
  name?: string | null
}

type EnrollmentContextPayload = {
  trackId?: string | null
  track?: { id: string; code: string; name: string } | null
  classSession?: {
    academicYear?: AcademicYearPayload | null
  } | null
}

/**
 * Portée d'un bulletin :
 *   'common' → bulletin NORMAL (matières du tronc commun uniquement)
 *   'exam'   → bulletin EXAMEN OFFICIEL (matières de la filière de l'élève)
 * Deux documents distincts, deux moyennes indépendantes.
 */
export type BulletinScope = 'common' | 'exam'

type BehaviorPayload = {
  attitudeResponses?: Array<{
    attitudeId?: string | null
    value?: unknown
  }>

  // Champs historiques déjà lus depuis la table student_behaviors
  absences?: unknown
  retards?: unknown
  devoirsManques?: unknown

  // Nouveaux champs numériques — mêmes conventions que les champs ci-dessus.
  // Le backend Prisma les renvoie normalement en camelCase. Les variantes
  // snake_case sont acceptées plus bas pour garder une tolérance si une route
  // renvoie un payload brut SQL ou ancien.
  leconsNonSues?: unknown
  respectUniforme?: unknown
  discipline?: unknown

  pointsForts?: string | null
  defis?: string | null
  remarque?: string | null
}

type AttitudePayload = {
  id: string
  label: string
}

const classAveragesCache = new Map<string, Promise<BulletinClassAverages>>()

// ── Helpers math ──────────────────────────────────────────────────────────────

function avg(arr: number[]): number | null {
  return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null
}

async function safeFetch<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) return fallback
    return res.json()
  } catch {
    return fallback
  }
}

function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key]
    }
    return undefined
  }, source)
}

function firstString(source: unknown, paths: string[]): string {
  for (const path of paths) {
    const value = readPath(source, path)
    if (value === null || value === undefined || value === '') continue
    return String(value)
  }
  return '—'
}

function normalizeYearRange(value: string | null | undefined): string | null {
  if (!value) return null
  const match = value.trim().match(/(\d{4})\s*[-\u2013\u2014/]\s*(\d{4})/)
  return match ? `${match[1]}-${match[2]}` : null
}

function resolveAcademicYearLabel(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    if (!candidate) continue

    const normalized = normalizeYearRange(candidate)
    if (normalized) return normalized

    const trimmed = candidate.trim()
    if (trimmed && trimmed !== '\u2014') return trimmed
  }

  return '\u2014'
}

// ── Normalisation behavior / attitudes ────────────────────────────────────────

function normalizeBehavior(raw: unknown): BehaviorPayload | null {
  const value = Array.isArray(raw) ? raw[0] ?? null : raw
  return value && typeof value === 'object' ? value as BehaviorPayload : null
}

function normalizeAttitudes(raw: unknown): AttitudePayload[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((attitude) => {
    if (!attitude || typeof attitude !== 'object') return []
    const record = attitude as Record<string, unknown>
    if (typeof record.id !== 'string' || typeof record.label !== 'string') return []
    return [{ id: record.id, label: record.label }]
  })
}

// ── Indexation des notes ──────────────────────────────────────────────────────

function addScoreToIndex(index: GradeIndex, grade: ApiGrade, score: number): void {
  if (!index.has(grade.classSubjectId)) {
    index.set(grade.classSubjectId, { direct: [], sections: new Map() })
  }
  const bucket = index.get(grade.classSubjectId)!
  if (grade.sectionId) {
    if (!bucket.sections.has(grade.sectionId)) bucket.sections.set(grade.sectionId, [])
    bucket.sections.get(grade.sectionId)!.push(score)
  } else {
    bucket.direct.push(score)
  }
}

function buildGradeIndex(allGrades: ApiGrade[]): GradeIndex {
  const index: GradeIndex = new Map()
  for (const grade of allGrades) {
    const score = parseDecimal(grade.studentScore)
    if (score !== null) addScoreToIndex(index, grade, score)
  }
  return index
}

// ── Construction des rubriques ────────────────────────────────────────────────

/**
 * Rubriques déclarées par les matières de la salle : id -> code.
 * Évite un appel à /api/subject-rubrics, l'information est déjà dans la
 * réponse de fetchClassSubjects.
 */
function rubricCodeIndex(classSubjects: ApiClassSubject[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const cs of classSubjects) {
    const rubric = cs.subject.rubric
    if (rubric?.id && rubric.code) map[rubric.id] = rubric.code
  }
  return map
}

/**
 * Passe des clés de dispense LOCALES (`classSubjectId::sectionId`, l'élève
 * étant porté par la Map) aux clés de lib/bulletin/from-api, qui sont à trois
 * parties. Les deux schémas partagent la sentinelle WHOLE_SUBJECT, importée
 * plus haut : le préfixage est donc exact, pas une coïncidence de format.
 */
function toComputeExclusions(
  enrollmentId: string,
  localKeys: Set<string> | undefined,
): Set<string> {
  const set = new Set<string>()
  if (!localKeys) return set
  for (const key of localKeys) set.add(`${enrollmentId}::${key}`)
  return set
}

/**
 * Entrées du MODULE DE CALCUL. Les RubriqueEntry construits par
 * buildSubjectEntries continuent d'alimenter le gabarit à l'identique ; ces
 * SubjectInput alimentent le calcul, et eux seuls.
 */
function buildSubjectInputs(
  classSubjects: ApiClassSubject[],
  grades: ApiGrade[],
  enrollmentId: string,
  localExclusionKeys: Set<string> | undefined,
): SubjectInput[] {
  return toSubjectInputs({
    classSubjects,
    grades,
    rubricCodeById: rubricCodeIndex(classSubjects),
    enrollmentId,
    exclusions: toComputeExclusions(enrollmentId, localExclusionKeys),
  }).subjects
}

function buildSubjectEntries(
  cs: ApiClassSubject,
  bucket: GradeBucket | undefined,
  excludedKeys?: Set<string>,
): RubriqueEntry[] {
  const subject = cs.subject
  // Note max effective : l'override de l'affectation (ex: /80 en SVT) prime sur
  // la note max de la matière (ex: /100). Concerne les matières SANS sections
  // (pour les matières à sous-matières, ce sont les notes max des sections qui
  // pilotent le total).
  // fetchClassSubjects a déjà normalisé ces deux valeurs en nombre : aucune
  // seconde conversion n'est nécessaire ici.
  const subjectMax = cs.maxScoreOverride != null ? cs.maxScoreOverride : subject.maxScore

  // Dispense de la matière entière (sectionId null en base) : la matière sort
  // du numérateur ET du dénominateur.
  if (excludedKeys?.has(exclusionKey(cs.id, null))) return []

  // Sections dispensées pour cette étape : la clé porte désormais
  // classSubjectId, de sorte qu'une dispense sur le tronc commun n'affecte pas
  // l'affectation de filière, et inversement. Elles sont totalement retirées
  // (ni au numérateur, ni au dénominateur) → elles ne contribuent pas à la
  // moyenne de CETTE étape uniquement.
  const activeSections = subject.sections.filter(
    (sec) => !excludedKeys?.has(exclusionKey(cs.id, sec.id)),
  )

  // TOUTES les sous-matières dispensées : la matière est entièrement dispensée.
  // Elle sort du bulletin comme une dispense de matière — son barème ne doit
  // apparaître NULLE PART, ni en ligne, ni dans le total imprimé. Sans cette
  // garde, le `coeff` désormais inconditionnel la ferait réapparaître au
  // dénominateur.
  if (subject.sections.length > 0 && activeSections.length === 0) return []

  // Le barème est TOUJOURS renseigné, note ou pas : règle MOA du 2026-09-09,
  // « note manquante → trait sur la note, BARÈME CONSERVÉ ». C'est ce coeff
  // qui fait que la ligne de total imprimée correspond à la moyenne imprimée.
  // Seule une dispense n'a pas de coeff — et elle n'a pas de ligne du tout.
  if (!subject.hasSections || activeSections.length === 0) {
    const note = avg(bucket?.direct ?? [])
    return [{ name: subject.name, note, coeff: subjectMax, isParent: false }]
  }

  const hasAnySectionGrade = activeSections.some(
    (sec) => (bucket?.sections.get(sec.id)?.length ?? 0) > 0,
  )
  if (!hasAnySectionGrade) {
    const note = avg(bucket?.direct ?? [])
    return [{ name: subject.name, note, coeff: subjectMax, isParent: false }]
  }

  const entries: RubriqueEntry[] = [{ name: subject.name, isParent: true }]
  for (const sec of activeSections) {
    const scores   = bucket?.sections.get(sec.id) ?? []
    const maxScore = sec.maxScore
    const note     = avg(scores)
    entries.push({
      name:     sec.name,
      note,
      coeff:    maxScore,
      isParent: false,
    })
  }
  return entries
}

function pushToRubrique(set: RubriqueSet, code: string, entries: RubriqueEntry[]): void {
  if (code === 'R1')      set.r1.push(...entries)
  else if (code === 'R2') set.r2.push(...entries)
  else if (code === 'R3') set.r3.push(...entries)
}

function buildRubriques(
  classSubjects: ApiClassSubject[],
  gradeIndex: GradeIndex,
  excludedKeys?: Set<string>,
): RubriqueSet {
  const set: RubriqueSet = {
    r1: [], r1Name: normalizeRubriqueLabel(1),
    r2: [], r2Name: normalizeRubriqueLabel(2),
    r3: [], r3Name: normalizeRubriqueLabel(3),
  }
  for (const cs of classSubjects) {
    const { rubric } = cs.subject
    const code = rubric?.code ?? ''
    const entries = buildSubjectEntries(cs, gradeIndex.get(cs.id), excludedKeys)
    pushToRubrique(set, code, entries)
  }
  return set
}

// ── Dispenses (exclusions) par étape ────────────────────────────────────────
// Une dispense est scopée par (élève + matière + section + étape). L'étape est
// portée par la requête ; les trois autres parties par la clé ci-dessous.
//
// La clé DOIT inclure classSubjectId : une même matière peut être affectée deux
// fois à une session — tronc commun (trackId null) et examen de filière — via
// @@unique([classSessionId, subjectId, trackId]). Les deux affectations
// partagent le même subject, donc les mêmes sectionId. Une clé réduite à
// (enrollmentId, sectionId) dispensait l'élève sur les DEUX affectations.
//
// sectionId null = dispense de la matière entière, symétrique de
// grades.section_id IS NULL qui signifie « note globale » (classes d'examen
// 9e et NS4, qui notent directement la matière sans sous-matières).
// WHOLE_SUBJECT est importé de lib/bulletin/from-api : une seule sentinelle
// pour les deux schémas de clé, celui d'ici et celui du module de calcul.

function exclusionKey(classSubjectId: string, sectionId: string | null): string {
  return `${classSubjectId}::${sectionId ?? WHOLE_SUBJECT}`
}

type SessionStepExclusions = Map<string, Set<string>> // enrollmentId -> Set<clé>

const exclusionsCache = new Map<string, Promise<SessionStepExclusions>>()

/** À appeler après l'enregistrement ou la suppression d'une dispense. */
export function invalidateExclusionsCache(classSessionId?: string, stepId?: string): void {
  if (!classSessionId) { exclusionsCache.clear(); return }
  if (stepId) { exclusionsCache.delete(`${classSessionId}:${stepId}`); return }
  for (const k of exclusionsCache.keys()) {
    if (k.startsWith(`${classSessionId}:`)) exclusionsCache.delete(k)
  }
}

function fetchSessionStepExclusions(
  classSessionId: string,
  stepId: string,
): Promise<SessionStepExclusions> {
  const cacheKey = `${classSessionId}:${stepId}`
  const cached = exclusionsCache.get(cacheKey)
  if (cached) return cached

  const promise = (async () => {
    // Le backend renvoie les QUATRE parties de la clé. Le type les déclare
    // toutes : en n'en déclarant que deux, classSubjectId arrivait et était
    // silencieusement jeté.
    const rows = await safeFetch<
      Array<{
        enrollmentId: string
        classSubjectId: string
        sectionId: string | null
        stepId?: string
      }>
    >(
      `/api/enrollments/excluded-sections?classSessionId=${classSessionId}&stepId=${stepId}`,
      [],
    )
    const map: SessionStepExclusions = new Map()
    for (const row of rows) {
      // Une dispense sans portee ne peut pas etre appliquee : sans
      // classSubjectId on ne sait pas SUR QUELLE affectation elle porte.
      // Signale au lieu d'absorber en silence.
      if (!row.classSubjectId) {
        console.warn(
          `[dispenses] ligne ignoree : classSubjectId absent (eleve ${row.enrollmentId}, ` +
          `section ${row.sectionId}). Dispense sans portee dans ` +
          `enrollment_section_exclusions.`,
        )
        continue
      }
      if (!map.has(row.enrollmentId)) map.set(row.enrollmentId, new Set())
      map.get(row.enrollmentId)!.add(exclusionKey(row.classSubjectId, row.sectionId))
    }
    return map
  })()

  exclusionsCache.set(cacheKey, promise)
  return promise
}

async function getClassAverages(params: {
  classSessionId: string
  stepId: string
  /**
   * TOUTES les matières de la salle, NON filtrées : chaque élève est évalué sur
   * SES propres matières (tronc commun, ou celles de SA filière — qui ont leurs
   * propres coefficients / notes max).
   */
  classSubjects: ApiClassSubject[]
  scope: BulletinScope
}): Promise<BulletinClassAverages> {
  // La moyenne de classe couvre TOUTE la salle (ex. tout NS4 A) : elle ne se
  // sépare PAS par filière. Sur un bulletin d'examen, on n'exclut donc plus les
  // élèves des autres filières — sinon un élève seul dans sa filière obtenait
  // une « moyenne classe » égale à sa propre note. Chaque élève est simplement
  // évalué sur les matières de sa propre filière, puis on moyenne sur la salle.
  const cacheKey = `${params.classSessionId}:${params.stepId}:${params.scope}`
  const cached = classAveragesCache.get(cacheKey)
  if (cached) return cached

  const promise = (async () => {
    const [allEnrollments, exclusions] = await Promise.all([
      apiFetch<EnrollmentForClassAverage[]>(
        `/api/enrollments?classSessionId=${params.classSessionId}&status=ACTIVE`,
      ),
      fetchSessionStepExclusions(params.classSessionId, params.stepId),
    ])

    const averages = await Promise.all(
      allEnrollments.map(async (enrollment) => {
        try {
          // Matières propres à CET élève : le tronc commun est partagé, les
          // matières d'examen sont celles de SA filière.
          const subjects = filterSubjectsByScope(
            params.classSubjects,
            params.scope,
            enrollment.trackId,
          )
          if (subjects.length === 0) return null

          const grades = await apiFetch<ApiGrade[]>(
            `/api/grades/enrollment/${enrollment.id}?stepId=${params.stepId}`,
          )
          return calculateBulletinAverages(
            buildSubjectInputs(subjects, grades, enrollment.id, exclusions.get(enrollment.id)),
          )
        } catch {
          return null
        }
      }),
    )

    return calculateClassAverages(averages.filter((avg): avg is NonNullable<typeof avg> => avg !== null))
  })()

  classAveragesCache.set(cacheKey, promise)
  return promise
}


async function calculateGeneralAverageForEnrollment(params: {
  enrollmentId: string
  classSessionId: string
  academicYearId: string
  selectedStepId: string
  classSubjects: ApiClassSubject[]
}): Promise<number | null> {
  // Dispenses d'étape : une étape dont l'élève est dispensé est totalement
  // exclue de la moyenne générale (ni au numérateur, ni au dénominateur).
  const [steps, exemptionRows] = await Promise.all([
    fetchSteps(params.academicYearId),
    safeFetch<Array<{ stepId: string }>>(
      `/api/enrollments/${params.enrollmentId}/step-exemptions`,
      [],
    ),
  ])
  const exemptedStepIds = new Set(exemptionRows.map((r) => r.stepId))
  const selectedStep = steps.find((step) => step.id === params.selectedStepId)
  const selectedStepNumber = selectedStep?.stepNumber

  const eligibleSteps = steps
    .filter((step) => selectedStepNumber === undefined || step.stepNumber <= selectedStepNumber)
    .filter((step) => !exemptedStepIds.has(step.id))
    .sort((a, b) => a.stepNumber - b.stepNumber)

  if (eligibleSteps.length === 0) return null

  const averages = await Promise.all(
    eligibleSteps.map(async (step) => {
      try {
        // Dispenses propres à CETTE étape : elles n'affectent que la moyenne
        // de cette étape dans le calcul de la moyenne générale.
        const [grades, exclusions] = await Promise.all([
          apiFetch<ApiGrade[]>(
            `/api/grades/enrollment/${params.enrollmentId}?stepId=${step.id}`,
          ),
          fetchSessionStepExclusions(params.classSessionId, step.id),
        ])
        return calculateBulletinAverages(
          buildSubjectInputs(
            params.classSubjects,
            grades,
            params.enrollmentId,
            exclusions.get(params.enrollmentId),
          ),
        ).moyenneEtape
      } catch {
        return null
      }
    }),
  )

  const validAverages = averages.filter((average): average is number =>
    average !== null && Number.isFinite(average),
  )

  if (validAverages.length === 0) return null

  return validAverages.reduce((sum, average) => sum + average, 0) / validAverages.length
}

// ── Bloc comportement ─────────────────────────────────────────────────────────

function resolveAttitudeOui(behavior: BehaviorPayload | null, attitudeId: string): boolean | null {
  const response = behavior?.attitudeResponses?.find((r) => r.attitudeId === attitudeId)
  return typeof response?.value === 'boolean' ? response.value : null
}

const DEFAULT_BEHAVIOUR_ITEMS = [
  "Est Agité(e)", "Est distrait(e)", "Est rêveur(se)", "Est bagarreur(se)", "Est impertinent(e)",
  "Prends des initiatives", "Perturbe les autres", "A des conduites imprévisibles",
  "Se laisse mener par les autres", "Respecte les prescrits et le code de vie",
  "Coopère avec l'enseignant", "Termine ce qu'il / elle commence",
  "Demande une attention excessive de l'enseignant",
  "Se décourage facilement lorsqu'un effort est nécessaire",
]

type BehaviorExtraKey = 'LECONS_NON_SUES' | 'RESPECT_UNIFORME' | 'DISCIPLINE'
type BehaviorExtraMap = Record<BehaviorExtraKey, string>

const EMPTY_BEHAVIOR_EXTRAS: BehaviorExtraMap = {
  LECONS_NON_SUES: '',
  RESPECT_UNIFORME: '',
  DISCIPLINE: '',
}

function getBehaviorRecord(behavior: BehaviorPayload | null): Record<string, unknown> | null {
  return behavior && typeof behavior === 'object'
    ? behavior as Record<string, unknown>
    : null
}

function formatBehaviorValue(value: unknown): string | null {
  if (value === null || value === undefined) return null

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null
  }

  if (typeof value === 'bigint') return value.toString()

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }

  if (typeof value === 'object') {
    // Prisma Decimal peut parfois arriver sous forme d'objet selon le client.
    // Hors calcul : compteurs de comportement (absences, retards), entiers.
    const decimalValue = parseDecimal(value)
    return decimalValue !== null && Number.isFinite(decimalValue)
      ? String(decimalValue)
      : null
  }

  return null
}

function readBehaviorField(
  behavior: BehaviorPayload | null,
  paths: string[],
): string | null {
  const record = getBehaviorRecord(behavior)
  if (!record) return null

  for (const path of paths) {
    const value = path.includes('.') ? readPath(record, path) : record[path]
    const formatted = formatBehaviorValue(value)
    if (formatted !== null) return formatted
  }

  return null
}

function parseBehaviorExtrasFromRemark(remarque: string | null | undefined): {
  extras: BehaviorExtraMap
  cleanRemarque: string
} {
  const source = remarque ?? ''
  const markerPattern = /\[\[\s*(LECONS_NON_SUES|RESPECT_UNIFORME|DISCIPLINE)\s*=\s*([^\]]*)\]\]/gi
  const extras: BehaviorExtraMap = { ...EMPTY_BEHAVIOR_EXTRAS }

  let match: RegExpExecArray | null
  while ((match = markerPattern.exec(source)) !== null) {
    const key = match[1].toUpperCase() as BehaviorExtraKey
    const value = match[2].trim()
    if (!extras[key] && value) extras[key] = value
  }

  const cleanRemarque = source
    .replace(markerPattern, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line, index, lines) => line.trim() !== '' || (index > 0 && index < lines.length - 1))
    .join('\n')
    .trim()

  return { extras, cleanRemarque }
}

function buildComportementItems(attitudes: AttitudePayload[], behavior: BehaviorPayload | null): ComportementItem[] {
  const source = attitudes.length > 0
    ? attitudes.map((att) => ({ id: att.id, label: att.label }))
    : DEFAULT_BEHAVIOUR_ITEMS.map((label, i) => ({ id: `default-${i}`, label }))
  const perCol = Math.max(1, Math.ceil(source.length / 3))
  return source.map((att, i) => ({
    label: att.label,
    oui:   resolveAttitudeOui(behavior, att.id),
    col:   Math.min(3, Math.floor(i / perCol) + 1) as 1 | 2 | 3,
  }))
}

function buildComportement(behavior: BehaviorPayload | null, attitudes: AttitudePayload[]) {
  const { extras, cleanRemarque } = parseBehaviorExtrasFromRemark(behavior?.remarque)

  // Même logique que les champs déjà pris en base : on lit d'abord la colonne
  // retournée par /api/behaviors, puis seulement en dernier recours les anciens
  // marqueurs qui avaient été stockés temporairement dans remarque.
  const absences = readBehaviorField(behavior, ['absences']) ?? '—'
  const retards = readBehaviorField(behavior, ['retards']) ?? '—'
  const devoirsNonRemis = readBehaviorField(behavior, ['devoirsManques', 'devoirs_manques']) ?? '—'
  const leconsNonSues = readBehaviorField(behavior, ['leconsNonSues', 'lecons_non_sues'])
    ?? formatBehaviorValue(extras.LECONS_NON_SUES)
    ?? '—'
  const uniforme = readBehaviorField(behavior, ['respectUniforme', 'respect_uniforme', 'uniforme'])
    ?? formatBehaviorValue(extras.RESPECT_UNIFORME)
    ?? '—'
  const discipline = readBehaviorField(behavior, ['discipline'])
    ?? formatBehaviorValue(extras.DISCIPLINE)
    ?? '—'

  return {
    absences,
    retards,
    devoirsNonRemis,
    leconsNonSues,
    uniforme,
    discipline,
    items:       buildComportementItems(attitudes, behavior),
    pointsForts: behavior?.pointsForts ?? '',
    defis:       behavior?.defis        ?? '',
    remarque:    cleanRemarque,
  }
}

// ── Fonction principale ───────────────────────────────────────────────────────

export async function buildBulletinData(params: {
  enrollmentId:            string
  studentId:               string
  classSessionId:          string
  stepId:                  string
  stepName:                string
  className:               string
  yearId:                  string
  academicYearLabel?:      string | null
  includeGeneralAverage?:  boolean
  /** 'common' = bulletin normal (défaut) ; 'exam' = bulletin examen officiel */
  scope?:                  BulletinScope
}): Promise<BulletinData> {
  const {
    enrollmentId,
    studentId,
    classSessionId,
    stepId,
    stepName,
    className,
    yearId,
    academicYearLabel,
    includeGeneralAverage = false,
    scope = 'common',
  } = params

  // 1. Fetch toutes les données en parallèle
  const [
    student,
    classSubjects,
    allGrades,
    behaviorRaw,
    attitudesRaw,
    schoolInfo,
    promotionPhotos,
    enrollmentContext,
    academicYear,
    stepExclusions,
  ] = await Promise.all([
    apiFetch<StudentPayload>(`/api/students/${studentId}`),
    fetchClassSubjects(classSessionId),
    apiFetch<ApiGrade[]>(`/api/grades/enrollment/${enrollmentId}?stepId=${stepId}`),
    safeFetch<unknown>(`/api/behaviors?enrollmentId=${enrollmentId}&stepId=${stepId}`, null),
    safeFetch<unknown>(`/api/attitudes?academicYearId=${yearId}`, []),
    safeFetch<SchoolInfoPayload | null>('/api/school-info', null),
    safeFetch<PromotionPhotoPayload[]>(`/api/promotion-photos?studentId=${studentId}`, []),
    safeFetch<EnrollmentContextPayload | null>(`/api/enrollments/${enrollmentId}`, null),
    safeFetch<AcademicYearPayload | null>(`/api/academic-years/${yearId}`, null),
    fetchSessionStepExclusions(classSessionId, stepId),
  ])

  // 2. Normaliser
  const behavior  = normalizeBehavior(behaviorRaw)
  const attitudes = normalizeAttitudes(attitudesRaw)

  // 3. Index des notes
  const gradeIndex = buildGradeIndex(allGrades)

  // 3bis. Portée filière — le bulletin normal ne contient que le tronc commun ;
  // le bulletin d'examen officiel, uniquement les matières de LA filière de
  // l'élève (jamais celles d'une autre filière).
  const studentTrackId = enrollmentContext?.trackId ?? null
  const scopedClassSubjects = filterSubjectsByScope(classSubjects, scope, studentTrackId)

  // 4. Rubriques — les sections dispensées pour cette étape sont retirées
  const excludedForStep = stepExclusions.get(enrollmentId)
  const { r1, r1Name, r2, r2Name, r3, r3Name } = buildRubriques(scopedClassSubjects, gradeIndex, excludedForStep)

  // 5. Resultats calcules CPMSL, centralises hors JSX.
  // Le gabarit reçoit r1/r2/r3 (RubriqueEntry) ; le calcul part des
  // SubjectInput. Deux chemins, une seule règle.
  const averages = calculateBulletinAverages(
    buildSubjectInputs(scopedClassSubjects, allGrades, enrollmentId, excludedForStep),
  )
  const moyenneEtape = formatBulletinNumber(averages.moyenneEtape)
  const appreciation = averages.appreciation
  const classAverages = await getClassAverages({
    classSessionId,
    stepId,
    // Liste COMPLÈTE : getClassAverages filtre lui-même par élève, afin que la
    // moyenne porte sur toute la salle et non sur la seule filière de l'élève.
    classSubjects,
    scope,
  })
  const backendMoyenneClasse = firstString(student, ['moyenneClasse', 'classAverage', 'bulletin.moyenneClasse', 'bulletin.classAverage'])
  const moyenneClasse = backendMoyenneClasse !== '—'
    ? backendMoyenneClasse
    : formatBulletinNumber(classAverages.moyenneClasseEtape)
  // Moyenne générale : elle « mélange » toutes les étapes. Sur le bulletin
  // d'EXAMEN, on ne se limite PAS aux seules matières d'examen (qui ne sont
  // notées qu'à l'étape d'examen → une seule étape à moyenner) : la générale
  // cumule tronc commun + matières de la filière de l'élève sur TOUTES les
  // étapes, pour refléter le parcours annuel complet. Sur le bulletin normal,
  // elle reste sur le tronc commun.
  const generalAverageSubjects =
    scope === 'exam'
      ? filterSubjectsByScope(classSubjects, 'all', studentTrackId)
      : scopedClassSubjects
  const moyenneGenerale = includeGeneralAverage
    ? formatBulletinNumber(await calculateGeneralAverageForEnrollment({
        enrollmentId,
        classSessionId,
        academicYearId: yearId,
        selectedStepId: stepId,
        classSubjects: generalAverageSubjects,
      }))
    : undefined

  // 6. Comportement
  const comportement = buildComportement(behavior, attitudes)
  const promotionPhoto = promotionPhotos.find(p => p.academicYearId === yearId) ?? promotionPhotos[0]
  const schoolName = schoolInfo?.name ?? schoolInfo?.nom ?? schoolInfo?.schoolName
  const logoUrl = schoolInfo?.logoUrl ?? schoolInfo?.logo ?? ''
  const enrollmentAcademicYear = enrollmentContext?.classSession?.academicYear
  const resolvedAcademicYear = resolveAcademicYearLabel(
    academicYearLabel,
    enrollmentAcademicYear?.yearString,
    enrollmentAcademicYear?.name,
    academicYear?.yearString,
    academicYear?.name,
  )

  return {
    prenoms:       student?.user?.firstname ?? '',
    nom:           student?.user?.lastname  ?? '',
    sexe:          student?.user?.gender    ?? '—',
    niveau:        normalizeBulletinLevel(className),
    // Filière = le vrai track de l'inscription (SVT, SES…), avec repli sur le
    // champ hérité si absent.
    filiere:       enrollmentContext?.track?.code ?? student?.filiere ?? '',
    dateNaissance: formatFrenchLongDate(student?.user?.birth_date ?? student?.user?.birthDate),
    anneeScolaire: resolvedAcademicYear,
    periode:       stepName,
    code:          student?.studentCode ?? '',
    nisu:          student?.nisu        ?? '',
    photoUrl:      promotionPhoto?.photoUrl ?? student?.user?.profilePhoto ?? undefined,

    rubrique1Name:  r1Name,
    rubrique1Poids: '70%',
    rubrique1:      r1,
    moyR1: averages.moyR1,
    moyClasseR1: classAverages.moyClasseR1,

    rubrique2Name:  r2Name,
    rubrique2Poids: '25%',
    rubrique2:      r2,
    moyR2: averages.moyR2,
    moyClasseR2: classAverages.moyClasseR2,

    rubrique3Name:  r3Name,
    rubrique3Poids: '5%',
    rubrique3:      r3,
    moyR3: averages.moyR3,
    moyClasseR3: classAverages.moyClasseR3,

    moyenneEtape,
    appreciation,
    moyenneClasse,
    moyenneGenerale,

    comportement,

    etablissement: {
      nomLigne1: '',
      nomLigne2: schoolName ?? '',
      adresse:   schoolInfo?.address ?? schoolInfo?.adresse ?? '',
      telephone: schoolInfo?.phone ?? schoolInfo?.telephone ?? '',
      email:     schoolInfo?.email ?? '',
      logoUrl,
    },
  }
}
