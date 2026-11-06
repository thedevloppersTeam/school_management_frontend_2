"use client"

import { useState, useEffect, useMemo, useRef } from "react"
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
import { fetchClassSubjects, fetchEntryEnrollments, fetchGradesForClassSubjectStep, bulkCreateGrades, updateGrade, deleteGrade } from "@/lib/api/grades"
import type { UpdateGradePayload } from "@/components/school/cpmsl-grades-grid"
import { toMessage } from '@/lib/errors'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { presentAtStep } from "@/lib/departures/presence"
import { bulkCreateParts, type BulkCreateCounts } from "@/lib/grades/save-summary"
import {
  SELECTION_VIDE,
  effetChangementSalle,
  salleAChargerAuRetour,
  selectionDepuisSession,
  type SelectionClasseSalle,
} from "@/lib/classes/selection"

// `counts` : compteurs created / replaced de bulk-create (null = serveur qui ne
// les fournit pas : ancien message, sur le nombre de saisies envoyées).
function buildSaveDescription(created: number, updated: number, deleted: number, counts: BulkCreateCounts | null = null): string {
  const parts: string[] = [...bulkCreateParts(created, counts, true)]
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
  // Sélection Classe → Salle (chantier W2). Tenue ICI, et non dans chaque mode
  // de saisie : une classe choisie sans salle doit survivre au passage Par
  // matière ↔ Par élève, et les autres onglets la partageront (T10, PR 3).
  const [selection,              setSelection]              = useState<SelectionClasseSalle>(SELECTION_VIDE)
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
  // Même chose pour l'onglet Comportement (BACKLOG W3) : nombre d'élèves dont
  // le comportement est modifié et non enregistré, et enregistrement en cours.
  const [comportementDirtyCount, setComportementDirtyCount] = useState(0)
  const [comportementSaving,     setComportementSaving]     = useState(false)
  const [pendingNav, setPendingNav] = useState<{ label: string; apply: () => void } | null>(null)

  // Un seul onglet est monté à la fois : au plus un des deux compteurs est non nul.
  const navDirtyCount = gridDirtyCount + comportementDirtyCount
  const navDirtyComportement = comportementDirtyCount > 0

  function guardNavigation(label: string, apply: () => void) {
    // Pendant l'enregistrement de Comportement, aucun changement d'onglet :
    // les onglets sont inactifs, et ce refus couvre tout autre appel.
    if (comportementSaving) return
    if (navDirtyCount === 0) { apply(); return }
    setPendingNav({ label, apply })
  }
  // Mode de saisie dans l'onglet "Saisie" : par matière (grille) ou par élève.
  const [entryMode,      setEntryMode]      = useState<"subject" | "student">("subject")

  // D-22 : à l'étape choisie, un élève parti n'est proposé que si elle est
  // ≤ sa dernière étape suivie ; après, il n'apparaît pas dans la grille.
  const enrollmentsAtStep = useMemo(
    () => enrollments.filter((e) => presentAtStep(e, selectedStepId, steps)),
    [enrollments, selectedStepId, steps],
  )

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

  // Jetons de chargement : seule la réponse de la DERNIÈRE demande est
  // appliquée. Sans eux, deux changements de salle rapprochés pouvaient
  // afficher les matières (ou les notes) de la salle précédente, arrivées
  // après celles de la nouvelle.
  const dernierChargement = useRef(0)
  const dernieresNotes    = useRef(0)
  // Salle dont Saisie détient (ou charge) les données ; null après un vidage.
  // Sert au chargement différé au retour sur l'onglet Saisie (T10, PR 3).
  const salleChargee      = useRef<string | null>(null)

  // Efface tout ce qui appartient à la salle courante, et périme les
  // chargements en vol. Appelé AVANT tout chargement d'une autre salle : à
  // aucun moment l'en-tête d'une salle ne doit côtoyer la matière ou les
  // notes d'une autre (effetChangementSalle, lib/classes/selection.ts).
  function viderSalle() {
    dernierChargement.current += 1
    dernieresNotes.current += 1
    salleChargee.current = null
    setSelectedClassSubjectId('')
    setExistingGrades([])
    setClassSubjects([])
    setEnrollments([])
    setLoadingSession(false)
    setLoadingGrades(false)
  }

  async function handleSessionChange(sessionId: string) {
    // Défaut 1 (audit W2) : une chaîne vide supprimait le filtre côté serveur
    // et ramenait TOUTES les matières et inscriptions (BACKLOG E25). Aucune
    // valeur vide ne part plus vers fetchClassSubjects ni fetchEntryEnrollments.
    if (!sessionId) { viderSalle(); return }
    viderSalle()
    salleChargee.current = sessionId
    const jeton = dernierChargement.current
    setLoadingSession(true)
    try {
      const [cs, enr] = await Promise.all([
        fetchClassSubjects(sessionId),
        // D-22 : actifs ET partis ; un parti n'est proposé qu'aux étapes suivies.
        fetchEntryEnrollments(sessionId),
      ])
      if (jeton !== dernierChargement.current) return
      setClassSubjects(cs)
      setEnrollments(enr)
    } catch (e) {
      if (jeton !== dernierChargement.current) return
      toast({
        title: 'Erreur',
        description: toMessage(e, "lors du chargement de la classe"),
        variant: 'destructive'
      })
    } finally {
      if (jeton === dernierChargement.current) setLoadingSession(false)
    }
  }

  // Changement de Classe ou de Salle, venu de ClasseSalleSelect, dans
  // n'importe quel onglet : la sélection est partagée (T10). Le vidage des
  // données de Saisie est immédiat ; leur chargement n'a lieu que si Saisie
  // est l'onglet affiché, sinon il attend le retour sur Saisie (changerOnglet).
  function handleSelectionChange(next: SelectionClasseSalle) {
    const effet = effetChangementSalle(selection, next)
    setSelection(next)
    if (!effet.viderAvant) return
    if (effet.charger && activeTab === "notes") handleSessionChange(effet.charger)
    else viderSalle()
  }

  // Changement d'onglet (déjà passé par guardNavigation). Au retour sur
  // Saisie, la salle choisie ailleurs est chargée une seule fois, par
  // handleSessionChange (vidage et jetons).
  function changerOnglet(onglet: string) {
    setActiveTab(onglet)
    if (onglet !== "notes") return
    const aCharger = salleAChargerAuRetour(selection, salleChargee.current)
    if (aCharger) handleSessionChange(aCharger)
  }

  async function loadGrades(classSubjectId: string, stepId: string) {
    dernieresNotes.current += 1
    const jeton = dernieresNotes.current
    setLoadingGrades(true)
    try {
      const grades = await fetchGradesForClassSubjectStep(classSubjectId, stepId)
      if (jeton !== dernieresNotes.current) return
      setExistingGrades(grades)
    } catch (e) {
      if (jeton !== dernieresNotes.current) return
      toast({
        title: 'Erreur',
        description: toMessage(e, "lors du chargement des notes"),
        variant: 'destructive'
      })
    } finally {
      if (jeton === dernieresNotes.current) setLoadingGrades(false)
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
    let createCounts: BulkCreateCounts | null = null
    if (toCreate.length > 0) {
      const plural = toCreate.length > 1 ? 's' : ''
      ops.push({
        // Libellé d'un ÉCHEC : le lot est refusé en entier, rien n'est écrit ;
        // on nomme donc les saisies envoyées, pas un résultat.
        label: `${toCreate.length} note${plural} nouvelle${plural}`,
        run: async () => { createCounts = await bulkCreateGrades(toCreate) },
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
          description: buildSaveDescription(toCreate.length, toUpdate.length, toDelete.length, createCounts),
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
  // Positionne classe, salle et étape, puis recharge TOUJOURS la salle, même
  // si c'est celle qui était ouverte : l'étape change, la matière et les
  // notes affichées ne valent plus. handleSessionChange vide avant de charger.
  function handleNavigateToSaisie(sessionId: string, stepId: string) {
    setActiveTab("notes")
    setSelectedStepId(stepId)
    const next = selectionDepuisSession(apiSessions, sessionId)
    setSelection(next)
    handleSessionChange(next.sessionId ?? "")
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
        onValueChange={(v) => guardNavigation("d'onglet", () => changerOnglet(v))}
        className="space-y-6"
      >
        {/* Pendant un enregistrement de Comportement, les autres onglets sont inactifs. */}
        <TabsList>
          <TabsTrigger value="notes" disabled={comportementSaving}>Saisie</TabsTrigger>
          <TabsTrigger value="consultation" disabled={comportementSaving}>Consultation</TabsTrigger>
          <TabsTrigger value="avancement" disabled={comportementSaving}>Avancement</TabsTrigger>
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
              enrollments={enrollmentsAtStep}
              existingGrades={existingGrades}
              selection={selection}
              selectedClassSubjectId={selectedClassSubjectId}
              selectedStepId={selectedStepId}
              loadingSession={loadingSession}
              loadingGrades={loadingGrades}
              saving={saving}
              onSelectionChange={handleSelectionChange}
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
              selection={selection}
              loadingSession={loadingSession}
              onSelectionChange={handleSelectionChange}
            />
          )}
        </TabsContent>

        {/* Consultation — W4 */}
        <TabsContent value="consultation">
          <GradesViewContent
            sessions={sessions}
            selection={selection}
            onSelectionChange={handleSelectionChange}
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
            selection={selection}
            onSelectionChange={handleSelectionChange}
            onDirtyChange={setComportementDirtyCount}
            onSavingChange={setComportementSaving}
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
              {navDirtyComportement
                ? <>{navDirtyCount} comportement{navDirtyCount > 1 ? 's' : ''} non enregistré{navDirtyCount > 1 ? 's' : ''}</>
                : <>{navDirtyCount} note{navDirtyCount > 1 ? 's' : ''} non enregistrée{navDirtyCount > 1 ? 's' : ''}</>}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Changer {pendingNav?.label} ferme{' '}
              {navDirtyComportement ? "l'onglet Comportement" : 'la grille de saisie'} et efface{' '}
              {navDirtyCount > 1 ? 'ces saisies' : 'cette saisie'}. Enregistrez d&apos;abord
              pour {navDirtyCount > 1 ? 'les' : 'la'} conserver.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revenir à la saisie</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { pendingNav?.apply(); setPendingNav(null) }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Abandonner {navDirtyCount > 1 ? 'les modifications' : 'la modification'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}