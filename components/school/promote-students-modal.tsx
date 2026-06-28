"use client"

import { useEffect, useMemo, useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ArrowRightIcon, GraduationCapIcon, RefreshCwIcon, SearchIcon } from "lucide-react"
import { clientFetch as apiFetch } from "@/lib/client-fetch"
import { parseDecimal } from "@/lib/decimal"
import {
  fetchAllAcademicYears,
  fetchClassSessions,
  type AcademicYear,
  type ClassSession,
} from "@/lib/api/dashboard"
import { toMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"

interface PromoteStudentsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentYear: AcademicYear
  currentYearSessions: ClassSession[]
  onSuccess?: () => void
}

interface GradebookSubject {
  classSubjectId: string
  subjectId: string
  name: string
  code: string
  maxScore: unknown
  coefficient: unknown
  hasSections: boolean
  sections: Array<{ id: string; name: string; code: string; maxScore: unknown }>
}

interface GradebookStudent {
  enrollmentId: string
  studentId: string
  studentCode: string
  firstname: string
  lastname: string
  status: string
  grades: Array<{
    id: string
    classSubjectId: string
    sectionId: string | null
    stepId: string
    studentScore: unknown
  }>
}

interface GradebookResponse {
  academicYear: { id: string; name: string }
  class: { id: string; letter: string; classType: string }
  classSession: { id: string }
  steps: Array<{ id: string; name: string; stepNumber: number }>
  subjects: GradebookSubject[]
  students: GradebookStudent[]
}

interface CandidateRow {
  enrollmentId: string
  studentId: string
  studentCode: string
  fullName: string
  average: number | null
  graded: boolean
}

function classDisplayName(s: ClassSession): string {
  const trackSuffix = s.class.track ? ` ${s.class.track.code}` : ""
  return `${s.class.classType.name} ${s.class.letter}${trackSuffix}`
}

function computeStudentAverage(student: GradebookStudent, subjects: GradebookSubject[], stepIds: string[]): number | null {
  if (student.grades.length === 0) return null

  const subjectMap = new Map(subjects.map(s => [s.classSubjectId, s]))
  const stepAverages: number[] = []

  for (const stepId of stepIds) {
    const subjectScores: { score: number; coef: number }[] = []

    for (const cs of subjects) {
      const coef = parseDecimal(cs.coefficient) ?? 1
      const subjectMax = parseDecimal(cs.maxScore) ?? 0
      if (subjectMax <= 0) continue

      const stepGrades = student.grades.filter(
        g => g.classSubjectId === cs.classSubjectId && g.stepId === stepId
      )
      if (stepGrades.length === 0) continue

      let raw = 0
      let denom = subjectMax

      if (cs.hasSections && cs.sections.length > 0) {
        const sectionMaxByCs = cs.sections.reduce((acc, sec) => {
          const m = parseDecimal(sec.maxScore) ?? 0
          return acc + m
        }, 0)
        denom = sectionMaxByCs > 0 ? sectionMaxByCs : subjectMax

        for (const g of stepGrades) {
          if (!g.sectionId) continue
          const score = parseDecimal(g.studentScore) ?? 0
          raw += score
        }
      } else {
        const g = stepGrades.find(x => x.sectionId == null)
        if (!g) continue
        raw = parseDecimal(g.studentScore) ?? 0
      }

      const normalized = denom > 0 ? (raw / denom) * 100 : 0
      subjectScores.push({ score: normalized, coef })
    }

    if (subjectScores.length === 0) continue
    const totalCoef = subjectScores.reduce((a, b) => a + b.coef, 0)
    if (totalCoef <= 0) continue
    const stepAvg = subjectScores.reduce((a, b) => a + b.score * b.coef, 0) / totalCoef
    stepAverages.push(stepAvg)
  }

  if (stepAverages.length === 0) return null
  return stepAverages.reduce((a, b) => a + b, 0) / stepAverages.length
}

