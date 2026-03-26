export interface AcademicYear {
  id: string
  name: string
  startDate: string
  endDate: string
  isActive: boolean
  status: 'preparation' | 'active' | 'archived'
  createdAt: string
}

export interface Level {
  id: string
  name: string
  niveau: 'Fondamentale' | 'Nouveau Secondaire'
  filiere?: 'LLA' | 'SES' | 'SMP' | 'SVT'
  classrooms?: { id: string; name: string }[]
  academicYearId: string
}

export interface Classroom {
  id: string
  name: string
  levelId: string
  capacity: number
  academicYearId: string
}

// Matière parent (définie par le MENFP)
export interface SubjectParent {
  id: string
  code: string               // ex: "COM101"
  name: string               // ex: "Français"
  rubrique: 'R1' | 'R2' | 'R3'
  levelIds: string[]         // niveaux concernés
  academicYearId: string
  coefficients: {            // coefficient ministère
    filiereId: string | null // null = tronc commun
    valeur: number
  }[]
}

// Sous-matière (définie par l'école CPMSL)
export interface SubjectChild {
  id: string
  code: string               // ex: "COML01" (3 letters + 1 type + 2 digits)
  name: string               // ex: "Dissertation"
  type: 'L' | 'C' | 'N' | 'P' | 'T'  // L=Langue, C=Calcul, N=Naturelle, P=Pratique, T=Théorie
  parentId: string           // → SubjectParent
  coefficient: number        // coefficient interne
  academicYearId: string
}

/**
 * @deprecated Use SubjectParent and SubjectChild instead
 * This interface is kept for backward compatibility only
 */
export interface Subject {
  id: string
  name: string
  code: string
  coefficient: number
  rubrique: 'R1' | 'R2' | 'R3'
  levelIds: string[]
  academicYearId: string
}

export interface Period {
  id: string
  name: string
  startDate?: string
  endDate?: string
  order: number
  status: 'open' | 'closed'
  isBlancExam: boolean       // Évaluation en blanc (9e et NSIV uniquement)
  academicYearId: string
}

export interface SchoolEvent {
  id: string
  title: string
  date: string
  type: 'ceremony' | 'meeting' | 'trip' | 'other'
  academicYearId: string
}

export interface Holiday {
  id: string
  name: string
  date: string // Format: MM-DD (sans année, récurrent)
}

export interface SchoolInfo {
  id: string
  name: string
  motto: string
  foundedYear: number
  address: string
  phone: string
  email: string
  logo?: string
}

export interface Student {
  id: string
  matricule: string
  studentCode: string // Code élève personnalisé
  nisu: string // Numéro d'Identification Scolaire Unique
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: 'M' | 'F'
  stream?: string // Filière (Sciences, Littéraire, Technique, etc.)
  classroomId: string
  levelId: string
  parentId?: string
  avatar?: string
  academicYearId: string
}

export interface Teacher {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  subjectIds: string[]
  levelIds: string[]
  avatar?: string
  academicYearId: string
}

export interface Grade {
  id: string
  studentId: string
  subjectId: string
  periodId: string
  value: number
  maxValue: number
  comment?: string
  createdAt: string
  academicYearId: string
}

// Attitudes prédéfinies (extensible par l'admin)
export interface Attitude {
  id: string
  label: string              // ex: "Respectueux(se)", "Perturbateur(trice)"
  academicYearId: string
}

// Réponse Oui/Non pour une attitude donnée
export interface AttitudeResponse {
  attitudeId: string
  value: boolean             // true = Oui, false = Non
}

export interface StudentBehavior {
  id: string
  studentId: string
  classroomId: string
  periodId: string
  academicYearId: string

  // Champs quantitatifs
  absences: number | null       // nombre entier ≥ 0
  retards: number | null        // nombre entier ≥ 0
  devoirsManques: number | null // nombre entier ≥ 0

  // Champs qualitatifs
  attitudeResponses: AttitudeResponse[]  // Oui/Non par attitude
  pointsForts: string           // texte libre, max 300 chars
  defis: string                 // texte libre, max 300 chars
  remarque: string              // texte libre, max 500 chars

  createdAt: string
  updatedAt: string
}

// Années académiques
export const academicYears: AcademicYear[] = [
  {
    id: 'ay-2024',
    name: '2024-2025',
    startDate: '2024-09-01',
    endDate: '2025-06-30',
    isActive: true,
    status: 'active',
    createdAt: '2024-08-01'
  },
  {
    id: 'ay-2023',
    name: '2023-2024',
    startDate: '2023-09-01',
    endDate: '2024-06-30',
    isActive: false,
    status: 'archived',
    createdAt: '2023-08-01'
  },
  {
    id: 'ay-2025',
    name: '2025-2026',
    startDate: '2025-09-01',
    endDate: '2026-06-30',
    isActive: false,
    status: 'preparation',
    createdAt: '2025-07-01'
  }
]

// Niveaux (Classes)
export const levels: Level[] = [
  { id: 'level-7e', name: '7e', niveau: 'Fondamentale', academicYearId: 'ay-2024' },
  { id: 'level-8e', name: '8e', niveau: 'Fondamentale', academicYearId: 'ay-2024' },
  { id: 'level-9e', name: '9e', niveau: 'Fondamentale', academicYearId: 'ay-2024' },
  { id: 'level-nsi', name: 'NSI', niveau: 'Nouveau Secondaire', academicYearId: 'ay-2024' },
  { id: 'level-nsii', name: 'NSII', niveau: 'Nouveau Secondaire', academicYearId: 'ay-2024' },
  { id: 'level-nsiii', name: 'NSIII', niveau: 'Nouveau Secondaire', academicYearId: 'ay-2024' },
  { id: 'level-nsiv', name: 'NSIV', niveau: 'Nouveau Secondaire', academicYearId: 'ay-2024' }
]

