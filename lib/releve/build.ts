/**
 * Relevé de notes — lecture des données et assemblage (R-REL-7, G8, G10).
 *
 * Référence : docs/GABARIT-RELEVE.md (v0.3), hors dépôt.
 *
 * R-REL-7 : toute lecture en échec REFUSE le relevé. Jamais « - » ni 0 à la
 * place d'une donnée non lue : c'est pourquoi ce module n'utilise PAS
 * safeFetch, qui rend la même valeur de repli pour une fiche absente et pour
 * une panne. Deux 404 seulement ont un sens métier :
 *   - fiche de comportement d'une étape : fiche absente, « - » ;
 *   - school_info : refus dédié « informations de l'école non renseignées ».
 *
 * Les appels passent par les route handlers Next.js (`/api/**`), comme tout
 * le frontend : le cookie de session reste first-party.
 */
import { ApiError, clientFetch } from '@/lib/client-fetch'
import { libelleClasseSalle } from '@/lib/classes/labels'
import {
  REMARQUE,
  SEUIL_REUSSITE,
  buildDisciplineGroup,
  buildSubjectGroups,
  choosePhoto,
  formatBirthDate,
  formatYearRange,
  legend,
  resolveSteps,
  scopeClassSubjects,
} from './compute'
import { splitColumns } from './columns'
import {
  ReleveUnavailableError,
  TIRET,
  type ApiBehaviorRow,
  type ApiClassSubjectRow,
  type ApiEnrollmentRow,
  type ApiExclusionRow,
  type ApiGradeRow,
  type ApiPromotionPhotoRow,
  type ApiSchoolInfoRow,
  type ApiStepExemptionRow,
  type ApiStudentRow,
  type ApiYearRow,
  type ReleveData,
} from './types'

const enc = encodeURIComponent

/** Lecture obligatoire : toute erreur, 404 compris, refuse le relevé. */
async function read<T>(path: string): Promise<T> {
  try {
    return await clientFetch<T>(path)
  } catch {
    throw new ReleveUnavailableError('indisponible')
  }
}

/** Marqueur d'un 404, distinct de tout corps reçu (y compris `null`). */
const ABSENT: unique symbol = Symbol('absent')

/**
 * Lecture où le 404 signifie « absent » ; toute autre erreur refuse.
 * Sans `marker`, le 404 rend null. Avec, il rend ABSENT, pour qu'un corps 200
 * vide ou « null » ne passe pas pour une fiche absente (K1).
 */
async function readOrAbsent<T>(path: string): Promise<T | null>
async function readOrAbsent<T>(path: string, marker: true): Promise<T | typeof ABSENT>
async function readOrAbsent<T>(path: string, marker = false): Promise<T | null | typeof ABSENT> {
  try {
    return await clientFetch<T>(path)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return marker ? ABSENT : null
    throw new ReleveUnavailableError('indisponible')
  }
}

function asArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) throw new ReleveUnavailableError('indisponible')
  return value as T[]
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

const BEHAVIOR_FIELDS = ['retards', 'absences', 'devoirsManques', 'leconsNonSues', 'respectUniforme'] as const

/**
 * K1 — une fiche lue en 200 doit être un objet portant les 5 champs, chacun
 * nombre ou null (`Int?` côté serveur). Corps vide, non JSON, tableau, champ
 * manquant ou d'un autre type : refus. Seul le 404 vaut « fiche absente ».
 */
function behaviorOf(raw: unknown): ApiBehaviorRow {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ReleveUnavailableError('indisponible')
  const row = raw as Record<string, unknown>
  for (const field of BEHAVIOR_FIELDS) {
    const v = row[field]
    if (!(field in row) || (v !== null && (typeof v !== 'number' || !Number.isFinite(v)))) {
      throw new ReleveUnavailableError('indisponible')
    }
  }
  return row as ApiBehaviorRow
}

/** K5 — champ de contrat ABSENT de la réponse : refus, jamais une valeur par défaut. */
function requireKey(source: object | null | undefined, key: string): void {
  if (!source || typeof source !== 'object' || !(key in source) || (source as Record<string, unknown>)[key] === undefined) {
    throw new ReleveUnavailableError('indisponible')
  }
}

/**
 * Toutes les données du relevé d'UNE inscription, déjà formatées.
 * Lève `ReleveUnavailableError` quand le relevé ne doit pas être imprimé.
 */
