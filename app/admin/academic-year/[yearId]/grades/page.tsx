"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertTriangleIcon } from "lucide-react"
import { academicYearsApi, classSessionsApi, classSubjectsApi, enrollmentsApi, gradesApi, subjectsApi } from "@/services/api" // Ajout de subjectsApi
import type { AcademicYear, AcademicStep, ClassSession, ClassSubject, Enrollment, Grade, GradeType, SubjectSection } from "@/types" // Ajout de SubjectSection
import { toast } from "sonner"
import { CPMSLGradesGrid } from "@/components/cpmsl-grades-grid"
import { CPMSLBehaviorGrid } from "@/components/cpmsl-behavior-grid"
import { CPMSLProgressionPanel } from "@/components/cpmsl-progression-panel"

export default function GradesPage() {
  const params = useParams()
  const yearId = params.yearId as string
  const [year, setYear] = useState<AcademicYear | null>(null)
  const [steps, setSteps] = useState<AcademicStep[]>([])
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("notes")

  // Grades tab state
  const [selectedSession, setSelectedSession] = useState<string>("")
  const [selectedStep, setSelectedStep] = useState<string>("")
  const [selectedSubject, setSelectedSubject] = useState<string>("")
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [subjectSections, setSubjectSections] = useState<SubjectSection[]>([]) // Ajout de l'état pour les sections

  // For progression panel
  const [allEnrollments, setAllEnrollments] = useState<Enrollment[]>([])
  const [allClassSubjects, setAllClassSubjects] = useState<ClassSubject[]>([])
  const [allGrades, setAllGrades] = useState<Grade[]>([])

  const isArchived = year ? new Date() > new Date(year.endDate) && !year.isCurrent : false

  console.log("yeard ID",yearId);

  useEffect(() => {
    async function fetchData() {
      try {
        const [yearData, stepsData, sessionsData] = await Promise.all([
          academicYearsApi.getById(yearId),
          academicYearsApi.getSteps(yearId).catch(() => []),
          classSessionsApi.getAll({ academicYearId: yearId }).catch(() => []),
        ])
        setYear(yearData)
        setSteps(stepsData)
        setSessions(sessionsData)
        if (sessionsData.length > 0) setSelectedSession(sessionsData[0].id)
        if (stepsData.length > 0) setSelectedStep(stepsData[0].id)
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    fetchData()
  }, [yearId])

  // Fetch session-specific data
  useEffect(() => {
    if (!selectedSession) return
    async function fetchSessionData() {
      try {
        const [subjects, enrs] = await Promise.all([
          classSubjectsApi.getAll({ classSessionId: selectedSession }).catch(() => []),
          enrollmentsApi.getAll({ classSessionId: selectedSession }).catch(() => []),
        ])
        setClassSubjects(subjects)
        setEnrollments(enrs)
        if (subjects.length > 0 && !selectedSubject) setSelectedSubject(subjects[0].id)

        // Fetch grades for all enrollments
        if (selectedStep && enrs.length > 0) {
          const allG: Grade[] = []
          for (const enr of enrs) {
            try {
              const g = await gradesApi.getByEnrollment(enr.id, { stepId: selectedStep })
              allG.push(...g)
            } catch { /* */ }
          }
          setGrades(allG)
        }
      } catch { /* ignore */ }
    }
    fetchSessionData()
  }, [selectedSession, selectedStep])

  // Fetch sections when subject changes
  useEffect(() => {
    async function fetchSections() {
      if (!selectedSubject) {
        setSubjectSections([])
        return
      }
      
      try {
        const selectedSubjectObj = classSubjects.find(cs => cs.id === selectedSubject)
        if (selectedSubjectObj?.subject?.hasSections) {
          const sections = await subjectsApi.getSections(selectedSubjectObj.subjectId)
          setSubjectSections(sections)
        } else {
          setSubjectSections([])
        }
      } catch (error) {
        console.error("Error fetching sections:", error)
        setSubjectSections([])
      }
    }
    
    fetchSections()
  }, [selectedSubject, classSubjects])

 const handleSaveGrades = useCallback(async (gradesToSave: { 
  enrollmentId: string; 
  classSubjectId: string; 
  stepId: string; 
  studentScore: number; 
  gradeType: GradeType;
  gradeId?: string;
  sectionId?: string;
  comment?: string;
}[]) => {
  try {
    const updates = gradesToSave.filter(g => g.gradeId)
    const creates = gradesToSave.filter(g => !g.gradeId)
    
    // Gérer les mises à jour
    for (const grade of updates) {
      await gradesApi.update(grade.gradeId!, {
        studentScore: grade.studentScore,
        gradeType: grade.gradeType,
        comment: grade.comment,
      })
    }
    
    // Gérer les créations
    for (const grade of creates) {
      await gradesApi.create(grade)
    }
    
    toast.success(`${creates.length + updates.length} note(s) enregistrée(s) avec succès`)
    
    // Rafraîchir les données
    if (selectedSession && selectedStep) {
      const [subjects, enrs] = await Promise.all([
        classSubjectsApi.getAll({ classSessionId: selectedSession }).catch(() => []),
        enrollmentsApi.getAll({ classSessionId: selectedSession }).catch(() => []),
      ])
      setClassSubjects(subjects)
      setEnrollments(enrs)
      
      if (selectedStep && enrs.length > 0) {
        const allG: Grade[] = []
        for (const enr of enrs) {
          try {
            const g = await gradesApi.getByEnrollment(enr.id, { stepId: selectedStep })
            allG.push(...g)
          } catch { /* */ }
        }
        setGrades(allG)
      }
    }
  } catch (error) {
    console.error("Erreur lors de l'enregistrement:", error)
    toast.error("Erreur lors de l'enregistrement des notes")
  }
}, [selectedSession, selectedStep])

const handleUpdateGrade = useCallback(async (
  gradeId: string, 
  studentScore: number, 
  gradeType: GradeType, 
  sectionId?: string, 
  comment?: string
) => {
  try {
    await gradesApi.update(gradeId, { studentScore, gradeType, comment })
    toast.success("Note mise à jour avec succès")
    
    // Rafraîchir les données
    if (selectedSession && selectedStep) {
      const [subjects, enrs] = await Promise.all([
        classSubjectsApi.getAll({ classSessionId: selectedSession }).catch(() => []),
        enrollmentsApi.getAll({ classSessionId: selectedSession }).catch(() => []),
      ])
      setClassSubjects(subjects)
      setEnrollments(enrs)
      
      if (selectedStep && enrs.length > 0) {
        const allG: Grade[] = []
        for (const enr of enrs) {
          try {
            const g = await gradesApi.getByEnrollment(enr.id, { stepId: selectedStep })
            allG.push(...g)
          } catch { /* */ }
        }
        setGrades(allG)
      }
    }
  } catch (error) {
    console.error("Erreur lors de la mise à jour:", error)
    toast.error("Erreur lors de la mise à jour de la note")
  }
}, [selectedSession, selectedStep])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6" data-testid="grades-page">
      {/* Header */}
      <div>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "36px", fontWeight: 700, letterSpacing: "-0.03em", color: "#2A3740" }}>Notes</h1>
        <p style={{ fontSize: "13px", fontWeight: 400, color: "hsl(var(--muted-foreground))" }}>Année {year?.name}</p>
      </div>

      {/* Archived Year Banner */}
      {isArchived && year && (
        <div className="rounded-lg p-4 flex items-center gap-3" style={{ backgroundColor: "#FEF6E0", border: "1px solid #C48B1A" }}>
          <AlertTriangleIcon className="h-5 w-5" style={{ color: "#C48B1A" }} />
          <div>
            <p style={{ color: "#C48B1A", fontSize: "12px", fontWeight: 500 }}>Année {year.name} — Archivée</p>
            <p style={{ color: "#C48B1A", fontSize: "13px" }}>Année archivée — les données sont en lecture seule</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList style={{ backgroundColor: "#F0F4F7", borderRadius: "8px", padding: "4px" }}>
          <TabsTrigger value="notes" className="data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>
            <span>Notes</span>
          </TabsTrigger>
          <TabsTrigger value="comportement" className="data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>
            <span>Comportement</span>
          </TabsTrigger>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="progression-v2" disabled={true} style={{ borderRadius: "6px", color: "#A8A5A2", cursor: "not-allowed", opacity: 0.6 }}>
                  Progression
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent><p>Disponible prochainement</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TabsTrigger value="progression" className="data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>
            <span>Avancement</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notes">
          <CPMSLGradesGrid
            steps={steps}
            sessions={sessions}
            classSubjects={classSubjects}
            enrollments={enrollments}
            grades={grades}
            isArchived={isArchived}
            selectedStep={selectedStep}
            selectedSession={selectedSession}
            selectedSubject={selectedSubject}
            onStepChange={setSelectedStep}
            onSessionChange={(v) => { setSelectedSession(v); setSelectedSubject("") }}
            onSubjectChange={setSelectedSubject}
            onSaveGrades={handleSaveGrades}
            onUpdateGrade={handleUpdateGrade}
            subjectSections={subjectSections}
          />
        </TabsContent>

        <TabsContent value="comportement">
          <CPMSLBehaviorGrid
            steps={steps}
            sessions={sessions}
            enrollments={allEnrollments.length > 0 ? allEnrollments : enrollments}
            isArchived={isArchived}
          />
        </TabsContent>

        <TabsContent value="progression">
          <CPMSLProgressionPanel
            steps={steps}
            sessions={sessions}
            allEnrollments={allEnrollments.length > 0 ? allEnrollments : enrollments}
            allClassSubjects={allClassSubjects.length > 0 ? allClassSubjects : classSubjects}
            allGrades={allGrades.length > 0 ? allGrades : grades}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}