// Salles de classe
// Pour Fondamentale: salles nommées A, B, C, etc.
// Pour Nouveau Secondaire: salles nommées par filière (LLA, SES, SMP, SVT)
export const classrooms: Classroom[] = [
  // 7e - Fondamentale
  { id: 'room-1', name: 'A', levelId: 'level-7e', capacity: 35, academicYearId: 'ay-2024' },
  { id: 'room-2', name: 'B', levelId: 'level-7e', capacity: 33, academicYearId: 'ay-2024' },
  // 8e - Fondamentale
  { id: 'room-3', name: 'A', levelId: 'level-8e', capacity: 34, academicYearId: 'ay-2024' },
  { id: 'room-4', name: 'B', levelId: 'level-8e', capacity: 30, academicYearId: 'ay-2024' },
  // 9e - Fondamentale
  { id: 'room-5', name: 'A', levelId: 'level-9e', capacity: 32, academicYearId: 'ay-2024' },
  // NSI - Nouveau Secondaire (filières = salles)
  { id: 'room-6', name: 'LLA', levelId: 'level-nsi', capacity: 28, academicYearId: 'ay-2024' },
  { id: 'room-7', name: 'SES', levelId: 'level-nsi', capacity: 30, academicYearId: 'ay-2024' },
  { id: 'room-8', name: 'SMP', levelId: 'level-nsi', capacity: 28, academicYearId: 'ay-2024' },
  { id: 'room-9', name: 'SVT', levelId: 'level-nsi', capacity: 29, academicYearId: 'ay-2024' },
  // NSII - Nouveau Secondaire (filières = salles)
  { id: 'room-10', name: 'LLA', levelId: 'level-nsii', capacity: 26, academicYearId: 'ay-2024' },
  { id: 'room-11', name: 'SES', levelId: 'level-nsii', capacity: 28, academicYearId: 'ay-2024' },
  { id: 'room-12', name: 'SMP', levelId: 'level-nsii', capacity: 27, academicYearId: 'ay-2024' },
  { id: 'room-13', name: 'SVT', levelId: 'level-nsii', capacity: 25, academicYearId: 'ay-2024' },
  // NSIII - Nouveau Secondaire (filières = salles)
  { id: 'room-14', name: 'LLA', levelId: 'level-nsiii', capacity: 24, academicYearId: 'ay-2024' },
  { id: 'room-15', name: 'SES', levelId: 'level-nsiii', capacity: 26, academicYearId: 'ay-2024' },
  { id: 'room-16', name: 'SMP', levelId: 'level-nsiii', capacity: 25, academicYearId: 'ay-2024' },
  { id: 'room-17', name: 'SVT', levelId: 'level-nsiii', capacity: 23, academicYearId: 'ay-2024' },
  // NSIV - Nouveau Secondaire (filières = salles)
  { id: 'room-18', name: 'LLA', levelId: 'level-nsiv', capacity: 22, academicYearId: 'ay-2024' },
  { id: 'room-19', name: 'SES', levelId: 'level-nsiv', capacity: 24, academicYearId: 'ay-2024' },
  { id: 'room-20', name: 'SMP', levelId: 'level-nsiv', capacity: 23, academicYearId: 'ay-2024' },
  { id: 'room-21', name: 'SVT', levelId: 'level-nsiv', capacity: 21, academicYearId: 'ay-2024' }
]

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MATIÈRES PARENT (MENFP)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const subjectParents: SubjectParent[] = [
  // ━━━ R1 ━━━
  {
    id: 'sp-1',
    code: 'COM101',
    name: 'Communication',
    rubrique: 'R1',
    levelIds: ['level-7e', 'level-8e', 'level-9e'],
    academicYearId: 'ay-2024',
    coefficients: [{ filiereId: null, valeur: 60 }]
  },
  {
    id: 'sp-2',
    code: 'MAT101',
    name: 'Mathématiques',
    rubrique: 'R1',
    levelIds: ['level-7e', 'level-8e', 'level-9e'],
    academicYearId: 'ay-2024',
    coefficients: [{ filiereId: null, valeur: 60 }]
  },
  
  // ━━━ R2 ━━━
  {
    id: 'sp-3',
    code: 'SCI101',
    name: 'Sciences',
    rubrique: 'R2',
    levelIds: ['level-7e', 'level-8e', 'level-9e'],
    academicYearId: 'ay-2024',
    coefficients: [{ filiereId: null, valeur: 30 }]
  },
  
  // ━━━ R3 ━━━
  {
    id: 'sp-4',
    code: 'LAN101',
    name: 'Langues Étrangères',
    rubrique: 'R3',
    levelIds: ['level-7e', 'level-8e', 'level-9e'],
    academicYearId: 'ay-2024',
    coefficients: [{ filiereId: null, valeur: 10 }]
  }
]

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SOUS-MATIÈRES (CPMSL)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const subjectChildren: SubjectChild[] = [
  // ━━━ Communication (sp-1) — COM ━━━
  { id: 'sc-1', code: 'COML01', name: 'Communication Française', type: 'L', parentId: 'sp-1', coefficient: 30, academicYearId: 'ay-2024' },
  { id: 'sc-2', code: 'COML02', name: 'Communication Créole', type: 'L', parentId: 'sp-1', coefficient: 30, academicYearId: 'ay-2024' },
  
  // ━━━ Mathématiques (sp-2) — MAT ━━━
  { id: 'sc-3', code: 'MATC01', name: 'Algèbre', type: 'C', parentId: 'sp-2', coefficient: 30, academicYearId: 'ay-2024' },
  { id: 'sc-4', code: 'MATC02', name: 'Géométrie', type: 'C', parentId: 'sp-2', coefficient: 30, academicYearId: 'ay-2024' },
  
  // ━━━ Sciences (sp-3) — SCI ━━━
  { id: 'sc-5', code: 'SCIN01', name: 'Sciences Naturelles', type: 'N', parentId: 'sp-3', coefficient: 15, academicYearId: 'ay-2024' },
  { id: 'sc-6', code: 'SCIN02', name: 'Physique-Chimie', type: 'N', parentId: 'sp-3', coefficient: 15, academicYearId: 'ay-2024' },
  
  // ━━━ Langues Étrangères (sp-4) — LAN ━━━
  { id: 'sc-7', code: 'LANL01', name: 'Anglais', type: 'L', parentId: 'sp-4', coefficient: 5, academicYearId: 'ay-2024' },
  { id: 'sc-8', code: 'LANL02', name: 'Espagnol', type: 'L', parentId: 'sp-4', coefficient: 5, academicYearId: 'ay-2024' }
]

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ANCIENNES MATIÈRES (DEPRECATED - À SUPPRIMER APRÈS MIGRATION)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const subjects: Subject[] = [
  { id: 'sub-1', name: 'Mathématiques', code: 'MATH', coefficient: 4, rubrique: 'R1', levelIds: ['level-1', 'level-2', 'level-3', 'level-4', 'level-5', 'level-6', 'level-7', 'level-8', 'level-9', 'level-10', 'level-11', 'level-12'], academicYearId: 'ay-2024' },
  { id: 'sub-2', name: 'Français', code: 'FR', coefficient: 3, rubrique: 'R1', levelIds: ['level-1', 'level-2', 'level-3', 'level-4', 'level-5', 'level-6', 'level-7', 'level-8', 'level-9', 'level-10', 'level-11', 'level-12'], academicYearId: 'ay-2024' },
  { id: 'sub-3', name: 'Créole', code: 'KRE', coefficient: 2, rubrique: 'R1', levelIds: ['level-1', 'level-2', 'level-3', 'level-4', 'level-5', 'level-6', 'level-7', 'level-8', 'level-9', 'level-10'], academicYearId: 'ay-2024' },
  { id: 'sub-4', name: 'Anglais', code: 'ENG', coefficient: 2, rubrique: 'R1', levelIds: ['level-1', 'level-2', 'level-3', 'level-4', 'level-5', 'level-6', 'level-7', 'level-8', 'level-9', 'level-10', 'level-11', 'level-12'], academicYearId: 'ay-2024' },
  { id: 'sub-5', name: 'Espagnol', code: 'ESP', coefficient: 2, rubrique: 'R1', levelIds: ['level-7', 'level-8', 'level-9', 'level-10', 'level-11', 'level-12'], academicYearId: 'ay-2024' },
  { id: 'sub-6', name: 'Sciences Physiques', code: 'PHY', coefficient: 3, rubrique: 'R1', levelIds: ['level-7', 'level-8', 'level-9', 'level-10', 'level-11', 'level-12'], academicYearId: 'ay-2024' },
  { id: 'sub-7', name: 'Sciences de la Vie et de la Terre', code: 'SVT', coefficient: 3, rubrique: 'R1', levelIds: ['level-7', 'level-8', 'level-9', 'level-10', 'level-11', 'level-12'], academicYearId: 'ay-2024' },
  { id: 'sub-8', name: 'Chimie', code: 'CHIM', coefficient: 3, rubrique: 'R1', levelIds: ['level-9', 'level-10', 'level-11', 'level-12'], academicYearId: 'ay-2024' },
  { id: 'sub-9', name: 'Histoire-Géographie', code: 'HIST', coefficient: 2, rubrique: 'R2', levelIds: ['level-1', 'level-2', 'level-3', 'level-4', 'level-5', 'level-6', 'level-7', 'level-8', 'level-9', 'level-10', 'level-11', 'level-12'], academicYearId: 'ay-2024' },
  { id: 'sub-10', name: 'Éducation Civique', code: 'CIV', coefficient: 1, rubrique: 'R2', levelIds: ['level-1', 'level-2', 'level-3', 'level-4', 'level-5', 'level-6', 'level-7', 'level-8', 'level-9', 'level-10'], academicYearId: 'ay-2024' },
  { id: 'sub-11', name: 'Philosophie', code: 'PHILO', coefficient: 3, rubrique: 'R2', levelIds: ['level-11', 'level-12'], academicYearId: 'ay-2024' },
  { id: 'sub-12', name: 'Économie', code: 'ECO', coefficient: 3, rubrique: 'R1', levelIds: ['level-8', 'level-11', 'level-12'], academicYearId: 'ay-2024' },
  { id: 'sub-13', name: 'Comptabilité', code: 'COMPTA', coefficient: 3, rubrique: 'R1', levelIds: ['level-8', 'level-11', 'level-12'], academicYearId: 'ay-2024' },
  { id: 'sub-14', name: 'Informatique', code: 'INFO', coefficient: 2, rubrique: 'R2', levelIds: ['level-5', 'level-6', 'level-7', 'level-8', 'level-9', 'level-10', 'level-11', 'level-12'], academicYearId: 'ay-2024' },
  { id: 'sub-15', name: 'Éducation Physique', code: 'EPS', coefficient: 1, rubrique: 'R3', levelIds: ['level-1', 'level-2', 'level-3', 'level-4', 'level-5', 'level-6', 'level-7', 'level-8', 'level-9', 'level-10', 'level-11', 'level-12'], academicYearId: 'ay-2024' },
  { id: 'sub-16', name: 'Arts Plastiques', code: 'ART', coefficient: 1, rubrique: 'R3', levelIds: ['level-1', 'level-2', 'level-3', 'level-4', 'level-5', 'level-6'], academicYearId: 'ay-2024' },
  { id: 'sub-17', name: 'Musique', code: 'MUS', coefficient: 1, rubrique: 'R3', levelIds: ['level-1', 'level-2', 'level-3', 'level-4', 'level-5', 'level-6'], academicYearId: 'ay-2024' },
  { id: 'sub-18', name: 'Sciences Expérimentales', code: 'SCIEXP', coefficient: 2, rubrique: 'R1', levelIds: ['level-1', 'level-2', 'level-3', 'level-4', 'level-5', 'level-6'], academicYearId: 'ay-2024' },
  { id: 'sub-19', name: 'Littérature', code: 'LITT', coefficient: 3, rubrique: 'R1', levelIds: ['level-7', 'level-11', 'level-12'], academicYearId: 'ay-2024' },
  { id: 'sub-20', name: 'Latin', code: 'LAT', coefficient: 2, rubrique: 'R2', levelIds: ['level-7', 'level-11', 'level-12'], academicYearId: 'ay-2024' },
  { id: 'sub-21', name: 'Biologie', code: 'BIO', coefficient: 4, rubrique: 'R1', levelIds: ['level-10', 'level-11', 'level-12'], academicYearId: 'ay-2024' },
  { id: 'sub-22', name: 'Géologie', code: 'GEO', coefficient: 2, rubrique: 'R1', levelIds: ['level-10'], academicYearId: 'ay-2024' },
  { id: 'sub-23', name: 'Technologie', code: 'TECH', coefficient: 2, rubrique: 'R2', levelIds: ['level-3', 'level-4', 'level-5', 'level-6'], academicYearId: 'ay-2024' },
  { id: 'sub-24', name: 'Religion', code: 'REL', coefficient: 1, rubrique: 'R3', levelIds: ['level-1', 'level-2', 'level-3', 'level-4', 'level-5', 'level-6'], academicYearId: 'ay-2024' }
]

