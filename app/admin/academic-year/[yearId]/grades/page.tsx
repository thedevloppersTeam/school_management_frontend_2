"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CPMSLGradesGrid } from "@/components/school/cpmsl-grades-grid"
import { CPMSLBehaviorGrid } from "@/components/school/cpmsl-behavior-grid"
import { CPMSLProgressionTab } from "@/components/school/cpmsl-progression-tab"
import GradesViewPage from "@/app/admin/academic-year/[yearId]/grades/view/page"
import type { ApiClassSession } from "@/lib/api/students"
import type { AcademicYearStep, ClassSession } from "@/lib/api/dashboard"
import type { ApiClassSubject, ApiEnrollment, ApiGrade, CreateGradePayload } from "@/lib/api/grades"
import { fetchClassSubjects, fetchEnrollments, fetchGradesForClassSubjectStep, bulkCreateGrades, updateGrade } from "@/lib/api/grades"
import type { UpdateGradePayload } from "@/components/school/cpmsl-grades-grid"

export default function GradesPage() {
  const params  = useParams()
  const yearId  = params.yearId as string
  const { toast } = useToast()

  // ── Contexte partagé ──────────────────────────────────────────────────────
  const [sessions,    setSessions]    = useState<ClassSession[]>([])
  const [steps,       setSteps]       = useState<AcademicYearStep[]>([])

  // ── Onglet Saisie (W3) ────────────────────────────────────────────────────
  const [apiSessions,            setApiSessions]            = useState<ApiClassSession[]>([])
  const [classSubjects,          setClassSubjects]          = useState<ApiClassSubject[]>([])
  const [enrollments,            setEnrollments]            = useState<ApiEnrollment[]>([])
  const [existingGrades,         setExistingGrades]         = useState<ApiGrade[]>([])
  const [selectedSessionId,      setSelectedSessionId]      = useState<string>("")
  const [selectedClassSubjectId, setSelectedClassSubjectId] = useState<string>("")
  const [selectedStepId,         setSelectedStepId]         = useState<string>("")
  const [loadingSession,         setLoadingSession]         = useState(false)
  const [loadingGrades,          setLoadingGrades]          = useState(false)
  const [saving,                 setSaving]                 = useState(false)

  const [loadingContext, setLoadingContext] = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [activeTab,      setActiveTab]      = useState<string>("notes")

  // ── Chargement contexte ───────────────────────────────────────────────────
  useEffect(() => {
    async function loadContext() {
      setLoadingContext(true)
      setError(null)
      try {
        const [sessionsRes, stepsRes] = await Promise.all([
          fetch(`/api/class-sessions?academicYearId=${yearId}`, { credentials: 'include' }),
          fetch(`/api/academic-years/${yearId}/steps`, { credentials: 'include' }),
        ])
        if (!sessionsRes.ok || !stepsRes.ok) throw new Error('Erreur de chargement du contexte')
        const [sessionsData, stepsData] = await Promise.all([
          sessionsRes.json(),
          stepsRes.json(),
        ])
        setSessions(sessionsData)
        setApiSessions(sessionsData)
        setSteps([...stepsData].sort((a, b) => a.stepNumber - b.stepNumber))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur inconnue')
      } finally {
        setLoadingContext(false)
      }
    }
    loadContext()
  }, [yearId])

  // ── Handlers W3 ──────────────────────────────────────────────────────────
  async function handleSessionChange(sessionId: string) {
    setSelectedSessionId(sessionId)
    setSelectedClassSubjectId('')
    setExistingGrades([])
    setLoadingSession(true)
    try {
      const [cs, enr] = await Promise.all([
        fetchClassSubjects(sessionId),
        fetchEnrollments(sessionId),
      ])
      setClassSubjects(cs)
      setEnrollments(enr)
    } catch (e) {
      toast({ title: 'Erreur', description: e instanceof Error ? e.message : 'Erreur de chargement' })
    } finally {
      setLoadingSession(false)
    }
  }

  async function loadGrades(classSubjectId: string, stepId: string) {
    setLoadingGrades(true)
    try {
      const grades = await fetchGradesForClassSubjectStep(classSubjectId, stepId)
      setExistingGrades(grades)
    } catch (e) {
      toast({ title: 'Erreur', description: e instanceof Error ? e.message : 'Erreur de chargement des notes' })
    } finally {
      setLoadingGrades(false)
    }
  }

  function handleClassSubjectChange(id: string) {
    setSelectedClassSubjectId(id)
    if (id && selectedStepId) loadGrades(id, selectedStepId)
  }

  function handleStepChange(id: string) {
    setSelectedStepId(id)
    if (selectedClassSubjectId && id) loadGrades(selectedClassSubjectId, id)
  }

  async function handleSaveGrades(toCreate: CreateGradePayload[], toUpdate: UpdateGradePayload[]) {
    setSaving(true)
    try {
      const ops: Promise<void>[] = []
      if (toCreate.length > 0) ops.push(bulkCreateGrades(toCreate))
      toUpdate.forEach(u => ops.push(updateGrade(u.gradeId, u.studentScore, u.gradeType)))
      await Promise.all(ops)

      const created = toCreate.length
      const updated = toUpdate.length
      const desc = [
        created > 0 ? `${created} note${created > 1 ? 's' : ''} créée${created > 1 ? 's' : ''}` : '',
        updated > 0 ? `${updated} note${updated > 1 ? 's' : ''} mise${updated > 1 ? 's' : ''} à jour` : '',
      ].filter(Boolean).join(', ')

      toast({ title: 'Notes enregistrées', description: desc })
      if (selectedClassSubjectId && selectedStepId) {
        await loadGrades(selectedClassSubjectId, selectedStepId)
      }
    } catch (e) {
      toast({ title: 'Erreur', description: e instanceof Error ? e.message : "Erreur lors de l'enregistrement", variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // ── Navigation depuis Avancement → Saisie ────────────────────────────────
  function handleNavigateToSaisie(sessionId: string, stepId: string) {
    setActiveTab("notes")
    setSelectedSessionId(sessionId)
    setSelectedStepId(stepId)
    handleSessionChange(sessionId)
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "36px", fontWeight: 700, letterSpacing: "-0.03em", color: "#2A3740" }}>
          Notes
        </h1>
      </div>

      {loadingContext ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: "#5A7085" }} />
        </div>
      ) : error ? (
        <div className="rounded-lg p-8 flex flex-col items-center justify-center gap-4" style={{ backgroundColor: "white", border: "1px solid #E8E6E3" }}>
          <p className="font-sans" style={{ color: "#C43C3C", fontSize: "14px" }}>{error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg font-sans text-sm font-medium text-white" style={{ backgroundColor: "#5A7085" }}>
            Réessayer
          </button>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList style={{ backgroundColor: "#F0F4F7", borderRadius: "8px", padding: "4px" }}>
            <TabsTrigger value="notes" className="label-ui data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>
              <span className="data-[state=active]:text-[#3A4A57] text-[#78756F]">Saisie</span>
            </TabsTrigger>
            <TabsTrigger value="consultation" className="label-ui data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>
              <span className="data-[state=active]:text-[#3A4A57] text-[#78756F]">Consultation</span>
            </TabsTrigger>
            <TabsTrigger value="avancement" className="label-ui data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>
              <span className="data-[state=active]:text-[#3A4A57] text-[#78756F]">Avancement</span>
            </TabsTrigger>
            <TabsTrigger value="comportement" className="label-ui data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>
              <span className="data-[state=active]:text-[#3A4A57] text-[#78756F]">Comportement</span>
            </TabsTrigger>
          </TabsList>

          {/* Saisie — W3 */}
          <TabsContent value="notes">
            <CPMSLGradesGrid
              sessions={apiSessions}
              steps={steps}
              classSubjects={classSubjects}
              enrollments={enrollments}
              existingGrades={existingGrades}
              selectedSessionId={selectedSessionId}
              selectedClassSubjectId={selectedClassSubjectId}
              selectedStepId={selectedStepId}
              loadingSession={loadingSession}
              loadingGrades={loadingGrades}
              saving={saving}
              onSessionChange={handleSessionChange}
              onClassSubjectChange={handleClassSubjectChange}
              onStepChange={handleStepChange}
              onSaveGrades={handleSaveGrades}
            />
          </TabsContent>

          {/* Consultation — W4 */}
          <TabsContent value="consultation">
            <GradesViewPage />
          </TabsContent>

          {/* Avancement */}
          <TabsContent value="avancement">
            <CPMSLProgressionTab
              yearId={yearId}
              sessions={sessions}
              steps={steps}
              onNavigateToSaisie={handleNavigateToSaisie}
            />
          </TabsContent>

          {/* Comportement */}
          <TabsContent value="comportement">
            <CPMSLBehaviorGrid
              levels={[]}
              classrooms={[]}
              periods={[]}
              students={[]}
              attitudes={[]}
              behaviors={[]}
              isArchived={false}
              onSaveBehaviors={() => toast({ title: "Comportements enregistrés" })}
              onAddAttitude={(label: string, academicYearId: string) => ({ id: `att-${Date.now()}`, label, academicYearId })}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}