export async function buildReleveData(studentId: string, enrollmentId: string): Promise<ReleveData> {
  // 1. Élève et inscription : ils désignent la salle et l'année.
  const [student, enrollment] = await Promise.all([
    read<ApiStudentRow>(`/api/students/${enc(studentId)}`),
    read<ApiEnrollmentRow>(`/api/enrollments/${enc(enrollmentId)}`),
  ])
  if (!student || !enrollment) throw new ReleveUnavailableError('indisponible')
  if (enrollment.studentId && enrollment.studentId !== studentId) {
    throw new ReleveUnavailableError('indisponible', 'inscription d’un autre élève')
  }
  const session = enrollment.classSession
  const classSessionId = enrollment.classSessionId ?? session?.id
  const academicYearId = session?.academicYearId ?? session?.academicYear?.id
  if (!classSessionId || !academicYearId) throw new ReleveUnavailableError('indisponible')

  // K5 — champs de contrat. trackId à null = « pas de filière » ; absent = refus.
  requireKey(enrollment, 'trackId')
  if (enrollment.trackId !== null) {
    requireKey(enrollment.track, 'code')
    if (!text(enrollment.track?.code)) throw new ReleveUnavailableError('indisponible')
  }
  requireKey(session?.class, 'classType')
  if (!session?.class?.classType || typeof session.class.classType.name !== 'string') {
    throw new ReleveUnavailableError('indisponible')
  }
  if (!student.user || typeof student.user !== 'object') throw new ReleveUnavailableError('indisponible')
  const birth = student.user.birthDate ?? student.user.birth_date
  if (birth === null || birth === undefined) throw new ReleveUnavailableError('naissance-non-renseignee')
  const dateNaissance = formatBirthDate(birth)
  if (dateNaissance === TIRET) throw new ReleveUnavailableError('indisponible', 'date de naissance illisible')

  // 2. Année et période (R-REL-6) : refus avant toute autre lecture.
  const year = await read<ApiYearRow>(`/api/academic-years/${enc(academicYearId)}`)
  if (!year) throw new ReleveUnavailableError('indisponible')
  requireKey(year, 'yearString')
  const { steps, included } = resolveSteps(year)
  const readSteps = steps.filter((s) => included.has(s.id))

  // 3. Le reste, en parallèle. Notes, dispenses et fiches : étapes retenues seules.
  const [classSubjectsRaw, exemptionsRaw, photosRaw, schoolInfo, perStep] = await Promise.all([
    read<unknown>(`/api/class-subjects?classSessionId=${enc(classSessionId)}`),
    read<unknown>(`/api/enrollments/${enc(enrollmentId)}/step-exemptions`),
    read<unknown>(`/api/promotion-photos?studentId=${enc(studentId)}`),
    readOrAbsent<ApiSchoolInfoRow>('/api/school-info'),
    Promise.all(
      readSteps.map(async (step) => {
        const [grades, exclusions, behavior] = await Promise.all([
          read<unknown>(`/api/grades/enrollment/${enc(enrollmentId)}?stepId=${enc(step.id)}`),
          read<unknown>(
            `/api/enrollments/excluded-sections?classSessionId=${enc(classSessionId)}&stepId=${enc(step.id)}`,
          ),
          readOrAbsent<unknown>(`/api/behaviors?enrollmentId=${enc(enrollmentId)}&stepId=${enc(step.id)}`, true),
        ])
        return {
          stepId: step.id,
          grades: asArray<ApiGradeRow>(grades),
          exclusions: asArray<ApiExclusionRow>(exclusions),
          behavior: behavior === ABSENT ? null : behaviorOf(behavior),
        }
      }),
    ),
  ])
  if (!schoolInfo) throw new ReleveUnavailableError('ecole-non-renseignee')
  // Q-D : adresse et téléphone sont imprimés au pied de page ; vides ou blancs,
  // le relevé n'est pas imprimé. Le courriel est facultatif.
  if (!text(schoolInfo.address) || !text(schoolInfo.phone)) {
    throw new ReleveUnavailableError('ecole-incomplete')
  }

  // 4. Assemblage.
  const trackId = enrollment.trackId ?? null
  const exemptedSteps = new Set(asArray<ApiStepExemptionRow>(exemptionsRaw).map((r) => r.stepId))
  const groups = buildSubjectGroups({
    classSubjects: scopeClassSubjects(asArray<ApiClassSubjectRow>(classSubjectsRaw), trackId),
    trackCode: text(enrollment.track?.code) || null,
    enrollmentId,
    steps,
    included,
    exemptedSteps,
    gradesByStep: new Map(perStep.map((p) => [p.stepId, p.grades])),
    exclusionsByStep: new Map(perStep.map((p) => [p.stepId, p.exclusions])),
  })
  // Les dispenses d'étape ne s'appliquent pas à la discipline (Q-B).
  const discipline = buildDisciplineGroup({
    steps,
    included,
    behaviorsByStep: new Map(perStep.map((p) => [p.stepId, p.behavior])),
  })
  const { left, right } = splitColumns(groups, discipline)

  const user = student.user
  return {
    identity: {
      prenom: text(user.firstname),
      nom: text(user.lastname).toLocaleUpperCase('fr'),
      dateNaissance,
      photoUrl: choosePhoto(asArray<ApiPromotionPhotoRow>(photosRaw), academicYearId, user.profilePhoto),
      niveau: libelleClasseSalle(session).classe,
      anneeScolaire: formatYearRange(year.yearString),
    },
    stepHeaders: steps.map((s) => s.name),
    left,
    right,
    footer: {
      adresse: text(schoolInfo.address),
      telephone: text(schoolInfo.phone),
      courriel: text(schoolInfo.email),
      remarque: REMARQUE,
      seuil: SEUIL_REUSSITE,
      legende: legend(),
    },
  }
}

