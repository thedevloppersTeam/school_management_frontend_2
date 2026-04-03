// ============================================================================
// TYPES - École CSM School Management System
// ============================================================================

// User & Authentication Types
export type UserRole = "SYSTEM_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";

export interface User {
  id: string;
  username: string;
  email: string;
  type: UserRole;
  firstname?: string;
  lastname?: string;
  birthDate?: string;
  profilePhoto?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  session: {
    userId: string;
    type: UserRole;
  };
}

export interface SessionUser {
  userId: string;
  type: UserRole;
}

// Student Types
export interface Student {
  id: string;
  userId: string;
  studentCode?: string;
  address?: string;
  nisu?: string;
  motherName?: string;
  fatherName?: string;
  phone1?: string;
  phone2?: string;
  parentsEmail?: string;
  user?: User;
}

// Teacher Types
export interface Teacher {
  id: string;
  userId: string;
  address?: string;
  phone?: string;
  email?: string;
  hireDate?: string;
  role?: string;
  description?: string;
  isActive: boolean;
  user?: User;
}

// Academic Year Types
export interface AcademicYear {
  id: string;
  name: string;
  yearString: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  createdAt?: string;
}

export interface AcademicStep {
  id: string;
  academicYearId: string;
  name: string;
  stepNumber: number;
  startDate: string;
  endDate: string;
}

// Class Types
export interface ClassTrack {
  id: string;
  name: string;
  code: string;
  description?: string;
}

export interface ClassType {
  id: string;
  name: string;
  isTerminal: boolean;
}

export interface Class {
  id: string;
  classTypeId: string;
  letter: string;
  trackId?: string;
  maxStudents: number;
  description?: string;
  classType?: ClassType;
  track?: ClassTrack;
}

export interface ClassSession {
  id: string;
  classId: string;
  academicYearId: string;
  class?: Class;
  academicYear?: AcademicYear;
}

// Subject Types
export interface SubjectRubric {
  id: string;
  name: string;
  code: string;
  description?: string;
}

export interface Subject {
  id: string;
  rubricId?: string;
  name: string;
  code: string;
  maxScore: number;
  coefficient: number;
  hasSections: boolean;
  description?: string;
  rubric?: SubjectRubric;
  sections?: SubjectSection[];
}

export interface SubjectSection {
  id: string;
  subjectId: string;
  name: string;
  code: string;
  maxScore: number;
  displayOrder: number;
}

// Class Subject Assignment
export interface ClassSubject {
  id: string;
  classSessionId: string;
  subjectId: string;
  teacherId: string;
  coefficientOverride?: number;
  subject?: Subject;
  teacher?: Teacher;
  classSession?: ClassSession;
}

// Enrollment Types
export type EnrollmentStatus = "ACTIVE" | "GRADUATED" | "TRANSFERRED" | "DROPPED";

export interface Enrollment {
  id: string;
  studentId: string;
  classSessionId: string;
  status: EnrollmentStatus;
  notes?: string;
  enrolledAt: string;
  student?: Student;
  classSession?: ClassSession;
}

// Grade Types
export type GradeType = "EXAM" | "HOMEWORK" | "ORAL";

export interface Grade {
  id: string;
  enrollmentId: string;
  classSubjectId: string;
  sectionId?: string;
  stepId: string;
  studentScore: number | { s: number; e: number; d: number[] };
  gradeType: GradeType;
  comment?: string;
  gradedAt?: string;
  enrollment?: Enrollment;
  classSubject?: ClassSubject;
  section?: SubjectSection;
  step?: AcademicStep;
}

export interface BulkGradeCreate {
  enrollmentId: string;
  classSubjectId: string;
  sectionId?: string;
  stepId: string;
  studentScore: number;
  gradeType: GradeType;
  comment?: string;
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Form Data Types
export interface UserCreateData {
  lastname: string;
  firstname: string;
  birthDate?: string;
  username: string;
  email: string;
  password: string;
  type: UserRole;
}

export interface UserUpdateData {
  lastname?: string;
  firstname?: string;
  birthDate?: string;
  username?: string;
  email?: string;
  profilePhoto?: string;
  type?: UserRole;
}

export interface StudentCreateData {
  userId: string;
  address?: string;
  motherName?: string;
  fatherName?: string;
  phone1?: string;
  phone2?: string;
  parentsEmail?: string;
}

export interface TeacherCreateData {
  userId: string;
  address?: string;
  phone?: string;
  email?: string;
  hireDate?: string;
  role?: string;
  description?: string;
}

export interface AcademicYearCreateData {
  name: string;
  yearString: string;
  startDate: string;
  endDate: string;
}

export interface StepCreateData {
  name: string;
  stepNumber: number;
  startDate: string;
  endDate: string;
}

export interface ClassCreateData {
  classTypeId: string;
  letter: string;
  trackId?: string;
  maxStudents: number;
  description?: string;
}

export interface SubjectCreateData {
  rubricId?: string;
  name: string;
  code: string;
  maxScore: number;
  coefficient: number;
  hasSections: boolean;
  description?: string;
}

export interface EnrollmentCreateData {
  studentId: string;
  classSessionId: string;
  notes?: string;
}

export interface GradeCreateData {
  enrollmentId: string;
  classSubjectId: string;
  sectionId?: string;
  stepId: string;
  studentScore: number;
  gradeType: GradeType;
  comment?: string;
  gradedAt?: string;
}
