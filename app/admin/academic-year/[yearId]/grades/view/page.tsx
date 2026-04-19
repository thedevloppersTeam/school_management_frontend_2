"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatCard } from "@/components/school/stat-card"
import {
  LockIcon,
  UsersIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  TrendingUpIcon,
  InboxIcon,
} from "lucide-react"
import { fetchClassSessions, fetchSteps, type AcademicYearStep, type ClassSession } from "@/lib/api/dashboard"
import { fetchClassSubjects, fetchEnrollments, type ApiClassSubject, type ApiEnrollment } from "@/lib/api/grades"
import { parseDecimal } from "@/lib/decimal"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Rubric { id: string; code: string; name: string }

interface GradeRow {
  enrollmentId: string
  studentId:    string
  lastname:     string
  firstname:    string
  studentCode:  string
  grades:       Record<string, number | null>
  average:      number | null
  isComplete:   boolean
  rang:         number | null
}

// ── Helper BR-001 ─────────────────────────────────────────────────────────────

function computeAverage(
  grades: Record<string, number | null>,
  classSubjects: ApiClassSubject[],
  rubrics: Rubric[]
): number | null {
  const rubricMap: Record<string, string> = {}
  rubrics.forEach(r => { rubricMap[r.id] = r.code })

  const byRubric: Record<string, number[]> = { R1: [], R2: [], R3: [] }
  classSubjects.forEach(cs => {
    const rid  = cs.subject.rubric?.id
    const code = rid ? rubricMap[rid] : null
    const note = grades[cs.id]
    if (code && note !== null && note !== undefined && (code === 'R1' || code === 'R2' || code === 'R3')) {
      byRubric[code].push(note)
    }
  })

  const avg = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null

  const a1 = avg(byRubric.R1)
  const a2 = avg(byRubric.R2)
  const a3 = avg(byRubric.R3)
  if (a1 === null && a2 === null && a3 === null) return null
  return (a1 ?? 0) * 0.7 + (a2 ?? 0) * 0.25 + (a3 ?? 0) * 0.05
}

function getAppreciation(m: number | null): string {
  if (m === null) return '—'
  if (m >= 9) return 'A+'
  if (m >= 8.5) return 'A'
  if (m >= 7.8) return 'B+'
  if (m >= 7.5) return 'B'
  if (m >= 6.9) return 'C+'
  if (m >= 6) return 'C'
  if (m >= 5.1) return 'D'
  return 'E'
}