// Informations de l'établissement
export const schoolInfo: SchoolInfo = {
  id: 'school-1',
  name: 'Cours Privé Mixte Saint Léonard',
  motto: "L'excellence avant tout",
  foundedYear: 1998,
  address: 'Port-au-Prince, Haïti',
  phone: '+509 3033 1295',
  email: 'courrier.information@stleonard.ht'
}

// Jours fériés (récurrents, sans année)
export const holidays: Holiday[] = [
  { id: 'holiday-1', name: "Jour de l'An", date: '01-01' },
  { id: 'holiday-2', name: "Jour de l'An (observé)", date: '01-02' },
  { id: 'holiday-3', name: 'Vendredi Saint', date: '04-07' },
  { id: 'holiday-4', name: 'Lundi de Pâques', date: '04-14' },
  { id: 'holiday-5', name: 'Fête du Drapeau', date: '05-18' },
  { id: 'holiday-6', name: 'Fête de la Vertières', date: '11-18' },
  { id: 'holiday-7', name: 'Noël', date: '12-25' }
]

// Événements scolaires (spécifiques à l'année active)
export const schoolEvents: SchoolEvent[] = [
  { id: 'event-1', title: 'Journée des Femmes', date: '2025-03-08', type: 'ceremony', academicYearId: 'ay-2024' },
  { id: 'event-2', title: 'Réunion parents-prof', date: '2025-04-15', type: 'meeting', academicYearId: 'ay-2024' },
  { id: 'event-3', title: 'Sortie culturelle 9e', date: '2025-05-20', type: 'trip', academicYearId: 'ay-2024' }
]

