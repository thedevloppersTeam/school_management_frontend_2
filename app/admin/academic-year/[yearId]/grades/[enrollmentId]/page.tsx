"use client"

// Saisie des notes par ÉLÈVE : toutes les matières et sous-matières d'un élève
// pour une étape, éditables d'un coup. Complémentaire à la grille par matière.

import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ArrowLeftIcon, SaveIcon } from "lucide-react"
import { clientFetch as apiFetch } from "@/lib/client-fetch"
import {
  fetchClassSubjects,
  bulkCreateGrades,
  updateGrade,
  deleteGrade,
  filterSubjectsByScope,
  effectiveMaxScore,
  type ApiClassSubject,
  type ApiGrade,
  type CreateGradePayload,
  type SubjectScope,
} from "@/lib/api/grades"
import { parseDecimal } from "@/lib/decimal"
import { RUBRIQUE_WEIGHTS, type RubriqueCode } from "@/lib/bulletin/compute"
import { parseScore, validateScoreInput } from "@/lib/grades/score-input"
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning"
import { toMessage } from "@/lib/errors"

interface Step { id: string; name: string; stepNumber: number; isCurrent: boolean }
interface EnrollmentPayload {
  id: string
  classSessionId: string
  trackId?: string | null
  track?: { id: string; code: string; name: string } | null
  student?: { user?: { firstname?: string; lastname?: string }; studentCode?: string }
  classSession?: {
    class?: { letter?: string; classType?: { name?: string; isTerminal?: boolean } }
    academicYear?: { steps?: Step[] }
  }
}

// Une saisie = valeur + validité. Clé : classSubjectId (mode global) ou
// `${classSubjectId}::${sectionId}` (mode sections).
interface Entry { value: string; isValid: boolean; error?: string }

// DR-004 etait reimplementee ici en flottant, sur un parseFloat qui lisait
// « 15,25 » comme 15 — une note fausse, validee sans un mot, envoyee en base.
// La regle vit desormais dans lib/grades/score-input.ts, qui delegue le verdict
// a isValidGrade() de lib/bulletin/compute.ts : la meme regle, en Decimal, que
// celle qui calcule le bulletin.
function validate(value: string, max: number): Entry {
  return { value, ...validateScoreInput(value, max) }
}

// Les rubriques etaient peintes avec les jetons d'ETAT — R1 en `info`, R2 en
// `success`, R3 en `warning`. Les classes etaient conformes, l'usage etait faux :
// une rubrique classe, elle ne signale pas. Toute matiere R3 portait en
// permanence la couleur de l'avertissement, et trois des quatre jetons d'etat
// etaient consommes en continu sur un axe qui n'en est pas un — quand une vraie
// alerte arrive, elle n'a plus de contraste semantique (Regle de la Raretee).
// Ce qui distingue une rubrique d'une autre, c'est son POIDS. On l'ecrit.
const RUBRIC_BADGE = "border-border bg-muted text-muted-foreground"

/** « R1 · 70 % » — la ponderation vient de compute.ts, jamais d'un litteral. */
function rubricLabel(code?: string): string {
  if (!code) return "—"
  const weight = RUBRIQUE_WEIGHTS[code as RubriqueCode]
  if (!weight) return code
  return `${code} · ${weight.times(100).toFixed(0)} %`
}

