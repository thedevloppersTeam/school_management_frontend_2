import api from "@/lib/api";
import type {
  LoginRequest,
  LoginResponse,
  User,
  AcademicYear,
  AcademicStep,
  ClassTrack,
  ClassType,
  Class,
  ClassSession,
  SubjectRubric,
  Subject,
  SubjectSection,
  ClassSubject,
  Enrollment,
  EnrollmentStatus,
  Grade,
  Teacher,
} from "@/types";

// ============================================================================
// Authentication API
// ============================================================================
export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>("/api/users/login", data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await api.post("/api/users/logout");
  },

  getCurrentSession: async (): Promise<{ userId: string; type: string } | null> => {
    try {
      const response = await api.get("/api/users/session");
      return response.data;
    } catch {
      return null;
    }
  },
};

// ============================================================================
// Users API
// ============================================================================
export const usersApi = {
  getAll: async (): Promise<User[]> => {
    const response = await api.post<User[]>("/api/users/", {});
    return response.data;
  },

  getById: async (id: string): Promise<User> => {
    const response = await api.get<User>(`/api/users/${id}`);
    return response.data;
  },

  create: async (data: Record<string, unknown>): Promise<User> => {
    const response = await api.post<{ message: string; user: User }>("/api/users/create", data);
    return response.data.user || response.data as unknown as User;
  },

  update: async (id: string, data: Record<string, unknown>): Promise<User> => {
    const response = await api.post<{ message: string; user: User }>(`/api/users/update/${id}`, data);
    return response.data.user || response.data as unknown as User;
  },

  updateStatus: async (id: string, isActive: boolean): Promise<User> => {
    const response = await api.post<{ message: string; user: User }>(`/api/users/status-update/${id}`, { isActive });
    return response.data.user || response.data as unknown as User;
  },

  updateMyPassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await api.post("/api/users/update-my-password", { currentPassword, newPassword });
  },

  updateMyProfile: async (data: { lastname?: string; firstname?: string; email?: string }): Promise<User> => {
    const response = await api.post<User>("/api/users/update-my-profile", data);
    return response.data;
  },
};

// ============================================================================
// Students API
// ============================================================================
export const studentsApi = {
  getAll: async (): Promise<unknown[]> => {
    const response = await api.post("/api/students/", {});
    return response.data;
  },

  getById: async (id: string): Promise<unknown> => {
    const response = await api.get(`/api/students/${id}`);
    return response.data;
  },

  create: async (data: Record<string, unknown>): Promise<unknown> => {
    const response = await api.post("/api/students/create", data);
    return response.data;
  },

  update: async (id: string, data: Record<string, unknown>): Promise<unknown> => {
    const response = await api.post(`/api/students/update/${id}`, data);
    return response.data;
  },
};

// ============================================================================
// Teachers API
// ============================================================================
export const teachersApi = {
  getAll: async (): Promise<Teacher[]> => {
    const response = await api.post<Teacher[]>("/api/teachers/", {});
    return response.data;
  },

  getById: async (id: string): Promise<Teacher> => {
    const response = await api.get<Teacher>(`/api/teachers/${id}`);
    return response.data;
  },

  create: async (data: Record<string, unknown>): Promise<Teacher> => {
    const response = await api.post<{ message: string; teacher: Teacher }>("/api/teachers/create", data);
    return response.data.teacher || response.data as unknown as Teacher;
  },

  update: async (id: string, data: Record<string, unknown>): Promise<Teacher> => {
    const response = await api.post<{ message: string; teacher: Teacher }>(`/api/teachers/update/${id}`, data);
    return response.data.teacher || response.data as unknown as Teacher;
  },

  updateStatus: async (id: string, isActive: boolean): Promise<Teacher> => {
    const response = await api.post<{ message: string; teacher: Teacher }>(`/api/teachers/status-update/${id}`, { isActive });
    return response.data.teacher || response.data as unknown as Teacher;
  },
};

