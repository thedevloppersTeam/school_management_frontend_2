/**
 * Relevé de notes — formes des données (lot 1).
 *
 * Référence : docs/GABARIT-RELEVE.md (v0.3), hors dépôt. `ReleveData` contient
 * TOUT ce que le gabarit affiche, déjà formaté : le gabarit (lot 2) n'effectue
 * aucun calcul.
 */
import type { GradeBand } from '@/lib/bulletin/grade-color'

/** Valeur non comptabilisée : tiret simple (gabarit §3), jamais « — ». */
export const TIRET = '-'

/** Une cellule affichée : texte formaté, et sa bande de couleur (null = aucune). */
export interface ReleveCell {
  text: string
  band: GradeBand | null
}

/** Une ligne de tableau : sous-matière, matière sans sous-matière, ou ligne de discipline. */
export interface ReleveLine {
  label: string
  /** Coeff affiché (R-REL-1), « 1 » pour la discipline. */
  coeff: string
  /** Une cellule par étape de l'année, dans l'ordre des en-têtes. */
  cells: ReleveCell[]
  /** Colonne sans titre : toujours « - », hors de tout calcul (gabarit §3). */
  blank: string
  /** Colonne « Moy. Gnle » (pour la discipline : total ou moyenne, R-REL-5). */
  average: ReleveCell
}

export interface ReleveGroup {
  title: string
  kind: 'matiere' | 'discipline'
  lines: ReleveLine[]
}

export interface ReleveIdentity {
  prenom: string
  /** En MAJUSCULES. */
  nom: string
  /** « JJ mois AAAA », mois en toutes lettres, sans décalage de fuseau. */
  dateNaissance: string
  /** Photo de promotion de l'année, sinon photo de profil, sinon null (G8). */
  photoUrl: string | null
  /** Niveau sans la salle (libelleClasseSalle().classe). */
  niveau: string
  /** « AAAA - AAAA ». */
  anneeScolaire: string
}

export interface ReleveLegendEntry {
  mention: string
  label: string
  range: string
  band: GradeBand
}

export interface ReleveFooter {
  adresse: string
  telephone: string
  courriel: string
  remarque: string
  /** Seuil de réussite imprimé, « 7.00 ». */
  seuil: string
  legende: ReleveLegendEntry[]
}

export interface ReleveData {
  identity: ReleveIdentity
  /** Noms des étapes de l'année, tels qu'en base, dans l'ordre. */
  stepHeaders: string[]
  /** Colonne gauche ; le groupe « Discipline » en est toujours le dernier. */
  left: ReleveGroup[]
  right: ReleveGroup[]
  footer: ReleveFooter
}

// ── Erreur ──────────────────────────────────────────────────────────────────

export type ReleveUnavailableReason =
  | 'indisponible'
  | 'aucune-etape-en-cours'
  | 'annee-en-preparation'
  | 'ecole-non-renseignee'
  | 'notes-non-representables'

const MESSAGES: Record<ReleveUnavailableReason, string> = {
  'indisponible':
    'Relevé de notes indisponible : une donnée n’a pas pu être lue. Réessayez dans un instant.',
  'aucune-etape-en-cours':
    'Relevé de notes indisponible : aucune étape en cours définie pour l’année active.',
  'annee-en-preparation':
    'Relevé de notes indisponible : l’année scolaire est en préparation.',
  'ecole-non-renseignee':
    'Relevé de notes indisponible : informations de l’école non renseignées.',
  'notes-non-representables':
    'Relevé de notes indisponible : des notes globales sont saisies sur une matière à sous-matières',
}

/**
 * Le relevé n'est pas généré (R-REL-6, R-REL-7, G10). Le message est rédigé
 * pour l'écran et ne contient aucune donnée d'élève ; seul `detail` peut porter
 * un nom de matière.
 */
export class ReleveUnavailableError extends Error {
  constructor(
    public readonly reason: ReleveUnavailableReason,
    detail?: string,
  ) {
    super(detail ? `${MESSAGES[reason]} (${detail}).` : MESSAGES[reason])
    this.name = 'ReleveUnavailableError'
  }
}

// ── Formes minimales lues dans l'API (structurelles) ────────────────────────

export interface ApiSectionRow {
  id: string
  name: string
  maxScore: unknown
  displayOrder?: number | null
}

export interface ApiClassSubjectRow {
  id: string
  /** null = tronc commun ; sinon matière de la filière portant cet id. */
  trackId: string | null
  track?: { code?: string | null } | null
  maxScoreOverride?: unknown
  subject: {
    id: string
    name: string
    maxScore: unknown
    rubric?: { code?: string | null } | null
    sections?: ApiSectionRow[] | null
  }
}

export interface ApiGradeRow {
  classSubjectId: string
  sectionId: string | null
  studentScore: unknown
}

export interface ApiStepRow {
  id: string
  name: string
  stepNumber: number
  isCurrent: boolean
}

export interface ApiYearRow {
  id: string
  yearString: string
  isCurrent: boolean
  endDate: string
  steps?: ApiStepRow[] | null
}

export interface ApiExclusionRow {
  enrollmentId: string
  classSubjectId: string
  sectionId: string | null
}

export interface ApiBehaviorRow {
  retards?: number | null
  absences?: number | null
  devoirsManques?: number | null
  leconsNonSues?: number | null
  respectUniforme?: number | null
}

export interface ApiPromotionPhotoRow {
  academicYearId?: string | null
  photoUrl?: string | null
}

export interface ApiStepExemptionRow {
  stepId: string
}

export interface ApiStudentRow {
  id?: string
  user?: {
    firstname?: string | null
    lastname?: string | null
    birthDate?: string | null
    birth_date?: string | null
    profilePhoto?: string | null
  } | null
}

export interface ApiEnrollmentRow {
  id?: string
  studentId?: string | null
  trackId?: string | null
  track?: { code?: string | null } | null
  classSessionId?: string | null
  classSession?: {
    id?: string | null
    academicYearId?: string | null
    academicYear?: { id?: string | null } | null
    class?: {
      letter?: string | null
      classType?: { name?: string | null } | null
    } | null
  } | null
}

export interface ApiSchoolInfoRow {
  address?: string | null
  phone?: string | null
  email?: string | null
}