export default function StudentGradesPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const yearId = params.yearId as string
  const enrollmentId = params.enrollmentId as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enrollment, setEnrollment] = useState<EnrollmentPayload | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [classSubjects, setClassSubjects] = useState<ApiClassSubject[]>([])
  const [selectedStepId, setSelectedStepId] = useState("")
  const [existingGrades, setExistingGrades] = useState<ApiGrade[]>([])
  const [excludedSections, setExcludedSections] = useState<Set<string>>(new Set())
  // Les dispenses n'ont pas pu etre chargees : on ne sait pas lesquelles
  // s'appliquent, donc on n'edite rien plutot que de risquer d'ecrire par-dessus.
  const [exclusionsUnavailable, setExclusionsUnavailable] = useState(false)
  const [loadingGrades, setLoadingGrades] = useState(false)

  // key = classSubjectId (global) ou `${classSubjectId}::${sectionId}` (section)
  const [entries, setEntries] = useState<Map<string, Entry>>(new Map())

  // Portée : tronc commun / examen officiel (filière de l'élève) / toutes
  const [scope, setScope] = useState<SubjectScope>('all')

  // ── Chargement contexte élève ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const enr = await apiFetch<EnrollmentPayload>(`/api/enrollments/${enrollmentId}`)
        if (cancelled) return
        setEnrollment(enr)
        const stepList = (enr.classSession?.academicYear?.steps ?? [])
          .slice()
          .sort((a, b) => a.stepNumber - b.stepNumber)
        setSteps(stepList)
        const current = stepList.find(s => s.isCurrent) ?? stepList[0]
        setSelectedStepId(current?.id ?? "")
        const cs = await fetchClassSubjects(enr.classSessionId)
        if (!cancelled) setClassSubjects(cs)
      } catch (e) {
        if (!cancelled) toast({ title: "Erreur", description: toMessage(e, "lors du chargement de l'élève"), variant: "destructive" })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [enrollmentId, toast])

  // ── Chargement notes + dispenses pour l'étape ────────────────────────────
  const loadGrades = useCallback(async (stepId: string) => {
    if (!stepId || !enrollment) return
    setLoadingGrades(true)
    try {
      const [grades, exclusionRows] = await Promise.all([
        apiFetch<ApiGrade[]>(`/api/grades/enrollment/${enrollmentId}?stepId=${stepId}`),
        // Un `.catch(() => [])` rendait ici un tableau vide indiscernable
        // d'une absence de dispense : sur un echec reseau, toutes les
        // sous-matieres dispensees redevenaient editables et vides, rentraient
        // dans le diff, et une saisie ecrivait une note la ou une dispense
        // existait. L'ecart manquante/dispensee vaut 1,50 point sur 10
        // (docs/CALCUL-BULLETIN.md). On distingue donc les deux cas.
        apiFetch<Array<{ enrollmentId: string; sectionId: string }>>(
          `/api/enrollments/excluded-sections?classSessionId=${enrollment.classSessionId}&stepId=${stepId}`,
        ).then(rows => ({ ok: true as const, rows }))
         .catch(() => ({ ok: false as const, rows: [] as Array<{ enrollmentId: string; sectionId: string }> })),
      ])
      const normalized = grades.map(g => ({ ...g, studentScore: parseDecimal(g.studentScore) ?? 0 }))
      setExistingGrades(normalized)
      setExclusionsUnavailable(!exclusionRows.ok)
      setExcludedSections(new Set(
        exclusionRows.rows.filter(r => r.enrollmentId === enrollmentId).map(r => r.sectionId),
      ))

      // Pré-remplir les saisies avec les notes existantes
      const next = new Map<string, Entry>()
      for (const g of normalized) {
        const key = g.sectionId ? `${g.classSubjectId}::${g.sectionId}` : g.classSubjectId
        next.set(key, { value: String(g.studentScore), isValid: true })
      }
      setEntries(next)
    } catch (e) {
      toast({ title: "Erreur", description: toMessage(e, "lors du chargement des notes"), variant: "destructive" })
    } finally {
      setLoadingGrades(false)
    }
  }, [enrollmentId, enrollment, toast])

  useEffect(() => {
    if (selectedStepId && enrollment) loadGrades(selectedStepId)
  }, [selectedStepId, enrollment, loadGrades])

  // ── Saisie ────────────────────────────────────────────────────────────────
  const setEntry = (key: string, value: string, max: number) => {
    setEntries(prev => {
      const next = new Map(prev)
      next.set(key, validate(value, max))
      return next
    })
  }

  // Matières visibles pour CET élève : tronc commun + celles de SA filière.
  // Un élève ne voit jamais les matières d'examen d'une autre filière.
  const visibleSubjects = useMemo(
    () => filterSubjectsByScope(classSubjects, scope, enrollment?.trackId),
    [classSubjects, scope, enrollment],
  )

  // Les matieres que CET eleve peut legitimement porter, filtre d'affichage
  // exclu. Le diff se calcule la-dessus, jamais sur `visibleSubjects` : sinon
  // basculer la portee avant d'enregistrer abandonne en silence les saisies
  // devenues invisibles, pendant que le toast annonce un succes.
  // La garde metier reste entiere : une matiere d'examen d'une autre filiere
  // n'est jamais dans cet ensemble.
  const savableSubjects = useMemo(
    () => filterSubjectsByScope(classSubjects, 'all', enrollment?.trackId),
    [classSubjects, enrollment],
  )

  // Les cles de saisie reellement affichees, dans la portee courante.
  const visibleKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const cs of visibleSubjects) {
      const hasSections = cs.subject.hasSections && cs.subject.sections.length > 0
      if (!hasSections) { keys.add(cs.id); continue }
      for (const sec of cs.subject.sections) keys.add(`${cs.id}::${sec.id}`)
    }
    return keys
  }, [visibleSubjects])

  // Une erreur bloque l'enregistrement — mais une erreur INVISIBLE, masquee par
  // le filtre de portee, rendait le bouton mort sans qu'aucune bordure rouge ne
  // soit a l'ecran : indiscernable d'une panne. On separe donc les deux.
  const visibleErrorCount = useMemo(() => {
    let n = 0
    for (const [key, e] of entries) if (!e.isValid && visibleKeys.has(key)) n++
    return n
  }, [entries, visibleKeys])

  const hiddenErrorCount = useMemo(() => {
    let n = 0
    for (const [key, e] of entries) if (!e.isValid && !visibleKeys.has(key)) n++
    return n
  }, [entries, visibleKeys])

  const hasErrors = visibleErrorCount + hiddenErrorCount > 0

  const hasExamSubjects = useMemo(
    () => filterSubjectsByScope(classSubjects, 'exam', enrollment?.trackId).length > 0,
    [classSubjects, enrollment],
  )
  // Classe terminale mais filière non configurée → on l'explique à l'utilisateur.
  const isTerminal = enrollment?.classSession?.class?.classType?.isTerminal === true
  const anyExamSubjectInClass = useMemo(
    () => classSubjects.some(cs => cs.trackId != null),
    [classSubjects],
  )

  // Diff avec l'existant → create / update / delete
  // Basé sur les matières VISIBLES : on n'enregistre jamais une note pour une
  // matière masquée (autre filière, ou hors du filtre courant).
  const diff = useMemo(() => {
    const existingByKey = new Map<string, ApiGrade>()
    for (const g of existingGrades) {
      const key = g.sectionId ? `${g.classSubjectId}::${g.sectionId}` : g.classSubjectId
      existingByKey.set(key, g)
    }
    const toCreate: CreateGradePayload[] = []
    const toUpdate: { gradeId: string; studentScore: number }[] = []
    const toDelete: string[] = []

    for (const cs of savableSubjects) {
      const hasSections = cs.subject.hasSections && cs.subject.sections.length > 0
      const targets = hasSections
        ? cs.subject.sections.map(sec => ({ key: `${cs.id}::${sec.id}`, sectionId: sec.id }))
        : [{ key: cs.id, sectionId: undefined as string | undefined }]

      for (const t of targets) {
        if (t.sectionId && excludedSections.has(t.sectionId)) continue // section dispensée : ignorer
        const entry = entries.get(t.key)
        const existing = existingByKey.get(t.key)
        const raw = entry?.value?.trim() ?? ""

        if (!raw) {
          if (existing) toDelete.push(existing.id) // note effacée = suppression
          continue
        }
        if (!entry?.isValid) continue
        const score = parseScore(raw)
        if (score === null) continue
        if (!existing) {
          toCreate.push({
            enrollmentId,
            classSubjectId: cs.id,
            ...(t.sectionId && { sectionId: t.sectionId }),
            stepId: selectedStepId,
            studentScore: score,
            gradeType: "EXAM",
          })
        } else if (score !== Number(existing.studentScore)) {
          toUpdate.push({ gradeId: existing.id, studentScore: score })
        }
      }
    }
    return { toCreate, toUpdate, toDelete }
  }, [savableSubjects, entries, existingGrades, excludedSections, enrollmentId, selectedStepId])

  const dirtyCount = diff.toCreate.length + diff.toUpdate.length + diff.toDelete.length
  // L'alerte native ne couvre que la fermeture d'onglet, F5 et l'URL. Changer
  // d'etape ne quitte pas la page : `beforeunload` ne peut structurellement pas
  // se declencher, et loadGrades reecrivait `entries` sans un mot.
  useUnsavedChangesWarning(dirtyCount > 0)

  const [pendingStepId, setPendingStepId] = useState<string | null>(null)

  function requestStepChange(stepId: string) {
    if (stepId === selectedStepId) return
    if (dirtyCount > 0) { setPendingStepId(stepId); return }
    setSelectedStepId(stepId)
  }

  const handleSave = async () => {
    if (hasErrors || dirtyCount === 0) return
    setSaving(true)
    try {
      const ops: Promise<unknown>[] = []
      if (diff.toCreate.length > 0) ops.push(bulkCreateGrades(diff.toCreate))
      diff.toUpdate.forEach(u => ops.push(updateGrade(u.gradeId, u.studentScore)))
      diff.toDelete.forEach(id => ops.push(deleteGrade(id)))
      await Promise.all(ops)
      const parts = [
        diff.toCreate.length && `${diff.toCreate.length} créée${diff.toCreate.length > 1 ? "s" : ""}`,
        diff.toUpdate.length && `${diff.toUpdate.length} modifiée${diff.toUpdate.length > 1 ? "s" : ""}`,
        diff.toDelete.length && `${diff.toDelete.length} retirée${diff.toDelete.length > 1 ? "s" : ""}`,
      ].filter(Boolean).join(", ")
      toast({ title: "Notes enregistrées", description: parts })
      await loadGrades(selectedStepId)
    } catch (e) {
      toast({ title: "Échec de l'enregistrement", description: toMessage(e, "lors de l'enregistrement"), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  // ── Rendu ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  const studentName = `${enrollment?.student?.user?.firstname ?? ""} ${enrollment?.student?.user?.lastname ?? ""}`.trim()
  const className = `${enrollment?.classSession?.class?.classType?.name ?? ""} ${enrollment?.classSession?.class?.letter ?? ""}`.trim()

  // Matières groupées par rubrique R1 → R2 → R3 (dans la portée choisie)
  const maxScoreByKey = new Map<string, number>()
  for (const cs of visibleSubjects) {
    const hasSections = cs.subject.hasSections && cs.subject.sections.length > 0
    if (!hasSections) { maxScoreByKey.set(cs.id, effectiveMaxScore(cs)); continue }
    for (const sec of cs.subject.sections) maxScoreByKey.set(`${cs.id}::${sec.id}`, sec.maxScore)
  }

  const orderedForKeys = [...visibleSubjects].sort((a, b) => {
    const ra = a.subject.rubric?.code ?? "ZZ"
    const rb = b.subject.rubric?.code ?? "ZZ"
    return ra.localeCompare(rb) || a.subject.name.localeCompare(b.subject.name, "fr")
  })

  // Ordre d'affichage des champs editables, de haut en bas. Les sous-matieres
  // dispensees n'ont pas de champ : elles ne prennent pas de rang.
  const inputOrder: string[] = []
  for (const cs of orderedForKeys) {
    const hasSections = cs.subject.hasSections && cs.subject.sections.length > 0
    if (!hasSections) { inputOrder.push(cs.id); continue }
    for (const sec of [...cs.subject.sections].sort((a, b) => a.displayOrder - b.displayOrder)) {
      if (excludedSections.has(sec.id)) continue
      inputOrder.push(`${cs.id}::${sec.id}`)
    }
  }

  // Collage d'une colonne — depuis un tableur ou un releve recopie. Une seule
  // valeur garde le comportement natif ; a partir de deux, on distribue vers le
  // bas. Chaque valeur passe par setEntry, donc par DR-004 : le collage ne
  // contourne pas la validation.
  function handlePasteFrom(key: string, e: React.ClipboardEvent<HTMLInputElement>) {
    const tokens = e.clipboardData
      .getData('text')
      .split(/[\r\n\t;]+/)
      .map((t) => t.trim())
      .filter(Boolean)
    if (tokens.length <= 1) return
    e.preventDefault()
    const start = inputOrder.indexOf(key)
    if (start < 0) return
    tokens.forEach((token, i) => {
      const targetKey = inputOrder[start + i]
      if (!targetKey) return
      const max = maxScoreByKey.get(targetKey)
      if (max === undefined) return
      setEntry(targetKey, token, max)
    })
  }

  const ordered = [...visibleSubjects].sort((a, b) => {
    const ra = a.subject.rubric?.code ?? "ZZ"
    const rb = b.subject.rubric?.code ?? "ZZ"
    return ra.localeCompare(rb) || a.subject.name.localeCompare(b.subject.name, "fr")
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-1 -ml-2 text-muted-foreground" onClick={() => router.push(`/admin/academic-year/${yearId}/grades`)}>
            <ArrowLeftIcon className="mr-1 h-4 w-4" /> Retour aux notes
          </Button>
          <h1 className="heading-2 break-words text-foreground">{studentName || "Élève sans nom"}</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            {className} — saisie des notes par élève
            {enrollment?.track && (
              <span className="ml-2 rounded border border-info-border bg-info-soft px-1.5 py-0.5 text-xs font-medium text-info-ink">
                Filière {enrollment.track.code}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedStepId} onValueChange={requestStepChange}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Étape" /></SelectTrigger>
            <SelectContent>
              {steps.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex flex-col items-end gap-1">
            <Button onClick={handleSave} disabled={saving || hasErrors || dirtyCount === 0}>
              <SaveIcon className="mr-2 h-4 w-4" />
              {saving ? "Enregistrement..." : dirtyCount > 0 ? `Enregistrer (${dirtyCount})` : "Enregistrer"}
            </Button>
            {/* Un bouton desactive sans cause visible est indiscernable d'une
                panne — surtout quand la ligne fautive est masquee par le filtre
                de portee. */}
            {hiddenErrorCount > 0 && (
              <p role="alert" className="text-3xs text-destructive">
                {hiddenErrorCount} erreur{hiddenErrorCount > 1 ? "s" : ""} dans les matières masquées —
                affichez « Toutes » pour {hiddenErrorCount > 1 ? "les" : "la"} corriger.
              </p>
            )}
          </div>
        </div>
      </div>

      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <h2 className="text-base font-semibold leading-none tracking-tight">Matières &amp; sous-matières</h2>
          <CardDescription>
            Videz une case pour retirer une note. Les sections dispensées sont grisées.
          </CardDescription>

          {/* Portée — seulement si l'élève a des matières d'examen officiel */}
          {hasExamSubjects && (
            <div className="mt-2 inline-flex rounded-lg border bg-muted/40 p-0.5">
              {([
                { key: 'all',    label: 'Toutes' },
                { key: 'common', label: 'Tronc commun' },
                { key: 'exam',   label: 'Examen officiel' },
              ] as const).map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setScope(opt.key)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    scope === opt.key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Aide filière : classe terminale mais configuration incomplète */}
          {isTerminal && !enrollment?.trackId && (
            <div className="mt-2 rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-xs text-warning-ink">
              Cet élève n&apos;a pas de filière définie pour cette année : ses matières
              d&apos;examen officiel ne peuvent pas s&apos;afficher. Définissez sa filière
              depuis la page <span className="font-medium">Élèves inscrits</span> (menu ⋮ → Définir la filière).
            </div>
          )}
          {isTerminal && enrollment?.trackId && !anyExamSubjectInClass && (
            <div className="mt-2 rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-xs text-warning-ink">
              Aucune matière d&apos;examen officiel n&apos;est encore rattachée à une filière
              dans cette classe. Assignez-en depuis <span className="font-medium">Configuration → Matières →
              Assigner des matières</span> (choisir « Examen officiel — filière »).
            </div>
          )}
        </CardHeader>
        {exclusionsUnavailable && (
          <div className="mx-4 mb-3 rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-xs text-warning-ink" role="alert">
            Les dispenses n&apos;ont pas pu être chargées. La saisie est bloquée : sans
            elles, une note pourrait être écrite sur une sous-matière dont cet élève
            est dispensé. Rechargez la page pour réessayer.
          </div>
        )}
        <CardContent className="p-0">
          {loadingGrades ? (
            <div className="p-6"><Skeleton className="h-64 w-full" /></div>
          ) : ordered.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              Aucune matière assignée à cette classe.
            </p>
          ) : (
            <div className="cpmsl-scroll overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th scope="col" className="px-3 py-1.5 text-left font-semibold text-muted-foreground">Matière / sous-matière</th>
                    <th scope="col" className="px-3 py-1.5 text-left font-semibold text-muted-foreground min-w-[84px]">Rubrique</th>
                    <th scope="col" className="px-3 py-1.5 text-center font-semibold text-muted-foreground min-w-[96px]">Note</th>
                    <th scope="col" className="px-3 py-1.5 text-left font-semibold text-muted-foreground min-w-[84px]">/ Max</th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((cs, ci) => {
                    // Le tri par rubrique existait deja ; sans en-tete de
                    // groupe, l'oeil devait lire quinze badges pour deviner ou
                    // R1 finit. On materialise la coupure, avec son poids.
                    const rubric = cs.subject.rubric?.code
                    const prevRubric = ci > 0 ? ordered[ci - 1].subject.rubric?.code : undefined
                    const startsGroup = ci === 0 || rubric !== prevRubric
                    const subj = cs.subject
                    const hasSections = subj.hasSections && subj.sections.length > 0
                    const rows: React.ReactNode[] = []

                    if (startsGroup) {
                      rows.push(
                        <tr key={`grp-${rubric ?? 'none'}`} className="border-t bg-muted/60">
                          <th
                            scope="colgroup"
                            colSpan={4}
                            className="px-3 py-1 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                          >
                            {rubric ? rubricLabel(rubric) : "Rubrique non définie"}
                          </th>
                        </tr>,
                      )
                    }

                    // Ligne matière
                    if (!hasSections) {
                      const key = cs.id
                      const entry = entries.get(key)
                      const err = entry && !entry.isValid
                      rows.push(
                        <tr key={cs.id} className={ci > 0 ? "border-t" : ""}>
                          <td className="px-3 py-1 font-semibold text-foreground">
                            {subj.name}
                            {cs.track && (
                              <span className="ml-2 rounded border border-info-border bg-info-soft px-1.5 py-0.5 text-3xs font-medium text-info-ink">
                                Examen · {cs.track.code}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1">
                            {subj.rubric?.code && <Badge variant="outline" className={RUBRIC_BADGE}>{rubricLabel(subj.rubric.code)}</Badge>}
                          </td>
                          <td className="px-3 py-1 text-center">
                            <Input
                              type="text" inputMode="decimal" autoComplete="off"
                              placeholder="—" disabled={exclusionsUnavailable}
                              value={entry?.value ?? ""}
                              onChange={e => setEntry(key, e.target.value, effectiveMaxScore(cs))}
                              onPaste={e => handlePasteFrom(key, e)}
                              data-grid-row={inputOrder.indexOf(key)}
                              aria-label={`${subj.name} — ${studentName}, sur ${effectiveMaxScore(cs)}`}
                              aria-invalid={!!err}
                              aria-describedby={err ? `err-${key}` : undefined}
                              className={`h-7 text-center tabular-nums ${err ? "border-destructive focus-visible:ring-destructive" : ""}`}
                            />
                            {err && entry?.error && (
                              <p id={`err-${key}`} role="alert" className="mt-0.5 text-3xs text-destructive">
                                {entry.error}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-1 tabular-nums text-muted-foreground">/ {effectiveMaxScore(cs)}</td>
                        </tr>,
                      )
                    } else {
                      // Ligne parent (matière)
                      rows.push(
                        <tr key={cs.id} className={`bg-muted/20 ${ci > 0 ? "border-t" : ""}`}>
                          <td className="px-3 py-1 font-semibold text-foreground">
                            {subj.name}
                            {cs.track && (
                              <span className="ml-2 rounded border border-info-border bg-info-soft px-1.5 py-0.5 text-3xs font-medium text-info-ink">
                                Examen · {cs.track.code}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1">
                            {subj.rubric?.code && <Badge variant="outline" className={RUBRIC_BADGE}>{rubricLabel(subj.rubric.code)}</Badge>}
                          </td>
                          <td className="px-3 py-1 text-center text-muted-foreground" colSpan={2}>
                            <span className="text-xs">{subj.sections.length} sous-matière{subj.sections.length > 1 ? "s" : ""} · /{subj.maxScore}</span>
                          </td>
                        </tr>,
                      )
                      // Lignes sections
                      for (const sec of [...subj.sections].sort((a, b) => a.displayOrder - b.displayOrder)) {
                        const key = `${cs.id}::${sec.id}`
                        const entry = entries.get(key)
                        const err = entry && !entry.isValid
                        const excluded = excludedSections.has(sec.id)
                        rows.push(
                          <tr key={key} className="border-t">
                            <td className="px-3 py-1 pl-8 text-muted-foreground">
                              <span className="mr-1.5 text-muted-foreground" aria-hidden>└</span>
                              {sec.name}
                              {excluded && <span className="ml-2 text-xs text-warning-ink">(dispensé)</span>}
                            </td>
                            <td />
                            <td className="px-3 py-1 text-center">
                              <Input
                                type="text" inputMode="decimal" autoComplete="off"
                                placeholder="—"
                                disabled={excluded || exclusionsUnavailable}
                                value={excluded ? "" : (entry?.value ?? "")}
                                onChange={e => setEntry(key, e.target.value, sec.maxScore)}
                                onPaste={e => handlePasteFrom(key, e)}
                                data-grid-row={inputOrder.indexOf(key)}
                                aria-label={`${sec.name} — ${subj.name}, ${studentName}, sur ${sec.maxScore}`}
                                aria-invalid={!!err}
                                aria-describedby={err ? `err-${key}` : undefined}
                                className={`h-7 text-center tabular-nums ${err ? "border-destructive focus-visible:ring-destructive" : ""}`}
                              />
                              {err && entry?.error && (
                                <p id={`err-${key}`} role="alert" className="mt-0.5 text-3xs text-destructive">
                                  {entry.error}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-1 tabular-nums text-muted-foreground">/ {sec.maxScore}</td>
                          </tr>,
                        )
                      }
                    }
                    return rows
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Changer d'etape recharge les notes et reecrit les saisies en cours. */}
      <AlertDialog
        open={pendingStepId !== null}
        onOpenChange={(o) => { if (!o) setPendingStepId(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dirtyCount} modification{dirtyCount > 1 ? "s" : ""} non enregistrée{dirtyCount > 1 ? "s" : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Changer d&apos;étape recharge les notes de {studentName} et efface{" "}
              {dirtyCount > 1 ? "ces saisies" : "cette saisie"}. Enregistrez d&apos;abord
              pour {dirtyCount > 1 ? "les" : "la"} conserver.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revenir à la saisie</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingStepId) setSelectedStepId(pendingStepId)
                setPendingStepId(null)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Abandonner {dirtyCount > 1 ? "les modifications" : "la modification"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