// ============================================================================
// Academic Years API
// ============================================================================
export const academicYearsApi = {
  getAll: async (): Promise<AcademicYear[]> => {
    const response = await api.get<AcademicYear[]>("/api/academic-years/");
    return response.data;
  },

  getById: async (id: string): Promise<AcademicYear> => {
    const response = await api.get<AcademicYear>(`/api/academic-years/${id}`);
    return response.data;
  },

  create: async (data: Record<string, unknown>): Promise<AcademicYear> => {
    const response = await api.post<AcademicYear>("/api/academic-years/create", data);
    return response.data;
  },

  update: async (id: string, data: Record<string, unknown>): Promise<AcademicYear> => {
    const response = await api.post<AcademicYear>(`/api/academic-years/update/${id}`, data);
    return response.data;
  },

  setCurrent: async (id: string): Promise<AcademicYear> => {
    const response = await api.post<AcademicYear>(`/api/academic-years/set-current/${id}`);
    return response.data;
  },

  getSteps: async (academicYearId: string): Promise<AcademicStep[]> => {
    const response = await api.get<AcademicStep[]>(`/api/academic-years/${academicYearId}/steps`);
    return response.data;
  },

  createStep: async (academicYearId: string, data: Record<string, unknown>): Promise<AcademicStep> => {
    const response = await api.post<AcademicStep>(`/api/academic-years/${academicYearId}/steps/create`, data);
    return response.data;
  },

  updateStep: async (id: string, data: Record<string, unknown>): Promise<AcademicStep> => {
    const response = await api.post<AcademicStep>(`/api/academic-years/steps/update/${id}`, data);
    return response.data;
  },
};

// ============================================================================
// Class Tracks API
// ============================================================================
export const classTracksApi = {
  getAll: async (): Promise<ClassTrack[]> => {
    const response = await api.get<ClassTrack[]>("/api/class-tracks/");
    return response.data;
  },
  getById: async (id: string): Promise<ClassTrack> => {
    const response = await api.get<ClassTrack>(`/api/class-tracks/${id}`);
    return response.data;
  },
  create: async (data: Record<string, unknown>): Promise<ClassTrack> => {
    const response = await api.post<ClassTrack>("/api/class-tracks/create", data);
    return response.data;
  },
  update: async (id: string, data: Record<string, unknown>): Promise<ClassTrack> => {
    const response = await api.post<ClassTrack>(`/api/class-tracks/update/${id}`, data);
    return response.data;
  },
};

// ============================================================================
// Class Types API
// ============================================================================
export const classTypesApi = {
  getAll: async (): Promise<ClassType[]> => {
    const response = await api.get<ClassType[]>("/api/class-types/");
    return response.data;
  },
  getById: async (id: string): Promise<ClassType> => {
    const response = await api.get<ClassType>(`/api/class-types/${id}`);
    return response.data;
  },
  create: async (data: Record<string, unknown>): Promise<ClassType> => {
    const response = await api.post<ClassType>("/api/class-types/create", data);
    return response.data;
  },
  update: async (id: string, data: Record<string, unknown>): Promise<ClassType> => {
    const response = await api.post<ClassType>(`/api/class-types/update/${id}`, data);
    return response.data;
  },
};

// ============================================================================
// Classes API
// ============================================================================
export const classesApi = {
  getAll: async (): Promise<Class[]> => {
    const response = await api.get<Class[]>("/api/classes/");
    return response.data;
  },
  getById: async (id: string): Promise<Class> => {
    const response = await api.get<Class>(`/api/classes/${id}`);
    return response.data;
  },
  create: async (data: Record<string, unknown>): Promise<Class> => {
    const response = await api.post<Class>("/api/classes/create", data);
    return response.data;
  },
  update: async (id: string, data: Record<string, unknown>): Promise<Class> => {
    const response = await api.post<Class>(`/api/classes/update/${id}`, data);
    return response.data;
  },
};

// ============================================================================
// Class Sessions API
// ============================================================================
export const classSessionsApi = {
  getAll: async (params?: { academicYearId?: string; classId?: string }): Promise<ClassSession[]> => {
    const queryParams = new URLSearchParams();
    if (params?.academicYearId) queryParams.append("academicYearId", params.academicYearId);
    if (params?.classId) queryParams.append("classId", params.classId);
    const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
    const response = await api.get<ClassSession[]>(`/api/class-sessions/${query}`);
    return response.data;
  },
  create: async (data: Record<string, unknown>): Promise<ClassSession> => {
    const response = await api.post<ClassSession>("/api/class-sessions/create", data);
    return response.data;
  },
};

// ============================================================================
// Subject Rubrics API
// ============================================================================
export const subjectRubricsApi = {
  getAll: async (): Promise<SubjectRubric[]> => {
    const response = await api.get<SubjectRubric[]>("/api/subject-rubrics/");
    return response.data;
  },
  getById: async (id: string): Promise<SubjectRubric> => {
    const response = await api.get<SubjectRubric>(`/api/subject-rubrics/${id}`);
    return response.data;
  },
  create: async (data: Record<string, unknown>): Promise<SubjectRubric> => {
    const response = await api.post<{ message: string; rubric: SubjectRubric }>("/api/subject-rubrics/create", data);
    return response.data.rubric || response.data as unknown as SubjectRubric;
  },
  update: async (id: string, data: Record<string, unknown>): Promise<SubjectRubric> => {
    const response = await api.post<{ message: string; rubric: SubjectRubric }>(`/api/subject-rubrics/update/${id}`, data);
    return response.data.rubric || response.data as unknown as SubjectRubric;
  },
};

