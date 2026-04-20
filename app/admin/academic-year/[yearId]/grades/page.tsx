"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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

function buildSaveDescription(created: number, updated: number): string {
  const parts: string[] = []
  if (created > 0) {
    const plural = created > 1 ? 's' : ''
    parts.push(`${created} note${plural} créée${plural}`)
  }
  if (updated > 0) {
    const plural = updated > 1 ? 's' : ''
    parts.push(`${updated} note${plural} mise${plural} à jour`)
  }
  return parts.join(', ')
}

export default function GradesPage() {
  const params  = useParams()
  const yearId  = params.yearId as string
  const { toast } = useToast()

  // ── Contexte partagé ──────────────────────────────────────────────────────
  const [sessions,    setSessions]    = useState<ClassSession[]>([])
  const [steps,       setSteps]       = useState<AcademicYearStep[]>([])
  const [yearName,    setYearName]    = useState<string>("")

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
        const [sessionsRes, stepsRes, yearRes] = await Promise.all([
          fetch(`/api/class-sessions?academicYearId=${yearId}`, { credentials: 'include' }),
          fetch(`/api/academic-years/${yearId}/steps`, { credentials: 'include' }),
          fetch(`/api/academic-years/${yearId}`, { credentials: 'include' }),
        ])
        if (!sessionsRes.ok || !stepsRes.ok) throw new Error('Erreur de chargement du contexte')
        const [sessionsData, stepsData] = await Promise.all([
          sessionsRes.json(),
          stepsRes.json(),
        ])
        setSessions(sessionsData)
        setApiSessions(sessionsData)
        setSteps([...stepsData].sort((a, b) => a.stepNumber - b.stepNumber))
        if (yearRes.ok) {
          const yearData = await yearRes.json()
          setYearName(yearData?.name ?? "")
        }
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
      const desc = buildSaveDescription(created, updated)

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
    // ── Helper function to render main content ──────────────────────────────
  function renderMainContent() {
    if (loadingContext) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-muted border-t-primary" />
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border bg-card p-8 shadow-sm">
          <p className="text-sm text-destructive">{error}</p>
          <Button onClick={() => globalThis.location.reload()} size="sm">
            Réessayer
          </Button>
        </div>
      )
    }

    return (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="notes">Saisie</TabsTrigger>
          <TabsTrigger value="consultation">Consultation</TabsTrigger>
          <TabsTrigger value="avancement">Avancement</TabsTrigger>
          <TabsTrigger value="comportement">Comportement</TabsTrigger>
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
          <GradesViewPage
            initialSessionId={selectedSessionId}
            initialStepId={selectedStepId}
          />
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

        {/* Comportement — W6 */}
        <TabsContent value="comportement">
          <CPMSLBehaviorGrid
            yearId={yearId}
            sessions={apiSessions}
            steps={steps}
          />
        </TabsContent>
      </Tabs>
    )
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Notes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Saisie, consultation, avancement et comportement
          {yearName && (
            <>
              {" "}&middot;{" "}
              <Badge variant="secondary" className="ml-1 align-middle">
                {yearName}
              </Badge>
            </>
          )}
        </p>
      </div>

      {renderMainContent()}
    </div>
  )
}