"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { LockIcon } from "lucide-react"
import { fetchClassSessions, fetchSteps, type AcademicYearStep, type ClassSession } from "@/lib/api/dashboard"
import { fetchClassSubjects, fetchEnrollments, type ApiClassSubject, type ApiEnrollment } from "@/lib/api/grades"
import { parseDecimal } from "@/lib/decimal"

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
  const rubricStyle = (code: string) => {
    if (code === 'R1') return { bg: '#E3EFF9', color: '#2B6CB0', border: '#93C5FD' }
    if (code === 'R2') return { bg: '#E8F5EC', color: '#2D7D46', border: '#86EFAC' }
    if (code === 'R3') return { bg: '#FAF8F3', color: '#B0A07A', border: '#D9C98A' }
    return { bg: '#F0F4F7', color: '#5A7085', border: '#B3C7D5' }
  }

    const poids = (code: string) => {
    if (code === 'R1') return '70%'
    if (code === 'R2') return '25%'
    if (code === 'R3') return '5%'
    return ''
  }
  const fmt = (v: number | null) => v !== null ? v.toFixed(2) : '—'

  const noteColor = (note: number | null, max: number) => {
    if (note === null) return '#A8A5A2'
    const pct = note / max
    if (pct >= 0.7) return '#2D7D46'
    return pct >= 0.5 ? '#C48B1A' : '#C43C3C'
  }

  if (loadingCtx) {
    return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-96 w-full" /></div>
  }

  return (
    <div className="space-y-6">

      {/* Sélecteurs */}
      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Sélection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid max-w-lg grid-cols-1 gap-4 sm:grid-cols-2">
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

      {/* Bannière étape clôturée */}
      {selectedStep && isLocked && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <LockIcon className="h-4 w-4 !text-amber-600" />
          <AlertTitle>Étape clôturée</AlertTitle>
          <AlertDescription>Consultation en lecture seule</AlertDescription>
        </Alert>
      )}

      {/* État vide */}
      {(!selectedSession || !selectedStep) && (
        <Card className="border bg-card py-12 text-center shadow-sm">
          <CardContent>
            <p className="text-sm font-medium text-muted-foreground">
              Sélectionnez une classe et une étape pour voir les notes
            </p>
          </CardContent>
        </Card>
      )}

      {/* Contenu */}
      {selectedSession && selectedStep && (
        loadingGrid ? (
          <div className="space-y-2">
             {[...new Array(4)].map((_, i) => <Skeleton key={`skeleton-${i}`} className="h-12 w-full" />)}          
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { label: 'Élèves inscrits',  value: gradeRows.length },
                { label: 'Notes complètes',  value: completeCount },
                { label: 'Notes manquantes', value: incompleteCount },
                { label: 'Moyenne classe',   value: classAverage !== null ? classAverage.toFixed(2) : '—' },
              ].map(kpi => (
                <Card key={kpi.label} className="border bg-card shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{kpi.label}</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{kpi.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Tableau */}
            {gradeRows.length === 0 ? (
              <Card className="border bg-card py-12 text-center shadow-sm">
                <CardContent>
                  <p className="text-sm font-medium text-muted-foreground">Aucun élève inscrit dans cette classe</p>
                </CardContent>
              </Card>
            ) : (
              <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: `${360 + classSubjects.length * 80}px` }}>
                  <thead>
                    {/* Ligne 1 — Rubriques */}
                    <tr style={{ backgroundColor: '#F1F5F9' }}>
                      <th rowSpan={2} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2C4A6E', borderBottom: '2px solid #D1D5DB', borderRight: '2px solid #D1D5DB', minWidth: '200px', verticalAlign: 'middle' }}>
                        Élève
                      </th>
                      {rubricGroups.map(group => {
                        const st = rubricStyle(group.rubric.code)
                        return (
                          <th key={group.rubric.id} colSpan={group.subjects.length}
                            style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: st.color, backgroundColor: st.bg, borderBottom: `1px solid ${st.border}`, borderLeft: `2px solid ${st.border}` }}>
                            {group.rubric.code} {poids(group.rubric.code)}
                          </th>
                        )
                      })}
                      <th rowSpan={2} style={{ padding: '12px 8px', textAlign: 'center', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#2A3740', borderBottom: '2px solid #D1D5DB', borderLeft: '2px solid #D1D5DB', minWidth: '80px', verticalAlign: 'middle', backgroundColor: '#EFF6FF' }}>
                        Moy.
                      </th>
                      <th rowSpan={2} style={{ padding: '12px 8px', textAlign: 'center', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#2A3740', borderBottom: '2px solid #D1D5DB', borderLeft: '1px solid #E8E6E3', minWidth: '90px', verticalAlign: 'middle' }}>
                        Statut
                      </th>
                      <th rowSpan={2} style={{ padding: '12px 8px', textAlign: 'center', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#2A3740', borderBottom: '2px solid #D1D5DB', borderLeft: '1px solid #E8E6E3', minWidth: '60px', verticalAlign: 'middle' }}>
                        Rang
                      </th>
                      <th rowSpan={2} style={{ padding: '12px 8px', textAlign: 'center', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#2A3740', borderBottom: '2px solid #D1D5DB', borderLeft: '1px solid #E8E6E3', minWidth: '90px', verticalAlign: 'middle' }}>
                        Appréciation
                      </th>
                    </tr>
                    {/* Ligne 2 — Codes matières */}
                    <tr style={{ backgroundColor: '#F8FAFC' }}>
                      {rubricGroups.map(group => {
                        const st = rubricStyle(group.rubric.code)
                        return group.subjects.map((cs, i) => (
                          <th key={cs.id}
                            style={{ padding: '8px 10px', textAlign: 'center', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: st.color, borderBottom: '2px solid #D1D5DB', borderLeft: i === 0 ? `2px solid ${st.border}` : `1px solid ${st.border}`, minWidth: '72px' }}
                            title={cs.subject.name}>
                            {cs.subject.code}
                          </th>
                        ))
                      })}
                    </tr>
                  </thead>

                  <tbody>
                    {gradeRows.map((row, ri) => (
                      <tr key={row.enrollmentId}
                        style={{ borderBottom: ri < gradeRows.length - 1 ? '1px solid #E8E6E3' : 'none', backgroundColor: ri % 2 === 0 ? 'white' : '#FAFAF8' }}>
                        <td style={{ padding: '10px 16px', borderRight: '2px solid #E8E6E3' }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#1E1A17' }}>{row.lastname}</div>
                          <div style={{ fontSize: '12px', color: '#78756F' }}>{row.firstname}</div>
                        </td>
                        {rubricGroups.map(group => {
                          const st = rubricStyle(group.rubric.code)
                          return group.subjects.map((cs, i) => {
                            const note = row.grades[cs.id]
                            const raw = cs.subject.maxScore
const max = (typeof raw === 'object' && (raw as any).d)
  ? Number((raw as any).d[0])
  : Number(raw) || 10
                            return (
                              <td key={cs.id}
                                style={{ padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: note !== null ? 600 : 400, color: noteColor(note ?? null, max), borderLeft: i === 0 ? `2px solid ${st.border}` : `1px solid #F0F0F0` }}>
                                {note !== null && note !== undefined ? note.toFixed(1) : '—'}
                              </td>
                            )
                          })
                        })}
                        {/* Moyenne */}
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, fontSize: '14px', borderLeft: '2px solid #D1D5DB', backgroundColor: '#EFF6FF', color: (() => {
                          if (row.average === null) return '#A8A5A2'
                          if (row.average >= 7) return '#2D7D46'
                          if (row.average >= 5) return '#C48B1A'
                          return '#C43C3C'
                        })() }}>
                          {fmt(row.average)}
                        </td>
                        {/* Statut */}
                        <td style={{ padding: '10px 8px', textAlign: 'center', borderLeft: '1px solid #E8E6E3' }}>
                          <Badge style={{ backgroundColor: row.isComplete ? '#E8F5EC' : '#FEF6E0', color: row.isComplete ? '#2D7D46' : '#C48B1A', border: 'none', fontSize: '11px', fontWeight: 500 }}>
                            {row.isComplete ? 'Complet' : 'Incomplet'}
                          </Badge>
                        </td>
                        {/* Rang */}
                        <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: '#5A7085', borderLeft: '1px solid #E8E6E3' }}>
                          {row.rang !== null ? `${row.rang}e` : '—'}
                        </td>
                        {/* Appréciation */}
                        <td style={{ padding: '10px 8px', textAlign: 'center', borderLeft: '1px solid #E8E6E3' }}>
                          <Badge style={{ backgroundColor: row.average !== null ? '#E3EFF9' : '#F0F4F7', color: row.average !== null ? '#2B6CB0' : '#A8A5A2', border: 'none', fontSize: '11px', fontWeight: 700 }}>
                            {getAppreciation(row.average)}
                          </Badge>
                        </td>
                      </tr>
                    ))}

                    {/* Ligne moyenne classe */}
                    <tr style={{ backgroundColor: '#F1F5F9', borderTop: '2px solid #D1D5DB' }}>
                      <td style={{ padding: '10px 16px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#2C4A6E', borderRight: '2px solid #D1D5DB', letterSpacing: '0.04em' }}>
                        Moy. classe
                      </td>
                      {rubricGroups.map(group => {
                        const st = rubricStyle(group.rubric.code)
                        return group.subjects.map((cs, i) => (
                          <td key={cs.id}
                            style={{ padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: st.color, borderLeft: i === 0 ? `2px solid ${st.border}` : `1px solid #E8E6E3` }}>
                            {fmt(columnAverages[cs.id])}
                          </td>
                        ))
                      })}
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '14px', fontWeight: 700, color: '#2B6CB0', borderLeft: '2px solid #D1D5DB', backgroundColor: '#DBEAFE' }}>
                        {fmt(classAverage)}
                      </td>
                      <td style={{ borderLeft: '1px solid #E8E6E3' }} />
                      <td style={{ borderLeft: '1px solid #E8E6E3' }} />
                      <td style={{ borderLeft: '1px solid #E8E6E3' }} />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )
      )}
    </div>
  )
}