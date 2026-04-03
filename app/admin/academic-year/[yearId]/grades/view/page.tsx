"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchClassSessions, fetchSteps, type AcademicYearStep, type ClassSession } from "@/lib/api/dashboard"
import { fetchClassSubjects, fetchEnrollments, type ApiClassSubject, type ApiEnrollment } from "@/lib/api/grades"
import { parseDecimal } from "@/lib/decimal"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Rubric {
  id: string
  code: string
  name: string
}

interface GradeRow {
  enrollmentId: string
  studentId: string
  lastname: string
  firstname: string
  studentCode: string
  // Map classSubjectId → note
  grades: Record<string, number | null>
  average: number | null
}

// ── Helper BR-001 ─────────────────────────────────────────────────────────────

function computeAverage(
  grades: Record<string, number | null>,
  classSubjects: ApiClassSubject[],
  rubrics: Rubric[]
): number | null {
  const rubricMap: Record<string, string> = {}
  rubrics.forEach(r => { rubricMap[r.id] = r.code })

  // Grouper les notes par rubrique
  const byRubric: Record<string, number[]> = { R1: [], R2: [], R3: [] }

  classSubjects.forEach(cs => {
    const rubricId = cs.subject.rubric?.id
    const code     = rubricId ? rubricMap[rubricId] : null
    const note     = grades[cs.id]
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

  // ── Données contexte ──────────────────────────────────────────────────────
  const [sessions,      setSessions]      = useState<ClassSession[]>([])
  const [steps,         setSteps]         = useState<AcademicYearStep[]>([])
  const [rubrics,       setRubrics]       = useState<Rubric[]>([])
  const [loadingCtx,    setLoadingCtx]    = useState(true)

  // ── Sélections ────────────────────────────────────────────────────────────
  const [selectedSession, setSelectedSession] = useState("")
  const [selectedStep,    setSelectedStep]    = useState("")

  // ── Données grid ──────────────────────────────────────────────────────────
  const [classSubjects,  setClassSubjects]  = useState<ApiClassSubject[]>([])
  const [enrollments,    setEnrollments]    = useState<ApiEnrollment[]>([])
  const [gradeRows,      setGradeRows]      = useState<GradeRow[]>([])
  const [loadingGrid,    setLoadingGrid]    = useState(false)

  // ── Chargement contexte ───────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const [sessionsData, stepsData, rubricsRes] = await Promise.all([
          fetchClassSessions(yearId),
          fetchSteps(yearId),
          fetch('/api/subject-rubrics', { credentials: 'include' }),
        ])
        setSessions(sessionsData)
        setSteps([...stepsData].sort((a, b) => a.stepNumber - b.stepNumber))
        if (rubricsRes.ok) {
          const r = await rubricsRes.json()
          setRubrics(r)
        }
      } catch {
        toast({ title: "Erreur", description: "Impossible de charger le contexte", variant: "destructive" })
      } finally {
        setLoadingCtx(false)
      }
    }
    init()
  }, [yearId, toast])

  // ── Chargement grid quand session + étape sélectionnées ───────────────────
  const loadGrid = useCallback(async (sessionId: string, stepId: string) => {
    if (!sessionId || !stepId) return
    setLoadingGrid(true)
    setGradeRows([])
    try {
      // 1. Matières + élèves en parallèle
      const [cs, enr] = await Promise.all([
        fetchClassSubjects(sessionId),
        fetchEnrollments(sessionId),
      ])
      setClassSubjects(cs)
      setEnrollments(enr)

      // 2. Notes par élève — toutes en parallèle
      const rows = await Promise.all(
        enr.map(async (enrollment) => {
          try {
            const res = await fetch(
              `/api/grades/enrollment/${enrollment.id}?stepId=${stepId}`,
              { credentials: 'include' }
            )
            const rawGrades = res.ok ? await res.json() : []

            // Map classSubjectId → score normalisé
            const gradeMap: Record<string, number | null> = {}
            cs.forEach(c => { gradeMap[c.id] = null })

            rawGrades.forEach((g: {
              classSubjectId: string
              sectionId: string | null
              studentScore: number
            }) => {
              // Prendre seulement les notes directes (pas les sections)
              if (g.sectionId === null) {
                gradeMap[g.classSubjectId] = parseDecimal(g.studentScore)
              }
            })

            const average = computeAverage(gradeMap, cs, rubrics)

            return {
              enrollmentId: enrollment.id,
              studentId:    enrollment.student.id,
              lastname:     enrollment.student.user.lastname,
              firstname:    enrollment.student.user.firstname,
              studentCode:  enrollment.student.studentCode,
              grades:       gradeMap,
              average,
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
            } as GradeRow
          }
        })
      )

      // Trier par nom
      rows.sort((a, b) => `${a.lastname} ${a.firstname}`.localeCompare(`${b.lastname} ${b.firstname}`))
      setGradeRows(rows)

    } catch (err) {
      console.error('[W4] erreur chargement grid:', err)
      toast({ title: "Erreur", description: "Impossible de charger les notes", variant: "destructive" })
    } finally {
      setLoadingGrid(false)
    }
  }, [rubrics, toast])

  useEffect(() => {
    if (selectedSession && selectedStep) {
      loadGrid(selectedSession, selectedStep)
    } else {
      setGradeRows([])
      setClassSubjects([])
      setEnrollments([])
    }
  }, [selectedSession, selectedStep, loadGrid])

  // ── Grouper matières par rubrique ─────────────────────────────────────────
  const rubricGroups = useMemo(() => {
    const rubricMap: Record<string, string> = {}
    rubrics.forEach(r => { rubricMap[r.id] = r.code })

    const groups: Array<{
      rubric: Rubric
      subjects: ApiClassSubject[]
    }> = []

    const rubricOrder = ['R1', 'R2', 'R3']
    rubricOrder.forEach(code => {
      const rubric = rubrics.find(r => r.code === code)
      if (!rubric) return

      const subjects = classSubjects.filter(cs => {
        const rid = cs.subject.rubric?.id
        return rid && rubricMap[rid] === code
      })

      if (subjects.length > 0) {
        groups.push({ rubric, subjects })
      }
    })

    // Matières sans rubrique
    const withoutRubric = classSubjects.filter(cs => !cs.subject.rubric)
    if (withoutRubric.length > 0) {
      groups.push({
        rubric: { id: 'none', code: '—', name: 'Sans rubrique' },
        subjects: withoutRubric
      })
    }

    return groups
  }, [classSubjects, rubrics])

  // ── Moyennes par colonne ──────────────────────────────────────────────────
  const columnAverages = useMemo(() => {
    const avgs: Record<string, number | null> = {}
    classSubjects.forEach(cs => {
      const notes = gradeRows
        .map(r => r.grades[cs.id])
        .filter((n): n is number => n !== null && n !== undefined)
      avgs[cs.id] = notes.length > 0
        ? notes.reduce((s, v) => s + v, 0) / notes.length
        : null
    })
    return avgs
  }, [classSubjects, gradeRows])

  // Moyenne générale de la classe
  const classAverage = useMemo(() => {
    const avgs = gradeRows.map(r => r.average).filter((a): a is number => a !== null)
    return avgs.length > 0 ? avgs.reduce((s, v) => s + v, 0) / avgs.length : null
  }, [gradeRows])

  const evaluatedCount = gradeRows.filter(r => r.average !== null).length

  // ── Couleurs rubrique ─────────────────────────────────────────────────────
  const rubricStyle = (code: string) => {
    if (code === 'R1') return { bg: '#E3EFF9', color: '#2B6CB0', border: '#93C5FD' }
    if (code === 'R2') return { bg: '#E8F5EC', color: '#2D7D46', border: '#86EFAC' }
    if (code === 'R3') return { bg: '#FAF8F3', color: '#B0A07A', border: '#D9C98A' }
    return { bg: '#F0F4F7', color: '#5A7085', border: '#B3C7D5' }
  }

  const poids = (code: string) =>
    code === 'R1' ? '70%' : code === 'R2' ? '25%' : code === 'R3' ? '5%' : ''

  const fmt = (v: number | null) => v !== null ? v.toFixed(2) : '—'

  // ── Rendu ─────────────────────────────────────────────────────────────────
  if (loadingCtx) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const totalCols = classSubjects.length + 1 // +1 pour Moyenne

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', fontWeight: 700, letterSpacing: '-0.03em', color: '#2A3740' }}>
          Consultation des notes
        </h1>
        <p style={{ fontSize: '13px', color: '#78756F', marginTop: '4px' }}>
          Vue d&apos;ensemble des notes par classe et par étape
        </p>
      </div>

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

      {/* Grid */}
      {!selectedSession || !selectedStep ? (
        <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #E8E6E3', padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: '15px', fontWeight: 500, color: '#78756F' }}>
            Sélectionnez une classe et une étape pour voir les notes
          </p>
        </div>
      ) : loadingGrid ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Élèves inscrits',  value: gradeRows.length },
              { label: 'Élèves évalués',   value: evaluatedCount },
              { label: 'Moyenne classe',   value: classAverage !== null ? `${classAverage.toFixed(2)} / 10` : '—' },
            ].map(kpi => (
              <div key={kpi.label} style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #E8E6E3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '16px 20px' }}>
                <p style={{ fontSize: '12px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#78756F', marginBottom: '6px' }}>
                  {kpi.label}
                </p>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 700, color: '#2A3740' }}>
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>

          {/* Tableau */}
          {gradeRows.length === 0 ? (
            <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #E8E6E3', padding: '48px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: '15px', fontWeight: 500, color: '#78756F' }}>
                Aucun élève inscrit dans cette classe
              </p>
            </div>
          ) : (
            <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #E8E6E3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: `${300 + totalCols * 80}px` }}>
                <thead>

                  {/* Ligne 1 — Rubriques fusionnées */}
                  <tr style={{ backgroundColor: '#F1F5F9' }}>
                    {/* Colonne Élève */}
                    <th
                      rowSpan={2}
                      style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2C4A6E', borderBottom: '2px solid #D1D5DB', borderRight: '2px solid #D1D5DB', minWidth: '200px', verticalAlign: 'middle' }}
                    >
                      Élève
                    </th>

                    {/* Groupes rubrique */}
                    {rubricGroups.map(group => {
                      const style = rubricStyle(group.rubric.code)
                      return (
                        <th
                          key={group.rubric.id}
                          colSpan={group.subjects.length}
                          style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: style.color, backgroundColor: style.bg, borderBottom: `1px solid ${style.border}`, borderLeft: `2px solid ${style.border}` }}
                        >
                          {group.rubric.code} {poids(group.rubric.code)}
                        </th>
                      )
                    })}

                    {/* Colonne Moyenne */}
                    <th
                      rowSpan={2}
                      style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2A3740', borderBottom: '2px solid #D1D5DB', borderLeft: '2px solid #D1D5DB', minWidth: '90px', verticalAlign: 'middle', backgroundColor: '#EFF6FF' }}
                    >
                      Moy.
                    </th>
                  </tr>

                  {/* Ligne 2 — Codes matières */}
                  <tr style={{ backgroundColor: '#F8FAFC' }}>
                    {rubricGroups.map(group => {
                      const style = rubricStyle(group.rubric.code)
                      return group.subjects.map((cs, i) => (
                        <th
                          key={cs.id}
                          style={{ padding: '8px 10px', textAlign: 'center', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: style.color, borderBottom: '2px solid #D1D5DB', borderLeft: i === 0 ? `2px solid ${style.border}` : `1px solid ${style.border}`, minWidth: '72px' }}
                          title={cs.subject.name}
                        >
                          {cs.subject.code}
                        </th>
                      ))
                    })}
                  </tr>
                </thead>

                <tbody>
                  {gradeRows.map((row, ri) => (
                    <tr
                      key={row.enrollmentId}
                      style={{ borderBottom: ri < gradeRows.length - 1 ? '1px solid #E8E6E3' : 'none', backgroundColor: ri % 2 === 0 ? 'white' : '#FAFAF8' }}
                      className="hover:bg-[#F5F4F2]"
                    >
                      {/* Élève */}
                      <td style={{ padding: '10px 16px', borderRight: '2px solid #E8E6E3' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#1E1A17' }}>{row.lastname}</div>
                        <div style={{ fontSize: '12px', color: '#78756F' }}>{row.firstname}</div>
                      </td>

                      {/* Notes par rubrique */}
                      {rubricGroups.map(group => {
                        const style = rubricStyle(group.rubric.code)
                        return group.subjects.map((cs, i) => {
                          const note = row.grades[cs.id]
                          const maxS = Number(cs.subject.maxScore) || 10
                          const pct  = note !== null && note !== undefined ? note / maxS : null
                          const noteColor = pct === null ? '#A8A5A2'
                            : pct >= 0.7 ? '#2D7D46'
                            : pct >= 0.5 ? '#C48B1A'
                            : '#C43C3C'
                          return (
                            <td
                              key={cs.id}
                              style={{ padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: note !== null ? 600 : 400, color: noteColor, borderLeft: i === 0 ? `2px solid ${style.border}` : `1px solid #F0F0F0` }}
                            >
                              {note !== null && note !== undefined ? note.toFixed(1) : '—'}
                            </td>
                          )
                        })
                      })}

                      {/* Moyenne élève */}
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, fontSize: '14px', borderLeft: '2px solid #D1D5DB', backgroundColor: '#EFF6FF', color: row.average !== null ? (row.average >= 7 ? '#2D7D46' : row.average >= 5 ? '#C48B1A' : '#C43C3C') : '#A8A5A2' }}>
                        {fmt(row.average)}
                      </td>
                    </tr>
                  ))}

                  {/* Ligne moyenne colonne */}
                  <tr style={{ backgroundColor: '#F1F5F9', borderTop: '2px solid #D1D5DB' }}>
                    <td style={{ padding: '10px 16px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#2C4A6E', borderRight: '2px solid #D1D5DB', letterSpacing: '0.04em' }}>
                      Moy. classe
                    </td>
                    {rubricGroups.map(group => {
                      const style = rubricStyle(group.rubric.code)
                      return group.subjects.map((cs, i) => (
                        <td
                          key={cs.id}
                          style={{ padding: '10px 8px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: style.color, borderLeft: i === 0 ? `2px solid ${style.border}` : `1px solid #E8E6E3` }}
                        >
                          {fmt(columnAverages[cs.id])}
                        </td>
                      ))
                    })}
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '14px', fontWeight: 700, color: '#2B6CB0', borderLeft: '2px solid #D1D5DB', backgroundColor: '#DBEAFE' }}>
                      {fmt(classAverage)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}