// Périodes (Étapes) - Exactement 4 étapes fixes par année
export const periods: Period[] = [
  // 2024-2025 (Active)
  { id: 'period-1', name: '1ère Étape', startDate: '2024-09-02', endDate: '2024-11-15', order: 1, status: 'closed', isBlancExam: false, academicYearId: 'ay-2024' },
  { id: 'period-2', name: '2ème Étape', startDate: '2024-11-18', endDate: '2025-02-07', order: 2, status: 'open', isBlancExam: false, academicYearId: 'ay-2024' },
  { id: 'period-3', name: '3ème Étape', startDate: '2025-02-10', endDate: '2025-04-25', order: 3, status: 'open', isBlancExam: false, academicYearId: 'ay-2024' },
  { id: 'period-4', name: '4ème Étape', startDate: '2025-04-28', endDate: '2025-06-27', order: 4, status: 'open', isBlancExam: false, academicYearId: 'ay-2024' },
  // 2025-2026 (En préparation)
  { id: 'period-5', name: '1ère Étape', startDate: '2025-09-01', endDate: '2025-11-14', order: 1, status: 'open', isBlancExam: false, academicYearId: 'ay-2025' },
  { id: 'period-6', name: '2ème Étape', startDate: '2025-11-17', endDate: '2026-02-06', order: 2, status: 'open', isBlancExam: false, academicYearId: 'ay-2025' },
  { id: 'period-7', name: '3ème Étape', startDate: '2026-02-09', endDate: '2026-04-24', order: 3, status: 'open', isBlancExam: false, academicYearId: 'ay-2025' },
  { id: 'period-8', name: '4ème Étape', startDate: '2026-04-27', endDate: '2026-06-26', order: 4, status: 'open', isBlancExam: false, academicYearId: 'ay-2025' }
]