// ============================================================================
// Subjects API
// ============================================================================
export const subjectsApi = {
  getAll: async (): Promise<Subject[]> => {
    const response = await api.get<Subject[]>("/api/subjects/");
    return response.data;
  },
  getById: async (id: string): Promise<Subject> => {
    const response = await api.get<Subject>(`/api/subjects/${id}`);
    return response.data;
  },
  create: async (data: Record<string, unknown>): Promise<Subject> => {
    const response = await api.post<{ message: string; subject: Subject }>("/api/subjects/create", data);
    return response.data.subject || response.data as unknown as Subject;
  },
  update: async (id: string, data: Record<string, unknown>): Promise<Subject> => {
    const response = await api.post<{ message: string; subject: Subject }>(`/api/subjects/update/${id}`, data);
    return response.data.subject || response.data as unknown as Subject;
  },
  getSections: async (subjectId: string): Promise<SubjectSection[]> => {
    const response = await api.get<SubjectSection[]>(`/api/subjects/${subjectId}/sections`);
    return response.data;
  },
  getSectionById: async (id: string): Promise<SubjectSection> => {
    const response = await api.get<SubjectSection>(`/api/subjects/sections/${id}`);
    return response.data;
  },
  createSection: async (subjectId: string, data: Record<string, unknown>): Promise<SubjectSection> => {
    const response = await api.post<{ message: string; section: SubjectSection }>(`/api/subjects/${subjectId}/sections/create`, data);
    return response.data.section || response.data as unknown as SubjectSection;
  },
  updateSection: async (id: string, data: Record<string, unknown>): Promise<SubjectSection> => {
    // Correction: l'URL doit correspondre à la documentation Postman
    // La documentation montre: /api/subjects/sections/update/:id
    const response = await api.post<{ message: string; section: SubjectSection }>(
      `/api/subjects/sections/update/${id}`, 
      data
    );
    return response.data.section || response.data as unknown as SubjectSection;
  },
};

// ============================================================================
// Class Subjects API
// ============================================================================
// Dans api.ts, corrigez classSubjectsApi.getAll
export const classSubjectsApi = {
  getAll: async (params?: { classSessionId?: string; teacherId?: string }): Promise<ClassSubject[]> => {
    try {
      // Construire l'URL correctement
      let url = "/api/class-subjects/"
      
      // Ajouter les paramètres si présents
      if (params?.classSessionId || params?.teacherId) {
        const queryParams = new URLSearchParams()
        if (params.classSessionId) queryParams.append("classSessionId", params.classSessionId)
        if (params.teacherId) queryParams.append("teacherId", params.teacherId)
        url += `?${queryParams.toString()}`
      }
      
      const response = await api.get<ClassSubject[]>(url)
      return response.data
    } catch (error) {
      console.error("Error fetching class subjects:", error)
      return []
    }
  },
  getById: async (id: string): Promise<ClassSubject> => {
    const response = await api.get<ClassSubject>(`/api/class-subjects/${id}`);
    return response.data;
  },
  create: async (data: Record<string, unknown>): Promise<ClassSubject> => {
    const response = await api.post<ClassSubject>("/api/class-subjects/create", data);
    return response.data;
  },
  update: async (id: string, data: Record<string, unknown>): Promise<ClassSubject> => {
    const response = await api.post<ClassSubject>(`/api/class-subjects/update/${id}`, data);
    return response.data;
  },
};

// ============================================================================
// Enrollments API
// ============================================================================
export const enrollmentsApi = {
  getAll: async (params?: { studentId?: string; classSessionId?: string; status?: EnrollmentStatus }): Promise<Enrollment[]> => {
    const queryParams = new URLSearchParams();
    if (params?.studentId) queryParams.append("studentId", params.studentId);
    if (params?.classSessionId) queryParams.append("classSessionId", params.classSessionId);
    if (params?.status) queryParams.append("status", params.status);
    const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
    const response = await api.get<Enrollment[]>(`/api/enrollments/${query}`);
    return response.data;
  },
  getById: async (id: string): Promise<Enrollment> => {
    const response = await api.get<Enrollment>(`/api/enrollments/${id}`);
    return response.data;
  },
  create: async (data: Record<string, unknown>): Promise<Enrollment> => {
    const response = await api.post<Enrollment>("/api/enrollments/create", data);
    return response.data;
  },
  transfer: async (data: { enrollmentId: string; newClassSessionId: string; notes?: string }): Promise<Enrollment> => {
    const response = await api.post<Enrollment>("/api/enrollments/transfer", data);
    return response.data;
  },
  updateStatus: async (id: string, data: { status: EnrollmentStatus; notes?: string }): Promise<Enrollment> => {
    const response = await api.post<Enrollment>(`/api/enrollments/status-update/${id}`, data);
    return response.data;
  },
};

