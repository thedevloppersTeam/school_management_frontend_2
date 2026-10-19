// lib/api/bulletin.ts
// Logique partagée de construction des données bulletin (individuel + lot)
// IMPORTANT : ce fichier ne contient aucun JSX — extension .ts correcte
// Les CHIFFRES du bulletin viennent du service de résultats serveur
// (GET /api/results, SPEC-RESULTATS lot L3) : un appel par salle et par
// étape, mis en cache pour la génération en lot. Ce fichier ne calcule plus
// aucune moyenne ; il assemble l'identité, le comportement et l'établissement,
// et confie les chiffres à l'adaptateur pur lib/bulletin/from-results.ts.
import { clientFetch as apiFetch } from '@/lib/client-fetch'
import { parseDecimal } from "@/lib/decimal"
import { formatFrenchLongDate } from "@/lib/date-format"
import type { BulletinData, ComportementItem } from "@/components/BulletinScolaire"
import {
  normalizeBulletinLevel,
  normalizeRubriqueLabel,
} from "@/lib/bulletin-calculations"
import { safeFetch } from "@/lib/api/safe-fetch"
import { invalidateExclusionsCache as invalidateStepExclusions } from "@/lib/api/step-exclusions"
import { fetchRoomResults, invalidateRoomResults, type ResultsScope } from "@/lib/api/results"
import { bulletinFiguresFromResults } from "@/lib/bulletin/from-results"

/**
 * Appelée par components/school/cpmsl-grades-grid.tsx quand une dispense
 * change (chemin d'import historique, conservé). Vide aussi les résultats
 * mis en cache de la salle : la dispense change les chiffres du service.
 */
export function invalidateExclusionsCache(classSessionId?: string, stepId?: string): void {
  invalidateStepExclusions(classSessionId, stepId)
  invalidateRoomResults(classSessionId)
}

// ── Types internes ────────────────────────────────────────────────────────────

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

/**
 * Moyenne de classe incalculable — ERREUR HISTORIQUE, plus levée depuis le
 * lot L3 : la moyenne de classe vient du service de résultats, qui la calcule
 * côté serveur ; un échec du service fait échouer le bulletin entier (ApiError).
 * Conservée parce que lib/errors.ts la reconnaît par son nom et que
 * lib/errors.test.ts l'importe. À retirer avec ces deux usages.
 *
 * Motif d'origine : les notes d'au moins un élève de la salle n'avaient pas
 * pu être chargées, même après une reprise.
 *
 * Calculer sur les seuls élèves chargés donnerait un chiffre faux, différent
 * d'une impression à l'autre. On n'imprime pas un bulletin dont la moyenne de
 * classe est fausse : le calcul s'arrête ici.
 *
 * Ne porte que le NOMBRE d'élèves concernés — jamais leurs noms ni leurs
 * identifiants : le message remonte jusqu'à l'écran.
 */
export class ClassAverageUnavailableError extends Error {
  constructor(public readonly failedCount: number) {
    super(
      `Moyenne de classe indisponible : les notes de ${failedCount} élève${failedCount > 1 ? 's' : ''} ` +
      `de la salle n'ont pas pu être chargées. Le bulletin n'est pas généré, pour ne pas imprimer ` +
      `une moyenne de classe fausse. Réessayez dans un instant.`,
    )
    this.name = 'ClassAverageUnavailableError'
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

  // 1. Données d'identité et de vie scolaire, en parallèle avec les résultats.
  //    Portée du service : bulletin normal → portée RS-03 du service (tronc
  //    commun ; + composants d'examen de la filière à l'étape d'examen blanc) ;
  //    bulletin d'examen officiel → filière de l'élève.
  const resultsScope: ResultsScope | undefined = scope === 'exam' ? 'exam' : undefined
  const [
    student,
    behaviorRaw,
    attitudesRaw,
    schoolInfo,
    promotionPhotos,
    enrollmentContext,
    academicYear,
    stepResults,
  ] = await Promise.all([
    apiFetch<StudentPayload>(`/api/students/${studentId}`),
    safeFetch<unknown>(`/api/behaviors?enrollmentId=${enrollmentId}&stepId=${stepId}`, null),
    safeFetch<unknown>(`/api/attitudes?academicYearId=${yearId}`, []),
    safeFetch<SchoolInfoPayload | null>('/api/school-info', null),
    safeFetch<PromotionPhotoPayload[]>(`/api/promotion-photos?studentId=${studentId}`, []),
    safeFetch<EnrollmentContextPayload | null>(`/api/enrollments/${enrollmentId}`, null),
    safeFetch<AcademicYearPayload | null>(`/api/academic-years/${yearId}`, null),
    fetchRoomResults(classSessionId, stepId, resultsScope),
  ])

  // 2. Normaliser
  const behavior  = normalizeBehavior(behaviorRaw)
  const attitudes = normalizeAttitudes(attitudesRaw)

  // 3. Moyenne générale : elle « mélange » toutes les étapes ≤ étape du bulletin.
  //    Sur le bulletin d'EXAMEN, elle cumule tronc commun + matières de la
  //    filière de l'élève (portée « all ») ; sur le bulletin normal, la même
  //    réponse que l'étape.
  const generalResults = includeGeneralAverage
    ? (scope === 'exam' ? await fetchRoomResults(classSessionId, stepId, 'all') : stepResults)
    : undefined

  // 4. Chiffres : lignes, barèmes, moyennes — tout vient du service.
  const figures = bulletinFiguresFromResults({
    step: stepResults,
    general: generalResults,
    enrollmentId,
    stepId,
    backendMoyenneClasse: firstString(student, ['moyenneClasse', 'classAverage', 'bulletin.moyenneClasse', 'bulletin.classAverage']),
  })

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

    rubrique1Name:  normalizeRubriqueLabel(1),
    rubrique1Poids: '70%',
    rubrique1:      figures.rubrique1,
    moyR1: figures.moyR1,
    moyR1Texte: figures.moyR1Texte,
    moyClasseR1: figures.moyClasseR1,
    moyClasseR1Texte: figures.moyClasseR1Texte,

    rubrique2Name:  normalizeRubriqueLabel(2),
    rubrique2Poids: '25%',
    rubrique2:      figures.rubrique2,
    moyR2: figures.moyR2,
    moyR2Texte: figures.moyR2Texte,
    moyClasseR2: figures.moyClasseR2,
    moyClasseR2Texte: figures.moyClasseR2Texte,

    rubrique3Name:  normalizeRubriqueLabel(3),
    rubrique3Poids: '5%',
    rubrique3:      figures.rubrique3,
    moyR3: figures.moyR3,
    moyR3Texte: figures.moyR3Texte,
    moyClasseR3: figures.moyClasseR3,
    moyClasseR3Texte: figures.moyClasseR3Texte,

    moyenneEtape: figures.moyenneEtape,
    appreciation: figures.appreciation,
    moyenneClasse: figures.moyenneClasse,
    moyenneGenerale: figures.moyenneGenerale,

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