// Élèves - Génération de 187 élèves répartis dans les 12 classes
const generateStudents = (): Student[] => {
  const maleFirstNames = [
    'Michel', 'Nicolas', 'Jean', 'Pierre', 'Luc', 'Marc', 'Paul', 'Jacques', 'François', 'Philippe', 'André',
    'David', 'Daniel', 'Christian', 'Bernard', 'Robert', 'Thomas', 'Laurent', 'Patrick', 'Alain',
    'Olivier', 'Eric', 'Frédéric', 'Sébastien', 'Vincent', 'Emmanuel', 'Arthur'
  ]
  
  const femaleFirstNames = [
    'Véronique', 'Karine', 'Marie', 'Sophie', 'Anne', 'Julie', 'Emma', 'Claire', 'Isabelle', 'Nathalie', 'Valérie', 'Catherine',
    'Sylvie', 'Martine', 'Monique', 'Nicole', 'Chantal', 'Sandrine', 'Stéphanie', 'Corinne', 'Brigitte',
    'Dominique', 'Laurence', 'Patricia', 'Christine'
  ]
  
  const lastNames = [
    'Nathan', 'Richard', 'Samuel', 'Tom', 'Jean-Baptiste', 'Pierre-Louis', 'Joseph', 'François', 'Charles', 'Antoine', 'Michel', 'Paul', 'Jacques', 'Louis',
    'Alexandre', 'Emmanuel', 'Gabriel', 'Raphaël', 'Daniel', 'David', 'Simon', 'Benjamin',
    'Etienne', 'Julien', 'Maxime', 'Lucas', 'Hugo', 'Théo', 'Léo', 'Arthur', 'Jules',
    'Dupont', 'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Petit', 'Durand', 'Leroy'
  ]
  
  const avatars = [
    'https://github.com/denizbuyuktas.png',
    'https://github.com/shoaibux1.png',
    'https://github.com/kdrnp.png',
    'https://github.com/yahyabedirhan.png',
    'https://github.com/yusufhilmi.png',
    'https://github.com/polymet-ai.png'
  ]
  
  const classDistribution = [
    { classId: 'room-1', levelId: 'level-7e', count: 32 },
    { classId: 'room-2', levelId: 'level-7e', count: 30 },
    { classId: 'room-3', levelId: 'level-8e', count: 31 },
    { classId: 'room-4', levelId: 'level-8e', count: 28 },
    { classId: 'room-5', levelId: 'level-9e', count: 30 },
    { classId: 'room-6', levelId: 'level-nsi', count: 0 }, // Will add specific students
    { classId: 'room-7', levelId: 'level-nsi', count: 28 },
    { classId: 'room-8', levelId: 'level-nsi', count: 26 },
    { classId: 'room-9', levelId: 'level-nsi', count: 27 }
  ]
  
  const students: Student[] = []
  let studentCounter = 1
  
  // Add specific students for NSI LLA (room-6) first
  const nsiLLAStudents = [
    { firstName: 'Alain', lastName: 'Dupont', gender: 'M' as const },
    { firstName: 'Robert', lastName: 'Emmanuel', gender: 'M' as const },
    { firstName: 'Marie', lastName: 'François', gender: 'F' as const },
    { firstName: 'Sophie', lastName: 'Jean', gender: 'F' as const },
    { firstName: 'Patrick', lastName: 'Joseph', gender: 'M' as const },
    { firstName: 'Claire', lastName: 'Louis', gender: 'F' as const },
    { firstName: 'André', lastName: 'Michel', gender: 'M' as const },
    { firstName: 'Nathalie', lastName: 'Pierre', gender: 'F' as const }
  ]
  
  nsiLLAStudents.forEach((student, index) => {
    const year = 2008 + Math.floor(Math.random() * 2)
    const month = Math.floor(Math.random() * 12) + 1
    const day = Math.floor(Math.random() * 28) + 1
    
    const nisu = `${String(studentCounter).padStart(12, '0')}`
    const avatar = avatars[Math.floor(Math.random() * avatars.length)]
    
    // Generate student code
    const firstPart = student.firstName.slice(0, 2).toUpperCase().padEnd(2, 'X')
    const lastPart = student.lastName.slice(0, 2).toUpperCase().padEnd(2, 'X')
    const sequentialNumber = String(studentCounter).padStart(4, '0')
    const studentCode = `${firstPart}${lastPart}${sequentialNumber}`
    
    students.push({
      id: `student-${studentCounter}`,
      matricule: `CPMSL${String(studentCounter).padStart(4, '0')}`,
      studentCode,
      nisu,
      firstName: student.firstName,
      lastName: student.lastName,
      dateOfBirth: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      gender: student.gender,
      classroomId: 'room-6',
      levelId: 'level-nsi',
      avatar,
      academicYearId: 'ay-2024'
    })
    
    studentCounter++
  })
  
  // Generate remaining students
  classDistribution.forEach(({ classId, levelId, count }) => {
    for (let i = 0; i < count; i++) {
      const gender = Math.random() > 0.5 ? 'M' : 'F'
      const firstName = gender === 'M' 
        ? maleFirstNames[Math.floor(Math.random() * maleFirstNames.length)]
        : femaleFirstNames[Math.floor(Math.random() * femaleFirstNames.length)]
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
      const year = 2008 + Math.floor(Math.random() * 6)
      const month = Math.floor(Math.random() * 12) + 1
      const day = Math.floor(Math.random() * 28) + 1
      
      // Pour les tests : 3 élèves avec NISU invalide, 8 sans photo
      let nisu = `${String(studentCounter).padStart(12, '0')}`
      if (studentCounter === 15) nisu = '12345' // NISU invalide (5 chiffres)
      if (studentCounter === 22) nisu = '123456789' // NISU invalide (9 chiffres)
      if (studentCounter === 33) nisu = '12345678901' // NISU invalide (11 chiffres)
      
      let avatar: string | undefined = avatars[Math.floor(Math.random() * avatars.length)]
      // 8 élèves sans photo
      if ([13, 17, 21, 25, 29, 34, 38, 42].includes(studentCounter)) {
        avatar = undefined
      }
      
      // Generate student code: 2 letters from first name + 2 letters from last name + 4 sequential digits
      const firstPart = firstName.slice(0, 2).toUpperCase().padEnd(2, 'X')
      const lastPart = lastName.slice(0, 2).toUpperCase().padEnd(2, 'X')
      const sequentialNumber = String(studentCounter).padStart(4, '0')
      const studentCode = `${firstPart}${lastPart}${sequentialNumber}`
      
      students.push({
        id: `student-${studentCounter}`,
        matricule: `CPMSL${String(studentCounter).padStart(4, '0')}`,
        studentCode,
        nisu,
        firstName,
        lastName,
        dateOfBirth: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        gender,
        classroomId: classId,
        levelId: levelId,
        avatar,
        academicYearId: 'ay-2024'
      })
      
      studentCounter++
    }
  })
  
  return students
}

export const students: Student[] = generateStudents()

// Professeurs
export const teachers: Teacher[] = [
  {
    id: 'teacher-1',
    firstName: 'Jean',
    lastName: 'Martin',
    email: 'prof.martin@school.com',
    phone: '+33 6 12 34 56 78',
    subjectIds: ['sub-1'],
    levelIds: ['level-10', 'level-11', 'level-12'],
    avatar: 'https://github.com/kdrnp.png',
    academicYearId: 'ay-2024'
  },
  {
    id: 'teacher-2',
    firstName: 'Sophie',
    lastName: 'Bernard',
    email: 'prof.bernard@school.com',
    phone: '+33 6 23 45 67 89',
    subjectIds: ['sub-2', 'sub-3'],
    levelIds: ['level-10', 'level-11', 'level-12'],
    avatar: 'https://github.com/yahyabedirhan.png',
    academicYearId: 'ay-2024'
  },
  {
    id: 'teacher-3',
    firstName: 'Marc',
    lastName: 'Lefebvre',
    email: 'prof.lefebvre@school.com',
    phone: '+33 6 34 56 78 90',
    subjectIds: ['sub-4', 'sub-5'],
    levelIds: ['level-10', 'level-11', 'level-12'],
    avatar: 'https://github.com/yusufhilmi.png',
    academicYearId: 'ay-2024'
  }
]

// Attitudes (comportement)
export const attitudes: Attitude[] = [
  { id: 'att-1', label: 'Respectueux(se)', academicYearId: 'ay-2024' },
  { id: 'att-2', label: 'Ponctuel(le)', academicYearId: 'ay-2024' },
  { id: 'att-3', label: 'Attentif(ve)', academicYearId: 'ay-2024' },
  { id: 'att-4', label: 'Travailleur(se)', academicYearId: 'ay-2024' },
  { id: 'att-5', label: 'Perturbateur(trice)', academicYearId: 'ay-2024' }
]