// ============================================================================
// Grades API
// ============================================================================
export const gradesApi = {
  getByEnrollment: async (enrollmentId: string, params?: { stepId?: string; classSubjectId?: string }): Promise<Grade[]> => {
    const queryParams = new URLSearchParams();
    if (params?.stepId) queryParams.append("stepId", params.stepId);
    if (params?.classSubjectId) queryParams.append("classSubjectId", params.classSubjectId);
    const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
    const response = await api.get<Grade[]>(`/api/grades/enrollment/${enrollmentId}${query}`);
    return response.data;
  },
  getByClassSubjectAndStep: async (classSubjectId: string, stepId: string): Promise<Grade[]> => {
    const response = await api.get<Grade[]>(`/api/grades/class-subject/${classSubjectId}/step/${stepId}`);
    return response.data;
  },
  create: async (data: Record<string, unknown>): Promise<Grade> => {
    const response = await api.post<Grade>("/api/grades/create", data);
    return response.data;
  },
  bulkCreate: async (grades: Record<string, unknown>[]): Promise<Grade[]> => {
    const response = await api.post<Grade[]>("/api/grades/bulk-create", { grades });
    return response.data;
  },
  update: async (id: string, data: Record<string, unknown>): Promise<Grade> => {
    const response = await api.post<Grade>(`/api/grades/update/${id}`, data);
    return response.data;
  },
};

// ============================================================================
// Reports API
// ============================================================================
export const reportsApi = {
  // Récupérer les données complètes pour un bulletin
  getBulletinData: async (params: {
    studentId: string;
    classSessionId: string;
    stepId: string;
  }): Promise<{
    student: any;
    grades: Grade[];
    classSubjects: ClassSubject[];
    academicYear: AcademicYear;
    step: AcademicStep;
    classSession: ClassSession;
    average: number;
    totalCoefficient: number;
  }> => {
    const response = await api.get(`/api/reports/bulletin/data`, { params });
    return response.data;
  },

  // Générer un bulletin PDF individuel
  generateBulletin: async (studentId: string, classSessionId: string, stepId: string): Promise<Blob> => {
    const response = await api.post(`/api/reports/bulletin/generate`, {
      studentId,
      classSessionId,
      stepId
    }, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Générer un rapport de classe PDF (format 8½×14)
  generateClassReport: async (classSessionId: string, stepId: string): Promise<Blob> => {
    const response = await api.post(`/api/reports/class/generate`, {
      classSessionId,
      stepId
    }, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Générer des bulletins en masse et retourner un ZIP
  generateBulletins: async (classSessionId: string, stepId: string, studentIds: string[]): Promise<Blob> => {
    const response = await api.post(`/api/reports/bulletins/generate-batch`, {
      classSessionId,
      stepId,
      studentIds
    }, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Récupérer un bulletin existant (si déjà généré)
  getBulletin: async (bulletinId: string): Promise<Blob> => {
    const response = await api.get(`/api/reports/bulletin/${bulletinId}`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Exporter les résultats en CSV/Excel
  exportResults: async (classSessionId: string, stepId: string, format: 'csv' | 'xlsx' = 'csv'): Promise<Blob> => {
    const response = await api.post(`/api/reports/class/export`, {
      classSessionId,
      stepId,
      format
    }, {
      responseType: 'blob'
    });
    return response.data;
  }
};

export const apiService = {
  auth: authApi,
  users: usersApi,
  students: studentsApi,
  teachers: teachersApi,
  academicYears: academicYearsApi,
  classTracks: classTracksApi,
  classTypes: classTypesApi,
  classes: classesApi,
  classSessions: classSessionsApi,
  subjectRubrics: subjectRubricsApi,
  subjects: subjectsApi,
  classSubjects: classSubjectsApi,
  enrollments: enrollmentsApi,
  grades: gradesApi,
  reports: reportsApi,
};

export default apiService;
