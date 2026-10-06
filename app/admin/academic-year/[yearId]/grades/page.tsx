"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CPMSLGradesGrid } from "@/components/school/cpmsl-grades-grid"
import { CPMSLGradesByStudent } from "@/components/school/cpmsl-grades-by-student"
import { CPMSLBehaviorGrid } from "@/components/school/cpmsl-behavior-grid"
import { CPMSLProgressionTab } from "@/components/school/cpmsl-progression-tab"
import { GradesViewContent } from "@/components/school/grades-view-content"
import type { ApiClassSession } from "@/lib/api/students"
import type { AcademicYearStep, ClassSession } from "@/lib/api/dashboard"
import type { ApiClassSubject, ApiEnrollment, ApiGrade, CreateGradePayload } from "@/lib/api/grades"
import { fetchClassSubjects, fetchEnrollments, fetchGradesForClassSubjectStep, bulkCreateGrades, updateGrade, deleteGrade } from "@/lib/api/grades"
import type { UpdateGradePayload } from "@/components/school/cpmsl-grades-grid"
import { toMessage } from '@/lib/errors'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

function buildSaveDescription(created: number, updated: number, deleted: number): string {
  const parts: string[] = []
  if (created > 0) {
    const plural = created > 1 ? 's' : ''
    parts.push(`${created} note${plural} créée${plural}`)
  }
  if (updated > 0) {
    const plural = updated > 1 ? 's' : ''
    parts.push(`${updated} note${plural} mise${plural} à jour`)
  }
  if (deleted > 0) {
    const plural = deleted > 1 ? 's' : ''
    parts.push(`${deleted} note${plural} retirée${plural}`)
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
  const [saveFailures, setSaveFailures] = useState<Array<{ label: string; reason: string }>>([])

  // Radix demonte le TabsContent inactif : changer d'onglet detruit l'etat de la
  // grille ET desenregistre son `beforeunload`. La bascule Par matiere / Par
  // eleve est un ternaire, donc elle demonte aussi. Le compte remonte par la
  // grille est la seule facon pour cette page de savoir qu'il y a quelque chose
  // a perdre.
  const [gridDirtyCount, setGridDirtyCount] = useState(0)
  const [pendingNav, setPendingNav] = useState<{ label: string; apply: () => void } | null>(null)

  function guardNavigation(label: string, apply: () => void) {
    if (gridDirtyCount === 0) { apply(); return }
    setPendingNav({ label, apply })
  }
  // Mode de saisie dans l'onglet "Saisie" : par matière (grille) ou par élève.
  const [entryMode,      setEntryMode]      = useState<"subject" | "student">("subject")

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
        setError(toMessage(e, "lors du chargement du contexte"))
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
      toast({
        title: 'Erreur',
        description: toMessage(e, "lors du chargement de la classe"),
        variant: 'destructive'
      })
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
      toast({
        title: 'Erreur',
        description: toMessage(e, "lors du chargement des notes"),
        variant: 'destructive'
      })
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

  // EP-011 — l'enregistrement n'est pas atomique et ne peut pas le devenir ici :
  // une requete groupee, plus une par modification et une par suppression, soit
  // une trentaine d'appels pour une session ordinaire. `Promise.all` rejetait au
  // PREMIER echec pendant que les autres partaient quand meme, le `catch` ne
  // rechargeait rien, et l'ecran continuait d'afficher des valeurs locales sur
  // un etat serveur partiel et inconnu. En contexte reseau haitien, l'echec
  // partiel n'est pas un cas limite.
  //
  // `allSettled` attend tout le monde, on recharge TOUJOURS depuis le serveur,
  // et on nomme ce qui a echoue au lieu d'annoncer un echec global sur un
  // enregistrement qui a partiellement reussi.
  // Cible a terme : un POST /api/grades/batch transactionnel cote backend.
  async function handleSaveGrades(toCreate: CreateGradePayload[], toUpdate: UpdateGradePayload[], toDelete: string[] = []) {
    setSaving(true)
    setSaveFailures([])

    type Op = { label: string; run: () => Promise<void> }
    const ops: Op[] = []
    if (toCreate.length > 0) {
      const plural = toCreate.length > 1 ? 's' : ''
      ops.push({
        label: `${toCreate.length} note${plural} nouvelle${plural}`,
        run: () => bulkCreateGrades(toCreate),
      })
    }
    toUpdate.forEach((u, i) => ops.push({
      label: `modification ${i + 1}`,
      run: () => updateGrade(u.gradeId, u.studentScore, u.gradeType),
    }))
    toDelete.forEach((id, i) => ops.push({
      label: `suppression ${i + 1}`,
      run: () => deleteGrade(id),
    }))

    try {
      const settled = await Promise.allSettled(ops.map(o => o.run()))
      const failures = settled
        .map((r, i) => (r.status === 'rejected'
          ? { label: ops[i].label, reason: toMessage(r.reason, "lors de l'enregistrement") }
          : null))
        .filter((f): f is { label: string; reason: string } => f !== null)

      if (failures.length === 0) {
        toast({
          title: 'Notes enregistrées',
          description: buildSaveDescription(toCreate.length, toUpdate.length, toDelete.length),
        })
      } else {
        setSaveFailures(failures)
        toast({
          title: `Enregistrement incomplet — ${failures.length} opération${failures.length > 1 ? 's' : ''} en échec`,
          description: 'Le détail reste affiché au-dessus de la grille. Les autres notes sont bien enregistrées.',
          variant: 'destructive',
        })
      }
    } finally {
      // Systematique, succes comme echec : apres un echec partiel, l'ecran doit
      // montrer ce qui est REELLEMENT en base, pas ce qui avait ete tape.
      if (selectedClassSubjectId && selectedStepId) {
        await loadGrades(selectedClassSubjectId, selectedStepId).catch(() => {})
      }
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
      <Tabs
        value={activeTab}
        onValueChange={(v) => guardNavigation("d'onglet", () => setActiveTab(v))}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="notes">Saisie</TabsTrigger>
          <TabsTrigger value="consultation">Consultation</TabsTrigger>
          <TabsTrigger value="avancement">Avancement</TabsTrigger>
          <TabsTrigger value="comportement">Comportement</TabsTrigger>
        </TabsList>

        {/* Saisie — W3 */}
        <TabsContent value="notes" className="space-y-4">
          {/* Un toast disparait en quatre secondes ; un enregistrement partiel
              doit rester lisible le temps de le reparer. */}
          {saveFailures.length > 0 && (
            <div role="alert" className="rounded-lg border border-destructive bg-destructive/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-destructive">
                    Enregistrement incomplet — {saveFailures.length} opération
                    {saveFailures.length > 1 ? 's' : ''} en échec
                  </p>
                  <p className="mt-0.5 max-w-prose text-xs text-muted-foreground">
                    Les autres notes sont bien enregistrées ; la grille a été rechargée
                    depuis le serveur et montre l&apos;état réel. Corrigez les lignes
                    ci-dessous puis enregistrez à nouveau.
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSaveFailures([])}>
                  Masquer
                </Button>
              </div>
              <ul className="cpmsl-scroll mt-2 max-h-32 space-y-0.5 overflow-y-auto">
                {saveFailures.map((f, i) => (
                  <li key={i} className="text-xs text-destructive">
                    <span className="font-medium">{f.label}</span> — {f.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* Bascule du mode de saisie */}
          <div className="inline-flex rounded-lg border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => guardNavigation("de mode de saisie", () => setEntryMode("subject"))}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${entryMode === "subject" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Par matière
            </button>
            <button
              type="button"
              onClick={() => guardNavigation("de mode de saisie", () => setEntryMode("student"))}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${entryMode === "student" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Par élève
            </button>
          </div>

          {entryMode === "subject" ? (
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
              onDirtyChange={setGridDirtyCount}
            />
          ) : (
            <CPMSLGradesByStudent
              yearId={yearId}
              sessions={apiSessions}
              enrollments={enrollments}
              selectedSessionId={selectedSessionId}
              loadingSession={loadingSession}
              onSessionChange={handleSessionChange}
            />
          )}
        </TabsContent>

        {/* Consultation — W4 */}
        <TabsContent value="consultation">
          <GradesViewContent
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
        <h1 className="heading-1 text-foreground">Notes</h1>
<div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
  <span>Saisie, consultation, avancement et comportement</span>
  {yearName && (
    <>
      <span>&middot;</span>
      <Badge variant="secondary" className="align-middle">
        {yearName}
      </Badge>
    </>
  )}
</div>
      </div>

      {renderMainContent()}

      <AlertDialog open={pendingNav !== null} onOpenChange={(o) => { if (!o) setPendingNav(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {gridDirtyCount} note{gridDirtyCount > 1 ? 's' : ''} non enregistrée{gridDirtyCount > 1 ? 's' : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Changer {pendingNav?.label} ferme la grille de saisie et efface{' '}
              {gridDirtyCount > 1 ? 'ces saisies' : 'cette saisie'}. Enregistrez d&apos;abord
              pour {gridDirtyCount > 1 ? 'les' : 'la'} conserver.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revenir à la saisie</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { pendingNav?.apply(); setPendingNav(null) }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Abandonner {gridDirtyCount > 1 ? 'les modifications' : 'la modification'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}