// Comportements élèves
export const studentBehaviors: StudentBehavior[] = [
  // NSI LLA - 1ère Étape (closed period) - Sample data to show read-only state
  {
    id: 'beh-1',
    studentId: 'student-2', // Robert Emmanuel
    classroomId: 'room-6',
    periodId: 'period-1',
    academicYearId: 'ay-2024',
    absences: 2,
    retards: 1,
    devoirsManques: 0,
    attitudeResponses: [
      { attitudeId: 'att-1', value: true },  // Respectueux(se): Oui
      { attitudeId: 'att-2', value: true },  // Ponctuel(le): Oui
      { attitudeId: 'att-3', value: true },  // Attentif(ve): Oui
      { attitudeId: 'att-4', value: true },  // Travailleur(se): Oui
      { attitudeId: 'att-5', value: false }  // Perturbateur(trice): Non
    ],
    pointsForts: 'Excellente participation en classe, toujours préparé',
    defis: 'Pourrait améliorer sa gestion du temps',
    remarque: 'Élève sérieux et motivé',
    createdAt: '2024-11-15T10:00:00Z',
    updatedAt: '2024-11-15T10:00:00Z'
  },
  {
    id: 'beh-2',
    studentId: 'student-3', // Marie François
    classroomId: 'room-6',
    periodId: 'period-1',
    academicYearId: 'ay-2024',
    absences: 0,
    retards: 0,
    devoirsManques: 0,
    attitudeResponses: [
      { attitudeId: 'att-1', value: true },  // Respectueux(se): Oui
      { attitudeId: 'att-2', value: true },  // Ponctuel(le): Oui
      { attitudeId: 'att-3', value: true },  // Attentif(ve): Oui
      { attitudeId: 'att-4', value: true },  // Travailleur(se): Oui
      { attitudeId: 'att-5', value: false }  // Perturbateur(trice): Non
    ],
    pointsForts: 'Excellente élève, très organisée',
    defis: '',
    remarque: 'Comportement exemplaire',
    createdAt: '2024-11-15T10:05:00Z',
    updatedAt: '2024-11-15T10:05:00Z'
  },
  {
    id: 'beh-3',
    studentId: 'student-5', // Patrick Joseph
    classroomId: 'room-6',
    periodId: 'period-1',
    academicYearId: 'ay-2024',
    absences: 5,
    retards: 3,
    devoirsManques: 2,
    attitudeResponses: [
      { attitudeId: 'att-1', value: false }, // Respectueux(se): Non
      { attitudeId: 'att-2', value: false }, // Ponctuel(le): Non
      { attitudeId: 'att-3', value: false }, // Attentif(ve): Non
      { attitudeId: 'att-4', value: false }, // Travailleur(se): Non
      { attitudeId: 'att-5', value: true }   // Perturbateur(trice): Oui
    ],
    pointsForts: 'Bon potentiel quand il est concentré',
    defis: 'Doit améliorer son assiduité et sa concentration',
    remarque: 'Besoin de plus de discipline et de régularité',
    createdAt: '2024-11-15T10:10:00Z',
    updatedAt: '2024-11-15T10:10:00Z'
  }
]

