"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertTriangleIcon, CheckCircleIcon, FileTextIcon, AlertCircleIcon, EyeIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PDFViewerModal } from "@/components/school/pdf-viewer-modal"
import { StatCard } from "@/components/school/stat-card"
import { 
  type Level,
  type Student,
  type Period,
  type SubjectParent,
  type SubjectChild,
  type Grade,
  type Classroom,
  type StudentBehavior,
  type Attitude,
  isStudentGradeComplete,
  calculateStudentEtapeMean,
} from "@/lib/data/school-data"

interface CPMSLBulletinsSectionProps {
  levels: Level[]
  students: Student[]
  periods: Period[]
  subjectParents: SubjectParent[]
  subjectChildren: SubjectChild[]
  grades: Grade[]
  classrooms: Classroom[]
  behaviors?: StudentBehavior[]
  attitudes: Attitude[]
  isArchived?: boolean
  academicYear?: string
}

export function CPMSLBulletinsSection({
  levels,
  students,
  periods,
  subjectParents,
  subjectChildren,
  grades,
  classrooms,
  behaviors = [],
  attitudes,
  isArchived = false,
  academicYear = '',
}: CPMSLBulletinsSectionProps) {
  const [selectedLevel, setSelectedLevel] = useState<string>("")
  const [selectedSubdivision, setSelectedSubdivision] = useState<string>("")
  const [selectedPeriod, setSelectedPeriod] = useState<string>("")
  const [showWarningModal, setShowWarningModal] = useState(false)
  const [showGeneratedModal, setShowGeneratedModal] = useState(false)
  const [generatedReports, setGeneratedReports] = useState<string[]>([])
  const [showPDFViewerModal, setShowPDFViewerModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  // Extract unique levels from classrooms
  const uniqueLevels = useMemo(() => {
    const levelMap = new Map<string, { id: string; name: string; classrooms: Classroom[] }>()
    
    levels.forEach(level => {
      if (!levelMap.has(level.id)) {
        levelMap.set(level.id, { id: level.id, name: level.name, classrooms: [] })
      }
    })
    
    classrooms.forEach(classroom => {
      const levelData = levelMap.get(classroom.levelId)
      if (levelData) {
        levelData.classrooms.push(classroom)
      }
    })
    
    return Array.from(levelMap.values())
      .filter(level => level.classrooms.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [levels, classrooms])

  // Get closed periods only
  const closedPeriods = periods.filter(p => p.status === 'closed')

  // Get classrooms for selected level
  const availableClassrooms = useMemo(() => {
    const level = uniqueLevels.find(l => l.id === selectedLevel)
    return level?.classrooms || []
  }, [selectedLevel, uniqueLevels])

  // Get selected level and classroom objects
  const selectedLevelObj = levels.find(l => l.id === selectedLevel)
  const selectedClassroomObj = classrooms.find(c => c.id === selectedSubdivision)
  
  // Get students for selected classroom
  const classStudents = students.filter(s => s.classroomId === selectedSubdivision)

  // Validate NISU: must be exactly 12 digits
  const isValidNISU = (nisu: string | undefined) => {
    if (!nisu) return false
    const trimmed = nisu.trim()
    return /^\d{12}$/.test(trimmed)
  }

  // Calculate KPIs
  const studentsWithNISU = classStudents.filter(s => isValidNISU(s.nisu))
  const studentsWithoutNISU = classStudents.filter(s => !isValidNISU(s.nisu))
  const studentsWithGeneratedReports = classStudents.filter(s => generatedReports.includes(s.id))

  // Ensure attitudes is an array
  const safeAttitudes = attitudes || []

  // Get selected period object
  const selectedPeriodObj = periods.find(p => p.id === selectedPeriod)
  const isBlancExam = selectedPeriodObj?.isBlancExam || false

  // Calculate grade completion stats
  const getStudentGradeCompletion = (studentId: string) => {
    if (!selectedPeriod || !selectedLevelObj) return { complete: false, total: 0, entered: 0 }
    
    const student = students.find(s => s.id === studentId)
    if (!student) return { complete: false, total: 0, entered: 0 }

    const complete = isStudentGradeComplete(
      studentId,
      student.levelId,
      selectedPeriod,
      grades,
      subjectParents,
      subjectChildren,
      isBlancExam
    )

    // Count required subjects for this level
    const levelSubjectParents = subjectParents.filter(sp => sp.levelIds.includes(student.levelId))
    let total = 0
    let entered = 0

    if (isBlancExam) {
      total = levelSubjectParents.length
      entered = levelSubjectParents.filter(parent => {
        const grade = grades.find(
          g => g.studentId === studentId && g.subjectId === parent.id && g.periodId === selectedPeriod
        )
        return grade !== undefined && grade.value !== null
      }).length
    } else {
      const requiredChildren = subjectChildren.filter(sc => {
        const parent = levelSubjectParents.find(sp => sp.id === sc.parentId)
        return parent !== undefined
      })
      total = requiredChildren.length
      entered = requiredChildren.filter(child => {
        const grade = grades.find(
          g => g.studentId === studentId && g.subjectId === child.id && g.periodId === selectedPeriod
        )
        return grade !== undefined && grade.value !== null
      }).length
    }
    
    return { complete, total, entered }
  }

  const studentsWithCompleteGrades = classStudents.filter(s => getStudentGradeCompletion(s.id).complete)
  const studentsWithMissingGrades = classStudents.filter(s => !getStudentGradeCompletion(s.id).complete)

  // Handle report generation
  const handleGenerateReports = () => {
    if (studentsWithoutNISU.length > 0) {
      setShowWarningModal(true)
    } else {
      generateReports()
    }
  }

  const generateReports = () => {
    const validStudentIds = studentsWithNISU.map(s => s.id)
    setGeneratedReports(validStudentIds)
    setShowWarningModal(false)
    setShowGeneratedModal(true)
  }

  const handleDownloadPDF = () => {
    console.log('Download PDF for:', selectedLevel, selectedSubdivision, selectedPeriod)
  }

  // Pagination
  const itemsPerPage = 25
  const totalPages = Math.ceil(classStudents.length / itemsPerPage)
  const paginatedStudents = classStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

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
                Étape
              </label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
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

            <div>
              <label className="label-ui" style={{ color: "#1E1A17", display: "block", marginBottom: "8px" }}>
                Classe
              </label>
              <Select value={selectedLevel} onValueChange={(value) => {
                setSelectedLevel(value)
                setSelectedSubdivision("")
              }}>
                <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }}>
                  <SelectValue placeholder="Sélectionner une classe" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueLevels.map(level => (
                    <SelectItem key={level.id} value={level.id}>
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
                value={selectedSubdivision} 
                onValueChange={setSelectedSubdivision}
                disabled={!selectedLevel || availableClassrooms.length === 0}
              >
                <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }}>
                  <SelectValue placeholder="Sélectionner une salle" />
                </SelectTrigger>
                <SelectContent>
                  {availableClassrooms.map(classroom => (
                    <SelectItem key={classroom.id} value={classroom.id}>
                      {classroom.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      {selectedLevel && selectedPeriod && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Élèves dans la classe"
              value={classStudents.length}
              icon={AlertCircleIcon}

              iconBgColor="#F0F4F7"
              iconColor="#5A7085"
            />
            <StatCard
              label="Notes complètes"
              value={studentsWithCompleteGrades.length}
              icon={CheckCircleIcon}

              iconBgColor="#E8F5EC"
              iconColor="#2D7D46"
            />
            <StatCard
              label="Notes manquantes"
              value={studentsWithMissingGrades.length}
              icon={AlertTriangleIcon}

              iconBgColor="#FEF6E0"
              iconColor="#C48B1A"
            />
            <StatCard
              label="Bulletins générés"
              value={studentsWithGeneratedReports.length}
              icon={FileTextIcon}

              iconBgColor="#E3EFF9"
              iconColor="#2B6CB0"
            />
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
              <h3 style={{ color: "#3A4A57", fontSize: "18px", fontWeight: 600, marginBottom: "4px" }}>
                Liste des élèves
              </h3>
              <p style={{ color: "#78756F", fontSize: "14px" }}>
                {selectedLevelObj?.name} {selectedClassroomObj?.name} — {closedPeriods.find(p => p.id === selectedPeriod)?.name}
              </p>
            </div>
            <div style={{ padding: "24px" }}>
              <div className="overflow-hidden" style={{ borderRadius: "8px", border: "1px solid #E8E6E3" }}>
                <Table>
                  <TableHeader>
                    <TableRow style={{ backgroundColor: "#F1F5F9", borderBottom: "2px solid #D1D5DB" }}>
                      <TableHead style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2C4A6E" }}>Photo</TableHead>
                      <TableHead style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2C4A6E" }}>Nom</TableHead>
                      <TableHead style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2C4A6E" }}>Prénom</TableHead>
                      <TableHead style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2C4A6E" }}>NISU</TableHead>
                      <TableHead style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2C4A6E" }}>Moyenne /10</TableHead>
                      <TableHead style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2C4A6E" }}>Résultat</TableHead>
                      <TableHead style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2C4A6E" }}>Statut bulletin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="body-base" style={{ textAlign: "center", color: "#78756F", padding: "32px" }}>
                          Aucun élève dans cette classe
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedStudents.map(student => {
                        const hasReport = generatedReports.includes(student.id)
                        const validNISU = isValidNISU(student.nisu)
                        
                        // Calculate student average
                        // Get filière from classroom name for Nouveau Secondaire levels
                        const studentClassroom = classrooms.find(c => c.id === student.classroomId)
                        const studentLevel = levels.find(l => l.id === student.levelId)
                        
                        // Determine filiereId based on niveau
                        // For Nouveau Secondaire: use classroom name as filiereId if subjects have filière-specific coefficients
                        // Otherwise use null (tronc commun)
                        let filiereId: string | null = null
                        
                        if (studentLevel?.niveau === 'Nouveau Secondaire' && studentClassroom) {
                          // Check if any subject parent for this level has filière-specific coefficients
                          const levelSubjectParents = subjectParents.filter(sp => sp.levelIds.includes(student.levelId))
                          const hasFiliereCoefficients = levelSubjectParents.some(sp => 
                            sp.coefficients && Array.isArray(sp.coefficients) && sp.coefficients.length > 0 && sp.coefficients.some(c => c.filiereId !== null)
                          )
                          filiereId = hasFiliereCoefficients ? studentClassroom.name : null
                        }
                        
                        const moyEtape = selectedPeriod ? calculateStudentEtapeMean(
                          student.id,
                          selectedPeriod,
                          student.levelId,
                          filiereId,
                          grades,
                          subjectParents,
                          subjectChildren,
                          isBlancExam
                        ) : null

                        const isReussi = moyEtape !== null && moyEtape >= 7.0
                        
                        return (
                          <TableRow 
                            key={student.id}
                            style={{ borderBottom: "1px solid #E8E6E3" }}
                            className="hover:bg-[#FAF8F3] transition-colors"
                          >
                            <TableCell>
                              <Avatar className="h-8 w-8" style={{ borderRadius: "50%" }}>
                                <AvatarImage src={student.avatar} />
                                <AvatarFallback style={{ backgroundColor: "#F0F4F7", color: "#5A7085", fontSize: "12px" }}>
                                  {student.firstName[0]}{student.lastName[0]}
                                </AvatarFallback>
                              </Avatar>
                            </TableCell>
                            <TableCell className="body-base" style={{ color: "#1E1A17", fontWeight: 600 }}>
                              {student.lastName}
                            </TableCell>
                            <TableCell className="body-base" style={{ color: "#1E1A17", fontWeight: 400 }}>
                              {student.firstName}
                            </TableCell>
                            <TableCell className="caption" style={{ fontFamily: "monospace", color: "#1E1A17" }}>
                              {student.nisu || <span style={{ color: "#A8A5A2" }}>—</span>}
                            </TableCell>
                            <TableCell className="body-base" style={{ color: "#1E1A17", fontWeight: 600, textAlign: "center" }}>
                              {moyEtape !== null ? moyEtape.toFixed(2) : <span style={{ color: "#A8A5A2" }}>—</span>}
                            </TableCell>
                            <TableCell>
                              {moyEtape !== null ? (
                                isReussi ? (
                                  <Badge style={{ backgroundColor: "#E8F5EC", color: "#2D7D46", border: "none", fontSize: "12px" }}>
                                    Réussi
                                  </Badge>
                                ) : (
                                  <Badge style={{ backgroundColor: "#FDE8E8", color: "#C43C3C", border: "none", fontSize: "12px" }}>
                                    Échoué
                                  </Badge>
                                )
                              ) : (
                                <Badge style={{ backgroundColor: "#F5F4F2", color: "#78756F", border: "none", fontSize: "12px" }}>
                                  Incomplet
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {hasReport ? (
                                <Badge style={{ backgroundColor: "#E3EFF9", color: "#2B6CB0", border: "none", fontSize: "12px" }}>
                                  Généré v1
                                </Badge>
                              ) : (
                                <Badge style={{ backgroundColor: "#F5F4F2", color: "#78756F", border: "none", fontSize: "12px" }}>
                                  Non généré
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {classStudents.length > itemsPerPage && (
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

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              size="lg"
              disabled={!selectedLevel || !selectedPeriod || classStudents.length === 0 || isArchived || studentsWithGeneratedReports.length > 0}
              onClick={handleGenerateReports}
              style={{
                backgroundColor: studentsWithGeneratedReports.length > 0 || isArchived ? "#9CA3AF" : "#2C4A6E",
                color: "#FFFFFF",
                fontSize: "14px",
                fontWeight: 600,
                borderRadius: "8px",
                padding: "10px 24px",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <FileTextIcon className="h-4 w-4" />
              Générer les bulletins
            </Button>

            {studentsWithGeneratedReports.length > 0 && (
              <Button
                size="lg"
                variant="outline"
                onClick={() => setShowPDFViewerModal(true)}
                style={{ borderColor: "#B3C7D5", color: "#5A7085" }}
              >
                <EyeIcon className="mr-2 h-5 w-5" />
                Voir les bulletins
              </Button>
            )}
          </div>
        </>
      )}

      {/* Empty State */}
      {(!selectedLevel || !selectedPeriod) && (
        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "10px",
            border: "1px solid #E8E6E3",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            padding: "48px 24px",
          }}
        >
          <div className="flex flex-col items-center justify-center text-center">
            <p style={{ fontFamily: "var(--font-serif)", fontSize: "16px", fontWeight: 600, color: "hsl(var(--muted-foreground))", textAlign: "center" }}>
              Choisissez une classe, une salle et une étape pour commencer la génération des bulletins
            </p>
          </div>
        </div>
      )}

      {/* Warning Modal - Students without NISU */}
      <Dialog open={showWarningModal} onOpenChange={setShowWarningModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangleIcon style={{ color: "#C48B1A", width: "20px", height: "20px" }} />
              <span style={{ color: "#2A3740" }}>Élèves sans NISU</span>
            </DialogTitle>
            <DialogDescription style={{ color: "#5C5955" }}>
              {studentsWithoutNISU.length} élève{studentsWithoutNISU.length > 1 ? 's' : ''} sans NISU valide {studentsWithoutNISU.length > 1 ? 'seront exclus' : 'sera exclu'} de la génération. Continuer quand même ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWarningModal(false)} style={{ borderColor: "#D1CECC" }}>
              Annuler
            </Button>
            <Button onClick={generateReports} style={{ backgroundColor: "#5A7085", color: "#FFFFFF" }}>
              Continuer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Modal - Reports Generated */}
      <Dialog open={showGeneratedModal} onOpenChange={setShowGeneratedModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircleIcon style={{ color: "#2D7D46", width: "20px", height: "20px" }} />
              <span style={{ color: "#2A3740" }}>Bulletins générés avec succès</span>
            </DialogTitle>
            <DialogDescription style={{ color: "#5C5955" }}>
              {studentsWithGeneratedReports.length} bulletin{studentsWithGeneratedReports.length > 1 ? 's ont' : ' a'} été généré{studentsWithGeneratedReports.length > 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button 
              onClick={() => {
                setShowGeneratedModal(false)
                setShowPDFViewerModal(true)
              }}
              style={{ backgroundColor: "#5A7085", color: "#FFFFFF" }}
            >
              <EyeIcon className="mr-2 h-4 w-4" />
              Voir les bulletins
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                handleDownloadPDF()
                setShowGeneratedModal(false)
              }}
              style={{ borderColor: "#D1CECC" }}
            >
              Télécharger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Viewer Modal */}
      {studentsWithGeneratedReports.length > 0 && selectedLevelObj && selectedPeriod && (
        <PDFViewerModal
          open={showPDFViewerModal}
          onOpenChange={setShowPDFViewerModal}
          students={studentsWithNISU}
          level={selectedLevelObj}
          period={periods.find(p => p.id === selectedPeriod)}
          subjectParents={subjectParents}
          subjectChildren={subjectChildren}
          grades={grades.filter(g => g.periodId === selectedPeriod)}
          behaviors={behaviors.filter(b => b.periodId === selectedPeriod)}
          attitudes={safeAttitudes}
          academicYear={academicYear}
          onDownload={handleDownloadPDF}
        />
      )}
    </div>
  )
}