export function PromoteStudentsModal({
  open,
  onOpenChange,
  currentYear,
  currentYearSessions,
  onSuccess,
}: PromoteStudentsModalProps) {
  const { toast } = useToast()

  const [years, setYears] = useState<AcademicYear[]>([])
  const [sourceYearId, setSourceYearId] = useState<string>("")
  const [sourceSessions, setSourceSessions] = useState<ClassSession[]>([])
  const [sourceClassSessionId, setSourceClassSessionId] = useState<string>("")
  const [minAverage, setMinAverage] = useState<string>("60")
  const [searchName, setSearchName] = useState("")

  const [loadingYears, setLoadingYears] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [computing, setComputing] = useState(false)
  const [candidates, setCandidates] = useState<CandidateRow[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [targetSessionId, setTargetSessionId] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)

  const sourceSession = sourceSessions.find(s => s.id === sourceClassSessionId)
  const targetSession = currentYearSessions.find(s => s.id === targetSessionId)

  useEffect(() => {
    if (!open) return
    setLoadingYears(true)
    fetchAllAcademicYears()
      .then((all) => {
        const filtered = all.filter(y => y.id !== currentYear.id)
        setYears(filtered)
      })
      .catch(err =>
        toast({ title: "Erreur", description: toMessage(err, "lors du chargement des années"), variant: "destructive" })
      )
      .finally(() => setLoadingYears(false))
  }, [open, currentYear.id, toast])

  useEffect(() => {
    if (!sourceYearId) { setSourceSessions([]); setSourceClassSessionId(""); return }
    setLoadingSessions(true)
    fetchClassSessions(sourceYearId)
      .then(setSourceSessions)
      .catch(err =>
        toast({ title: "Erreur", description: toMessage(err, "lors du chargement des classes"), variant: "destructive" })
      )
      .finally(() => setLoadingSessions(false))
  }, [sourceYearId, toast])

  useEffect(() => {
    if (!open) {
      setSourceYearId("")
      setSourceSessions([])
      setSourceClassSessionId("")
      setMinAverage("60")
      setSearchName("")
      setCandidates(null)
      setSelectedIds(new Set())
      setTargetSessionId("")
    }
  }, [open])

  useEffect(() => {
    setCandidates(null)
    setSelectedIds(new Set())
  }, [sourceClassSessionId])

  async function handleLoadCandidates() {
    if (!sourceClassSessionId || !sourceSession) return
    const minAvg = Number(minAverage)
    if (!Number.isFinite(minAvg)) {
      toast({ title: "Moyenne invalide", description: "Saisissez un nombre.", variant: "destructive" })
      return
    }

    setComputing(true)
    try {
      const classId = sourceSession.class.id
      const data = await apiFetch<GradebookResponse>(
        `/api/gradebook/class/${classId}?academicYearId=${sourceYearId}`
      )
      if (!data || !Array.isArray(data.steps) || !Array.isArray(data.students) || !Array.isArray(data.subjects)) {
        console.error("[promote] unexpected gradebook shape:", data)
        throw new Error("Réponse du serveur inattendue (champs manquants)")
      }
      const stepIds = data.steps.map(s => s.id)

      const rows: CandidateRow[] = data.students
        .filter(s => s.status === "ACTIVE")
        .map(s => {
          const avg = computeStudentAverage(s, data.subjects, stepIds)
          return {
            enrollmentId: s.enrollmentId,
            studentId: s.studentId,
            studentCode: s.studentCode,
            fullName: `${s.lastname} ${s.firstname}`.trim(),
            average: avg,
            graded: avg !== null,
          }
        })
        .sort((a, b) => {
          if (a.average == null && b.average == null) return a.fullName.localeCompare(b.fullName)
          if (a.average == null) return 1
          if (b.average == null) return -1
          return b.average - a.average
        })

      const eligibleIds = rows.filter(r => r.average != null && r.average >= minAvg).map(r => r.enrollmentId)
      setCandidates(rows)
      setSelectedIds(new Set(eligibleIds))

      const eligibleCount = eligibleIds.length
      const total = rows.length
      toast({
        title: `${eligibleCount} élève${eligibleCount > 1 ? "s" : ""} éligible${eligibleCount > 1 ? "s" : ""}`,
        description: `Sur ${total} élève${total > 1 ? "s" : ""} avec moyenne ≥ ${minAvg}.`,
      })
    } catch (err) {
      console.error("[promote] handleLoadCandidates failed:", err)
      toast({
        title: "Erreur",
        description: toMessage(err, "lors du calcul des moyennes"),
        variant: "destructive",
      })
    } finally {
      setComputing(false)
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function toggleSelectAllVisible() {
    if (!candidates) return
    const visibleIds = filteredCandidates.filter(r => r.graded).map(r => r.enrollmentId)
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const n = new Set(prev)
      if (allSelected) visibleIds.forEach(id => n.delete(id))
      else visibleIds.forEach(id => n.add(id))
      return n
    })
  }

  const filteredCandidates = useMemo(() => {
    if (!candidates) return []
    if (!searchName.trim()) return candidates
    const q = searchName.toLowerCase()
    return candidates.filter(c =>
      c.fullName.toLowerCase().includes(q) || c.studentCode.toLowerCase().includes(q)
    )
  }, [candidates, searchName])

  async function handleSubmit() {
    if (!targetSessionId || selectedIds.size === 0) return
    setSubmitting(true)
    let successCount = 0
    const failures: string[] = []
    try {
      const minAvg = Number(minAverage)
      const allCandidates = candidates ?? []
      await Promise.all(
        Array.from(selectedIds).map(async id => {
          const row = allCandidates.find(r => r.enrollmentId === id)
          if (!row) return
          try {
            await apiFetch(`/api/enrollments/transfer`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                enrollmentId: id,
                newClassSessionId: targetSessionId,
                notes: `Promotion depuis ${sourceSession ? classDisplayName(sourceSession) : "année précédente"} (moyenne ${row.average?.toFixed(2) ?? "—"} ≥ ${minAvg})`,
              }),
            })
            successCount++
          } catch (e) {
            failures.push(`${row.fullName} — ${toMessage(e)}`)
          }
        })
      )

      if (successCount > 0) {
        toast({
          title: `${successCount} élève${successCount > 1 ? "s transférés" : " transféré"}`,
          description: failures.length ? `${failures.length} échec(s)` : undefined,
        })
        onOpenChange(false)
        onSuccess?.()
      }
      if (failures.length > 0) {
        console.error("[promote] échecs:", failures)
        if (successCount === 0) {
          toast({
            title: "Aucun transfert effectué",
            description: failures[0],
            variant: "destructive",
          })
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  const eligibleCount = candidates ? candidates.filter(c => c.average != null && c.average >= Number(minAverage)).length : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 p-0 sm:max-w-[760px]">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <GraduationCapIcon className="h-5 w-5 text-[#2C4A6E]" />
            Promouvoir des élèves de l&apos;année précédente
          </DialogTitle>
          <DialogDescription>
            Sélectionnez une classe source, fixez la moyenne requise, puis transférez les élèves éligibles vers une classe de l&apos;année <span className="font-medium">{currentYear.name}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-4">
          <section className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2C4A6E] text-xs font-bold text-white">1</span>
              <h3 className="text-sm font-semibold">Source &amp; critère</h3>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Année source</Label>
                <Select value={sourceYearId} onValueChange={setSourceYearId} disabled={loadingYears}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingYears ? "Chargement..." : "Choisir l'année précédente"} />
                  </SelectTrigger>
                  <SelectContent>
                    {years.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Aucune autre année</div>
                    ) : (
                      years.map(y => (
                        <SelectItem key={y.id} value={y.id}>
                          {y.name} {y.isCurrent ? "(courante)" : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Classe source</Label>
                <Select
                  value={sourceClassSessionId}
                  onValueChange={setSourceClassSessionId}
                  disabled={!sourceYearId || loadingSessions}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingSessions ? "Chargement..." : "Choisir la classe"} />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceSessions.map(s => (
                      <SelectItem key={s.id} value={s.id}>{classDisplayName(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Moyenne minimale (sur 100)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={minAverage}
                  onChange={e => setMinAverage(e.target.value)}
                  placeholder="60"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs opacity-0">.</Label>
                <Button
                  type="button"
                  className="w-full bg-[#2C4A6E] text-white hover:bg-[#1F3856]"
                  onClick={handleLoadCandidates}
                  disabled={!sourceClassSessionId || computing}
                >
                  {computing ? <RefreshCwIcon className="mr-2 h-4 w-4 animate-spin" /> : <SearchIcon className="mr-2 h-4 w-4" />}
                  {computing ? "Calcul..." : "Rechercher les élèves"}
                </Button>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white", candidates ? "bg-[#2C4A6E]" : "bg-muted-foreground/40")}>2</span>
                <h3 className="text-sm font-semibold">Élèves éligibles</h3>
                {candidates && (
                  <Badge variant="secondary" className="ml-1">
                    {selectedIds.size} / {eligibleCount} sélectionné{selectedIds.size > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              {candidates && (
                <button
                  type="button"
                  onClick={toggleSelectAllVisible}
                  className="text-xs font-medium text-[#2C4A6E] hover:underline"
                >
                  Tout (dé)sélectionner
                </button>
              )}
            </div>

            {!candidates ? (
              <div className="flex h-[180px] items-center justify-center rounded-md border border-dashed bg-muted/20 px-6 text-center text-sm text-muted-foreground">
                Lancez une recherche pour voir les élèves éligibles.
              </div>
            ) : (
              <>
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Filtrer par nom ou code..."
                    value={searchName}
                    onChange={e => setSearchName(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <ScrollArea className="h-[260px] rounded-md border">
                  {filteredCandidates.length === 0 ? (
                    <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                      Aucun élève
                    </div>
                  ) : (
                    <ul className="divide-y bg-background">
                      {filteredCandidates.map(row => {
                        const isEligible = row.average != null && row.average >= Number(minAverage)
                        const isSelected = selectedIds.has(row.enrollmentId)
                        return (
                          <li
                            key={row.enrollmentId}
                            onClick={() => row.graded && toggleSelect(row.enrollmentId)}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 transition-colors",
                              row.graded && "cursor-pointer hover:bg-muted/40",
                              !row.graded && "opacity-60",
                              isSelected && "bg-[#F0F4F7]"
                            )}
                          >
                            <Checkbox
                              checked={isSelected}
                              disabled={!row.graded}
                              onCheckedChange={() => toggleSelect(row.enrollmentId)}
                              onClick={e => e.stopPropagation()}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">{row.fullName || "—"}</span>
                                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                                  {row.studentCode}
                                </code>
                              </div>
                            </div>
                            <div className="text-right">
                              {row.average != null ? (
                                <span
                                  className={cn(
                                    "tabular-nums text-sm font-semibold",
                                    isEligible ? "text-emerald-700" : "text-muted-foreground"
                                  )}
                                >
                                  {row.average.toFixed(2)} / 100
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Aucune note</span>
                              )}
                              {row.graded && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "ml-2 text-[10px]",
                                    isEligible
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                      : "border-amber-200 bg-amber-50 text-amber-700"
                                  )}
                                >
                                  {isEligible ? "Éligible" : "Non éligible"}
                                </Badge>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </ScrollArea>
              </>
            )}
          </section>

          <Separator />

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white", selectedIds.size > 0 ? "bg-[#2C4A6E]" : "bg-muted-foreground/40")}>3</span>
              <h3 className="text-sm font-semibold">Classe de destination</h3>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Classe de l&apos;année {currentYear.name}</Label>
                <Select value={targetSessionId} onValueChange={setTargetSessionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir la classe d'accueil" />
                  </SelectTrigger>
                  <SelectContent>
                    {currentYearSessions.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Aucune classe configurée</div>
                    ) : (
                      currentYearSessions.map(s => (
                        <SelectItem key={s.id} value={s.id}>{classDisplayName(s)}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              {sourceSession && targetSession && (
                <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs">
                  <span className="font-medium">{classDisplayName(sourceSession)}</span>
                  <ArrowRightIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{classDisplayName(targetSession)}</span>
                </div>
              )}
            </div>
          </section>
        </div>

        <DialogFooter className="border-t bg-muted/30 px-6 py-3">
          <div className="flex w-full items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || !targetSessionId || selectedIds.size === 0}
              className="bg-[#2C4A6E] text-white hover:bg-[#1F3856]"
            >
              {submitting
                ? "Transfert..."
                : `Transférer ${selectedIds.size > 0 ? `${selectedIds.size} ` : ""}élève${selectedIds.size > 1 ? "s" : ""}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