// Notes (sur 10)
export const grades: Grade[] = [
  // NSI LLA - SubjectChildren grades - 1ère Étape (period-1)
  // Communication Française (sc-1)
  { id: 'grade-nsi-1', studentId: 'student-2', subjectId: 'sc-1', periodId: 'period-1', value: 7.5, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' }, // Robert Emmanuel
  { id: 'grade-nsi-2', studentId: 'student-3', subjectId: 'sc-1', periodId: 'period-1', value: 8.0, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' }, // Marie François
  { id: 'grade-nsi-3', studentId: 'student-5', subjectId: 'sc-1', periodId: 'period-1', value: 6.0, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' }, // Patrick Joseph
  { id: 'grade-nsi-4', studentId: 'student-7', subjectId: 'sc-1', periodId: 'period-1', value: 9.5, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' }, // André Michel
  
  // Communication Créole (sc-2)
  { id: 'grade-nsi-5', studentId: 'student-2', subjectId: 'sc-2', periodId: 'period-1', value: 8.0, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  { id: 'grade-nsi-6', studentId: 'student-3', subjectId: 'sc-2', periodId: 'period-1', value: 7.5, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  { id: 'grade-nsi-7', studentId: 'student-5', subjectId: 'sc-2', periodId: 'period-1', value: 6.5, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  { id: 'grade-nsi-8', studentId: 'student-7', subjectId: 'sc-2', periodId: 'period-1', value: 9.0, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  
  // Algèbre (sc-3)
  { id: 'grade-nsi-9', studentId: 'student-2', subjectId: 'sc-3', periodId: 'period-1', value: 7.0, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  { id: 'grade-nsi-10', studentId: 'student-3', subjectId: 'sc-3', periodId: 'period-1', value: 8.5, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  { id: 'grade-nsi-11', studentId: 'student-5', subjectId: 'sc-3', periodId: 'period-1', value: 5.5, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  { id: 'grade-nsi-12', studentId: 'student-7', subjectId: 'sc-3', periodId: 'period-1', value: 9.0, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  
  // Géométrie (sc-4)
  { id: 'grade-nsi-13', studentId: 'student-2', subjectId: 'sc-4', periodId: 'period-1', value: 7.5, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  { id: 'grade-nsi-14', studentId: 'student-3', subjectId: 'sc-4', periodId: 'period-1', value: 8.0, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  { id: 'grade-nsi-15', studentId: 'student-5', subjectId: 'sc-4', periodId: 'period-1', value: 6.0, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  { id: 'grade-nsi-16', studentId: 'student-7', subjectId: 'sc-4', periodId: 'period-1', value: 8.5, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  
  // Sciences Naturelles (sc-5)
  { id: 'grade-nsi-17', studentId: 'student-2', subjectId: 'sc-5', periodId: 'period-1', value: 8.0, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  { id: 'grade-nsi-18', studentId: 'student-3', subjectId: 'sc-5', periodId: 'period-1', value: 7.5, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  { id: 'grade-nsi-19', studentId: 'student-5', subjectId: 'sc-5', periodId: 'period-1', value: 6.5, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  { id: 'grade-nsi-20', studentId: 'student-7', subjectId: 'sc-5', periodId: 'period-1', value: 9.0, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  
  // Physique-Chimie (sc-6)
  { id: 'grade-nsi-21', studentId: 'student-2', subjectId: 'sc-6', periodId: 'period-1', value: 7.5, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  { id: 'grade-nsi-22', studentId: 'student-3', subjectId: 'sc-6', periodId: 'period-1', value: 8.0, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  { id: 'grade-nsi-23', studentId: 'student-5', subjectId: 'sc-6', periodId: 'period-1', value: 6.0, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  { id: 'grade-nsi-24', studentId: 'student-7', subjectId: 'sc-6', periodId: 'period-1', value: 8.5, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  
  // Anglais (sc-7)
  { id: 'grade-nsi-25', studentId: 'student-2', subjectId: 'sc-7', periodId: 'period-1', value: 8.5, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  { id: 'grade-nsi-26', studentId: 'student-3', subjectId: 'sc-7', periodId: 'period-1', value: 7.5, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  { id: 'grade-nsi-27', studentId: 'student-5', subjectId: 'sc-7', periodId: 'period-1', value: 7.0, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  { id: 'grade-nsi-28', studentId: 'student-7', subjectId: 'sc-7', periodId: 'period-1', value: 9.0, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  
  // Espagnol (sc-8)
  { id: 'grade-nsi-29', studentId: 'student-2', subjectId: 'sc-8', periodId: 'period-1', value: 8.0, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  { id: 'grade-nsi-30', studentId: 'student-3', subjectId: 'sc-8', periodId: 'period-1', value: 7.0, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  { id: 'grade-nsi-31', studentId: 'student-5', subjectId: 'sc-8', periodId: 'period-1', value: 6.5, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' },
  { id: 'grade-nsi-32', studentId: 'student-7', subjectId: 'sc-8', periodId: 'period-1', value: 8.5, maxValue: 10, createdAt: '2024-11-15', academicYearId: 'ay-2024' }
]

// Fonctions utilitaires
export const getActiveAcademicYear = (): AcademicYear | undefined => {
  return academicYears.find(ay => ay.isActive)
}

export const getStudentsByClassroom = (classroomId: string): Student[] => {
  return students.filter(s => s.classroomId === classroomId)
}

export const getGradesByStudent = (studentId: string, periodId?: string): Grade[] => {
  return grades.filter(g => g.studentId === studentId && (!periodId || g.periodId === periodId))
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GRADE CALCULATION FUNCTIONS (CPMSL Business Rules)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Calculate the mean grade for one SubjectParent for a student in a period
 * 
 * RULE: Weighted average of SubjectChildren grades
 * Formula: Σ(childGrade × child.coefficient) / Σ(child.coefficient)
 * Missing grades are EXCLUDED from both numerator and denominator
 * 
 * @param studentId - Student ID
 * @param parentId - SubjectParent ID
 * @param periodId - Period ID
 * @param grades - All grades
 * @param subjectChildren - All subject children
 * @param isBlancExam - If true, grade is directly on parent (no children averaging)
 * @returns Mean grade on base 10, or null if no grades entered
 * 
 * TEST 1 — SubjectParent mean, missing grade excluded
 * SubjectChildren: sc-A (coeff 2, grade 8.0), sc-B (coeff 1, no grade)
 * Expected: (8.0 × 2) / 2 = 8.00 (NOT 8.0×2 + 0×1 / 3 = 5.33)
 */
export function calculateSubjectParentMean(
  studentId: string,
  parentId: string,
  periodId: string,
  grades: Grade[],
  subjectChildren: SubjectChild[],
  isBlancExam: boolean
): number | null {
  // For blanc exams, grade is directly on parent
  if (isBlancExam) {
    const parentGrade = grades.find(
      g => g.studentId === studentId && g.subjectId === parentId && g.periodId === periodId
    )
    return parentGrade ? parentGrade.value : null
  }

  // Get all children for this parent
  const children = subjectChildren.filter(sc => sc.parentId === parentId)
  if (children.length === 0) return null

  let totalWeighted = 0
  let totalCoefficients = 0

  children.forEach(child => {
    const grade = grades.find(
      g => g.studentId === studentId && g.subjectId === child.id && g.periodId === periodId
    )
    
    // Only include if grade exists (missing grades are excluded)
    if (grade && grade.value !== null && grade.value !== undefined) {
      totalWeighted += grade.value * child.coefficient
      totalCoefficients += child.coefficient
    }
  })

  // If no grades at all, return null
  if (totalCoefficients === 0) return null

  return totalWeighted / totalCoefficients
}

/**
 * Calculate the full step average (Moyenne Étape) for a student
 * 
 * RULE: BR-001 from SRS
 * Moyenne Étape = (moyR1 × 0.70) + (moyR2 × 0.25) + (moyR3 × 0.05)
 * 
 * Where each moyRx is the weighted average of SubjectParent means in that rubrique
 * If a rubrique has no subjects, redistribute weight proportionally
 * 
 * @param studentId - Student ID
 * @param periodId - Period ID
 * @param levelId - Student's level ID
 * @param filiereId - Student's filière ID (null for tronc commun)
 * @param grades - All grades
 * @param subjectParents - All subject parents
 * @param subjectChildren - All subject children
 * @param isBlancExam - If true, grades are on parents directly
 * @returns Step average on base 10, or null if no grades at all
 * 
 * TEST 2 — Full étape mean
 * R1 subjects means: [7.0, 8.0] coeffs [2, 3] → moyR1 = (14+24)/5 = 7.60
 * R2 subjects means: [6.0] coeff [1]          → moyR2 = 6.00
 * R3 subjects means: [9.0] coeff [1]          → moyR3 = 9.00
 * Expected: 7.60×0.70 + 6.00×0.25 + 9.00×0.05 = 5.32+1.50+0.45 = 7.27
 */
export function calculateStudentEtapeMean(
  studentId: string,
  periodId: string,
  levelId: string,
  filiereId: string | null,
  grades: Grade[],
  subjectParents: SubjectParent[],
  subjectChildren: SubjectChild[],
  isBlancExam: boolean
): number | null {
  // Filter subject parents for this level
  const levelSubjects = subjectParents.filter(sp => sp.levelIds.includes(levelId))
  if (levelSubjects.length === 0) return null

  // Calculate weighted average for each rubrique
  const rubriqueAverages = new Map<string, number>()
  const rubriqueWeights = new Map<string, number>()

  ;(['R1', 'R2', 'R3'] as const).forEach(rubrique => {
    const rubriqueSubjects = levelSubjects.filter(sp => sp.rubrique === rubrique)
    if (rubriqueSubjects.length === 0) return

    let totalWeighted = 0
    let totalCoefficients = 0

    rubriqueSubjects.forEach(parent => {
      const mean = calculateSubjectParentMean(
        studentId,
        parent.id,
        periodId,
        grades,
        subjectChildren,
        isBlancExam
      )

      if (mean !== null) {
        // Get coefficient for this filière (or tronc commun)
        const coeffObj = parent.coefficients.find(c => c.filiereId === filiereId)
        const coefficient = coeffObj?.valeur || 0

        if (coefficient > 0) {
          totalWeighted += mean * coefficient
          totalCoefficients += coefficient
        }
      }
    })

    if (totalCoefficients > 0) {
      rubriqueAverages.set(rubrique, totalWeighted / totalCoefficients)
      rubriqueWeights.set(rubrique, totalCoefficients)
    }
  })

  // If no grades at all, return null
  if (rubriqueAverages.size === 0) return null

  // Apply 70/25/5 weights with redistribution if needed
  const baseWeights = { R1: 0.70, R2: 0.25, R3: 0.05 }
  let finalAverage = 0
  let totalWeight = 0

  // Calculate which rubriques have data
  const availableRubriques = Array.from(rubriqueAverages.keys())
  
  // Calculate total base weight for available rubriques
  availableRubriques.forEach(rubrique => {
    totalWeight += baseWeights[rubrique as keyof typeof baseWeights]
  })

  // Apply weights (redistributed proportionally if some rubriques are missing)
  availableRubriques.forEach(rubrique => {
    const baseWeight = baseWeights[rubrique as keyof typeof baseWeights]
    const redistributedWeight = baseWeight / totalWeight
    const average = rubriqueAverages.get(rubrique)!
    finalAverage += average * redistributedWeight
  })

  return finalAverage
}

/**
 * Calculate class average for a period
 * 
 * RULE: Average of all individual student averages (moyEtape)
 * Students with no grades at all are EXCLUDED
 * 
 * @param classroomStudents - Students in the classroom
 * @param periodId - Period ID
 * @param grades - All grades
 * @param subjectParents - All subject parents
 * @param subjectChildren - All subject children
 * @param isBlancExam - If true, grades are on parents directly
 * @returns Class average on base 10, or null if no students have grades
 */
export function calculateClassMean(
  classroomStudents: Student[],
  periodId: string,
  grades: Grade[],
  subjectParents: SubjectParent[],
  subjectChildren: SubjectChild[],
  isBlancExam: boolean
): number | null {
  let totalAverage = 0
  let studentCount = 0

  classroomStudents.forEach(student => {
    const studentAverage = calculateStudentEtapeMean(
      student.id,
      periodId,
      student.levelId,
      null, // TODO: Get filière from student or classroom
      grades,
      subjectParents,
      subjectChildren,
      isBlancExam
    )

    if (studentAverage !== null) {
      totalAverage += studentAverage
      studentCount++
    }
  })

  return studentCount > 0 ? totalAverage / studentCount : null
}

/**
 * Check if a student has complete grades for a period
 * 
 * RULE: A student is "grade-complete" if ALL SubjectChildren belonging to
 * SubjectParents that are in subjectParent.levelIds (matching student's levelId)
 * have at least one grade entered for that student + period
 * 
 * @param studentId - Student ID
 * @param levelId - Student's level ID
 * @param periodId - Period ID
 * @param grades - All grades
 * @param subjectParents - All subject parents
 * @param subjectChildren - All subject children
 * @param isBlancExam - If true, check grades on parents directly
 * @returns true if all required grades are entered
 * 
 * TEST 3 — isStudentGradeComplete
 * Student in level-7e, 3 subjectChildren mapped to level-7e subjects
 * 2 grades entered, 1 missing → Expected: false
 * 3 grades entered             → Expected: true
 * No check on level-nsi subjects for this student
 */
export function isStudentGradeComplete(
  studentId: string,
  levelId: string,
  periodId: string,
  grades: Grade[],
  subjectParents: SubjectParent[],
  subjectChildren: SubjectChild[],
  isBlancExam: boolean
): boolean {
  // Get subject parents for this level
  const levelSubjectParents = subjectParents.filter(sp => sp.levelIds.includes(levelId))
  if (levelSubjectParents.length === 0) return true // No subjects = complete by default

  if (isBlancExam) {
    // For blanc exams, check grades on parents directly
    return levelSubjectParents.every(parent => {
      const grade = grades.find(
        g => g.studentId === studentId && g.subjectId === parent.id && g.periodId === periodId
      )
      return grade !== undefined && grade.value !== null && grade.value !== undefined
    })
  } else {
    // For normal periods, check all children of level's parents
    const requiredChildren = subjectChildren.filter(sc => {
      const parent = levelSubjectParents.find(sp => sp.id === sc.parentId)
      return parent !== undefined
    })

    if (requiredChildren.length === 0) return true

    return requiredChildren.every(child => {
      const grade = grades.find(
        g => g.studentId === studentId && g.subjectId === child.id && g.periodId === periodId
      )
      return grade !== undefined && grade.value !== null && grade.value !== undefined
    })
  }
}

/**
 * @deprecated Use calculateStudentEtapeMean instead
 * This function is kept for backward compatibility only
 */
export const calculateStudentAverage = (studentId: string, periodId: string): number => {
  const studentGrades = getGradesByStudent(studentId, periodId)
  if (studentGrades.length === 0) return 0
  
  let totalWeighted = 0
  let totalCoefficients = 0
  
  studentGrades.forEach(grade => {
    const subject = subjects.find(s => s.id === grade.subjectId)
    if (subject) {
      const gradeValue = (grade.value / grade.maxValue) * 20
      totalWeighted += gradeValue * subject.coefficient
      totalCoefficients += subject.coefficient
    }
  })
  
  return totalCoefficients > 0 ? totalWeighted / totalCoefficients : 0
}

export const getClassroomByLevel = (levelId: string): Classroom[] => {
  return classrooms.filter(c => c.levelId === levelId)
}

export const getSubjectsByLevel = (levelId: string): Subject[] => {
  return subjects.filter(s => s.levelIds.includes(levelId))
}

export const getLevelById = (levelId: string): Level | undefined => {
  return levels.find(l => l.id === levelId)
}

export const getClassroomById = (classroomId: string): Classroom | undefined => {
  return classrooms.find(c => c.id === classroomId)
}

export const getPeriodById = (periodId: string): Period | undefined => {
  return periods.find(p => p.id === periodId)
}

// Fonction pour formater l'affichage combiné "Classe + Salle"
export const formatClassroomDisplay = (levelId: string, classroomId: string): string => {
  const level = getLevelById(levelId)
  const classroom = getClassroomById(classroomId)
  
  if (!level || !classroom) return ''
  
  return `${level.name} Salle ${classroom.name}`
}

// Fonction pour obtenir toutes les salles d'une classe avec affichage formaté
export const getClassroomOptionsForLevel = (levelId: string): { id: string; label: string }[] => {
  const level = getLevelById(levelId)
  if (!level) return []
  
  const levelClassrooms = getClassroomByLevel(levelId)
  
  return levelClassrooms.map(classroom => ({
    id: classroom.id,
    label: `${level.name} Salle ${classroom.name}`
  }))
}