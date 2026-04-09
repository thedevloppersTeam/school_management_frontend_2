"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

interface SubjectColumn {
  classSubjectId: string
  subjectId:      string
  name:           string
  code:           string
  rubricCode:     'R1' | 'R2' | 'R3'
  maxScore:       number
  sections:       Array<{ id: string; name: string; maxScore: number }>
}

interface StudentRow {
  enrollmentId: string
  lastname:     string
  firstname:    string
  scores:       Record<string, number | null>
  finalAverage: number | null
  mention:      'Réussi' | 'Échec' | 'Incomplet'
  rang:         number
}

interface ReportData {
  subjects:     SubjectColumn[]
  rows:         StudentRow[]
  enrolled:     number
  evaluated:    number
  passed:       number
  failed:       number
  classAverage: number
  median:       number
  min:          number
  max:          number
  subjectAvgs:  Record<string, number | null>
}

type RawGrade = {
  classSubjectId: string
  sectionId: string | null
  studentScore: number | { s: number; e: number; d: number[] }
}

type RawEnrollment = {
  id: string
  student?: { nisu?: string; user?: { firstname?: string; lastname?: string } }
}

// ── Module-level helpers ───────────────────────────────────────────────────────

function calcMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function fmt(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return '—'
  return value.toFixed(decimals)
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`apiFetch ${url} → ${res.status}`)
  return res.json() as Promise<T>
}

function calculateSectionScores(
  sub: SubjectColumn,
  grades: RawGrade[]
): number | null {
  let total = 0
  for (const sec of sub.sections) {
    const g = grades.find(
      g => g.classSubjectId === sub.classSubjectId && g.sectionId === sec.id
    )
    if (!g) return null
    const score = parseDecimal(g.studentScore)
    if (score === null) return null
    total += score
  }
  return total
}

// Extracts per-subject scores for one enrollment
function buildScores(
  subjects: SubjectColumn[],
  grades: RawGrade[]
): Record<string, number | null> {
  const scores: Record<string, number | null> = {}

  for (const sub of subjects) {
    if (sub.sections.length === 0) {
      const g = grades.find(
        g => g.classSubjectId === sub.classSubjectId && g.sectionId === null
      )
      scores[sub.classSubjectId] = g ? parseDecimal(g.studentScore) : null
    } else {
      scores[sub.classSubjectId] = calculateSectionScores(sub, grades)
    }
  }

  return scores
}

// Groups normalised scores (out of 10) by rubric
function groupByRubric(
  subjects: SubjectColumn[],
  scores: Record<string, number | null>
): Record<'R1' | 'R2' | 'R3', number[]> {
  const byRubric: Record<'R1' | 'R2' | 'R3', number[]> = { R1: [], R2: [], R3: [] }

  for (const sub of subjects) {
    const val = scores[sub.classSubjectId]
    if (val !== null) {
      const normalized = sub.maxScore === 0 ? 0 : (val / sub.maxScore) * 10
      byRubric[sub.rubricCode].push(normalized)
    }
  }

  return byRubric
}

// Computes final weighted average: 70% R1 + 25% R2 + 5% R3
function computeFinalAverage(
  byRubric: Record<'R1' | 'R2' | 'R3', number[]>
): number | null {
  const avg = (arr: number[]): number | null =>
    arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null

  const avgR1 = avg(byRubric.R1)
  const avgR2 = avg(byRubric.R2)
  const avgR3 = avg(byRubric.R3)

  if (avgR1 === null && avgR2 === null && avgR3 === null) return null

  return (avgR1 ?? 0) * 0.7 + (avgR2 ?? 0) * 0.25 + (avgR3 ?? 0) * 0.05
}

// Module-level async function — nesting starts at 0, never exceeds level 2
async function processEnrollment(
  enr: RawEnrollment,
  subjects: SubjectColumn[],
  selectedStep: string
): Promise<StudentRow> {
  const grades = await apiFetch<RawGrade[]>(
    `/api/grades/enrollment/${enr.id}?stepId=${selectedStep}`
  )

  const scores       = buildScores(subjects, grades)
  const byRubric     = groupByRubric(subjects, scores)
  const finalAverage = computeFinalAverage(byRubric)

  const mention: StudentRow['mention'] =
    finalAverage === null ? 'Incomplet' :
    finalAverage >= 7     ? 'Réussi'   : 'Échec'

  return {
    enrollmentId: enr.id,
    lastname:  enr.student?.user?.lastname  ?? '—',
    firstname: enr.student?.user?.firstname ?? '—',
    scores,
    finalAverage,
    mention,
    rang: 0,
  }
}

