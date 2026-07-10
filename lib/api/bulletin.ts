// lib/api/bulletin.ts
// Logique partagée de construction des données bulletin (individuel + lot)
// IMPORTANT : ce fichier ne contient aucun JSX — extension .ts correcte
import { clientFetch as apiFetch } from '@/lib/client-fetch'
import { fetchClassSubjects, type ApiClassSubject, type ApiGrade } from "@/lib/api/grades"
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
  classSession?: {
    academicYear?: AcademicYearPayload | null
  } | null
}

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

function decimalToNumber(raw: unknown, fallback = 0): number {
  if (raw == null) return fallback
  if (typeof raw === 'object' && 'd' in raw) {
    const digits = (raw as { d?: unknown }).d
    if (Array.isArray(digits) && digits.length > 0) return Number(digits[0])
  }
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

function buildSubjectEntries(cs: ApiClassSubject, bucket: GradeBucket | undefined): RubriqueEntry[] {
  const subject = cs.subject
  const subjectMax = decimalToNumber(subject.maxScore, 0)

  if (!subject.hasSections || subject.sections.length === 0) {
    const note = avg(bucket?.direct ?? [])
    return [{ name: subject.name, note, coeff: note !== null ? subjectMax : undefined, isParent: false }]
  }

  const hasAnySectionGrade = Array.from(bucket?.sections.values() ?? []).some(arr => arr.length > 0)
  if (!hasAnySectionGrade) {
    const note = avg(bucket?.direct ?? [])
    return [{ name: subject.name, note, coeff: note !== null ? subjectMax : undefined, isParent: false }]
  }

  const entries: RubriqueEntry[] = [{ name: subject.name, isParent: true }]
  for (const sec of subject.sections) {
    const scores   = bucket?.sections.get(sec.id) ?? []
    const maxScore = decimalToNumber(sec.maxScore, 0)
    const note     = avg(scores)
    entries.push({
      name:     sec.name,
      note,
      coeff:    note !== null ? maxScore : undefined,
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

function buildRubriques(classSubjects: ApiClassSubject[], gradeIndex: GradeIndex): RubriqueSet {
  const set: RubriqueSet = {
    r1: [], r1Name: normalizeRubriqueLabel(1),
    r2: [], r2Name: normalizeRubriqueLabel(2),
    r3: [], r3Name: normalizeRubriqueLabel(3),
  }
  for (const cs of classSubjects) {
    const { rubric } = cs.subject
    const code = rubric?.code ?? ''
    const entries = buildSubjectEntries(cs, gradeIndex.get(cs.id))
    pushToRubrique(set, code, entries)
  }
  return set
}

async function getClassAverages(params: {
  classSessionId: string
  stepId: string
  classSubjects: ApiClassSubject[]
}): Promise<BulletinClassAverages> {
  const cacheKey = `${params.classSessionId}:${params.stepId}`
  const cached = classAveragesCache.get(cacheKey)
  if (cached) return cached

  const promise = (async () => {
    const enrollments = await apiFetch<EnrollmentForClassAverage[]>(
      `/api/enrollments?classSessionId=${params.classSessionId}&status=ACTIVE`,
    )

    const averages = await Promise.all(
      enrollments.map(async (enrollment) => {
        try {
          const grades = await apiFetch<ApiGrade[]>(
            `/api/grades/enrollment/${enrollment.id}?stepId=${params.stepId}`,
          )
          const gradeIndex = buildGradeIndex(grades)
          const rubriques = buildRubriques(params.classSubjects, gradeIndex)
          return calculateBulletinAverages({
            rubrique1: rubriques.r1,
            rubrique2: rubriques.r2,
            rubrique3: rubriques.r3,
          })
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
  academicYearId: string
  selectedStepId: string
  classSubjects: ApiClassSubject[]
}): Promise<number | null> {
  const steps = await fetchSteps(params.academicYearId)
  const selectedStep = steps.find((step) => step.id === params.selectedStepId)
  const selectedStepNumber = selectedStep?.stepNumber

  const eligibleSteps = steps
    .filter((step) => selectedStepNumber === undefined || step.stepNumber <= selectedStepNumber)
    .sort((a, b) => a.stepNumber - b.stepNumber)

  if (eligibleSteps.length === 0) return null

  const averages = await Promise.all(
    eligibleSteps.map(async (step) => {
      try {
        const grades = await apiFetch<ApiGrade[]>(
          `/api/grades/enrollment/${params.enrollmentId}?stepId=${step.id}`,
        )
        const gradeIndex = buildGradeIndex(grades)
        const rubriques = buildRubriques(params.classSubjects, gradeIndex)
        return calculateBulletinAverages({
          rubrique1: rubriques.r1,
          rubrique2: rubriques.r2,
          rubrique3: rubriques.r3,
        }).moyenneEtape
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
    const decimalValue = decimalToNumber(value, Number.NaN)
    return Number.isFinite(decimalValue) ? String(decimalValue) : null
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
  ])

  // 2. Normaliser
  const behavior  = normalizeBehavior(behaviorRaw)
  const attitudes = normalizeAttitudes(attitudesRaw)

  // 3. Index des notes
  const gradeIndex = buildGradeIndex(allGrades)

  // 4. Rubriques
  const { r1, r1Name, r2, r2Name, r3, r3Name } = buildRubriques(classSubjects, gradeIndex)

  // 5. Resultats calcules CPMSL, centralises hors JSX.
  const averages = calculateBulletinAverages({
    rubrique1: r1,
    rubrique2: r2,
    rubrique3: r3,
  })
  const moyenneEtape = formatBulletinNumber(averages.moyenneEtape)
  const appreciation = averages.appreciation
  const classAverages = await getClassAverages({ classSessionId, stepId, classSubjects })
  const backendMoyenneClasse = firstString(student, ['moyenneClasse', 'classAverage', 'bulletin.moyenneClasse', 'bulletin.classAverage'])
  const moyenneClasse = backendMoyenneClasse !== '—'
    ? backendMoyenneClasse
    : formatBulletinNumber(classAverages.moyenneClasseEtape)
  const moyenneGenerale = includeGeneralAverage
    ? formatBulletinNumber(await calculateGeneralAverageForEnrollment({
        enrollmentId,
        academicYearId: yearId,
        selectedStepId: stepId,
        classSubjects,
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
    filiere:       student?.filiere         ?? '—',
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
