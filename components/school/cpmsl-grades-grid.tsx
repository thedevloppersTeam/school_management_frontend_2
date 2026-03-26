"use client"

import { useState, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { SaveIcon, AlertCircleIcon, LockIcon, CheckCircle2Icon, UsersIcon, FileTextIcon, AlertTriangleIcon, BarChart3Icon } from "lucide-react"
import type { Level, Period, Student, SubjectParent, SubjectChild, Grade, Classroom } from "@/lib/data/school-data"
import { calculateClassMean } from "@/lib/data/school-data"

interface CPMSLGradesGridProps {
  levels: Level[]
  periods: Period[]
  students: Student[]
  subjectParents: SubjectParent[]
  subjectChildren: SubjectChild[]
  grades: Grade[]
  classrooms: Classroom[]
  isArchived?: boolean
  onSaveGrades?: (grades: { studentId: string; subjectId: string; periodId: string; value: number }[]) => void
  onClosePeriod?: (periodId: string, reason: string) => void
}

function generateStudentCode(firstName: string, lastName: string, index: number): string {
  const firstPart = firstName.slice(0, 2).toUpperCase().padEnd(2, 'X')
  const lastPart = lastName.slice(0, 2).toUpperCase().padEnd(2, 'X')
  return `${firstPart}${lastPart}${String(index + 1).padStart(4, '0')}`
}

interface GradeEntry {
  studentId: string
  value: string
  isValid: boolean
  error?: string
}

export function CPMSLGradesGrid({
  levels,
  periods,
  students,
  subjectParents,
  subjectChildren,
  grades,
  classrooms,
  isArchived = false,
  onSaveGrades,
  onClosePeriod
}: CPMSLGradesGridProps) {
  const [selectedLevelId, setSelectedLevelId] = useState<string>("")
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>("")
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("")
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("")
  const [isSubjectParent, setIsSubjectParent] = useState<boolean>(true)
  const [gradeEntries, setGradeEntries] = useState<Map<string, GradeEntry>>(new Map())
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false)
  const [closeReason, setCloseReason] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 25

  const filteredClassrooms = useMemo(() => {
    if (!selectedLevelId) return []
    return classrooms
      .filter(c => c.levelId === selectedLevelId)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [selectedLevelId, classrooms])

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId)
  const isPeriodClosed = selectedPeriod?.status === 'closed'
  const isBlancExam = selectedPeriod?.isBlancExam || false

  const filteredStudents = useMemo(() => {
    if (!selectedClassroomId) return []
    return students
      .filter(s => s.classroomId === selectedClassroomId)
      .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`))
      .map((student, index) => ({
        ...student,
        displayCode: generateStudentCode(student.firstName, student.lastName, index)
      }))
  }, [selectedClassroomId, students])

  // Pagination
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedStudents = filteredStudents.slice(startIndex, startIndex + itemsPerPage)

  // Reset to page 1 when filters change
  useMemo(() => setCurrentPage(1), [selectedClassroomId, selectedPeriodId])

  const filteredSubjectParents = useMemo(() => {
    if (!selectedLevelId) return []
    return subjectParents
      .filter(sp => sp.levelIds.includes(selectedLevelId))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [selectedLevelId, subjectParents])

  const getChildrenForParent = (parentId: string) => {
    return subjectChildren
      .filter(sc => sc.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  useMemo(() => {
    if (!selectedLevelId || !selectedPeriodId || !selectedSubjectId) return
    const newEntries = new Map<string, GradeEntry>()
    filteredStudents.forEach(student => {
      const existingGrade = grades.find(
        g => g.studentId === student.id && g.subjectId === selectedSubjectId && g.periodId === selectedPeriodId
      )
      if (existingGrade) {
        newEntries.set(student.id, {
          studentId: student.id,
          value: existingGrade.value.toString(),
          isValid: true
        })
      }
    })
    setGradeEntries(newEntries)
  }, [selectedLevelId, selectedPeriodId, selectedSubjectId, filteredStudents, grades])

  const kpis = useMemo(() => {
    if (!selectedLevelId || !selectedPeriodId || !selectedSubjectId) {
      return { totalStudents: 0, enteredGrades: 0, missingGrades: 0, progressPercentage: 0, classMean: null }
    }
    const totalStudents = filteredStudents.length
    let enteredGrades = 0
    filteredStudents.forEach(student => {
      const entry = gradeEntries.get(student.id)
      if (entry && entry.value && entry.isValid) enteredGrades++
    })
    const missingGrades = totalStudents - enteredGrades
    const progressPercentage = totalStudents > 0 ? Math.round((enteredGrades / totalStudents) * 100) : 0
    
    // Calculate class mean
    const classMean = calculateClassMean(
      filteredStudents,
      selectedPeriodId,
      grades,
      subjectParents,
      subjectChildren,
      isBlancExam
    )
    
    return { totalStudents, enteredGrades, missingGrades, progressPercentage, classMean }
  }, [selectedLevelId, selectedPeriodId, selectedSubjectId, filteredStudents, gradeEntries, grades, subjectParents, subjectChildren, isBlancExam])

  const validateGrade = (value: string): { isValid: boolean; error?: string } => {
    if (!value || value.trim() === '') return { isValid: true }
    const numValue = parseFloat(value)
    if (isNaN(numValue)) return { isValid: false, error: 'Valeur invalide' }
    const remainder = (numValue * 100) % 25
    if (remainder !== 0) return { isValid: false, error: 'Multiples de 0.25 uniquement' }
    if (numValue < 0 || numValue > 10) return { isValid: false, error: 'Entre 0 et 10' }
    return { isValid: true }
  }

  const handleGradeChange = (studentId: string, value: string) => {
    const validation = validateGrade(value)
    const newEntries = new Map(gradeEntries)
    newEntries.set(studentId, { studentId, value, isValid: validation.isValid, error: validation.error })
    setGradeEntries(newEntries)
  }

  const getGradeStatus = (studentId: string): string => {
    const entry = gradeEntries.get(studentId)
    if (!entry || !entry.value) return 'Non saisie'
    if (!entry.isValid) return 'Invalide'
    return 'Valide'
  }

  const hasErrors = useMemo(() => {
    return Array.from(gradeEntries.values()).some(entry => !entry.isValid)
  }, [gradeEntries])

  const handleSaveGrades = () => {
    if (hasErrors || !selectedSubjectId) return
    const gradesToSave = Array.from(gradeEntries.values())
      .filter(entry => entry.value && entry.isValid)
      .map(entry => ({
        studentId: entry.studentId,
        subjectId: selectedSubjectId,
        periodId: selectedPeriodId,
        value: parseFloat(entry.value)
      }))
    onSaveGrades?.(gradesToSave)
  }

  const handleClosePeriod = () => {
    if (!closeReason.trim()) return
    onClosePeriod?.(selectedPeriodId, closeReason)
    setIsCloseDialogOpen(false)
    setCloseReason("")
  }

  const globalSubjectProgress = useMemo(() => {
    if (!selectedLevelId || !selectedPeriodId) return { completed: 0, total: 0, percentage: 0 }
    let totalSubjects = 0
    let completedSubjects = 0
    if (isBlancExam) {
      totalSubjects = filteredSubjectParents.length
      filteredSubjectParents.forEach(parent => {
        const hasGrades = filteredStudents.some(student => {
          return grades.find(g => g.studentId === student.id && g.subjectId === parent.id && g.periodId === selectedPeriodId)
        })
        if (hasGrades) completedSubjects++
      })
    } else {
      filteredSubjectParents.forEach(parent => {
        const children = getChildrenForParent(parent.id)
        totalSubjects += children.length
        children.forEach(child => {
          const hasGrades = filteredStudents.some(student => {
            return grades.find(g => g.studentId === student.id && g.subjectId === child.id && g.periodId === selectedPeriodId)
          })
          if (hasGrades) completedSubjects++
        })
      })
    }
    const percentage = totalSubjects > 0 ? Math.round((completedSubjects / totalSubjects) * 100) : 0
    return { completed: completedSubjects, total: totalSubjects, percentage }
  }, [selectedLevelId, selectedPeriodId, filteredSubjectParents, filteredStudents, grades, isBlancExam, getChildrenForParent])

  // Get selected subject name for display
  const selectedSubjectName = useMemo(() => {
    if (isBlancExam) {
      const parent = filteredSubjectParents.find(sp => sp.id === selectedSubjectId)
      return parent?.name || ''
    } else {
      const child = subjectChildren.find(sc => sc.id === selectedSubjectId)
      return child?.name || ''
    }
  }, [selectedSubjectId, isBlancExam, filteredSubjectParents, subjectChildren])

  // Get selected level and classroom names for display
  const selectedLevelName = useMemo(() => {
    const level = levels.find(l => l.id === selectedLevelId)
    const classroom = classrooms.find(c => c.id === selectedClassroomId)
    if (!level || !classroom) return ''
    return `${level.name} ${classroom.name}`
  }, [selectedLevelId, selectedClassroomId, levels, classrooms])

  // Get selected period name for display
  const selectedPeriodName = useMemo(() => {
    const period = periods.find(p => p.id === selectedPeriodId)
    return period?.name || ''
  }, [selectedPeriodId, periods])

  // Count entered grades
  const enteredCount = useMemo(() => {
    return Array.from(gradeEntries.values()).filter(entry => entry.value && entry.isValid).length
  }, [gradeEntries])

  // Count missing grades
  const missingCount = useMemo(() => {
    return filteredStudents.length - enteredCount
  }, [filteredStudents.length, enteredCount])

  // Empty state
  if (!selectedClassroomId || !selectedPeriodId || !selectedSubjectId) {
    return (
      <div className="space-y-6">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
            <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }}>
              <SelectValue placeholder="Sélectionner une étape" style={{ color: "#A8A5A2" }} />
            </SelectTrigger>
            <SelectContent>
              {periods.map(period => (
                <SelectItem key={period.id} value={period.id}>{period.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedLevelId} onValueChange={(value) => {
            setSelectedLevelId(value)
            setSelectedClassroomId("")
            setSelectedSubjectId("")
          }}>
            <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }}>
              <SelectValue placeholder="Sélectionner une classe" style={{ color: "#A8A5A2" }} />
            </SelectTrigger>
            <SelectContent>
              {levels.map(level => (
                <SelectItem key={level.id} value={level.id}>{level.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedClassroomId} onValueChange={(value) => {
            setSelectedClassroomId(value)
            setSelectedSubjectId("")
          }} disabled={!selectedLevelId}>
            <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px", opacity: !selectedLevelId ? 0.5 : 1, cursor: !selectedLevelId ? "not-allowed" : "pointer" }}>
              <SelectValue placeholder="Sélectionner une salle" style={{ color: "#A8A5A2" }} />
            </SelectTrigger>
            <SelectContent>
              {filteredClassrooms.map(classroom => (
                <SelectItem key={classroom.id} value={classroom.id}>{classroom.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedSubjectId} onValueChange={(value) => {
            setSelectedSubjectId(value)
            const isParent = filteredSubjectParents.some(sp => sp.id === value)
            setIsSubjectParent(isParent)
          }} disabled={!selectedClassroomId}>
            <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px", opacity: !selectedClassroomId ? 0.5 : 1, cursor: !selectedClassroomId ? "not-allowed" : "pointer" }}>
              <SelectValue placeholder="Sélectionner une matière" style={{ color: "#A8A5A2" }} />
            </SelectTrigger>
            <SelectContent>
              {isBlancExam ? (
                filteredSubjectParents.map(parent => (
                  <SelectItem key={parent.id} value={parent.id}>{parent.name}</SelectItem>
                ))
              ) : (
                filteredSubjectParents.map(parent => {
                  const children = getChildrenForParent(parent.id)
                  return (
                    <div key={parent.id}>
                      <div className="px-2 py-1.5 text-xs font-semibold" style={{ backgroundColor: "#F0F4F7", color: "#4A5D6E" }}>
                        {parent.name}
                      </div>
                      {children.map(child => (
                        <SelectItem key={child.id} value={child.id} className="pl-6">{child.name}</SelectItem>
                      ))}
                    </div>
                  )
                })
              )}
            </SelectContent>
          </Select>
            </div>
          </div>
        </div>

        <div className="rounded-lg p-12 flex flex-col items-center justify-center text-center space-y-2" style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <p className="font-serif font-semibold" style={{ fontSize: "16px", color: "hsl(var(--muted-foreground))" }}>
            Choisissez une classe, une salle, une étape et une matière
          </p>
          <p className="font-sans" style={{ fontSize: "13px", fontWeight: 400, color: "hsl(var(--muted-foreground))" }}>
            pour commencer la saisie des notes
          </p>
        </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId} disabled={isArchived}>
          <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }}>
            <SelectValue placeholder="Sélectionner une étape" />
          </SelectTrigger>
          <SelectContent>
            {periods.map(period => (
              <SelectItem key={period.id} value={period.id}>{period.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedLevelId} onValueChange={(value) => {
          setSelectedLevelId(value)
          setSelectedClassroomId("")
          setSelectedSubjectId("")
        }} disabled={isArchived}>
          <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }}>
            <SelectValue placeholder="Sélectionner une classe" />
          </SelectTrigger>
          <SelectContent>
            {levels.map(level => (
              <SelectItem key={level.id} value={level.id}>{level.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedClassroomId} onValueChange={(value) => {
          setSelectedClassroomId(value)
          setSelectedSubjectId("")
        }} disabled={isArchived || !selectedLevelId}>
          <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px", opacity: (isArchived || !selectedLevelId) ? 0.5 : 1, cursor: (isArchived || !selectedLevelId) ? "not-allowed" : "pointer" }}>
            <SelectValue placeholder="Sélectionner une salle" />
          </SelectTrigger>
          <SelectContent>
            {filteredClassrooms.map(classroom => (
              <SelectItem key={classroom.id} value={classroom.id}>{classroom.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedSubjectId} onValueChange={(value) => {
          setSelectedSubjectId(value)
          const isParent = filteredSubjectParents.some(sp => sp.id === value)
          setIsSubjectParent(isParent)
        }} disabled={isArchived || isPeriodClosed || !selectedClassroomId}>
          <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px", opacity: (isArchived || isPeriodClosed || !selectedClassroomId) ? 0.5 : 1, cursor: (isArchived || isPeriodClosed || !selectedClassroomId) ? "not-allowed" : "pointer" }}>
            <SelectValue placeholder="Sélectionner une matière" />
          </SelectTrigger>
          <SelectContent>
            {isBlancExam ? (
              filteredSubjectParents.map(parent => (
                <SelectItem key={parent.id} value={parent.id}>{parent.name}</SelectItem>
              ))
            ) : (
              filteredSubjectParents.map(parent => {
                const children = getChildrenForParent(parent.id)
                return (
                  <div key={parent.id}>
                    <div className="px-2 py-1.5 text-xs font-semibold" style={{ backgroundColor: "#F0F4F7", color: "#4A5D6E" }}>
                      {parent.name}
                    </div>
                    {children.map(child => (
                      <SelectItem key={child.id} value={child.id} className="pl-6">{child.name}</SelectItem>
                    ))}
                  </div>
                )
              })
            )}
          </SelectContent>
        </Select>
          </div>
        </div>
      </div>

      {/* Closed Period Banner */}
      {isPeriodClosed && (
        <div className="rounded-lg p-4 flex items-center gap-3" style={{ backgroundColor: "#FEF6E0", border: "1px solid #C48B1A" }}>
          <LockIcon className="h-5 w-5" style={{ color: "#C48B1A" }} />
          <p className="text-sm font-medium" style={{ color: "#C48B1A" }}>
            Étape clôturée — les notes ne peuvent plus être modifiées
          </p>
        </div>
      )}

      {/* Header Section with Class Average */}
      <div className="rounded-lg p-4 flex items-center justify-between" style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <h2 className="font-serif font-semibold" style={{ fontSize: "18px", color: "#2C4A6E" }}>
          {selectedPeriodName} — {selectedLevelName} — {selectedSubjectName}
        </h2>
        {kpis.classMean !== null && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ backgroundColor: "#F0F4F7" }}>
            <BarChart3Icon className="h-5 w-5" style={{ color: "#5A7085" }} />
            <span className="font-sans font-semibold" style={{ fontSize: "14px", color: "#2C4A6E" }}>
              Moy. classe: {kpis.classMean.toFixed(2)} / 10
            </span>
          </div>
        )}
      </div>



      {/* Grades Table */}
      <div className="rounded-lg overflow-hidden" style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
          <thead>
            <tr style={{ backgroundColor: "#F1F5F9", borderBottom: "2px solid #D1D5DB" }}>
              <th className="text-left px-6 py-3 font-sans font-bold uppercase" style={{ fontSize: "12px", letterSpacing: "0.06em", color: "#2C4A6E", width: "25%" }}>NOM</th>
              <th className="text-left px-6 py-3 font-sans font-bold uppercase" style={{ fontSize: "12px", letterSpacing: "0.06em", color: "#2C4A6E", width: "25%" }}>PRÉNOM</th>
              <th className="text-center px-6 py-3 font-sans font-bold uppercase" style={{ fontSize: "12px", letterSpacing: "0.06em", color: "#2C4A6E", width: "25%" }}>NOTE /10</th>
              <th className="text-center px-6 py-3 font-sans font-bold uppercase" style={{ fontSize: "12px", letterSpacing: "0.06em", color: "#2C4A6E", width: "25%" }}>STATUT</th>
            </tr>
          </thead>
          <tbody>
            {paginatedStudents.map((student, index) => {
              const entry = gradeEntries.get(student.id)
              const hasValue = entry && entry.value && entry.value.trim() !== ''
              const isValid = entry?.isValid !== false
              const hasError = entry && !entry.isValid && hasValue
              
              return (
                <tr 
                  key={student.id} 
                  style={{ 
                    borderBottom: index < paginatedStudents.length - 1 ? "1px solid #E8E6E3" : "none",
                    backgroundColor: index % 2 === 0 ? "white" : "#FAFAF8",
                    height: "48px"
                  }}
                >
                  <td className="px-6 py-3 font-sans" style={{ fontSize: "14px", fontWeight: 600, color: "#1E1A17" }}>
                    {student.lastName}
                  </td>
                  <td className="px-6 py-3 font-sans" style={{ fontSize: "14px", fontWeight: 400, color: "#1E1A17" }}>
                    {student.firstName}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex justify-center">
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        step="0.5"
                        value={entry?.value || ''}
                        onChange={(e) => handleGradeChange(student.id, e.target.value)}
                        placeholder="—"
                        disabled={isPeriodClosed || isArchived}
                        className="text-center"
                        style={{
                          width: "80px",
                          borderRadius: "8px",
                          borderColor: hasError ? "#EF4444" : hasValue ? "#2C4A6E" : "#D1D5DB",
                          borderWidth: "1px",
                          color: "#1E1A17"
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Tab') {
                            e.preventDefault()
                            const currentIndex = paginatedStudents.findIndex(s => s.id === student.id)
                            if (currentIndex < paginatedStudents.length - 1) {
                              const nextStudent = paginatedStudents[currentIndex + 1]
                              const nextInput = document.querySelector(`input[data-student-id="${nextStudent.id}"]`) as HTMLInputElement
                              nextInput?.focus()
                            }
                          }
                        }}
                        data-student-id={student.id}
                      />
                    </div>
                    {hasError && entry.error && (
                      <p className="text-center mt-1 font-sans" style={{ fontSize: "11px", color: "#EF4444" }}>
                        {entry.error}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-3 text-center">
                    <Badge 
                      variant="secondary"
                      style={{
                        backgroundColor: hasValue && isValid ? "#D1FAE5" : "#F3F4F6",
                        color: hasValue && isValid ? "#065F46" : "#6B7280",
                        border: "none",
                        fontWeight: 500
                      }}
                    >
                      {hasValue && isValid ? 'Saisi' : 'Non saisi'}
                    </Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Pagination */}
      {filteredStudents.length > itemsPerPage && (
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              style={{ borderColor: "#D1CECC", color: "#5C5955" }}
            >
              ← Précédent
            </Button>
            <span className="body-base" style={{ color: "#78756F" }}>
              Page {currentPage} sur {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              style={{ borderColor: "#D1CECC", color: "#5C5955" }}
            >
              Suivant →
            </Button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3" style={{ marginTop: "24px" }}>
        <Button
          size="lg"
          disabled={!selectedClassroomId || !selectedPeriodId || hasErrors || isPeriodClosed || isArchived}
          onClick={handleSaveGrades}
          style={{
            backgroundColor: (!selectedClassroomId || !selectedPeriodId || hasErrors || isPeriodClosed || isArchived) ? "#9CA3AF" : "#5A7085",
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
          <SaveIcon className="h-4 w-4" />
          Enregistrer les notes
        </Button>
      </div>



      {/* Close Period Dialog */}
      <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
        <DialogContent style={{ backgroundColor: "white", borderRadius: "12px" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#2A3740", fontSize: "18px" }}>Clôturer cette étape ?</DialogTitle>
            <DialogDescription style={{ color: "#78756F" }}>
              Les notes seront verrouillées et ne pourront plus être modifiées.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason" style={{ color: "#1E1A17" }}>Motif (obligatoire)</Label>
            <Textarea
              id="reason"
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
              rows={4}
              style={{ borderColor: "#D1CECC", borderRadius: "8px" }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloseDialogOpen(false)} style={{ borderColor: "#D1CECC", color: "#5C5955" }}>
              Annuler
            </Button>
            <Button onClick={handleClosePeriod} disabled={!closeReason.trim()} style={{ backgroundColor: "#C48B1A", color: "white" }}>
              Confirmer la clôture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}