// ── Composant ─────────────────────────────────────────────────────────────────

export function CPMSLRapportsSection({
  academicYearId,
  isArchived = false,
}: Readonly<CPMSLRapportsSectionProps>) {
  const [steps,         setSteps]         = useState<AcademicYearStep[]>([])
  const [sessions,      setSessions]      = useState<ClassSession[]>([])
  const [loadingInit,   setLoadingInit]   = useState(true)
  const [loadingReport, setLoadingReport] = useState(false)
  const [generating,    setGenerating]    = useState(false)
  const [selectedStep,    setSelectedStep]    = useState("")
  const [selectedSession, setSelectedSession] = useState("")
  const [report,          setReport]          = useState<ReportData | null>(null)
  const reportRef = useRef<HTMLDivElement>(null)

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const [s, ses] = await Promise.all([
          fetchSteps(academicYearId),
          fetchClassSessions(academicYearId),
        ])
        setSteps(s)
        setSessions(ses)
      } catch (e) {
        console.error('[rapports] init:', e)
      } finally {
        setLoadingInit(false)
      }
    }
    init()
  }, [academicYearId])

  // ── Calcul rapport ─────────────────────────────────────────────────────────
  const computeReport = useCallback(async () => {
    if (!selectedSession || !selectedStep) return
    setLoadingReport(true)
    setReport(null)

    try {
      const [enrollments, rawSubjects, rubrics] = await Promise.all([
        apiFetch<RawEnrollment[]>(
          `/api/enrollments?classSessionId=${selectedSession}&status=ACTIVE`
        ),
        apiFetch<Array<{
          id: string
          subjectId: string
          subject?: {
            name?: string
            code?: string
            maxScore?: number
            hasSections?: boolean
            rubricId?: string
            rubric?: { code?: string }
            sections?: Array<{ id: string; name: string; maxScore?: number }>
          }
        }>>(`/api/class-subjects?classSessionId=${selectedSession}`),
        apiFetch<Array<{ id: string; code: string }>>('/api/subject-rubrics'),
      ])

      const rubricMap: Record<string, string> = {}
      rubrics.forEach(r => { rubricMap[r.id] = r.code })

      const subjects: SubjectColumn[] = rawSubjects
        .map(cs => {
          const rubricId   = cs.subject?.rubricId
          const rubricCode = (rubricId ? rubricMap[rubricId] : null) as 'R1' | 'R2' | 'R3' | null
          if (!rubricCode) return null

          const sections = (cs.subject?.sections ?? []).map(sec => ({
            id: sec.id,
            name: sec.name,
            maxScore: Number(sec.maxScore) || 10,
          }))

          const maxScore = sections.length > 0
            ? sections.reduce((sum, s) => sum + s.maxScore, 0)
            : Number(cs.subject?.maxScore) || 10

          return {
            classSubjectId: cs.id,
            subjectId: cs.subjectId,
            name: cs.subject?.name ?? '—',
            code: cs.subject?.code ?? '—',
            rubricCode,
            maxScore,
            sections,
          } satisfies SubjectColumn
        })
        .filter((s): s is SubjectColumn => s !== null)

      const rubricOrder: Record<string, number> = { R1: 0, R2: 1, R3: 2 }
      subjects.sort((a, b) =>
        rubricOrder[a.rubricCode] - rubricOrder[b.rubricCode] ||
        a.name.localeCompare(b.name)
      )

      // Clean call site — processEnrollment is now a module-level function
      const rows: StudentRow[] = await Promise.all(
        enrollments.map(enr => processEnrollment(enr, subjects, selectedStep))
      )

      rows.sort((a, b) => {
        if (a.finalAverage === null && b.finalAverage === null) return 0
        if (a.finalAverage === null) return 1
        if (b.finalAverage === null) return -1
        return b.finalAverage - a.finalAverage
      })
      rows.forEach((r, i) => { r.rang = i + 1 })

      const validAvgs = rows
        .filter(r => r.finalAverage !== null)
        .map(r => r.finalAverage as number)

      const subjectAvgs: Record<string, number | null> = {}
      subjects.forEach(sub => {
        const vals = rows
          .map(r => r.scores[sub.classSubjectId])
          .filter((v): v is number => v !== null)
        subjectAvgs[sub.classSubjectId] =
          vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null
      })

      setReport({
        subjects,
        rows,
        enrolled:     rows.length,
        evaluated:    validAvgs.length,
        passed:       rows.filter(r => r.mention === 'Réussi').length,
        failed:       rows.filter(r => r.mention === 'Échec').length,
        classAverage: validAvgs.length
          ? validAvgs.reduce((s, v) => s + v, 0) / validAvgs.length
          : 0,
        median: calcMedian(validAvgs),
        min:    validAvgs.length ? Math.min(...validAvgs) : 0,
        max:    validAvgs.length ? Math.max(...validAvgs) : 0,
        subjectAvgs,
      })
    } catch (e) {
      console.error('[rapports] compute:', e)
    } finally {
      setLoadingReport(false)
    }
  }, [selectedSession, selectedStep])

  useEffect(() => {
    if (selectedSession && selectedStep) computeReport()
    else setReport(null)
  }, [selectedSession, selectedStep, computeReport])

  // ── Génération PDF 8½×14 ──────────────────────────────────────────────────
  const generatePDF = async () => {
    if (!report || !reportRef.current) return
    setGenerating(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const jsPDF       = (await import('jspdf')).default

      const canvas = await html2canvas(reportRef.current, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff',
      })

      const imgData = canvas.toDataURL('image/png')
      const pageW   = 355.6  // 14 pouces en mm
      const pageH   = 215.9  // 8.5 pouces en mm
      const imgW    = pageW
      const imgH    = (canvas.height * pageW) / canvas.width
      const pdf     = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'legal' })
      let pos       = 0

      pdf.addImage(imgData, 'PNG', 0, pos, imgW, imgH)
      pos -= pageH
      while (pos > -imgH) {
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, pos, imgW, imgH)
        pos -= pageH
      }

      const sessionObj = sessions.find(s => s.id === selectedSession)
      const cn = sessionObj ? getClassSessionName(sessionObj) : 'classe'
      const sn = steps.find(s => s.id === selectedStep)?.name ?? 'etape'
      pdf.save(`rapport_${cn}_${sn}_${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (e) {
      console.error('[rapports] PDF:', e)
    } finally {
      setGenerating(false)
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderMentionBadge = (mention: StudentRow['mention']) => {
    if (mention === 'Réussi') {
      return (
        <span style={{ backgroundColor: '#E8F5EC', color: '#2D7D46', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>
          Réussi
        </span>
      )
    }
    if (mention === 'Échec') {
      return (
        <span style={{ backgroundColor: '#FDE8E8', color: '#C43C3C', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>
          Échec
        </span>
      )
    }
    return (
      <span style={{ backgroundColor: '#FEF6E0', color: '#C48B1A', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>
        Incomplet
      </span>
    )
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '10px',
    border: '1px solid #E8E6E3',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  }
  const thStyle: React.CSSProperties = {
    padding: '8px 10px',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: '#2C4A6E',
    whiteSpace: 'nowrap',
    borderBottom: '2px solid #D1D5DB',
    textAlign: 'center',
  }
  const tdStyle: React.CSSProperties = {
    padding: '7px 10px',
    fontSize: '12px',
    textAlign: 'center',
    borderBottom: '1px solid #E8E6E3',
    color: '#1E1A17',
  }

  const rubriqueGroups: Record<string, SubjectColumn[]> = { R1: [], R2: [], R3: [] }
  report?.subjects.forEach(sub => { rubriqueGroups[sub.rubricCode].push(sub) })

  const sessionObj = sessions.find(s => s.id === selectedSession)
  const className  = sessionObj ? getClassSessionName(sessionObj) : ''
  const stepName   = steps.find(s => s.id === selectedStep)?.name ?? ''

  if (loadingInit) return <Skeleton className="h-48 w-full" />

  return (
    <div className="space-y-6">

      {/* Sélecteurs */}
      <div style={card}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8E6E3' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', fontWeight: 600, color: '#3A4A57' }}>
            Rapport statistique de classe
          </h3>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="class-select" style={{ fontSize: '13px', fontWeight: 500, color: '#1E1A17', display: 'block', marginBottom: '8px' }}>
                Classe
              </label>
              <Select value={selectedSession} onValueChange={setSelectedSession}>
                <SelectTrigger id="class-select" style={{ borderColor: '#D1CECC', borderRadius: '8px' }}>
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
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#1E1A17', display: 'block', marginBottom: '8px' }}>
                Étape
              </label>
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
      </div>

      {loadingReport && <Skeleton className="h-64 w-full" />}

      {report && !loadingReport && (
        <>
          {/* KPIs aperçu */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Inscrits',      value: report.enrolled },
              { label: 'Évalués',       value: report.evaluated },
              { label: 'Réussites',     value: report.passed },
              { label: 'Échecs',        value: report.failed },
              { label: 'Taux réussite', value: `${report.evaluated ? Math.round((report.passed / report.evaluated) * 100) : 0}%` },
              { label: 'Moy. classe',   value: `${report.classAverage.toFixed(2)}/10` },
              { label: 'Médiane',       value: `${report.median.toFixed(2)}/10` },
            ].map(kpi => (
              <div key={kpi.label} style={{ ...card, padding: '14px 16px' }}>
                <p style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', color: '#78756F', marginBottom: '6px' }}>
                  {kpi.label}
                </p>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 700, color: '#2A3740' }}>
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>

          {/* Zone capturée pour PDF */}
          <div
            ref={reportRef}
            style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '10px', border: '1px solid #E8E6E3' }}
          >

            {/* En-tête */}
            <div style={{ marginBottom: '20px', borderBottom: '2px solid #2C4A6E', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '18px', fontWeight: 700, color: '#2A3740', fontFamily: 'var(--font-serif)' }}>
                  Cours Privé Mixte Saint Léonard
                </p>
                <p style={{ fontSize: '13px', color: '#5C5955', marginTop: '2px' }}>
                  Rapport statistique · {className} · {stepName}
                </p>
              </div>
              <div style={{ textAlign: 'right', fontSize: '12px', color: '#78756F' }}>
                <p>Généré le {new Date().toLocaleDateString('fr-FR')}</p>
                <p style={{ marginTop: '2px', fontWeight: 600, color: '#2C4A6E' }}>
                  {report.passed}/{report.evaluated} réussis ({report.evaluated ? Math.round((report.passed / report.evaluated) * 100) : 0}%)
                </p>
              </div>
            </div>

            {/* Synthèse */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginBottom: '20px' }}>
              {[
                { label: 'Inscrits',  value: report.enrolled },
                { label: 'Évalués',   value: report.evaluated },
                { label: 'Réussis',   value: report.passed },
                { label: 'Échecs',    value: report.failed },
                { label: 'Moyenne',   value: `${report.classAverage.toFixed(2)}/10` },
                { label: 'Min / Max', value: `${fmt(report.min)} / ${fmt(report.max)}` },
              ].map(k => (
                <div key={k.label} style={{ backgroundColor: '#F1F5F9', borderRadius: '6px', padding: '10px 12px', textAlign: 'center' }}>
                  <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#5A7085', marginBottom: '4px' }}>
                    {k.label}
                  </p>
                  <p style={{ fontSize: '18px', fontWeight: 700, color: '#2A3740' }}>
                    {k.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Grille */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  {/* Ligne 1 : groupes rubriques */}
                  <tr style={{ backgroundColor: '#2C4A6E' }}>
                    <th colSpan={3} style={{ ...thStyle, color: '#FFFFFF', backgroundColor: '#2C4A6E', textAlign: 'left', border: 'none' }}>
                      Élève
                    </th>
                    {(['R1', 'R2', 'R3'] as const).map(r => {
                      const cols = rubriqueGroups[r]
                      if (!cols || cols.length === 0) return null
                      let bg: string
                      if (r === 'R1') {
                        bg = '#2C4A6E'
                      } else if (r === 'R2') {
                        bg = '#3A5F7D'
                      } else {
                        bg = '#4A7396'
                      }
                      return (
                        <th
                          key={r}
                          colSpan={cols.length}
                          style={{ ...thStyle, color: '#FFFFFF', backgroundColor: bg, border: 'none' }}
                        >
                          {r} · {cols.length} matière{cols.length > 1 ? 's' : ''}
                        </th>
                      )
                    })}
                    <th colSpan={2} style={{ ...thStyle, color: '#FFFFFF', backgroundColor: '#1E3A50', border: 'none' }}>
                      Résultat
                    </th>
                  </tr>
                  {/* Ligne 2 : colonnes */}
                  <tr style={{ backgroundColor: '#F1F5F9' }}>
                    <th style={{ ...thStyle, textAlign: 'center', width: '28px' }}>Rg</th>
                    <th style={{ ...thStyle, textAlign: 'left', minWidth: '110px' }}>Nom</th>
                    <th style={{ ...thStyle, textAlign: 'left', minWidth: '80px' }}>Prénom</th>
                    {report.subjects.map(sub => (
                      <th key={sub.classSubjectId} style={{ ...thStyle, minWidth: '55px' }}>
                        {sub.code}
                        <br />
                        <span style={{ fontSize: '9px', fontWeight: 400, color: '#78756F' }}>
                          /{sub.maxScore}
                        </span>
                      </th>
                    ))}
                    <th style={{ ...thStyle, minWidth: '55px' }}>Moy./10</th>
                    <th style={{ ...thStyle, minWidth: '60px' }}>Mention</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row, idx) => (
                    <tr key={row.enrollmentId} style={{ backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB' }}>
                      <td style={{ ...tdStyle, fontWeight: 600, color: '#5A7085' }}>{row.rang}</td>
                      <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600 }}>{row.lastname}</td>
                      <td style={{ ...tdStyle, textAlign: 'left' }}>{row.firstname}</td>
                      {report.subjects.map(sub => (
                        <td key={sub.classSubjectId} style={tdStyle}>
                          {fmt(row.scores[sub.classSubjectId], 1)}
                        </td>
                      ))}
                      <td style={{ ...tdStyle, fontWeight: 700, color: row.finalAverage !== null && row.finalAverage >= 7 ? '#2D7D46' : '#C43C3C' }}>
                        {fmt(row.finalAverage)}
                      </td>
                      <td style={tdStyle}>
                        {renderMentionBadge(row.mention)}
                      </td>
                    </tr>
                  ))}

                  {/* Ligne moyennes classe */}
                  <tr style={{ backgroundColor: '#E8EDF2', borderTop: '2px solid #2C4A6E' }}>
                    <td colSpan={3} style={{ ...tdStyle, textAlign: 'left', fontWeight: 700, color: '#2C4A6E' }}>
                      Moy. classe
                    </td>
                    {report.subjects.map(sub => (
                      <td key={sub.classSubjectId} style={{ ...tdStyle, fontWeight: 600, color: '#2C4A6E' }}>
                        {fmt(report.subjectAvgs[sub.classSubjectId], 1)}
                      </td>
                    ))}
                    <td style={{ ...tdStyle, fontWeight: 700, color: '#2C4A6E' }}>
                      {report.classAverage.toFixed(2)}
                    </td>
                    <td style={{ ...tdStyle, fontSize: '10px', color: '#5A7085' }}>
                      {Math.round((report.passed / (report.evaluated || 1)) * 100)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Légende */}
            <div style={{ marginTop: '12px', fontSize: '10px', color: '#78756F', borderTop: '1px solid #E8E6E3', paddingTop: '10px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <span>Seuil de réussite : ≥ 7,00/10</span>
              <span>Formule BR-001 : 70% R1 + 25% R2 + 5% R3</span>
              <span>Score par matière = somme des sous-matières</span>
            </div>
          </div>

          {/* Bouton génération */}
          <Button
            size="lg"
            onClick={generatePDF}
            disabled={isArchived || generating}
            style={{
              backgroundColor: isArchived || generating ? '#9CA3AF' : '#2C4A6E',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '8px',
              padding: '10px 24px',
            }}
          >
            <FileTextIcon className="mr-2 h-5 w-5" />
            {generating ? 'Génération...' : 'Générer le rapport PDF 8½×14'}
          </Button>
        </>
      )}

      {!report && !loadingReport && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E8E6E3', padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: '15px', fontWeight: 500, color: '#78756F' }}>
            Sélectionnez une classe et une étape pour générer le rapport
          </p>
        </div>
      )}
    </div>
  )
}