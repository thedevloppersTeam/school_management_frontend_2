"use client"

// Saisie des notes par ÉLÈVE : toutes les matières et sous-matières d'un élève
// pour une étape, éditables d'un coup. Complémentaire à la grille par matière.

import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeftIcon, SaveIcon } from "lucide-react"
import { clientFetch as apiFetch } from "@/lib/client-fetch"
import {
  fetchClassSubjects,
  bulkCreateGrades,
  updateGrade,
  deleteGrade,
  type ApiClassSubject,
  type ApiGrade,
  type CreateGradePayload,
} from "@/lib/api/grades"
import { parseDecimal } from "@/lib/decimal"
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning"
import { toMessage } from "@/lib/errors"

interface Step { id: string; name: string; stepNumber: number; isCurrent: boolean }
interface EnrollmentPayload {
  id: string
  classSessionId: string
  student?: { user?: { firstname?: string; lastname?: string }; studentCode?: string }
  classSession?: {
    class?: { letter?: string; classType?: { name?: string } }
    academicYear?: { steps?: Step[] }
  }
}

// Une saisie = valeur + validité. Clé : classSubjectId (mode global) ou
// `${classSubjectId}::${sectionId}` (mode sections).
interface Entry { value: string; isValid: boolean; error?: string }

function validate(value: string, max: number): Entry {
  if (!value || value.trim() === "") return { value, isValid: true }
  const num = parseFloat(value)
  if (isNaN(num)) return { value, isValid: false, error: "Valeur invalide" }
  if (num < 0 || num > max) return { value, isValid: false, error: `0 à ${max}` }
  if (Math.round(num * 4 * 1e10) / 1e10 !== Math.round(num * 4))
    return { value, isValid: false, error: "Multiples de 0,25" }
  return { value, isValid: true }
}