function sessionLabel(s: ClassSession): string {
  const { classType, letter, track } = s.class
  const base = `${classType.name} ${letter}`
  return track ? `${base} — ${track.code}` : base
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GradesViewPage({
  initialSessionId = "",
  initialStepId    = "",
}: {
  initialSessionId?: string
  initialStepId?:    string
}) {
  const params  = useParams()
  const yearId  = params.yearId as string
  const { toast } = useToast()

  const [sessions,   setSessions]   = useState<ClassSession[]>([])
  const [steps,      setSteps]      = useState<AcademicYearStep[]>([])
  const [rubrics,    setRubrics]    = useState<Rubric[]>([])
  const [loadingCtx, setLoadingCtx] = useState(true)

  const [selectedSession, setSelectedSession] = useState(initialSessionId)
  const [selectedStep,    setSelectedStep]    = useState(initialStepId)

  const [classSubjects, setClassSubjects] = useState<ApiClassSubject[]>([])
  const isLocked = useMemo(() => {
    const step = steps.find(s => s.id === selectedStep)
    return step ? !step.isCurrent : false
  }, [steps, selectedStep])
  const [gradeRows,   setGradeRows]   = useState<GradeRow[]>([])
  const [loadingGrid, setLoadingGrid] = useState(false)

  // ── Chargement contexte ───────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const [sessionsData, stepsData, rubricsRes, yearRes] = await Promise.all([
          fetchClassSessions(yearId),
          fetchSteps(yearId),
          fetch('/api/subject-rubrics', { credentials: 'include' }),
          fetch(`/api/academic-years/${yearId}`, { credentials: 'include' }),
        ])
        setSessions(sessionsData)
        setSteps([...stepsData].sort((a, b) => a.stepNumber - b.stepNumber))
        if (rubricsRes.ok) setRubrics(await rubricsRes.json())
        
      } catch {
        toast({ title: "Erreur", description: "Impossible de charger le contexte", variant: "destructive" })
      } finally {
        setLoadingCtx(false)
      }
    }
    init()
  }, [yearId, toast])

  // ── Chargement grille ─────────────────────────────────────────────────────
  const loadGrid = useCallback(async (sessionId: string, stepId: string) => {
    if (!sessionId || !stepId) return
    setLoadingGrid(true)
    setGradeRows([])
    try {
      const [cs, enr] = await Promise.all([
        fetchClassSubjects(sessionId),
        fetchEnrollments(sessionId),
      ])
      setClassSubjects(cs)

      const rows = await Promise.all(
        enr.map(async (enrollment) => {
          try {
            const res       = await fetch(`/api/grades/enrollment/${enrollment.id}?stepId=${stepId}`, { credentials: 'include' })
            const rawGrades = res.ok ? await res.json() : []

            const gradeMap: Record<string, number | null> = {}
            cs.forEach(c => { gradeMap[c.id] = null })
            rawGrades.forEach((g: { classSubjectId: string; sectionId: string | null; studentScore: number }) => {
              if (g.sectionId === null) gradeMap[g.classSubjectId] = parseDecimal(g.studentScore)
            })

            const isComplete = cs.length > 0 && cs.every(c => gradeMap[c.id] !== null)

            return {
              enrollmentId: enrollment.id,
              studentId:    enrollment.student.id,
              lastname:     enrollment.student.user.lastname,
              firstname:    enrollment.student.user.firstname,
              studentCode:  enrollment.student.studentCode,
              grades:       gradeMap,
              average:      computeAverage(gradeMap, cs, rubrics),
              isComplete,
              rang:         null,
            } as GradeRow
          } catch {
            return {
              enrollmentId: enrollment.id,
              studentId:    enrollment.student.id,
              lastname:     enrollment.student.user.lastname,
              firstname:    enrollment.student.user.firstname,
              studentCode:  enrollment.student.studentCode,
              grades:       {},
              average:      null,
              isComplete:   false,
              rang:         null,
            } as GradeRow
          }
        })
      )

      rows.sort((a, b) => `${a.lastname} ${a.firstname}`.localeCompare(`${b.lastname} ${b.firstname}`))

      // ── Fix : rang n'incrémente que pour les élèves avec une moyenne ──────
      const ranked = [...rows].sort((a, b) => (b.average ?? -1) - (a.average ?? -1))
      let rang = 1
      ranked.forEach((row, i) => {
        if (row.average === null) {
          row.rang = null
        } else if (i > 0 && ranked[i - 1].average === row.average) {
          row.rang = ranked[i - 1].rang
          rang++
        } else {
          row.rang = rang
          rang++
        }
      })

      setGradeRows(rows)
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les notes", variant: "destructive" })
    } finally {
      setLoadingGrid(false)
    }
  }, [rubrics, toast])

  useEffect(() => {
    if (selectedSession && selectedStep) loadGrid(selectedSession, selectedStep)
    else { setGradeRows([]); setClassSubjects([]) }
  }, [selectedSession, selectedStep, loadGrid])

  // ── Groupes rubriques ─────────────────────────────────────────────────────
  const rubricGroups = useMemo(() => {
    const rubricMap: Record<string, string> = {}
    rubrics.forEach(r => { rubricMap[r.id] = r.code })
    const groups: Array<{ rubric: Rubric; subjects: ApiClassSubject[] }> = []
    ;['R1', 'R2', 'R3'].forEach(code => {
      const rubric   = rubrics.find(r => r.code === code)
      if (!rubric) return
      const subjects = classSubjects.filter(cs => cs.subject.rubric?.id && rubricMap[cs.subject.rubric.id] === code)
      if (subjects.length > 0) groups.push({ rubric, subjects })
    })
    const withoutRubric = classSubjects.filter(cs => !cs.subject.rubric)
    if (withoutRubric.length > 0) groups.push({ rubric: { id: 'none', code: '—', name: 'Sans rubrique' }, subjects: withoutRubric })
    return groups
  }, [classSubjects, rubrics])

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const columnAverages = useMemo(() => {
    const avgs: Record<string, number | null> = {}
    classSubjects.forEach(cs => {
      const notes = gradeRows.map(r => r.grades[cs.id]).filter((n): n is number => n !== null)
      avgs[cs.id] = notes.length > 0 ? notes.reduce((s, v) => s + v, 0) / notes.length : null
    })
    return avgs
  }, [classSubjects, gradeRows])

  const classAverage = useMemo(() => {
    const avgs = gradeRows.map(r => r.average).filter((a): a is number => a !== null)
    return avgs.length > 0 ? avgs.reduce((s, v) => s + v, 0) / avgs.length : null
  }, [gradeRows])

  const completeCount   = gradeRows.filter(r => r.isComplete).length
  const incompleteCount = gradeRows.length - completeCount

  // ── Helpers UI ────────────────────────────────────────────────────────────
  const rubricClasses = (code: string) => {
    switch (code) {
      case 'R1':
        return {
          header: 'bg-blue-50 text-blue-700',
          col:    'text-blue-700',
          border: 'border-l-blue-200',
        }
      case 'R2':
        return {
          header: 'bg-emerald-50 text-emerald-700',
          col:    'text-emerald-700',
          border: 'border-l-emerald-200',
        }
      case 'R3':
        return {
          header: 'bg-amber-50 text-amber-700',
          col:    'text-amber-700',
          border: 'border-l-amber-200',
        }
      default:
        return {
          header: 'bg-muted text-muted-foreground',
          col:    'text-muted-foreground',
          border: 'border-l-border',
        }
    }
  }

  const poids = (code: string) => {
    if (code === 'R1') return '70%'
    if (code === 'R2') return '25%'
    if (code === 'R3') return '5%'
    return ''
  }
  const fmt = (v: number | null) => v !== null ? v.toFixed(2) : '—'

  const noteColorClass = (note: number | null, max: number) => {
    if (note === null) return 'text-muted-foreground'
    const pct = note / max
    if (pct >= 0.7) return 'text-emerald-600'
    return pct >= 0.5 ? 'text-amber-600' : 'text-destructive'
  }

  const averageColorClass = (avg: number | null) => {
    if (avg === null) return 'text-muted-foreground'
    if (avg >= 7) return 'text-emerald-600'
    if (avg >= 5) return 'text-amber-600'
    return 'text-destructive'
  }

  if (loadingCtx) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[104px] rounded-xl" />)}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Sélecteurs ── */}
      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Consultation des notes</CardTitle>
          <CardDescription>Sélectionnez une classe et une étape pour afficher la grille</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-2xl">
            <Select value={selectedSession} onValueChange={setSelectedSession}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une classe" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map(s => (
                  <SelectItem key={s.id} value={s.id}>{sessionLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStep} onValueChange={setSelectedStep}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une étape" />
              </SelectTrigger>
              <SelectContent>
                {steps.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Bannière étape clôturée ── */}
      {selectedStep && isLocked && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <LockIcon className="h-4 w-4 !text-amber-600" />
          <AlertTitle>Étape clôturée</AlertTitle>
          <AlertDescription>Consultation en lecture seule</AlertDescription>
        </Alert>
      )}

      {/* ── État vide ── */}
      {(!selectedSession || !selectedStep) && (
        <Card className="border bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <InboxIcon className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              Aucune sélection
            </h3>
            <p className="mt-1 max-w-[320px] text-center text-sm text-muted-foreground">
              Sélectionnez une classe et une étape pour voir les notes des élèves.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Contenu ── */}
      {selectedSession && selectedStep && (
        loadingGrid ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[104px] rounded-xl" />)}
            </div>
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Élèves inscrits"
                value={gradeRows.length}
                icon={UsersIcon}
                iconClassName="text-blue-600"
                iconBgClassName="bg-blue-50"
              />
              <StatCard
                label="Notes complètes"
                value={completeCount}
                icon={CheckCircle2Icon}
                iconClassName="text-emerald-600"
                iconBgClassName="bg-emerald-50"
              />
              <StatCard
                label="Notes manquantes"
                value={incompleteCount}
                icon={AlertCircleIcon}
                iconClassName="text-amber-600"
                iconBgClassName="bg-amber-50"
              />
              <StatCard
                label="Moyenne classe"
                value={classAverage !== null ? classAverage.toFixed(2) : '—'}
                icon={TrendingUpIcon}
                iconClassName="text-violet-600"
                iconBgClassName="bg-violet-50"
              />
            </div>

            {/* Grille des notes */}
            {gradeRows.length === 0 ? (
              <Card className="border bg-card shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                    <UsersIcon className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-foreground">
                    Aucun élève inscrit
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Aucun élève n'est inscrit dans cette classe.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border bg-card shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base font-semibold">Grille des notes</CardTitle>
                      <CardDescription>
                        {gradeRows.length} élève{gradeRows.length > 1 ? 's' : ''} · {classSubjects.length} matière{classSubjects.length > 1 ? 's' : ''}
                      </CardDescription>
                    </div>
                    {isLocked && (
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                        <LockIcon className="mr-1 h-3 w-3" /> Clôturée
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table className="min-w-full" style={{ minWidth: `${360 + classSubjects.length * 80}px` }}>
                      <TableHeader>
                        {/* Ligne 1 — Rubriques */}
                        <TableRow className="bg-muted/60 hover:bg-muted/60">
                          <TableHead
                            rowSpan={2}
                            className="w-[200px] border-r-2 border-border pl-6 align-middle text-xs font-semibold uppercase tracking-wider text-foreground"
                          >
                            Élève
                          </TableHead>
                          {rubricGroups.map(group => {
                            const rc = rubricClasses(group.rubric.code)
                            return (
                              <TableHead
                                key={group.rubric.id}
                                colSpan={group.subjects.length}
                                className={cn(
                                  "border-l-2 text-center align-middle text-xs font-semibold uppercase tracking-wide",
                                  rc.header,
                                  rc.border
                                )}
                              >
                                {group.rubric.code} {poids(group.rubric.code)}
                              </TableHead>
                            )
                          })}
                          <TableHead
                            rowSpan={2}
                            className="min-w-[80px] border-l-2 border-border bg-primary/5 text-center align-middle text-xs font-semibold uppercase tracking-wider text-foreground"
                          >
                            Moy.
                          </TableHead>
                          <TableHead
                            rowSpan={2}
                            className="min-w-[90px] border-l border-border text-center align-middle text-xs font-semibold uppercase tracking-wider text-foreground"
                          >
                            Statut
                          </TableHead>
                          <TableHead
                            rowSpan={2}
                            className="min-w-[60px] border-l border-border text-center align-middle text-xs font-semibold uppercase tracking-wider text-foreground"
                          >
                            Rang
                          </TableHead>
                          <TableHead
                            rowSpan={2}
                            className="min-w-[90px] border-l border-border text-center align-middle text-xs font-semibold uppercase tracking-wider text-foreground"
                          >
                            Appréciation
                          </TableHead>
                        </TableRow>
                        {/* Ligne 2 — Codes matières */}
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          {rubricGroups.map(group => {
                            const rc = rubricClasses(group.rubric.code)
                            return group.subjects.map((cs, i) => (
                              <TableHead
                                key={cs.id}
                                title={cs.subject.name}
                                className={cn(
                                  "min-w-[72px] text-center text-[11px] font-semibold uppercase tracking-wide",
                                  rc.col,
                                  i === 0 ? `border-l-2 ${rc.border}` : `border-l ${rc.border}`
                                )}
                              >
                                {cs.subject.code}
                              </TableHead>
                            ))
                          })}
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {gradeRows.map((row, ri) => (
                          <TableRow
                            key={row.enrollmentId}
                            className={cn(ri % 2 === 1 && "bg-muted/20")}
                          >
                            <TableCell className="border-r-2 border-border pl-6">
                              <div className="text-sm font-semibold text-foreground">{row.lastname}</div>
                              <div className="text-xs text-muted-foreground">{row.firstname}</div>
                            </TableCell>
                            {rubricGroups.map(group => {
                              const rc = rubricClasses(group.rubric.code)
                              return group.subjects.map((cs, i) => {
                                const note = row.grades[cs.id]
                                const raw = cs.subject.maxScore
                                const max =
                                  (typeof raw === 'object' && (raw as unknown as { d?: unknown[] })?.d)
                                    ? Number((raw as unknown as { d: unknown[] }).d[0])
                                    : Number(raw) || 10
                                return (
                                  <TableCell
                                    key={cs.id}
                                    className={cn(
                                      "text-center text-sm tabular-nums",
                                      note !== null && note !== undefined ? "font-semibold" : "font-normal",
                                      noteColorClass(note ?? null, max),
                                      i === 0 ? `border-l-2 ${rc.border}` : "border-l border-border/50"
                                    )}
                                  >
                                    {note !== null && note !== undefined ? note.toFixed(1) : '—'}
                                  </TableCell>
                                )
                              })
                            })}
                            {/* Moyenne */}
                            <TableCell
                              className={cn(
                                "border-l-2 border-border bg-primary/5 text-center text-sm font-bold tabular-nums",
                                averageColorClass(row.average)
                              )}
                            >
                              {fmt(row.average)}
                            </TableCell>
                            {/* Statut */}
                            <TableCell className="border-l border-border text-center">
                              {row.isComplete ? (
                                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                                  Complet
                                </Badge>
                              ) : (
                                <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
                                  Incomplet
                                </Badge>
                              )}
                            </TableCell>
                            {/* Rang */}
                            <TableCell className="border-l border-border text-center text-sm font-bold tabular-nums text-foreground">
                              {row.rang !== null ? `${row.rang}e` : '—'}
                            </TableCell>
                            {/* Appréciation */}
                            <TableCell className="border-l border-border text-center">
                              <Badge
                                variant={row.average !== null ? "secondary" : "outline"}
                                className="font-bold tabular-nums"
                              >
                                {getAppreciation(row.average)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>

                      <TableFooter>
                        {/* Ligne moyenne classe */}
                        <TableRow className="bg-muted/60 hover:bg-muted/60">
                          <TableCell className="border-r-2 border-border pl-6 text-xs font-bold uppercase tracking-wider text-foreground">
                            Moy. classe
                          </TableCell>
                          {rubricGroups.map(group => {
                            const rc = rubricClasses(group.rubric.code)
                            return group.subjects.map((cs, i) => (
                              <TableCell
                                key={cs.id}
                                className={cn(
                                  "text-center text-sm font-bold tabular-nums",
                                  rc.col,
                                  i === 0 ? `border-l-2 ${rc.border}` : "border-l border-border/50"
                                )}
                              >
                                {fmt(columnAverages[cs.id])}
                              </TableCell>
                            ))
                          })}
                          <TableCell className="border-l-2 border-border bg-primary/10 text-center text-sm font-bold tabular-nums text-primary">
                            {fmt(classAverage)}
                          </TableCell>
                          <TableCell className="border-l border-border" />
                          <TableCell className="border-l border-border" />
                          <TableCell className="border-l border-border" />
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )
      )}
    </div>
  )
}