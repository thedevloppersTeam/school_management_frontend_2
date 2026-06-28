"use client"

import { Fragment, useState, useEffect, useCallback, useMemo } from "react"
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
import { fetchActiveAcademicYear, fetchClassSessions, fetchSteps, type AcademicYearStep, type ClassSession } from "@/lib/api/dashboard"
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
  rubricAverages: Record<string, number | null>
  average:      number | null
  isComplete:   boolean
  rang:         number | null
}

// ── Formule bulletin (BR-001) ─────────────────────────────────────────────────
// Conforme au bulletin papier du CPMSL :
//   - par matière : moy = somme(scores des sections renseignées) / somme(maxScore des sections renseignées) × 10
//   - par rubrique : agrégat pondéré par maxScore sur toutes les sections renseignées de la rubrique
//   - moyenne étape = R1 × 0.70 + R2 × 0.25 + R3 × 0.05
// Les sections non notées sont ignorées (score ET max), comme sur le bulletin.

const RUBRIC_WEIGHTS: Record<string, number> = { R1: 0.7, R2: 0.25, R3: 0.05 }

function computeAverage(rubricAverages: Record<string, number | null>): number | null {
  const a1 = rubricAverages.R1
  const a2 = rubricAverages.R2
  const a3 = rubricAverages.R3
  if (a1 == null && a2 == null && a3 == null) return null
  return (a1 ?? 0) * RUBRIC_WEIGHTS.R1 + (a2 ?? 0) * RUBRIC_WEIGHTS.R2 + (a3 ?? 0) * RUBRIC_WEIGHTS.R3
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GradesViewPage({
  initialSessionId = "",
  initialStepId    = "",
}: {
  initialSessionId?: string
  initialStepId?:    string
}) {
  const { toast } = useToast()

  const [sessions,   setSessions]   = useState<ClassSession[]>([])
  const [steps,      setSteps]      = useState<AcademicYearStep[]>([])
  const [rubrics,    setRubrics]    = useState<Rubric[]>([])
  const [loadingCtx, setLoadingCtx] = useState(true)

  const [selectedSession, setSelectedSession] = useState(initialSessionId)
  const [selectedStep,    setSelectedStep]    = useState(initialStepId)
  const [selectedClassTypeId, setSelectedClassTypeId] = useState<string>("")

  // Sync classType when sessions arrive (or when initialSessionId is provided)
  useEffect(() => {
    if (!selectedSession) {
      setSelectedClassTypeId("")
      return
    }
    const s = sessions.find(x => x.id === selectedSession)
    if (s) setSelectedClassTypeId(s.class.classType.id)
  }, [selectedSession, sessions])

  const classTypeOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    sessions.forEach(s => {
      const ct = s.class.classType
      if (!map.has(ct.id)) map.set(ct.id, { id: ct.id, name: ct.name })
    })
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [sessions])

  const salleOptions = useMemo(() => {
    if (!selectedClassTypeId) return []
    return sessions
      .filter(s => s.class.classType.id === selectedClassTypeId)
      .map(s => ({
        sessionId: s.id,
        // For tracked classes (NS3/NS4) the track code stands in as the "salle".
        label: s.class.track?.code ?? s.class.letter,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [sessions, selectedClassTypeId])

  function handleClassTypeChange(classTypeId: string) {
    setSelectedClassTypeId(classTypeId)
    setSelectedSession("")
    setGradeRows([])
  }

  function handleSalleChange(sessionId: string) {
    setSelectedSession(sessionId)
  }

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
        const current = await fetchActiveAcademicYear()
        if (!current) {
          setLoadingCtx(false)
          return
        }
        const [sessionsData, stepsData, rubricsRes] = await Promise.all([
          fetchClassSessions(current.id),
          fetchSteps(current.id),
          fetch('/api/subject-rubrics', { credentials: 'include' }),
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
  }, [toast])

  // ── Chargement grille ─────────────────────────────────────────────────────
  const loadGrid = useCallback(async (sessionId: string, stepId: string) => {
    if (!sessionId || !stepId) return
    setLoadingGrid(true)
    setGradeRows([])
    try {
      const [cs, enr, exclusionsRes] = await Promise.all([
        fetchClassSubjects(sessionId),
        fetchEnrollments(sessionId),
        fetch(`/api/enrollments/excluded-sections?classSessionId=${sessionId}`, { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
      ])
      setClassSubjects(cs)

      // enrollmentId → Set<excluded sectionId>
      const exclusionsByEnrollment = new Map<string, Set<string>>()
      ;(exclusionsRes as Array<{ enrollmentId: string; sectionId: string }>).forEach((x) => {
        const set = exclusionsByEnrollment.get(x.enrollmentId) ?? new Set<string>()
        set.add(x.sectionId)
        exclusionsByEnrollment.set(x.enrollmentId, set)
      })

      // Lookup helpers reused across all enrollments.
      const rubricMap: Record<string, string> = {}
      rubrics.forEach(r => { rubricMap[r.id] = r.code })
      const rubricByCsId = new Map<string, string>()
      const sectionMaxById = new Map<string, number>()
      const subjectFallbackMaxById = new Map<string, number>()
      cs.forEach((c) => {
        const rid = c.subject.rubric?.id
        const code = rid ? rubricMap[rid] : undefined
        if (code) rubricByCsId.set(c.id, code)
        subjectFallbackMaxById.set(c.id, parseDecimal(c.subject.maxScore) ?? 0)
        c.subject.sections.forEach((s) => sectionMaxById.set(s.id, parseDecimal(s.maxScore) ?? 0))
      })

      const rows = await Promise.all(
        enr.map(async (enrollment) => {
          try {
            const res       = await fetch(`/api/grades/enrollment/${enrollment.id}?stepId=${stepId}`, { credentials: 'include' })
            const rawGrades = res.ok ? await res.json() : []
            const excluded = exclusionsByEnrollment.get(enrollment.id) ?? new Set<string>()

            // Per-matière : on n'agrège QUE les sections réellement notées
            // (sum + max accumulés ensemble) — comme le bulletin papier.
            const sumByCs: Record<string, number> = {}
            const maxByCs: Record<string, number> = {}
            const countByCs: Record<string, number> = {}
            // Per-rubrique : agrégat section-pondéré (somme/somme × 10).
            const sumByRubric: Record<string, number> = { R1: 0, R2: 0, R3: 0 }
            const maxByRubric: Record<string, number> = { R1: 0, R2: 0, R3: 0 }

            rawGrades.forEach((g: { classSubjectId: string; sectionId: string | null; studentScore: number }) => {
              if (g.sectionId && excluded.has(g.sectionId)) return
              const v = parseDecimal(g.studentScore)
              if (v === null) return
              const max = g.sectionId
                ? sectionMaxById.get(g.sectionId) ?? 0
                : subjectFallbackMaxById.get(g.classSubjectId) ?? 0
              sumByCs[g.classSubjectId] = (sumByCs[g.classSubjectId] ?? 0) + v
              maxByCs[g.classSubjectId] = (maxByCs[g.classSubjectId] ?? 0) + max
              countByCs[g.classSubjectId] = (countByCs[g.classSubjectId] ?? 0) + 1
              const code = rubricByCsId.get(g.classSubjectId)
              if (code && code in sumByRubric) {
                sumByRubric[code] += v
                maxByRubric[code] += max
              }
            })

            // Pour le statut "complet" on continue à compter les sections attendues
            // (après exclusions) — autrement on ne pourrait jamais distinguer
            // "rien saisi" de "tout saisi".
            const expectedCountByCs: Record<string, number> = {}
            cs.forEach((c) => {
              if (c.subject.sections.length === 0) expectedCountByCs[c.id] = 1
              else expectedCountByCs[c.id] = c.subject.sections.filter((s) => !excluded.has(s.id)).length
            })

            const gradeMap: Record<string, number | null> = {}
            cs.forEach((c) => {
              const max = maxByCs[c.id] ?? 0
              gradeMap[c.id] = max > 0 ? (sumByCs[c.id] / max) * 10 : null
            })

            const rubricAverages: Record<string, number | null> = {}
            ;(['R1', 'R2', 'R3'] as const).forEach(code => {
              const m = maxByRubric[code]
              rubricAverages[code] = m > 0 ? (sumByRubric[code] / m) * 10 : null
            })

            const isComplete = cs.length > 0 && cs.every((c) => {
              const expected = expectedCountByCs[c.id]
              if (expected === 0) return true
              return (countByCs[c.id] ?? 0) >= expected
            })

            return {
              enrollmentId: enrollment.id,
              studentId:    enrollment.student.id,
              lastname:     enrollment.student.user.lastname,
              firstname:    enrollment.student.user.firstname,
              studentCode:  enrollment.student.studentCode,
              grades:       gradeMap,
              rubricAverages,
              average:      computeAverage(rubricAverages),
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
              rubricAverages: { R1: null, R2: null, R3: null },
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

  const rubricColumnAverages = useMemo(() => {
    const out: Record<string, number | null> = { R1: null, R2: null, R3: null }
    ;(['R1', 'R2', 'R3'] as const).forEach(code => {
      const notes = gradeRows
        .map(r => r.rubricAverages[code])
        .filter((n): n is number => n !== null && n !== undefined)
      out[code] = notes.length > 0 ? notes.reduce((s, v) => s + v, 0) / notes.length : null
    })
    return out
  }, [gradeRows])

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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:max-w-3xl">
            <Select value={selectedClassTypeId} onValueChange={handleClassTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Classe" />
              </SelectTrigger>
              <SelectContent>
                {classTypeOptions.map(ct => (
                  <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedSession}
              onValueChange={handleSalleChange}
              disabled={!selectedClassTypeId}
            >
              <SelectTrigger>
                <SelectValue placeholder={selectedClassTypeId ? "Salle" : "Choisir d'abord une classe"} />
              </SelectTrigger>
              <SelectContent>
                {salleOptions.map(opt => (
                  <SelectItem key={opt.sessionId} value={opt.sessionId}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStep} onValueChange={setSelectedStep}>
              <SelectTrigger>
                <SelectValue placeholder="Étape" />
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
                    <Table className="min-w-full" style={{ minWidth: `${440 + classSubjects.length * 76 + rubricGroups.length * 80}px` }}>
                      <TableHeader>
                        {/* Ligne 1 — Rubriques (avec colonne Moy. de rubrique) */}
                        <TableRow className="bg-muted/60 hover:bg-muted/60">
                          <TableHead
                            rowSpan={2}
                            className="w-[200px] border-r-2 border-border pl-6 align-middle text-xs font-semibold uppercase tracking-wider text-foreground"
                          >
                            Élève
                          </TableHead>
                          {rubricGroups.map(group => {
                            const rc = rubricClasses(group.rubric.code)
                            const isMain = group.rubric.code === 'R1' || group.rubric.code === 'R2' || group.rubric.code === 'R3'
                            return (
                              <TableHead
                                key={group.rubric.id}
                                colSpan={group.subjects.length + (isMain ? 1 : 0)}
                                className={cn(
                                  "border-l-2 text-center align-middle text-xs font-bold uppercase tracking-wide",
                                  rc.header,
                                  rc.border
                                )}
                              >
                                <div className="flex flex-col leading-tight">
                                  <span>{group.rubric.code}</span>
                                  <span className="text-[10px] font-normal opacity-80">poids {poids(group.rubric.code)}</span>
                                </div>
                              </TableHead>
                            )
                          })}
                          <TableHead
                            rowSpan={2}
                            className="min-w-[88px] border-l-2 border-border bg-primary/10 text-center align-middle text-xs font-bold uppercase tracking-wider text-foreground"
                            title="Moyenne de l'étape = R1×0.70 + R2×0.25 + R3×0.05"
                          >
                            Moy. étape
                          </TableHead>
                          <TableHead
                            rowSpan={2}
                            className="min-w-[88px] border-l border-border text-center align-middle text-xs font-semibold uppercase tracking-wider text-foreground"
                          >
                            Appréciation
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
                            Statut
                          </TableHead>
                        </TableRow>
                        {/* Ligne 2 — Codes matières (+ colonne "Moy." dédiée par rubrique) */}
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          {rubricGroups.map(group => {
                            const rc = rubricClasses(group.rubric.code)
                            const isMain = group.rubric.code === 'R1' || group.rubric.code === 'R2' || group.rubric.code === 'R3'
                            return (
                              <Fragment key={group.rubric.id}>
                                {group.subjects.map((cs, i) => (
                                  <TableHead
                                    key={cs.id}
                                    title={cs.subject.name}
                                    className={cn(
                                      "min-w-[64px] text-center text-[11px] font-semibold uppercase tracking-wide",
                                      rc.col,
                                      i === 0 ? `border-l-2 ${rc.border}` : `border-l ${rc.border}`
                                    )}
                                  >
                                    {cs.subject.code}
                                  </TableHead>
                                ))}
                                {isMain && (
                                  <TableHead
                                    key={`${group.rubric.id}-avg`}
                                    title={`Moyenne de la rubrique ${group.rubric.code} (somme des points / somme des max × 10)`}
                                    className={cn(
                                      "min-w-[72px] border-l text-center text-[11px] font-bold uppercase tracking-wide",
                                      rc.header,
                                      rc.border
                                    )}
                                  >
                                    Moy.
                                  </TableHead>
                                )}
                              </Fragment>
                            )
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
                              const isMain = group.rubric.code === 'R1' || group.rubric.code === 'R2' || group.rubric.code === 'R3'
                              const rubAvg = isMain ? row.rubricAverages[group.rubric.code] ?? null : null
                              return (
                                <Fragment key={`${row.enrollmentId}-${group.rubric.id}`}>
                                  {group.subjects.map((cs, i) => {
                                    const note = row.grades[cs.id]
                                    return (
                                      <TableCell
                                        key={cs.id}
                                        className={cn(
                                          "text-center text-sm tabular-nums",
                                          note !== null && note !== undefined ? "font-semibold" : "font-normal",
                                          averageColorClass(note ?? null),
                                          i === 0 ? `border-l-2 ${rc.border}` : "border-l border-border/50"
                                        )}
                                      >
                                        {note !== null && note !== undefined ? note.toFixed(2) : '—'}
                                      </TableCell>
                                    )
                                  })}
                                  {isMain && (
                                    <TableCell
                                      key={`${group.rubric.id}-avg`}
                                      className={cn(
                                        "border-l text-center text-sm font-bold tabular-nums",
                                        rc.header,
                                        rc.border,
                                        averageColorClass(rubAvg)
                                      )}
                                    >
                                      {fmt(rubAvg)}
                                    </TableCell>
                                  )}
                                </Fragment>
                              )
                            })}
                            {/* Moy. étape */}
                            <TableCell
                              className={cn(
                                "border-l-2 border-border bg-primary/10 text-center text-base font-bold tabular-nums",
                                averageColorClass(row.average)
                              )}
                            >
                              {fmt(row.average)}
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
                            {/* Rang */}
                            <TableCell className="border-l border-border text-center text-sm font-bold tabular-nums text-foreground">
                              {row.rang !== null ? `${row.rang}e` : '—'}
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
                            const isMain = group.rubric.code === 'R1' || group.rubric.code === 'R2' || group.rubric.code === 'R3'
                            return (
                              <Fragment key={`footer-${group.rubric.id}`}>
                                {group.subjects.map((cs, i) => (
                                  <TableCell
                                    key={cs.id}
                                    className={cn(
                                      "text-center text-sm font-semibold tabular-nums",
                                      rc.col,
                                      i === 0 ? `border-l-2 ${rc.border}` : "border-l border-border/50"
                                    )}
                                  >
                                    {fmt(columnAverages[cs.id])}
                                  </TableCell>
                                ))}
                                {isMain && (
                                  <TableCell
                                    key={`${group.rubric.id}-avg`}
                                    className={cn(
                                      "border-l text-center text-sm font-bold tabular-nums",
                                      rc.header,
                                      rc.border
                                    )}
                                  >
                                    {fmt(rubricColumnAverages[group.rubric.code])}
                                  </TableCell>
                                )}
                              </Fragment>
                            )
                          })}
                          <TableCell className="border-l-2 border-border bg-primary/10 text-center text-base font-bold tabular-nums text-primary">
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