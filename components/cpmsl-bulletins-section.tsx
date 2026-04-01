// components/school/cpmsl-bulletins-section.tsx
"use client"

import { useState, useMemo, useEffect } from "react"
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
import { AlertTriangleIcon, CheckCircleIcon, FileTextIcon, AlertCircleIcon, EyeIcon, DownloadIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import { 
  academicYearsApi,
  classSessionsApi,
  classSubjectsApi,
  enrollmentsApi,
  gradesApi,
  studentsApi
} from "@/services/api"
import type { AcademicStep, ClassSession, ClassSubject, Enrollment, Grade, Student } from "@/types"
import { parseDecimal } from "@/lib/decimal"
import { BulletinPDFGenerator } from "./bulletin-pdf-generator"
import { BatchBulletinGenerator } from "./batch-bulletin-generator"

interface CPMSLBulletinsSectionProps {
  academicYearId: string
  isArchived?: boolean
}

interface ClassStudent {
  id: string
  studentId: string
  enrollmentId: string
  lastname: string
  firstname: string
  nisu: string
  avatar?: string
  studentData?: Student
}

export function CPMSLBulletinsSection({ academicYearId, isArchived = false }: CPMSLBulletinsSectionProps) {
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [steps, setSteps] = useState<AcademicStep[]>([])
  const [selectedSession, setSelectedSession] = useState<string>("")
  const [selectedStep, setSelectedStep] = useState<string>("")
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([])
  const [generatedReports, setGeneratedReports] = useState<Set<string>>(new Set())
  const [showPDFModal, setShowPDFModal] = useState(false)
  const [selectedStudentData, setSelectedStudentData] = useState<{
    studentId: string
    studentName: string
    enrollmentId: string
  } | null>(null)
  const [showBatchGenerator, setShowBatchGenerator] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [studentsData, setStudentsData] = useState<Map<string, Student>>(new Map())
  const itemsPerPage = 25

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
      } catch (error) {
        console.error("Error fetching data:", error)
        toast.error("Erreur lors du chargement des données")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [academicYearId])

  // charge les données de la classe
useEffect(() => {
  if (!selectedSession || !selectedStep) return

  async function fetchClassData() {
    setLoading(true)
    try {
      const [enrollmentsData, subjectsData] = await Promise.all([
        enrollmentsApi.getAll({ classSessionId: selectedSession }).catch(() => []),
        classSubjectsApi.getAll({ classSessionId: selectedSession }).catch(() => []),
      ])
      setEnrollments(enrollmentsData)
      setClassSubjects(subjectsData)

      // Récupérer les informations détaillées des étudiants
      const studentMap = new Map<string, Student>()
      for (const enrollment of enrollmentsData) {
        if (enrollment.studentId) {
          try {
            const student = await studentsApi.getById(enrollment.studentId)
            studentMap.set(enrollment.studentId, student as Student)
          } catch (error) {
            console.error(`Error fetching student ${enrollment.studentId}:`, error)
          }
        }
      }
      setStudentsData(studentMap)

      // Charger les notes pour tous les élèves en utilisant gradesApi.getByEnrollment
    const allGrades: Grade[] = []
for (const enrollment of enrollmentsData) {
  try {
    // Utiliser l'API correcte avec enrollmentId et stepId
    const gradesData = await gradesApi.getByEnrollment(enrollment.id, { stepId: selectedStep })
    if (gradesData && Array.isArray(gradesData)) {
      allGrades.push(...gradesData)
    }
  } catch (error) {
    console.error(`Error fetching grades for enrollment ${enrollment.id}:`, error)
  }
}
setGrades(allGrades)
    } catch (error) {
      console.error("Error fetching class data:", error)
      toast.error("Erreur lors du chargement des données de la classe")
    } finally {
      setLoading(false)
    }
  }

  fetchClassData()
}, [selectedSession, selectedStep])

  const selectedSessionObj = sessions.find(s => s.id === selectedSession)
  const selectedStepObj = steps.find(s => s.id === selectedStep)
  
  // Construire la liste des élèves avec leurs informations complètes
  const classStudents = useMemo(() => {
    return enrollments.map(enrollment => {
      const student = studentsData.get(enrollment.studentId)
      return {
        id: enrollment.id,
        studentId: enrollment.studentId,
        enrollmentId: enrollment.id,
        lastname: student?.user?.lastname || '',
        firstname: student?.user?.firstname || '',
        nisu: student?.nisu || '',
        avatar: student?.user?.profilePhoto,
        studentData: student
      }
    }).filter(s => s.studentId)
  }, [enrollments, studentsData])

  const isValidNISU = (nisu: string | undefined) => {
  if (!nisu) return false
  const trimmed = nisu.trim()
  return /^[A-Za-z0-9]{14}$/.test(trimmed)
}

  const studentsWithNISU = classStudents.filter(s => isValidNISU(s.nisu))
  const studentsWithoutNISU = classStudents.filter(s => !isValidNISU(s.nisu))

  // Calculer la complétion des notes pour chaque élève
  const getStudentGradeCompletion = (enrollmentId: string) => {
  const studentGrades = grades.filter(g => g.enrollmentId === enrollmentId)
  
  const totalSubjects = classSubjects.length
  const enteredSubjects = studentGrades.filter(g => {
    const score = parseDecimal(g.studentScore)
    return score !== null && score !== undefined && !isNaN(score)
  }).length
  
  return {
    complete: totalSubjects > 0 && enteredSubjects === totalSubjects,
    total: totalSubjects,
    entered: enteredSubjects,
    missing: totalSubjects - enteredSubjects
  }
}

// Modifier calculateStudentAverage
const calculateStudentAverage = (enrollmentId: string): number | null => {
  const studentGrades = grades.filter(g => g.enrollmentId === enrollmentId)
    .filter(g => {
      const score = parseDecimal(g.studentScore)
      return score !== null && score !== undefined && !isNaN(score)
    })
  
  if (studentGrades.length === 0) return null
  
  let totalWeightedScore = 0
  let totalCoefficient = 0
  
  for (const grade of studentGrades) {
    const classSubject = classSubjects.find(cs => cs.id === grade.classSubjectId)
    if (classSubject) {
      const maxScore = parseDecimal(classSubject.subject?.maxScore) || 20
      const coefficient = parseDecimal(classSubject.coefficientOverride ?? classSubject.subject?.coefficient) || 1
      const studentScore = parseDecimal(grade.studentScore) || 0
      const normalizedScore = studentScore * (20 / maxScore)
      totalWeightedScore += normalizedScore * coefficient
      totalCoefficient += coefficient
    }
  }
  
  return totalCoefficient > 0 ? totalWeightedScore / totalCoefficient : null
}

  const studentsWithCompleteGrades = classStudents.filter(s => getStudentGradeCompletion(s.enrollmentId).complete)
  const studentsWithMissingGrades = classStudents.filter(s => !getStudentGradeCompletion(s.enrollmentId).complete)
  const studentsWithGeneratedReports = classStudents.filter(s => generatedReports.has(s.studentId))

  const handleGenerateReports = () => {
    if (studentsWithoutNISU.length > 0) {
      toast.warning(`${studentsWithoutNISU.length} élève(s) sans NISU valide. Ils seront exclus de la génération.`)
    }
    
    const validStudentIds = studentsWithNISU.map(s => s.studentId)
    if (validStudentIds.length === 0) {
      toast.error("Aucun élève avec NISU valide pour générer les bulletins")
      return
    }
    
    setShowBatchGenerator(true)
  }

  const handleGenerateSinglePDF = (studentId: string, studentName: string, enrollmentId: string) => {
    // Validation des données avant de définir l'état
    if (!studentId || typeof studentId !== 'string') {
      console.error("Invalid studentId:", studentId)
      toast.error("Erreur: ID étudiant invalide")
      return
    }
    
    if (!enrollmentId || typeof enrollmentId !== 'string') {
      console.error("Invalid enrollmentId:", enrollmentId)
      toast.error("Erreur: ID d'inscription invalide")
      return
    }
    
    const cleanStudentId = String(studentId).trim()
    const cleanStudentName = String(studentName || "").trim()
    const cleanEnrollmentId = String(enrollmentId).trim()
    
    if (!cleanStudentId || !cleanEnrollmentId) {
      toast.error("Données étudiant manquantes")
      return
    }
    
    setSelectedStudentData({
      studentId: cleanStudentId,
      studentName: cleanStudentName || "Étudiant",
      enrollmentId: cleanEnrollmentId
    })
    setShowPDFModal(true)
  }

  const handleClosePDFModal = () => {
    setShowPDFModal(false)
    // Petit délai pour éviter les problèmes de réinitialisation
    setTimeout(() => {
      setSelectedStudentData(null)
    }, 100)
  }

  const handleBatchComplete = () => {
    const validStudentIds = studentsWithNISU.map(s => s.studentId)
    setGeneratedReports(new Set(validStudentIds))
    toast.success(`${validStudentIds.length} bulletin(s) généré(s) avec succès`)
  }

  const handleViewStudentPreview = (studentId: string, studentName: string, enrollmentId: string) => {
    handleGenerateSinglePDF(studentId, studentName, enrollmentId)
  }

  const paginatedStudents = classStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  const totalPages = Math.ceil(classStudents.length / itemsPerPage)

  // Reset page when selection changes
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedSession, selectedStep])

  if (loading && !selectedSession) {
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block" style={{ color: "#1E1A17" }}>
                Classe
              </label>
              <Select value={selectedSession} onValueChange={setSelectedSession} disabled={isArchived}>
                <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }}>
                  <SelectValue placeholder="Sélectionner une classe" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map(session => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.class?.classType?.name} {session.class?.letter}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block" style={{ color: "#1E1A17" }}>
                Étape
              </label>
              <Select value={selectedStep} onValueChange={setSelectedStep} disabled={isArchived}>
                <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }}>
                  <SelectValue placeholder="Sélectionner une étape" />
                </SelectTrigger>
                <SelectContent>
                  {steps.map(step => (
                    <SelectItem key={step.id} value={step.id}>
                      {step.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      {selectedSession && selectedStep && classStudents.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg border bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Élèves dans la classe</p>
                  <p className="text-2xl font-bold">{classStudents.length}</p>
                </div>
                <AlertCircleIcon className="h-8 w-8 text-gray-400" />
              </div>
            </div>
            
            <div className="p-4 rounded-lg border bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Notes complètes</p>
                  <p className="text-2xl font-bold text-green-600">{studentsWithCompleteGrades.length}</p>
                </div>
                <CheckCircleIcon className="h-8 w-8 text-green-500" />
              </div>
            </div>
            
            <div className="p-4 rounded-lg border bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Notes manquantes</p>
                  <p className="text-2xl font-bold text-yellow-600">{studentsWithMissingGrades.length}</p>
                </div>
                <AlertTriangleIcon className="h-8 w-8 text-yellow-500" />
              </div>
            </div>
            
            <div className="p-4 rounded-lg border bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Bulletins générés</p>
                  <p className="text-2xl font-bold text-blue-600">{studentsWithGeneratedReports.length}</p>
                </div>
                <FileTextIcon className="h-8 w-8 text-blue-500" />
              </div>
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
              <h3 style={{ color: "#3A4A57", fontSize: "18px", fontWeight: 600, marginBottom: "4px" }}>
                Liste des élèves
              </h3>
              <p style={{ color: "#78756F", fontSize: "14px" }}>
                {selectedSessionObj?.class?.classType?.name} {selectedSessionObj?.class?.letter} — {selectedStepObj?.name}
              </p>
            </div>
            <div style={{ padding: "24px" }}>
              <div className="overflow-hidden" style={{ borderRadius: "8px", border: "1px solid #E8E6E3" }}>
                <Table>
                  <TableHeader>
                    <TableRow style={{ backgroundColor: "#F1F5F9", borderBottom: "2px solid #D1D5DB" }}>
                      <TableHead className="w-[50px]">Photo</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>Prénom</TableHead>
                      <TableHead>NISU</TableHead>
                      <TableHead className="text-center">Moyenne /20</TableHead>
                      <TableHead className="text-center">Notes</TableHead>
                      <TableHead className="text-center">Résultat</TableHead>
                      <TableHead className="text-center">Statut bulletin</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          Aucun élève dans cette classe
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedStudents.map(student => {
                        const hasReport = generatedReports.has(student.studentId)
                        const validNISU = isValidNISU(student.nisu)
                        const completion = getStudentGradeCompletion(student.enrollmentId)
                        const average = calculateStudentAverage(student.enrollmentId)
                        const isPassing = average !== null && average >= 10
                        const hasAnyGrade = grades.some(g => {
  if (g.enrollmentId !== student.enrollmentId) return false
  const score = parseDecimal(g.studentScore)
  return score !== null && score !== undefined && !isNaN(score)
})
                        
                        return (
                          <TableRow 
                            key={student.id} 
                            style={{ borderBottom: "1px solid #E8E6E3" }}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <TableCell>
                              <Avatar className="h-8 w-8">
                                <AvatarFallback style={{ backgroundColor: "#F0F4F7", color: "#5A7085", fontSize: "12px" }}>
                                  {student.firstname?.[0]}{student.lastname?.[0]}
                                </AvatarFallback>
                              </Avatar>
                            </TableCell>
                            <TableCell className="font-medium">{student.lastname}</TableCell>
                            <TableCell>{student.firstname}</TableCell>
                            <TableCell className="font-mono">
                              {validNISU ? (
                                <span className="text-green-600 font-medium">{student.nisu}</span>
                              ) : (
                                <span className="text-red-500 text-sm" title="NISU invalide ou manquant">
                                  {student.nisu ? `${student.nisu} (invalide)` : '—'}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-center font-semibold">
  {average !== null ? (
    <span className={average >= 10 ? 'text-green-600' : 'text-red-600'}>
      {average.toFixed(2)}
    </span>
  ) : (
    <span className="text-gray-400">—</span>
  )}
</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-xs">
                                {completion.entered}/{completion.total}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {hasAnyGrade ? (
                                completion.complete ? (
                                  isPassing ? (
                                    <Badge style={{ backgroundColor: "#E8F5EC", color: "#2D7D46" }}>Réussi</Badge>
                                  ) : (
                                    <Badge style={{ backgroundColor: "#FDE8E8", color: "#C43C3C" }}>Échoué</Badge>
                                  )
                                ) : (
                                  <Badge style={{ backgroundColor: "#FEF6E0", color: "#C48B1A" }}>
                                    {completion.missing} note{completion.missing > 1 ? 's' : ''} manquante{completion.missing > 1 ? 's' : ''}
                                  </Badge>
                                )
                              ) : (
                                <Badge variant="outline">Aucune note</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {hasReport ? (
                                <Badge style={{ backgroundColor: "#E3EFF9", color: "#2B6CB0" }}>Généré</Badge>
                              ) : (
                                <Badge variant="outline">Non généré</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex gap-2 justify-center">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleGenerateSinglePDF(student.studentId, `${student.lastname} ${student.firstname}`, student.enrollmentId)}
                                  disabled={!hasAnyGrade || !validNISU}
                                  title={!hasAnyGrade ? "Aucune note saisie" : !validNISU ? "NISU invalide ou manquant" : "Voir le bulletin"}
                                >
                                  <EyeIcon className="h-4 w-4" />
                                </Button>
                              </div>
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
                <div className="flex items-center justify-center gap-4 pt-4 mt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    style={{ borderColor: "#D1CECC" }}
                  >
                    ← Précédent
                  </Button>
                  <span className="text-sm text-muted-foreground">
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
              disabled={!selectedSession || !selectedStep || classStudents.length === 0 || isArchived || studentsWithNISU.length === 0}
              onClick={handleGenerateReports}
              style={{
                backgroundColor: (isArchived || studentsWithNISU.length === 0) ? "#9CA3AF" : "#2C4A6E",
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
              Générer les bulletins ({studentsWithNISU.length} élève{studentsWithNISU.length > 1 ? 's' : ''})
            </Button>

            {studentsWithGeneratedReports.length > 0 && (
              <Button
                size="lg"
                variant="outline"
                onClick={() => setShowBatchGenerator(true)}
                style={{ borderColor: "#B3C7D5", color: "#5A7085" }}
              >
                <DownloadIcon className="mr-2 h-4 w-4" />
                Télécharger l'archive ({studentsWithGeneratedReports.length})
              </Button>
            )}
          </div>

          {/* Avertissement NISU */}
          {studentsWithoutNISU.length > 0 && (
            <div className="p-3 rounded-lg" style={{ backgroundColor: "#FEF6E0", border: "1px solid #C48B1A" }}>
              <div className="flex items-center gap-2">
                <AlertTriangleIcon className="h-4 w-4" style={{ color: "#C48B1A" }} />
                <p className="text-sm" style={{ color: "#C48B1A" }}>
                  {studentsWithoutNISU.length} élève{studentsWithoutNISU.length > 1 ? 's' : ''} sans NISU valide 
                  {studentsWithoutNISU.length > 1 ? ' seront exclus' : ' sera exclu'} de la génération des bulletins.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {(!selectedSession || !selectedStep) && (
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
              Choisissez une classe et une étape pour commencer la génération des bulletins
            </p>
          </div>
        </div>
      )}

      {classStudents.length === 0 && selectedSession && selectedStep && (
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
            <AlertCircleIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p style={{ fontSize: "16px", fontWeight: 500, color: "#3A4A57" }}>
              Aucun élève dans cette classe
            </p>
            <p style={{ fontSize: "14px", color: "#78756F", marginTop: "8px" }}>
              Veuillez vérifier que des élèves sont inscrits dans cette classe
            </p>
          </div>
        </div>
      )}

      {/* PDF Generator Modal - Avec guard supplémentaire */}
      {showPDFModal && selectedStudentData && selectedSession && selectedStep && (
        (() => {
          // Validation supplémentaire avant rendu
          const isValid = 
            selectedStudentData.studentId && 
            typeof selectedStudentData.studentId === 'string' &&
            selectedStudentData.enrollmentId && 
            typeof selectedStudentData.enrollmentId === 'string'
          
          if (!isValid) {
            console.error("Invalid student data:", selectedStudentData)
            return null
          }
          
          return (
            <BulletinPDFGenerator
              open={showPDFModal}
              onOpenChange={handleClosePDFModal}
              studentId={selectedStudentData.studentId}
              studentName={selectedStudentData.studentName}
              classSessionId={selectedSession}
              stepId={selectedStep}
              stepName={selectedStepObj?.name || ''}
              className={`${selectedSessionObj?.class?.classType?.name || ''} ${selectedSessionObj?.class?.letter || ''}`}
              enrollmentId={selectedStudentData.enrollmentId}
            />
          )
        })()
      )}

      {/* Batch Generator Modal */}
      {showBatchGenerator && selectedSession && selectedStep && (
        <BatchBulletinGenerator
          open={showBatchGenerator}
          onOpenChange={setShowBatchGenerator}
          classSessionId={selectedSession}
          stepId={selectedStep}
          studentIds={studentsWithNISU.map(s => s.studentId)}
          studentNames={new Map(studentsWithNISU.map(s => [s.studentId, `${s.lastname} ${s.firstname}`]))}
          enrollmentIds={new Map(studentsWithNISU.map(s => [s.studentId, s.enrollmentId]))}
          className={`${selectedSessionObj?.class?.classType?.name || ''} ${selectedSessionObj?.class?.letter || ''}`}
          stepName={selectedStepObj?.name || ''}
          onComplete={handleBatchComplete}
          onViewStudent={handleViewStudentPreview}
        />
      )}
    </div>
  )
}