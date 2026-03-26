"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FileTextIcon, AlertCircleIcon, UsersIcon, TrendingUpIcon, TrendingDownIcon } from "lucide-react"
import { 
  type Level,
  type Student,
  type Period,
  type Grade,
  type SubjectParent,
  type SubjectChild,
} from "@/lib/data/school-data"

interface CPMSLRapportsSectionProps {
  levels: Level[]
  students: Student[]
  periods: Period[]
  subjectParents: SubjectParent[]
  subjectChildren: SubjectChild[]
  grades: Grade[]
  isArchived?: boolean
}

export function CPMSLRapportsSection({
  levels,
  students,
  periods,
  subjectParents,
  subjectChildren,
  grades,
  isArchived = false,
}: CPMSLRapportsSectionProps) {
  const [reportLevel, setReportLevel] = useState<string>("")
  const [reportSubdivision, setReportSubdivision] = useState<string>("")
  const [reportPeriod, setReportPeriod] = useState<string>("")
  const [currentPage, setCurrentPage] = useState(1)

  // Extract unique levels and subdivisions
  const uniqueLevels = useMemo(() => {
    const levelMap = new Map<string, { name: string; subdivisions: string[] }>()
    
    levels.forEach(level => {
      const match = level.name.match(/^(\d+e|NSI+)\s*([A-Z]+)?$/)
      if (match) {
        const [, levelName, subdivision] = match
        if (!levelMap.has(levelName)) {
          levelMap.set(levelName, { name: levelName, subdivisions: [] })
        }
        if (subdivision) {
          const existing = levelMap.get(levelName)!
          if (!existing.subdivisions.includes(subdivision)) {
            existing.subdivisions.push(subdivision)
          }
        }
      }
    })
    
    return Array.from(levelMap.entries()).map(([name, data]) => ({
      name,
      subdivisions: data.subdivisions.sort()
    }))
  }, [levels])

  // Get closed periods only
  const closedPeriods = periods.filter(p => p.status === 'closed')

  // Get subdivisions for selected level
  const reportAvailableSubdivisions = useMemo(() => {
    const level = uniqueLevels.find(l => l.name === reportLevel)
    return level?.subdivisions || []
  }, [reportLevel, uniqueLevels])

  // Get full level name
  const getFullLevelName = (levelName: string, subdivision?: string) => {
    return subdivision ? `${levelName} ${subdivision}` : levelName
  }

  // Get students for selected class
  const reportLevelObj = levels.find(l => 
    l.name === getFullLevelName(reportLevel, reportSubdivision)
  )
  const reportClassStudents = students.filter(s => s.levelId === reportLevelObj?.id)

  // Calculate report statistics
  const reportStats = useMemo(() => {
    if (!reportPeriod || reportClassStudents.length === 0) {
      return null
    }

    const studentGrades = reportClassStudents.map(student => {
      const studentGradeRecords = grades.filter(
        g => g.studentId === student.id && g.periodId === reportPeriod
      )
      
      if (studentGradeRecords.length === 0) {
        return { 
          student, 
          average: null, 
          avgR1: null,
          avgR2: null,
          avgR3: null,
          status: 'Incomplet' as const 
        }
      }

      // Calculate averages by rubrique
      const gradesByRubrique = {
        R1: studentGradeRecords.filter(g => {
          const childSubject = subjectChildren.find(sc => sc.id === g.subjectId)
          if (childSubject) {
            const parent = subjectParents.find(sp => sp.id === childSubject.parentId)
            return parent?.rubrique === 'R1'
          }
          return false
        }),
        R2: studentGradeRecords.filter(g => {
          const childSubject = subjectChildren.find(sc => sc.id === g.subjectId)
          if (childSubject) {
            const parent = subjectParents.find(sp => sp.id === childSubject.parentId)
            return parent?.rubrique === 'R2'
          }
          return false
        }),
        R3: studentGradeRecords.filter(g => {
          const childSubject = subjectChildren.find(sc => sc.id === g.subjectId)
          if (childSubject) {
            const parent = subjectParents.find(sp => sp.id === childSubject.parentId)
            return parent?.rubrique === 'R3'
          }
          return false
        })
      }

      const avgR1 = gradesByRubrique.R1.length > 0
        ? gradesByRubrique.R1.reduce((sum, g) => sum + g.value, 0) / gradesByRubrique.R1.length
        : null
      
      const avgR2 = gradesByRubrique.R2.length > 0
        ? gradesByRubrique.R2.reduce((sum, g) => sum + g.value, 0) / gradesByRubrique.R2.length
        : null
      
      const avgR3 = gradesByRubrique.R3.length > 0
        ? gradesByRubrique.R3.reduce((sum, g) => sum + g.value, 0) / gradesByRubrique.R3.length
        : null

      // Calculate final average: 70% R1 + 25% R2 + 5% R3
      let average: number | null = null
      if (avgR1 !== null || avgR2 !== null || avgR3 !== null) {
        average = (avgR1 || 0) * 0.7 + (avgR2 || 0) * 0.25 + (avgR3 || 0) * 0.05
      }

      return {
        student,
        average,
        avgR1,
        avgR2,
        avgR3,
        status: average !== null && average >= 7 ? 'Réussi' as const : average !== null ? 'Échec' as const : 'Incomplet' as const
      }
    })

    const validAverages = studentGrades.filter(sg => sg.average !== null).map(sg => sg.average!)
    const passed = studentGrades.filter(sg => sg.status === 'Réussi').length
    const failed = studentGrades.filter(sg => sg.status === 'Échec').length

    const classAverage = validAverages.length > 0
      ? validAverages.reduce((sum, avg) => sum + avg, 0) / validAverages.length
      : 0

    const sortedAverages = [...validAverages].sort((a, b) => a - b)
    const median = sortedAverages.length > 0
      ? sortedAverages.length % 2 === 0
        ? (sortedAverages[sortedAverages.length / 2 - 1] + sortedAverages[sortedAverages.length / 2]) / 2
        : sortedAverages[Math.floor(sortedAverages.length / 2)]
      : 0

    const min = sortedAverages.length > 0 ? sortedAverages[0] : 0
    const max = sortedAverages.length > 0 ? sortedAverages[sortedAverages.length - 1] : 0

    return {
      enrolled: reportClassStudents.length,
      evaluated: validAverages.length,
      passed,
      failed,
      classAverage,
      median,
      min,
      max,
      studentGrades
    }
  }, [reportPeriod, reportClassStudents, grades, subjectParents, subjectChildren])

  // Pagination
  const itemsPerPage = 25
  const totalPages = reportStats ? Math.ceil(reportStats.studentGrades.length / itemsPerPage) : 0
  const paginatedStudents = reportStats 
    ? reportStats.studentGrades.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : []

  return (
    <div className="space-y-6">
      {/* Selectors */}
      <div
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "10px",
          border: "1px solid #E8E6E3",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ padding: "24px", borderBottom: "1px solid #E8E6E3" }}>
          <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "15px", fontWeight: 600, color: "#3A4A57" }}>
            Sélection de la classe et de l'étape
          </h3>
        </div>
        <div style={{ padding: "24px" }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label-ui" style={{ color: "#1E1A17", display: "block", marginBottom: "8px" }}>
                Classe
              </label>
              <Select value={reportLevel} onValueChange={(value) => {
                setReportLevel(value)
                setReportSubdivision("")
              }}>
                <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }}>
                  <SelectValue placeholder="Sélectionner une classe" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueLevels.map(level => (
                    <SelectItem key={level.name} value={level.name}>
                      {level.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="label-ui" style={{ color: "#1E1A17", display: "block", marginBottom: "8px" }}>
                Salle
              </label>
              <Select 
                value={reportSubdivision} 
                onValueChange={setReportSubdivision}
                disabled={!reportLevel || reportAvailableSubdivisions.length === 0}
              >
                <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }}>
                  <SelectValue placeholder="Sélectionner une salle" />
                </SelectTrigger>
                <SelectContent>
                  {reportAvailableSubdivisions.map(sub => (
                    <SelectItem key={sub} value={sub}>
                      {sub}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="label-ui" style={{ color: "#1E1A17", display: "block", marginBottom: "8px" }}>
                Étape
              </label>
              <Select value={reportPeriod} onValueChange={setReportPeriod}>
                <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }}>
                  <SelectValue placeholder="Sélectionner une étape" />
                </SelectTrigger>
                <SelectContent>
                  {closedPeriods.map(period => (
                    <SelectItem key={period.id} value={period.id}>
                      <div className="flex items-center gap-2">
                        <span>{period.name}</span>
                        <Badge style={{ backgroundColor: "#FEF6E0", color: "#C48B1A", border: "none", fontSize: "11px" }}>
                          Clôturée
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Report Preview */}
      {reportLevel && reportPeriod && reportStats && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "10px",
                border: "1px solid #E8E6E3",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                padding: "16px",
              }}
            >
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 500, textTransform: "uppercase", color: "hsl(var(--muted-foreground))", marginBottom: "8px" }}>
                Élèves inscrits
              </p>
              <p style={{ fontFamily: "var(--font-serif)", fontSize: "24px", fontWeight: 700, color: "#2A3740" }}>
                {reportStats.enrolled}
              </p>
            </div>

            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "10px",
                border: "1px solid #E8E6E3",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                padding: "16px",
              }}
            >
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 500, textTransform: "uppercase", color: "hsl(var(--muted-foreground))", marginBottom: "8px" }}>
                Élèves évalués
              </p>
              <p style={{ fontFamily: "var(--font-serif)", fontSize: "24px", fontWeight: 700, color: "#2A3740" }}>
                {reportStats.evaluated}
              </p>
            </div>

            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "10px",
                border: "1px solid #E8E6E3",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                padding: "16px",
              }}
            >
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 500, textTransform: "uppercase", color: "hsl(var(--muted-foreground))", marginBottom: "8px" }}>
                Réussites
              </p>
              <p style={{ fontFamily: "var(--font-serif)", fontSize: "24px", fontWeight: 700, color: "#2A3740" }}>
                {reportStats.passed}
              </p>
            </div>

            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "10px",
                border: "1px solid #E8E6E3",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                padding: "16px",
              }}
            >
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 500, textTransform: "uppercase", color: "hsl(var(--muted-foreground))", marginBottom: "8px" }}>
                Échecs
              </p>
              <p style={{ fontFamily: "var(--font-serif)", fontSize: "24px", fontWeight: 700, color: "#2A3740" }}>
                {reportStats.failed}
              </p>
            </div>

            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "10px",
                border: "1px solid #E8E6E3",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                padding: "16px",
              }}
            >
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 500, textTransform: "uppercase", color: "hsl(var(--muted-foreground))", marginBottom: "8px" }}>
                Moyenne classe
              </p>
              <p style={{ fontFamily: "var(--font-serif)", fontSize: "24px", fontWeight: 700, color: "#2A3740" }}>
                {reportStats.classAverage.toFixed(2)} / 10
              </p>
            </div>

            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "10px",
                border: "1px solid #E8E6E3",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                padding: "16px",
              }}
            >
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 500, textTransform: "uppercase", color: "hsl(var(--muted-foreground))", marginBottom: "8px" }}>
                Médiane
              </p>
              <p style={{ fontFamily: "var(--font-serif)", fontSize: "24px", fontWeight: 700, color: "#2A3740" }}>
                {reportStats.median.toFixed(2)} / 10
              </p>
            </div>

            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "10px",
                border: "1px solid #E8E6E3",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                padding: "16px",
              }}
            >
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 500, textTransform: "uppercase", color: "hsl(var(--muted-foreground))", marginBottom: "8px" }}>
                Min / Max
              </p>
              <p style={{ fontFamily: "var(--font-serif)", fontSize: "24px", fontWeight: 700, color: "#2A3740" }}>
                {reportStats.min.toFixed(2)} / {reportStats.max.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Students Table */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "10px",
              border: "1px solid #E8E6E3",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ padding: "24px", borderBottom: "1px solid #E8E6E3" }}>
              <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "15px", fontWeight: 600, color: "#3A4A57", marginBottom: "4px" }}>
                Résultats par élève
              </h3>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 400, color: "hsl(var(--muted-foreground))", marginBottom: "8px" }}>
                {getFullLevelName(reportLevel, reportSubdivision)} — {closedPeriods.find(p => p.id === reportPeriod)?.name}
              </p>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 400, color: "hsl(var(--muted-foreground))" }}>
                Seuil de réussite : ≥ 7.00 / 10
              </p>
            </div>
            <div style={{ padding: "24px" }}>
              <div className="overflow-hidden" style={{ borderRadius: "8px", border: "1px solid #E8E6E3" }}>
                <Table>
                  <TableHeader>
                    <TableRow style={{ backgroundColor: "#F1F5F9", borderBottom: "2px solid #D1D5DB" }}>
                      <TableHead style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2C4A6E" }}>NOM</TableHead>
                      <TableHead style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2C4A6E" }}>PRÉNOM</TableHead>
                      <TableHead style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2C4A6E", textAlign: "right" }}>MOY. R1</TableHead>
                      <TableHead style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2C4A6E", textAlign: "right" }}>MOY. R2</TableHead>
                      <TableHead style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2C4A6E", textAlign: "right" }}>MOY. R3</TableHead>
                      <TableHead style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2C4A6E", textAlign: "right" }}>MOYENNE FINALE</TableHead>
                      <TableHead style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2C4A6E" }}>STATUT</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedStudents.map(({ student, average, avgR1, avgR2, avgR3, status }) => (
                      <TableRow 
                        key={student.id}
                        style={{ borderBottom: "1px solid #E8E6E3" }}
                        className="hover:bg-[#FAF8F3] transition-colors"
                      >
                        <TableCell style={{ fontFamily: "var(--font-sans)", fontSize: "14px", fontWeight: 600, color: "#1E1A17" }}>
                          {student.lastName}
                        </TableCell>
                        <TableCell style={{ fontFamily: "var(--font-sans)", fontSize: "14px", fontWeight: 400, color: "#1E1A17" }}>
                          {student.firstName}
                        </TableCell>
                        <TableCell className="body-base" style={{ color: "#1E1A17", textAlign: "right" }}>
                          {avgR1 !== null ? avgR1.toFixed(2) : '—'}
                        </TableCell>
                        <TableCell className="body-base" style={{ color: "#1E1A17", textAlign: "right" }}>
                          {avgR2 !== null ? avgR2.toFixed(2) : '—'}
                        </TableCell>
                        <TableCell className="body-base" style={{ color: "#1E1A17", textAlign: "right" }}>
                          {avgR3 !== null ? avgR3.toFixed(2) : '—'}
                        </TableCell>
                        <TableCell className="body-base" style={{ color: "#1E1A17", textAlign: "right", fontWeight: 700 }}>
                          {average !== null ? average.toFixed(2) : '—'}
                        </TableCell>
                        <TableCell>
                          {status === 'Réussi' && (
                            <Badge style={{ backgroundColor: "#E8F5EC", color: "#2D7D46", border: "none", fontSize: "12px" }}>
                              ✅ Réussi
                            </Badge>
                          )}
                          {status === 'Échec' && (
                            <Badge style={{ backgroundColor: "#FDE8E8", color: "#C43C3C", border: "none", fontSize: "12px" }}>
                              ❌ Échec
                            </Badge>
                          )}
                          {status === 'Incomplet' && (
                            <Badge style={{ backgroundColor: "#FEF6E0", color: "#C48B1A", border: "none", fontSize: "12px" }}>
                              ⏳ Incomplet
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {reportStats.studentGrades.length > itemsPerPage && (
                <div className="flex items-center justify-center gap-4 pt-4 mt-4" style={{ borderTop: "1px solid #E8E6E3" }}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    style={{ borderColor: "#D1CECC" }}
                  >
                    ← Précédent
                  </Button>
                  <span className="body-base" style={{ color: "#78756F" }}>
                    Page {currentPage} sur {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                    style={{ borderColor: "#D1CECC" }}
                  >
                    Suivant →
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Generate Button */}
          <Button 
            size="lg" 
            disabled={isArchived}
            style={{
              backgroundColor: isArchived ? "#9CA3AF" : "#2C4A6E",
              color: "#FFFFFF",
              fontSize: "14px",
              fontWeight: 600,
              borderRadius: "8px",
              padding: "10px 24px"
            }}
          >
            <FileTextIcon className="mr-2 h-5 w-5" />
            Générer le rapport PDF 8½×14
          </Button>
        </>
      )}

      {/* Empty State */}
      {(!reportLevel || !reportPeriod) && (
        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "10px",
            border: "1px solid #E8E6E3",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            padding: "48px 24px",
          }}
        >
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