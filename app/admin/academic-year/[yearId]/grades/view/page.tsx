"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
  return (a1 ?? 0) * 0.70 + (a2 ?? 0) * 0.25 + (a3 ?? 0) * 0.05
}

function getAppreciation(m: number | null): string {
  if (m === null) return '—'
  if (m >= 9.0) return 'A+'
  if (m >= 8.5) return 'A'
  if (m >= 7.8) return 'B+'
  if (m >= 7.5) return 'B'
  if (m >= 6.9) return 'C+'
  if (m >= 6.0) return 'C'
  if (m >= 5.1) return 'D'
  return 'E'
}

function sessionLabel(s: ClassSession): string {
  const { classType, letter, track } = s.class
  const base = `${classType.name} ${letter}`
  return track ? `${base} — ${track.code}` : base
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GradesViewPage() {
  const params  = useParams()
  const yearId  = params.yearId as string
  const { toast } = useToast()

  const [sessions,   setSessions]   = useState<ClassSession[]>([])
  const [steps,      setSteps]      = useState<AcademicYearStep[]>([])
  const [rubrics,    setRubrics]    = useState<Rubric[]>([])
  const [loadingCtx, setLoadingCtx] = useState(true)
  const [yearName,   setYearName]   = useState("")

  const [selectedSession, setSelectedSession] = useState("")
  const [selectedStep,    setSelectedStep]    = useState("")

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
        if (yearRes.ok) { const y = await yearRes.json(); setYearName(y.name ?? "") }
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

  const poids = (code: string) =>
    code === 'R1' ? '70%' : code === 'R2' ? '25%' : code === 'R3' ? '5%' : ''

  const fmt = (v: number | null) => v !== null ? v.toFixed(2) : '—'

  const noteColor = (note: number | null, max: number) => {
    if (note === null) return '#A8A5A2'
    const pct = note / max
    return pct >= 0.7 ? '#2D7D46' : pct >= 0.5 ? '#C48B1A' : '#C43C3C'
  }

  if (loadingCtx) {
    return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-96 w-full" /></div>
  }

  return (
    <div className="space-y-6">

      {/* Sélecteurs */}
      <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #E8E6E3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8E6E3' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', fontWeight: 600, color: '#3A4A57' }}>
            Sélection
          </h3>
        </div>
        <div style={{ padding: '24px' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ maxWidth: '480px' }}>
            <Select value={selectedSession} onValueChange={setSelectedSession}>
              <SelectTrigger style={{ borderColor: '#D1CECC', borderRadius: '8px' }}>
                <SelectValue placeholder="Sélectionner une classe" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map(s => (
                  <SelectItem key={s.id} value={s.id}>{sessionLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStep} onValueChange={setSelectedStep}>
              <SelectTrigger style={{ borderColor: '#D1CECC', borderRadius: '8px' }}>
                <SelectValue placeholder="Sélectionner une étape" />
              </SelectTrigger>
              <SelectContent>
                {steps.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Bannière étape clôturée */}
      {selectedStep && isLocked && (
        <div className="rounded-lg p-4 flex items-center gap-3"
          style={{ backgroundColor: '#FEF6E0', border: '1px solid #C48B1A' }}>
          <svg className="h-5 w-5 flex-shrink-0" style={{ color: '#C48B1A' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-sm font-medium" style={{ color: '#C48B1A' }}>
            Étape clôturée — consultation en lecture seule
          </p>
        </div>
      )}

      {/* État vide */}
      {(!selectedSession || !selectedStep) && (
        <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #E8E6E3', padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: '15px', fontWeight: 500, color: '#78756F' }}>
            Sélectionnez une classe et une étape pour voir les notes
          </p>
        </div>
      )}

      {/* Contenu */}
      {selectedSession && selectedStep && (
        loadingGrid ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Élèves inscrits',  value: gradeRows.length,                                          bg: '#F0F4F7', color: '#2A3740' },
                { label: 'Notes complètes',  value: completeCount,                                             bg: '#E8F5EC', color: '#2D7D46' },
                { label: 'Notes manquantes', value: incompleteCount,                                           bg: '#FEF6E0', color: '#C48B1A' },
                { label: 'Moyenne classe',   value: classAverage !== null ? classAverage.toFixed(2) : '—',    bg: '#E3EFF9', color: '#2B6CB0' },
              ].map(kpi => (
                <div key={kpi.label} style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #E8E6E3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '16px 20px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#78756F', marginBottom: '6px' }}>{kpi.label}</p>
                  <p style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 700, color: kpi.color }}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Tableau */}
            {gradeRows.length === 0 ? (
              <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #E8E6E3', padding: '48px 24px', textAlign: 'center' }}>
                <p style={{ fontSize: '15px', fontWeight: 500, color: '#78756F' }}>Aucun élève inscrit dans cette classe</p>
              </div>
            ) : (
              <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #E8E6E3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
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
                            const max  = Number(cs.subject.maxScore) || 10
                            return (
                              <td key={cs.id}
                                style={{ padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: note !== null ? 600 : 400, color: noteColor(note ?? null, max), borderLeft: i === 0 ? `2px solid ${st.border}` : `1px solid #F0F0F0` }}>
                                {note !== null && note !== undefined ? note.toFixed(1) : '—'}
                              </td>
                            )
                          })
                        })}
                        {/* Moyenne */}
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, fontSize: '14px', borderLeft: '2px solid #D1D5DB', backgroundColor: '#EFF6FF', color: row.average !== null ? (row.average >= 7 ? '#2D7D46' : row.average >= 5 ? '#C48B1A' : '#C43C3C') : '#A8A5A2' }}>
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