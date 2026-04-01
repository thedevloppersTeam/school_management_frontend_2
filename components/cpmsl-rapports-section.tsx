// components/school/cpmsl-rapports-section.tsx
"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileTextIcon } from "lucide-react"
import { toast } from "sonner"
import { reportsApi, academicYearsApi, classSessionsApi, enrollmentsApi, gradesApi, classSubjectsApi } from "@/services/api"
import type { AcademicStep, ClassSession, Enrollment, Grade, ClassSubject } from "@/types"
import { parseDecimal } from "@/lib/decimal"

interface CPMSLRapportsSectionProps {
  academicYearId: string
  isArchived?: boolean
}

export function CPMSLRapportsSection({ academicYearId, isArchived = false }: CPMSLRapportsSectionProps) {
  const [loading, setLoading] = useState(true)
  const [steps, setSteps] = useState<AcademicStep[]>([])
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [allEnrollments, setAllEnrollments] = useState<Enrollment[]>([])
  const [allGrades, setAllGrades] = useState<Grade[]>([])
  const [allClassSubjects, setAllClassSubjects] = useState<ClassSubject[]>([])
  const [selectedSession, setSelectedSession] = useState<string>("")
  const [selectedStep, setSelectedStep] = useState<string>("")
  const [currentPage, setCurrentPage] = useState(1)
  const [generating, setGenerating] = useState(false)

  // Charger les données initiales
  useEffect(() => {
    async function fetchData() {
      try {
        const [stepsData, sessionsData] = await Promise.all([
          academicYearsApi.getSteps(academicYearId).catch(() => []),
          classSessionsApi.getAll({ academicYearId }).catch(() => []),
        ])
        setSteps(stepsData)
        setSessions(sessionsData)
        
        if (sessionsData.length > 0) setSelectedSession(sessionsData[0].id)
        if (stepsData.length > 0) setSelectedStep(stepsData[0].id)
        
        // Charger toutes les inscriptions et matières
        const enrollmentsData: Enrollment[] = []
        const classSubjectsData: ClassSubject[] = []
        
        for (const session of sessionsData) {
          const enrs = await enrollmentsApi.getAll({ classSessionId: session.id }).catch(() => [])
          enrollmentsData.push(...enrs)
          
          const subjects = await classSubjectsApi.getAll({ classSessionId: session.id }).catch(() => [])
          classSubjectsData.push(...subjects)
        }
        
        setAllEnrollments(enrollmentsData)
        setAllClassSubjects(classSubjectsData)
        
        // Charger toutes les notes
        const gradesData: Grade[] = []
        for (const step of stepsData) {
          for (const subject of classSubjectsData) {
            try {
              const grades = await gradesApi.getByClassSubjectAndStep(subject.id, step.id)
              gradesData.push(...grades)
            } catch (error) {
              // Ignorer
            }
          }
        }
        setAllGrades(gradesData)
        
      } catch (error) {
        console.error("Error fetching data:", error)
        toast.error("Erreur lors du chargement des données")
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [academicYearId])

  const classEnrollments = useMemo(() => {
    if (!selectedSession) return []
    return allEnrollments.filter(e => e.classSessionId === selectedSession)
      .sort((a, b) => {
        const nameA = `${a.student?.user?.lastname || ""} ${a.student?.user?.firstname || ""}`
        const nameB = `${b.student?.user?.lastname || ""} ${b.student?.user?.firstname || ""}`
        return nameA.localeCompare(nameB)
      })
  }, [selectedSession, allEnrollments])

  const selectedSessionObj = sessions.find(s => s.id === selectedSession)
  const sessionDisplayName = selectedSessionObj ? `${selectedSessionObj.class?.classType?.name || ""} ${selectedSessionObj.class?.letter || ""}` : ""
  const selectedStepName = steps.find(s => s.id === selectedStep)?.name || ""

  const reportStats = useMemo(() => {
    if (!selectedStep || classEnrollments.length === 0) return null

    const studentGrades = classEnrollments.map(enr => {
      const grades = allGrades.filter(g => g.enrollmentId === enr.id && g.stepId === selectedStep)
      if (grades.length === 0) return { enrollment: enr, average: null, status: "Incomplet" as const }

      // Calculer la moyenne pondérée
      let totalWeightedScore = 0
      let totalCoefficient = 0
      
      for (const grade of grades) {
        const classSubject = allClassSubjects.find(cs => cs.id === grade.classSubjectId)
        if (classSubject) {
          const maxScore = parseDecimal(classSubject.subject?.maxScore) || 20
          const coefficient = parseDecimal(classSubject.coefficientOverride ?? classSubject.subject?.coefficient) || 1
          const studentScore = parseDecimal(grade.studentScore) || 0
          const normalizedScore = studentScore * (10 / maxScore)
          totalWeightedScore += normalizedScore * coefficient
          totalCoefficient += coefficient
        }
      }
      
      const average = totalCoefficient > 0 ? totalWeightedScore / totalCoefficient : null
      
      return {
        enrollment: enr,
        average,
        status: average !== null ? (average >= 7 ? ("Réussi" as const) : ("Échec" as const)) : "Incomplet" as const,
      }
    })

    const validAverages = studentGrades.filter(sg => sg.average !== null).map(sg => sg.average!)
    const passed = studentGrades.filter(sg => sg.status === "Réussi").length
    const failed = studentGrades.filter(sg => sg.status === "Échec").length
    const classAverage = validAverages.length > 0 ? validAverages.reduce((s, v) => s + v, 0) / validAverages.length : 0

    const sortedAvg = [...validAverages].sort((a, b) => a - b)
    const median = sortedAvg.length > 0
      ? sortedAvg.length % 2 === 0
        ? (sortedAvg[sortedAvg.length / 2 - 1] + sortedAvg[sortedAvg.length / 2]) / 2
        : sortedAvg[Math.floor(sortedAvg.length / 2)]
      : 0
    const min = sortedAvg.length > 0 ? sortedAvg[0] : 0
    const max = sortedAvg.length > 0 ? sortedAvg[sortedAvg.length - 1] : 0

    return { enrolled: classEnrollments.length, evaluated: validAverages.length, passed, failed, classAverage, median, min, max, studentGrades }
  }, [selectedStep, classEnrollments, allGrades, allClassSubjects])

  const handleGenerateReport = async () => {
    if (!selectedSession || !selectedStep) {
      toast.error("Veuillez sélectionner une classe et une étape")
      return
    }
    
    setGenerating(true)
    try {
      const blob = await reportsApi.generateClassReport(selectedSession, selectedStep)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rapport_${sessionDisplayName}_${selectedStepName}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Rapport généré avec succès")
    } catch (error) {
      console.error("Error generating report:", error)
      toast.error("Erreur lors de la génération du rapport")
    } finally {
      setGenerating(false)
    }
  }

  const itemsPerPage = 25
  const totalPages = reportStats ? Math.ceil(reportStats.studentGrades.length / itemsPerPage) : 0
  const paginatedStudents = reportStats ? reportStats.studentGrades.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) : []

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Selectors */}
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: "10px", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <div style={{ padding: "24px", borderBottom: "1px solid #E8E6E3" }}>
          <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "15px", fontWeight: 600, color: "#3A4A57" }}>
            Sélection de la classe et de l&apos;étape
          </h3>
        </div>
        <div style={{ padding: "24px" }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label style={{ fontSize: "12px", fontWeight: 500, color: "#1E1A17", display: "block", marginBottom: "8px", textTransform: "uppercase" }}>Classe</label>
              <Select value={selectedSession} onValueChange={(v) => { setSelectedSession(v); setCurrentPage(1) }}>
                <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }} data-testid="rapports-class-select">
                  <SelectValue placeholder="Sélectionner une classe" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map(s => (<SelectItem key={s.id} value={s.id}>{s.class?.classType?.name || ""} {s.class?.letter || s.id.slice(0, 6)}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 500, color: "#1E1A17", display: "block", marginBottom: "8px", textTransform: "uppercase" }}>Étape</label>
              <Select value={selectedStep} onValueChange={setSelectedStep}>
                <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }} data-testid="rapports-step-select">
                  <SelectValue placeholder="Sélectionner une étape" />
                </SelectTrigger>
                <SelectContent>
                  {steps.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Report Stats */}
      {selectedSession && selectedStep && reportStats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {[
              { label: "Élèves inscrits", value: reportStats.enrolled },
              { label: "Élèves évalués", value: reportStats.evaluated },
              { label: "Réussites", value: reportStats.passed },
              { label: "Échecs", value: reportStats.failed },
              { label: "Moyenne classe", value: `${reportStats.classAverage.toFixed(2)} / 10` },
              { label: "Médiane", value: `${reportStats.median.toFixed(2)} / 10` },
              { label: "Min / Max", value: `${reportStats.min.toFixed(2)} / ${reportStats.max.toFixed(2)}` },
            ].map(kpi => (
              <div key={kpi.label} style={{ backgroundColor: "#FFFFFF", borderRadius: "10px", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", padding: "16px" }}>
                <p style={{ fontSize: "12px", fontWeight: 500, textTransform: "uppercase", color: "hsl(var(--muted-foreground))", marginBottom: "8px" }}>{kpi.label}</p>
                <p style={{ fontFamily: "var(--font-serif)", fontSize: "24px", fontWeight: 700, color: "#2A3740" }}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Students Table */}
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: "10px", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ padding: "24px", borderBottom: "1px solid #E8E6E3" }}>
              <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "15px", fontWeight: 600, color: "#3A4A57", marginBottom: "4px" }}>Résultats par élève</h3>
              <p style={{ fontSize: "13px", fontWeight: 400, color: "hsl(var(--muted-foreground))", marginBottom: "8px" }}>{sessionDisplayName} — {selectedStepName}</p>
              <p style={{ fontSize: "13px", fontWeight: 400, color: "hsl(var(--muted-foreground))" }}>Seuil de réussite : ≥ 7.00 / 10</p>
            </div>
            <div style={{ padding: "24px" }}>
              <div className="overflow-hidden" style={{ borderRadius: "8px", border: "1px solid #E8E6E3" }}>
                <Table>
                  <TableHeader>
                    <TableRow style={{ backgroundColor: "#F1F5F9", borderBottom: "2px solid #D1D5DB" }}>
                      <TableHead style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2C4A6E" }}>NOM</TableHead>
                      <TableHead style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2C4A6E" }}>PRÉNOM</TableHead>
                      <TableHead style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2C4A6E", textAlign: "right" }}>MOYENNE FINALE</TableHead>
                      <TableHead style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2C4A6E" }}>STATUT</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedStudents.map(({ enrollment, average, status }) => {
                      const user = enrollment.student?.user
                      const averageValue = average !== null ? average.toFixed(2) : "—"
                      return (
                        <TableRow key={enrollment.id} style={{ borderBottom: "1px solid #E8E6E3" }} className="hover:bg-[#FAF8F3] transition-colors">
                          <TableCell style={{ fontSize: "14px", fontWeight: 600, color: "#1E1A17" }}>{user?.lastname || ""}</TableCell>
                          <TableCell style={{ fontSize: "14px", fontWeight: 400, color: "#1E1A17" }}>{user?.firstname || ""}</TableCell>
                          <TableCell style={{ fontSize: "14px", fontWeight: 700, color: "#1E1A17", textAlign: "right" }}>{averageValue}</TableCell>
                          <TableCell>
                            {status === "Réussi" && <Badge style={{ backgroundColor: "#E8F5EC", color: "#2D7D46", border: "none", fontSize: "12px" }}>Réussi</Badge>}
                            {status === "Échec" && <Badge style={{ backgroundColor: "#FDE8E8", color: "#C43C3C", border: "none", fontSize: "12px" }}>Échec</Badge>}
                            {status === "Incomplet" && <Badge style={{ backgroundColor: "#FEF6E0", color: "#C48B1A", border: "none", fontSize: "12px" }}>Incomplet</Badge>}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {reportStats.studentGrades.length > itemsPerPage && (
                <div className="flex items-center justify-center gap-4 pt-4 mt-4" style={{ borderTop: "1px solid #E8E6E3" }}>
                  <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={{ borderColor: "#D1CECC" }}>← Précédent</Button>
                  <span style={{ color: "#78756F", fontSize: "14px" }}>Page {currentPage} sur {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} style={{ borderColor: "#D1CECC" }}>Suivant →</Button>
                </div>
              )}
            </div>
          </div>

          {/* Generate Button */}
          <Button 
            size="lg" 
            disabled={isArchived || generating} 
            onClick={handleGenerateReport}
            style={{ 
              backgroundColor: (isArchived || generating) ? "#9CA3AF" : "#2C4A6E", 
              color: "#FFFFFF", 
              fontSize: "14px", 
              fontWeight: 600, 
              borderRadius: "8px", 
              padding: "10px 24px" 
            }} 
            data-testid="generate-rapport-btn"
          >
            {generating ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Génération en cours...
              </div>
            ) : (
              <>
                <FileTextIcon className="mr-2 h-5 w-5" />
                Générer le rapport PDF 8½×14
              </>
            )}
          </Button>
        </>
      )}

      {/* Empty State */}
      {(!selectedSession || !selectedStep) && (
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: "10px", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", padding: "48px 24px" }}>
          <div className="flex flex-col items-center justify-center">
            <p style={{ fontFamily: "var(--font-serif)", fontSize: "16px", fontWeight: 600, color: "hsl(var(--muted-foreground))", textAlign: "center" }}>
              Sélectionnez une classe et une étape pour voir le rapport
            </p>
          </div>
        </div>
      )}
    </div>
  )
}