function rubricBadge(code?: string) {
  if (code === "R1") return "border-blue-200 bg-blue-50 text-blue-700"
  if (code === "R2") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (code === "R3") return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-neutral-200 bg-neutral-50 text-neutral-600"
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
  const [loadingGrades, setLoadingGrades] = useState(false)

  // key = classSubjectId (global) ou `${classSubjectId}::${sectionId}` (section)
  const [entries, setEntries] = useState<Map<string, Entry>>(new Map())

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
        apiFetch<Array<{ enrollmentId: string; sectionId: string }>>(
          `/api/enrollments/excluded-sections?classSessionId=${enrollment.classSessionId}&stepId=${stepId}`,
        ).catch(() => []),
      ])
      const normalized = grades.map(g => ({ ...g, studentScore: parseDecimal(g.studentScore) ?? 0 }))
      setExistingGrades(normalized)
      setExcludedSections(new Set(
        exclusionRows.filter(r => r.enrollmentId === enrollmentId).map(r => r.sectionId),
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

  const hasErrors = useMemo(
    () => Array.from(entries.values()).some(e => !e.isValid),
    [entries],
  )

  // Diff avec l'existant → create / update / delete
  const diff = useMemo(() => {
    const existingByKey = new Map<string, ApiGrade>()
    for (const g of existingGrades) {
      const key = g.sectionId ? `${g.classSubjectId}::${g.sectionId}` : g.classSubjectId
      existingByKey.set(key, g)
    }
    const toCreate: CreateGradePayload[] = []
    const toUpdate: { gradeId: string; studentScore: number }[] = []
    const toDelete: string[] = []

    for (const cs of classSubjects) {
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
        const score = parseFloat(raw)
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
  }, [classSubjects, entries, existingGrades, excludedSections, enrollmentId, selectedStepId])

  const dirtyCount = diff.toCreate.length + diff.toUpdate.length + diff.toDelete.length
  useUnsavedChangesWarning(dirtyCount > 0)

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

  // Matières groupées par rubrique R1 → R2 → R3
  const ordered = [...classSubjects].sort((a, b) => {
    const ra = a.subject.rubric?.code ?? "ZZ"
    const rb = b.subject.rubric?.code ?? "ZZ"
    return ra.localeCompare(rb) || a.subject.name.localeCompare(b.subject.name, "fr")
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-1 -ml-2 text-muted-foreground" onClick={() => router.push(`/admin/academic-year/${yearId}/students`)}>
            <ArrowLeftIcon className="mr-1 h-4 w-4" /> Retour aux élèves
          </Button>
          <h1 className="font-serif text-2xl font-bold text-foreground">{studentName}</h1>
          <p className="text-sm text-muted-foreground">{className} — saisie des notes par élève</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedStepId} onValueChange={setSelectedStepId}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Étape" /></SelectTrigger>
            <SelectContent>
              {steps.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={handleSave} disabled={saving || hasErrors || dirtyCount === 0}>
            <SaveIcon className="mr-2 h-4 w-4" />
            {saving ? "Enregistrement..." : dirtyCount > 0 ? `Enregistrer (${dirtyCount})` : "Enregistrer"}
          </Button>
        </div>
      </div>

      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Matières & sous-matières</CardTitle>
          <CardDescription>
            Videz une case pour retirer une note. Les sections dispensées sont grisées.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loadingGrades ? (
            <div className="p-6"><Skeleton className="h-64 w-full" /></div>
          ) : ordered.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              Aucune matière assignée à cette classe.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Matière / sous-matière</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground w-[90px]">Rubrique</th>
                    <th className="px-4 py-2.5 text-center font-semibold text-muted-foreground w-[140px]">Note</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground w-[90px]">/ Max</th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((cs, ci) => {
                    const subj = cs.subject
                    const hasSections = subj.hasSections && subj.sections.length > 0
                    const rows: React.ReactNode[] = []

                    // Ligne matière
                    if (!hasSections) {
                      const key = cs.id
                      const entry = entries.get(key)
                      const err = entry && !entry.isValid
                      rows.push(
                        <tr key={cs.id} className={ci > 0 ? "border-t" : ""}>
                          <td className="px-4 py-2.5 font-semibold text-foreground">{subj.name}</td>
                          <td className="px-4 py-2.5">
                            {subj.rubric?.code && <Badge variant="outline" className={rubricBadge(subj.rubric.code)}>{subj.rubric.code}</Badge>}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <Input
                              type="number" step="0.25" min="0" max={subj.maxScore}
                              inputMode="decimal" placeholder="—"
                              value={entry?.value ?? ""}
                              onChange={e => setEntry(key, e.target.value, subj.maxScore)}
                              className={`h-8 text-center ${err ? "border-destructive focus-visible:ring-destructive" : ""}`}
                            />
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">/ {subj.maxScore}</td>
                        </tr>,
                      )
                    } else {
                      // Ligne parent (matière)
                      rows.push(
                        <tr key={cs.id} className={`bg-muted/20 ${ci > 0 ? "border-t" : ""}`}>
                          <td className="px-4 py-2.5 font-semibold text-foreground">{subj.name}</td>
                          <td className="px-4 py-2.5">
                            {subj.rubric?.code && <Badge variant="outline" className={rubricBadge(subj.rubric.code)}>{subj.rubric.code}</Badge>}
                          </td>
                          <td className="px-4 py-2.5 text-center text-muted-foreground" colSpan={2}>
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
                            <td className="px-4 py-2 pl-10 text-muted-foreground">
                              <span className="text-neutral-400 mr-1.5" aria-hidden>└</span>
                              {sec.name}
                              {excluded && <span className="ml-2 text-xs text-amber-600">(dispensé)</span>}
                            </td>
                            <td />
                            <td className="px-4 py-1.5 text-center">
                              <Input
                                type="number" step="0.25" min="0" max={sec.maxScore}
                                inputMode="decimal" placeholder={excluded ? "—" : "—"}
                                disabled={excluded}
                                value={excluded ? "" : (entry?.value ?? "")}
                                onChange={e => setEntry(key, e.target.value, sec.maxScore)}
                                className={`h-8 text-center ${err ? "border-destructive focus-visible:ring-destructive" : ""}`}
                              />
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">/ {sec.maxScore}</td>
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
    </div>
  )
}
