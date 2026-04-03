"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileTextIcon } from "lucide-react"
import {
  fetchSteps,
  fetchClassSessions,
  getClassSessionName,
  type AcademicYearStep,
  type ClassSession,
} from "@/lib/api/dashboard"
import { parseDecimal } from "@/lib/decimal"

// ── Types ─────────────────────────────────────────────────────────────────────

interface CPMSLRapportsSectionProps {
  academicYearId: string
  isArchived?: boolean
}

interface StudentResult {
  enrollmentId: string
  lastname: string
  firstname: string
  avgR1: number | null
  avgR2: number | null
  avgR3: number | null
  finalAverage: number | null
  status: 'Réussi' | 'Échec' | 'Incomplet'
}

interface ReportStats {
  enrolled: number
  evaluated: number
  passed: number
  failed: number
  classAverage: number
  median: number
  min: number
  max: number
  results: StudentResult[]
}

// ── Helper ────────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

// ── Composant ─────────────────────────────────────────────────────────────────

export function CPMSLRapportsSection({
  academicYearId,
  isArchived = false,
}: CPMSLRapportsSectionProps) {
  const [steps, setSteps]       = useState<AcademicYearStep[]>([])
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [loadingInit, setLoadingInit] = useState(true)
  const [loadingReport, setLoadingReport] = useState(false)

  const [selectedStep, setSelectedStep]       = useState("")
  const [selectedSession, setSelectedSession] = useState("")
  const [stats, setStats]                     = useState<ReportStats | null>(null)
  const [currentPage, setCurrentPage]         = useState(1)
  const itemsPerPage = 25

  // ── Chargement initial ────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const [stepsData, sessionsData] = await Promise.all([
          fetchSteps(academicYearId),
          fetchClassSessions(academicYearId),
        ])
        setSteps(stepsData)
        setSessions(sessionsData)
      } catch (err) {
        console.error('[rapports] init error:', err)
      } finally {
        setLoadingInit(false)
      }
    }
    init()
  }, [academicYearId])

  // ── Calcul du rapport ─────────────────────────────────────────────────────────
  const computeReport = useCallback(async () => {
    if (!selectedSession || !selectedStep) return
    setLoadingReport(true)
    setStats(null)

    try {
      // 1. Inscriptions actives
      const enrollments = await apiFetch<Array<{
        id: string
        student?: { user?: { firstname?: string; lastname?: string } }
      }>>(`/api/enrollments?classSessionId=${selectedSession}&status=ACTIVE`)

      // 2. Matières de la classe avec rubriques
      const classSubjects = await apiFetch<Array<{
        id: string
        subjectId: string
        subject?: {
          rubricId?: string
          coefficient?: number
          maxScore?: number
          rubric?: { code: string }
        }
      }>>(`/api/class-subjects?classSessionId=${selectedSession}`)

      // 3. Rubriques
      const rubrics = await apiFetch<Array<{ id: string; code: string }>>(
        '/api/subject-rubrics'
      )

      // Map rubricId → code (R1/R2/R3)
      const rubricMap: Record<string, string> = {}
      rubrics.forEach(r => { rubricMap[r.id] = r.code })

      // Map classSubjectId → rubric code
      const csRubricMap: Record<string, string> = {}
      classSubjects.forEach(cs => {
        const rubricId = cs.subject?.rubricId
        if (rubricId) csRubricMap[cs.id] = rubricMap[rubricId] || ''
      })

      // 4. Notes par élève
      const results: StudentResult[] = await Promise.all(
        enrollments.map(async (enr) => {
          const grades = await apiFetch<Array<{
            classSubjectId: string
            studentScore: number | { s: number; e: number; d: number[] }
          }>>(`/api/grades/enrollment/${enr.id}?stepId=${selectedStep}`)

          // Regrouper par rubrique
          const byRubric: Record<string, number[]> = { R1: [], R2: [], R3: [] }

          grades.forEach(g => {
            const code = csRubricMap[g.classSubjectId]
            const score = parseDecimal(g.studentScore)
            if (code && score !== null && byRubric[code]) {
              byRubric[code].push(score)
            }
          })

          const avg = (arr: number[]) =>
            arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null

          const avgR1 = avg(byRubric.R1)
          const avgR2 = avg(byRubric.R2)
          const avgR3 = avg(byRubric.R3)

          // BR-001 : 70% R1 + 25% R2 + 5% R3
          let finalAverage: number | null = null
          if (avgR1 !== null || avgR2 !== null || avgR3 !== null) {
            finalAverage =
              (avgR1 ?? 0) * 0.70 +
              (avgR2 ?? 0) * 0.25 +
              (avgR3 ?? 0) * 0.05
          }

          const status: StudentResult['status'] =
            finalAverage === null ? 'Incomplet' :
            finalAverage >= 7 ? 'Réussi' : 'Échec'

          return {
            enrollmentId: enr.id,
            lastname:  enr.student?.user?.lastname  || '—',
            firstname: enr.student?.user?.firstname || '—',
            avgR1,
            avgR2,
            avgR3,
            finalAverage,
            status,
          }
        })
      )

      // 5. Statistiques classe
      const valid = results.filter(r => r.finalAverage !== null).map(r => r.finalAverage!)
      const sorted = [...valid].sort((a, b) => a - b)
      const median = sorted.length === 0 ? 0 :
        sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)]

      setStats({
        enrolled:     results.length,
        evaluated:    valid.length,
        passed:       results.filter(r => r.status === 'Réussi').length,
        failed:       results.filter(r => r.status === 'Échec').length,
        classAverage: valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : 0,
        median,
        min: sorted[0] ?? 0,
        max: sorted[sorted.length - 1] ?? 0,
        results,
      })
    } catch (err) {
      console.error('[rapports] compute error:', err)
    } finally {
      setLoadingReport(false)
    }
  }, [selectedSession, selectedStep])

  useEffect(() => {
    if (selectedSession && selectedStep) computeReport()
    else setStats(null)
  }, [selectedSession, selectedStep, computeReport])

  // ── Pagination ────────────────────────────────────────────────────────────────
  const totalPages = stats ? Math.ceil(stats.results.length / itemsPerPage) : 0
  const paginated  = stats ? stats.results.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) : []

  const fmt = (v: number | null) => v !== null ? v.toFixed(2) : '—'

  // ── Rendu ─────────────────────────────────────────────────────────────────────
  if (loadingInit) {
    return <Skeleton className="h-48 w-full" />
  }

  return (
    <div className="space-y-6">

      {/* Sélecteurs */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E8E6E3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid #E8E6E3' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', fontWeight: 600, color: '#3A4A57' }}>
            Sélection de la classe et de l&apos;étape
          </h3>
        </div>
        <div style={{ padding: '24px' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#1E1A17', display: 'block', marginBottom: '8px' }}>Classe</label>
              <Select value={selectedSession} onValueChange={v => { setSelectedSession(v); setCurrentPage(1) }}>
                <SelectTrigger style={{ borderColor: '#D1CECC', borderRadius: '8px' }}>
                  <SelectValue placeholder="Sélectionner une classe" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map(s => (
                    <SelectItem key={s.id} value={s.id}>{getClassSessionName(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#1E1A17', display: 'block', marginBottom: '8px' }}>Étape</label>
              <Select value={selectedStep} onValueChange={v => { setSelectedStep(v); setCurrentPage(1) }}>
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
      </div>

      {/* Loading */}
      {loadingReport && <Skeleton className="h-64 w-full" />}

      {/* Rapport */}
      {stats && !loadingReport && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {[
              { label: 'Inscrits',       value: stats.enrolled },
              { label: 'Évalués',        value: stats.evaluated },
              { label: 'Réussites',      value: stats.passed },
              { label: 'Échecs',         value: stats.failed },
              { label: 'Moy. classe',    value: `${stats.classAverage.toFixed(2)} / 10` },
              { label: 'Médiane',        value: `${stats.median.toFixed(2)} / 10` },
              { label: 'Min / Max',      value: `${fmt(stats.min)} / ${fmt(stats.max)}` },
            ].map(kpi => (
              <div key={kpi.label} style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E8E6E3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '16px' }}>
                <p style={{ fontSize: '12px', fontWeight: 500, textTransform: 'uppercase', color: '#78756F', marginBottom: '8px' }}>{kpi.label}</p>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 700, color: '#2A3740' }}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Table */}
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E8E6E3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #E8E6E3' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#3A4A57' }}>Résultats par élève</h3>
              <p style={{ fontSize: '13px', color: '#78756F', marginTop: '4px' }}>
                Seuil de réussite : ≥ 7.00 / 10 — Formule BR-001 : 70% R1 + 25% R2 + 5% R3
              </p>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ borderRadius: '8px', border: '1px solid #E8E6E3', overflow: 'hidden' }}>
                <Table>
                  <TableHeader>
                    <TableRow style={{ backgroundColor: '#F1F5F9', borderBottom: '2px solid #D1D5DB' }}>
                      {['Nom', 'Prénom', 'Moy. R1', 'Moy. R2', 'Moy. R3', 'Moyenne finale', 'Statut'].map(h => (
                        <TableHead key={h} style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2C4A6E' }}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map(r => (
                      <TableRow key={r.enrollmentId} style={{ borderBottom: '1px solid #E8E6E3' }} className="hover:bg-[#FAF8F3]">
                        <TableCell style={{ fontWeight: 600, color: '#1E1A17', fontSize: '14px' }}>{r.lastname}</TableCell>
                        <TableCell style={{ color: '#1E1A17', fontSize: '14px' }}>{r.firstname}</TableCell>
                        <TableCell style={{ textAlign: 'right', color: '#1E1A17' }}>{fmt(r.avgR1)}</TableCell>
                        <TableCell style={{ textAlign: 'right', color: '#1E1A17' }}>{fmt(r.avgR2)}</TableCell>
                        <TableCell style={{ textAlign: 'right', color: '#1E1A17' }}>{fmt(r.avgR3)}</TableCell>
                        <TableCell style={{ textAlign: 'right', fontWeight: 700, color: '#1E1A17' }}>{fmt(r.finalAverage)}</TableCell>
                        <TableCell>
                          {r.status === 'Réussi' && <Badge style={{ backgroundColor: '#E8F5EC', color: '#2D7D46', border: 'none' }}>✅ Réussi</Badge>}
                          {r.status === 'Échec'  && <Badge style={{ backgroundColor: '#FDE8E8', color: '#C43C3C', border: 'none' }}>❌ Échec</Badge>}
                          {r.status === 'Incomplet' && <Badge style={{ backgroundColor: '#FEF6E0', color: '#C48B1A', border: 'none' }}>⏳ Incomplet</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-4 mt-4" style={{ borderTop: '1px solid #E8E6E3' }}>
                  <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={{ borderColor: '#D1CECC' }}>← Précédent</Button>
                  <span style={{ fontSize: '13px', color: '#78756F' }}>Page {currentPage} / {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} style={{ borderColor: '#D1CECC' }}>Suivant →</Button>
                </div>
              )}
            </div>
          </div>

          {/* Bouton rapport PDF */}
          <Button
            size="lg"
            disabled={isArchived}
            style={{ backgroundColor: isArchived ? '#9CA3AF' : '#2C4A6E', color: '#FFFFFF', fontSize: '14px', fontWeight: 600, borderRadius: '8px', padding: '10px 24px' }}
          >
            <FileTextIcon className="mr-2 h-5 w-5" />
            Générer le rapport PDF 8½×14
          </Button>
        </>
      )}

      {/* Empty state */}
      {!stats && !loadingReport && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E8E6E3', padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: '15px', fontWeight: 500, color: '#78756F' }}>
            Sélectionnez une classe et une étape pour voir le rapport
          </p>
        </div>
      )}
    </div>
  )
}