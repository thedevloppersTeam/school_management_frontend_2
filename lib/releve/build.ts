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

/** Lecture où le 404 signifie « absent » (null) ; toute autre erreur refuse. */
async function readOrAbsent<T>(path: string): Promise<T | null> {
  try {
    return await clientFetch<T>(path)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null
    throw new ReleveUnavailableError('indisponible')
  }
}

function asArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) throw new ReleveUnavailableError('indisponible')
  return value as T[]
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

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

  // 2. Année et période (R-REL-6) : refus avant toute autre lecture.
  const year = await read<ApiYearRow>(`/api/academic-years/${enc(academicYearId)}`)
  if (!year) throw new ReleveUnavailableError('indisponible')
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
          readOrAbsent<ApiBehaviorRow>(`/api/behaviors?enrollmentId=${enc(enrollmentId)}&stepId=${enc(step.id)}`),
        ])
        return {
          stepId: step.id,
          grades: asArray<ApiGradeRow>(grades),
          exclusions: asArray<ApiExclusionRow>(exclusions),
          behavior,
        }
      }),
    ),
  ])
  if (!schoolInfo) throw new ReleveUnavailableError('ecole-non-renseignee')

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
  const discipline = buildDisciplineGroup({
    steps,
    included,
    exemptedSteps,
    behaviorsByStep: new Map(perStep.map((p) => [p.stepId, p.behavior])),
  })
  const { left, right } = splitColumns(groups, discipline)

  const user = student.user ?? {}
  return {
    identity: {
      prenom: text(user.firstname),
      nom: text(user.lastname).toLocaleUpperCase('fr'),
      dateNaissance: formatBirthDate(user.birthDate ?? user.birth_date),
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

