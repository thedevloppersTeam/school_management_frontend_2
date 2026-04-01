"use client"

import { useState, useMemo, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { SaveIcon, BarChart3Icon, RefreshCwIcon, FilterIcon, MessageSquareIcon } from "lucide-react"
import type { AcademicStep, ClassSession, ClassSubject, Enrollment, Grade, GradeType, SubjectSection } from "@/types"
import { parseDecimal } from "@/lib/decimal"

interface CPMSLGradesGridProps {
  steps: AcademicStep[]
  sessions: ClassSession[]
  classSubjects: ClassSubject[]
  enrollments: Enrollment[]
  grades: Grade[]
  isArchived?: boolean
  selectedStep: string
  selectedSession: string
  selectedSubject: string
  onStepChange: (v: string) => void
  onSessionChange: (v: string) => void
  onSubjectChange: (v: string) => void
  onSaveGrades: (grades: { 
    enrollmentId: string; 
    classSubjectId: string; 
    stepId: string; 
    studentScore: number; 
    gradeType: GradeType;
    gradeId?: string;
    sectionId?: string;
    comment?: string;
  }[]) => void
  onUpdateGrade?: (gradeId: string, studentScore: number, gradeType: GradeType, sectionId?: string, comment?: string) => void
  subjectSections?: SubjectSection[]
}

interface GradeEntry {
  enrollmentId: string
  value: string
  isValid: boolean
  error?: string
  gradeId?: string
  originalValue?: string
  sectionId?: string
  comment?: string
  originalComment?: string
}

const GRADE_TYPES: { value: GradeType; label: string }[] = [
  { value: "EXAM", label: "Examen" },
  { value: "HOMEWORK", label: "Devoir" },
  { value: "ORAL", label: "Oral" },
]

export function CPMSLGradesGrid({
  steps,
  sessions,
  classSubjects,
  enrollments,
  grades,
  isArchived = false,
  selectedStep,
  selectedSession,
  selectedSubject,
  onStepChange,
  onSessionChange,
  onSubjectChange,
  onSaveGrades,
  onUpdateGrade,
  subjectSections = [],
}: CPMSLGradesGridProps) {
  const [gradeEntries, setGradeEntries] = useState<Map<string, GradeEntry>>(new Map())
  const [gradeType, setGradeType] = useState<GradeType>("EXAM")
  const [selectedSection, setSelectedSection] = useState<string>("all")
  /* const [selectedGradeTypeFilter, setSelectedGradeTypeFilter] = useState<GradeType | "all">("all") */
  const [selectedGradeTypeFilter, setSelectedGradeTypeFilter] = useState<GradeType | "all">(GRADE_TYPES[0]?.value || "all");
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedGradeForComment, setSelectedGradeForComment] = useState<{ enrollmentId: string; comment: string } | null>(null)
  const itemsPerPage = 25

  const selectedSubjectObj = classSubjects.find(cs => cs.id === selectedSubject)
  const subjectHasSections = selectedSubjectObj?.subject?.hasSections || false
  
  const currentSectionMaxScore = useMemo(() => {
    if (selectedSection !== "all" && subjectHasSections) {
      const section = subjectSections.find(s => s.id === selectedSection)
      return parseDecimal(section?.maxScore) || 100
    }
    if (!selectedSubjectObj?.subject) return 100
    return parseDecimal(selectedSubjectObj.subject.maxScore) || 100
  }, [selectedSubjectObj, subjectSections, selectedSection, subjectHasSections])

  // Filtrer les notes par section et par type
  const filteredGrades = useMemo(() => {
    let filtered = grades
    if (selectedSection !== "all" && subjectHasSections) {
      filtered = filtered.filter(g => g.sectionId === selectedSection)
    }
    if (selectedGradeTypeFilter !== "all") {
      filtered = filtered.filter(g => g.gradeType === selectedGradeTypeFilter)
    }
    return filtered
  }, [grades, selectedSection, subjectHasSections, selectedGradeTypeFilter])

  const sortedEnrollments = useMemo(() => {
    return [...enrollments].sort((a, b) => {
      const nameA = `${a.student?.user?.lastname || ""} ${a.student?.user?.firstname || ""}`
      const nameB = `${b.student?.user?.lastname || ""} ${b.student?.user?.firstname || ""}`
      return nameA.localeCompare(nameB)
    })
  }, [enrollments])

  const totalPages = Math.ceil(sortedEnrollments.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedEnrollments = sortedEnrollments.slice(startIndex, startIndex + itemsPerPage)

  useEffect(() => setCurrentPage(1), [selectedSession, selectedStep, selectedSection, selectedGradeTypeFilter])

  // Initialize grade entries from existing grades
  useEffect(() => {
    if (!selectedSubject || !selectedStep || enrollments.length === 0) return
    const newEntries = new Map<string, GradeEntry>()
    
    enrollments.forEach(enr => {
      let existing: Grade | undefined
      
      if (subjectHasSections && selectedSection !== "all") {
        existing = filteredGrades.find(g =>
          g.enrollmentId === enr.id &&
          g.classSubjectId === selectedSubject &&
          g.stepId === selectedStep &&
          g.sectionId === selectedSection
        )
      } else if (!subjectHasSections) {
        existing = filteredGrades.find(g =>
          g.enrollmentId === enr.id &&
          g.classSubjectId === selectedSubject &&
          g.stepId === selectedStep &&
          !g.sectionId
        )
      } else if (selectedSection === "all" && subjectHasSections) {
        existing = undefined
      } else {
        existing = undefined
      }
      
      if (existing) {
  const score = parseDecimal(existing.studentScore)
  const valueStr = score !== null ? score.toString() : ""
  newEntries.set(enr.id, { 
    enrollmentId: enr.id, 
    value: valueStr, 
    isValid: score !== null,
    gradeId: existing.id,
    originalValue: valueStr,
    sectionId: existing.sectionId,
    comment: existing.comment || "",
    originalComment: existing.comment || ""
  })
  // Set gradeType from existing grade if available
  if (existing.gradeType && !gradeType) {
    setGradeType(existing.gradeType)
  }
}else {
        newEntries.set(enr.id, { 
          enrollmentId: enr.id, 
          value: "", 
          isValid: true,
          gradeId: undefined,
          originalValue: "",
          sectionId: selectedSection !== "all" ? selectedSection : undefined,
          comment: "",
          originalComment: ""
        })
      }
    })
    setGradeEntries(newEntries)
  }, [selectedSubject, selectedStep, enrollments, filteredGrades, subjectHasSections, selectedSection])

  const validateGrade = (value: string): { isValid: boolean; error?: string } => {
    if (!value || value.trim() === "") return { isValid: true }
    const numValue = parseFloat(value)
    if (isNaN(numValue)) return { isValid: false, error: "Valeur invalide" }
    if (numValue < 0 || numValue > currentSectionMaxScore) return { isValid: false, error: `Entre 0 et ${currentSectionMaxScore}` }
    return { isValid: true }
  }

  const handleGradeChange = (enrollmentId: string, value: string) => {
    const validation = validateGrade(value)
    const newEntries = new Map(gradeEntries)
    const existingEntry = newEntries.get(enrollmentId)
    newEntries.set(enrollmentId, { 
      enrollmentId, 
      value, 
      isValid: validation.isValid, 
      error: validation.error,
      gradeId: existingEntry?.gradeId,
      originalValue: existingEntry?.originalValue,
      sectionId: selectedSection !== "all" ? selectedSection : undefined,
      comment: existingEntry?.comment || "",
      originalComment: existingEntry?.originalComment || ""
    })
    setGradeEntries(newEntries)
  }

  const handleCommentChange = (enrollmentId: string, comment: string) => {
    const newEntries = new Map(gradeEntries)
    const existingEntry = newEntries.get(enrollmentId)
    if (existingEntry) {
      newEntries.set(enrollmentId, { 
        ...existingEntry, 
        comment,
        originalComment: existingEntry.originalComment || ""
      })
      setGradeEntries(newEntries)
    }
  }

  const openCommentDialog = (enrollmentId: string, currentComment: string) => {
    setSelectedGradeForComment({ enrollmentId, comment: currentComment })
  }

  const saveComment = () => {
    if (selectedGradeForComment) {
      handleCommentChange(selectedGradeForComment.enrollmentId, selectedGradeForComment.comment)
      setSelectedGradeForComment(null)
    }
  }

  const hasErrors = useMemo(() => Array.from(gradeEntries.values()).some(e => !e.isValid), [gradeEntries])
  
  const hasChanges = useMemo(() => {
    return Array.from(gradeEntries.values()).some(e => 
      e.value !== e.originalValue || e.comment !== e.originalComment
    )
  }, [gradeEntries])

  const getModifiedEntries = useMemo(() => {
    return Array.from(gradeEntries.values()).filter(e => 
      (e.value !== e.originalValue || e.comment !== e.originalComment) && 
      e.value && e.isValid
    )
  }, [gradeEntries])

  const kpis = useMemo(() => {
    const total = sortedEnrollments.length
    const entered = Array.from(gradeEntries.values()).filter(e => e.value && e.isValid).length
    const validGrades = Array.from(gradeEntries.values()).filter(e => e.value && e.isValid).map(e => parseFloat(e.value))
    const classMean = validGrades.length > 0 ? validGrades.reduce((s, v) => s + v, 0) / validGrades.length : null
    return { total, entered, missing: total - entered, classMean }
  }, [sortedEnrollments, gradeEntries])

  const handleSaveAllGrades = () => {
    if (hasErrors || !selectedSubject || !selectedStep) return
    if (subjectHasSections && selectedSection === "all") {
      return
    }
    
    const gradesToSave = getModifiedEntries.map(e => {
      const gradeData: any = {
        enrollmentId: e.enrollmentId,
        classSubjectId: selectedSubject,
        stepId: selectedStep,
        studentScore: parseFloat(e.value),
        gradeType,
        gradeId: e.gradeId
      }
      
      if (subjectHasSections && selectedSection !== "all") {
        gradeData.sectionId = selectedSection
      }
      
      if (e.comment && e.comment.trim() !== "") {
        gradeData.comment = e.comment
      }
      
      return gradeData
    })
    
    onSaveGrades(gradesToSave)
  }

  const handleUpdateSingleGrade = (enrollmentId: string) => {
    const entry = gradeEntries.get(enrollmentId)
    if (!entry || !entry.value || !entry.isValid) return
    if (!entry.gradeId) return // Ne pas activer si pas de note existante
    
    const gradeData: any = {
      enrollmentId: entry.enrollmentId,
      classSubjectId: selectedSubject,
      stepId: selectedStep,
      studentScore: parseFloat(entry.value),
      gradeType,
      gradeId: entry.gradeId
    }
    
    if (subjectHasSections && selectedSection !== "all") {
      gradeData.sectionId = selectedSection
    }
    
    if (entry.comment && entry.comment.trim() !== "") {
      gradeData.comment = entry.comment
    }
    
    if (onUpdateGrade && entry.gradeId) {
      onUpdateGrade(entry.gradeId, parseFloat(entry.value), gradeType, selectedSection !== "all" ? selectedSection : undefined, entry.comment)
    } else {
      onSaveGrades([gradeData])
    }
  }

  const selectedStepName = steps.find(s => s.id === selectedStep)?.name || ""
  const selectedSessionObj = sessions.find(s => s.id === selectedSession)
  const sessionDisplayName = selectedSessionObj ? `${selectedSessionObj.class?.classType?.name || ""} ${selectedSessionObj.class?.letter || ""}` : ""
  const subjectDisplayName = selectedSubjectObj?.subject?.name || selectedSubjectObj?.subject?.code || ""

  // Empty state - selectors
  if (!selectedSession || !selectedStep || !selectedSubject) {
    return (
      <div className="space-y-6">
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: "10px", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ padding: "24px", borderBottom: "1px solid #E8E6E3" }}>
            <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "15px", fontWeight: 600, color: "#3A4A57" }}>
              Sélection de la classe et de l&apos;étape
            </h3>
          </div>
          <div style={{ padding: "24px" }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Select value={selectedStep} onValueChange={onStepChange}>
                <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }}>
                  <SelectValue placeholder="Sélectionner une étape" />
                </SelectTrigger>
                <SelectContent>{steps.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
              </Select>
              <Select value={selectedSession} onValueChange={onSessionChange}>
                <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }}>
                  <SelectValue placeholder="Sélectionner une classe" />
                </SelectTrigger>
                <SelectContent>{sessions.map(s => (<SelectItem key={s.id} value={s.id}>{s.class?.classType?.name || ""} {s.class?.letter || s.id.slice(0, 6)}</SelectItem>))}</SelectContent>
              </Select>
              <Select value={selectedSubject} onValueChange={onSubjectChange} disabled={classSubjects.length === 0}>
                <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px", opacity: classSubjects.length === 0 ? 0.5 : 1 }}>
                  <SelectValue placeholder="Sélectionner une matière" />
                </SelectTrigger>
                <SelectContent>{classSubjects.map(cs => (<SelectItem key={cs.id} value={cs.id}>{cs.subject?.name || cs.subject?.code || cs.id.slice(0, 6)}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="rounded-lg p-12 flex flex-col items-center justify-center text-center space-y-2" style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <p className="font-serif font-semibold" style={{ fontSize: "16px", color: "hsl(var(--muted-foreground))" }}>Choisissez une classe, une étape et une matière</p>
          <p className="font-sans" style={{ fontSize: "13px", fontWeight: 400, color: "hsl(var(--muted-foreground))" }}>pour commencer la saisie des notes</p>
        </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <Select value={selectedStep} onValueChange={onStepChange} disabled={isArchived}>
              <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }}>
                <SelectValue placeholder="Étape" />
              </SelectTrigger>
              <SelectContent>{steps.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
            </Select>
            
            <Select value={selectedSession} onValueChange={(v) => { onSessionChange(v); onSubjectChange("") }} disabled={isArchived}>
              <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }}>
                <SelectValue placeholder="Classe" />
              </SelectTrigger>
              <SelectContent>{sessions.map(s => (<SelectItem key={s.id} value={s.id}>{s.class?.classType?.name || ""} {s.class?.letter || s.id.slice(0, 6)}</SelectItem>))}</SelectContent>
            </Select>
            
            <Select value={selectedSubject} onValueChange={onSubjectChange} disabled={isArchived || classSubjects.length === 0}>
              <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px", opacity: (isArchived || classSubjects.length === 0) ? 0.5 : 1 }}>
                <SelectValue placeholder="Matière" />
              </SelectTrigger>
              <SelectContent>{classSubjects.map(cs => (<SelectItem key={cs.id} value={cs.id}>{cs.subject?.name || cs.subject?.code || cs.id.slice(0, 6)}</SelectItem>))}</SelectContent>
            </Select>
            
            {/* Filtre par type de note */}
            <Select value={selectedGradeTypeFilter} onValueChange={(v) => setSelectedGradeTypeFilter(v as GradeType | "all")} disabled={isArchived}>
              <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }}>
                <SelectValue placeholder="Type de note" />
              </SelectTrigger>
              <SelectContent>
                {/* <SelectItem value="all">Tous les types</SelectItem> */}
                {GRADE_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Filtre par section pour les matières avec sections */}
            {subjectHasSections && subjectSections.length > 0 && (
              <Select value={selectedSection} onValueChange={setSelectedSection} disabled={isArchived}>
                <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }}>
                  <SelectValue placeholder="Filtrer par section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <FilterIcon className="h-4 w-4" />
                      <span>Toutes les sections</span>
                    </div>
                  </SelectItem>
                  {subjectSections.map(section => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name} (/{section.maxScore})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {/* <Select value={gradeType} onValueChange={v => setGradeType(v as GradeType)} disabled={isArchived}>
              <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }}>
                <SelectValue placeholder="Type de note à saisir" />
              </SelectTrigger>
              <SelectContent>{GRADE_TYPES.map(t => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}</SelectContent>
            </Select> */}
          </div>
          
          {/* Section Statistics Panel */}
          {subjectHasSections && selectedSection === "all" && (
            <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: "#F0F4F7", border: "1px solid #D1CECC" }}>
              <div className="flex items-center gap-2 mb-3">
                <BarChart3Icon className="h-4 w-4" style={{ color: "#5A7085" }} />
                <h4 className="font-semibold" style={{ fontSize: "13px", color: "#2C4A6E" }}>Statistiques par section</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {subjectSections.map(section => {
                  const sectionGrades = grades.filter(g => g.sectionId === section.id)
                  const completedCount = sectionGrades.length
                  const totalPossible = sortedEnrollments.length
                  const completionRate = totalPossible > 0 ? (completedCount / totalPossible) * 100 : 0
                  const scores = sectionGrades
  .map(g => parseDecimal(g.studentScore))
  .filter((score): score is number => score !== null)

const average = scores.length > 0 
  ? scores.reduce((a, b) => a + b, 0) / scores.length 
  : null
                  
                  return (
                    <div key={section.id} className="p-3 rounded-lg" style={{ backgroundColor: "white" }}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium" style={{ fontSize: "14px", color: "#2C4A6E" }}>{section.name}</span>
                        <Badge variant="outline" style={{ fontSize: "11px" }}>
                          {completedCount}/{totalPossible}
                        </Badge>
                      </div>
                      <div className="text-sm" style={{ color: "#5A7085" }}>
                        {average !== null ? (
                          <div className="flex justify-between">
                            <span>Moyenne:</span>
                            <strong style={{ color: "#2C4A6E" }}>{average.toFixed(2)} / {section.maxScore}</strong>
                          </div>
                        ) : (
                          <span className="italic">Aucune note saisie</span>
                        )}
                      </div>
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                        <div 
                          className="bg-blue-600 h-1.5 rounded-full" 
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          
          {/* Messages informatifs */}
          {subjectHasSections && selectedSection === "all" && (
            <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: "#E6F7FF", border: "1px solid #0099CC" }}>
              <p style={{ color: "#0099CC", fontSize: "13px" }}>
                Mode "Toutes les sections" - Visualisation des statistiques. Pour saisir ou modifier des notes, veuillez sélectionner une section spécifique.
              </p>
            </div>
          )}
          
          {subjectHasSections && selectedSection !== "all" && selectedSection && (
            <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: "#E8F5E9", border: "1px solid #4CAF50" }}>
              <p style={{ color: "#2E7D32", fontSize: "13px" }}>
                Saisie des notes pour la section: <strong>{subjectSections.find(s => s.id === selectedSection)?.name}</strong>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Header with class average */}
      {(!subjectHasSections || selectedSection !== "all") && (
        <div className="rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3" style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <h2 className="font-serif font-semibold" style={{ fontSize: "18px", color: "#2C4A6E" }}>
            {selectedStepName} — {sessionDisplayName} — {subjectDisplayName}
            {selectedSection !== "all" && subjectHasSections && (
              <span style={{ fontSize: "14px", color: "#5A7085", marginLeft: "8px" }}>
                ({subjectSections.find(s => s.id === selectedSection)?.name})
              </span>
            )}
            {selectedGradeTypeFilter !== "all" && (
              <span style={{ fontSize: "14px", color: "#5A7085", marginLeft: "8px" }}>
                [Type: {GRADE_TYPES.find(t => t.value === selectedGradeTypeFilter)?.label}]
              </span>
            )}
          </h2>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs">{kpis.entered}/{kpis.total} saisis</Badge>
            {kpis.classMean !== null && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ backgroundColor: "#F0F4F7" }}>
                <BarChart3Icon className="h-4 w-4" style={{ color: "#5A7085" }} />
                <span className="font-sans font-semibold" style={{ fontSize: "14px", color: "#2C4A6E" }}>
                  Moy: {kpis.classMean.toFixed(2)} / {currentSectionMaxScore}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grades Table */}
      {(!subjectHasSections || selectedSection !== "all") && (
        <>
          <div className="rounded-lg overflow-hidden" style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr style={{ backgroundColor: "#F1F5F9", borderBottom: "2px solid #D1D5DB" }}>
                    <th className="text-left px-6 py-3 font-sans font-bold uppercase" style={{ fontSize: "12px", letterSpacing: "0.06em", color: "#2C4A6E", width: "20%" }}>NOM</th>
                    <th className="text-left px-6 py-3 font-sans font-bold uppercase" style={{ fontSize: "12px", letterSpacing: "0.06em", color: "#2C4A6E", width: "20%" }}>PRÉNOM</th>
                    <th className="text-center px-6 py-3 font-sans font-bold uppercase" style={{ fontSize: "12px", letterSpacing: "0.06em", color: "#2C4A6E", width: "15%" }}>NOTE /{currentSectionMaxScore}</th>
                    <th className="text-center px-6 py-3 font-sans font-bold uppercase" style={{ fontSize: "12px", letterSpacing: "0.06em", color: "#2C4A6E", width: "25%" }}>COMMENTAIRE</th>
                    <th className="text-center px-6 py-3 font-sans font-bold uppercase" style={{ fontSize: "12px", letterSpacing: "0.06em", color: "#2C4A6E", width: "10%" }}>STATUT</th>
                    <th className="text-center px-6 py-3 font-sans font-bold uppercase" style={{ fontSize: "12px", letterSpacing: "0.06em", color: "#2C4A6E", width: "10%" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEnrollments.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Aucun élève inscrit dans cette classe</td></tr>
                  ) : paginatedEnrollments.map((enr, index) => {
                    const user = enr.student?.user
                    const entry = gradeEntries.get(enr.id)
                    const hasValue = entry && entry.value && entry.value.trim() !== ""
                    const hasError = entry && !entry.isValid && hasValue
                    const isExistingGrade = entry && entry.gradeId
                    const isModified = entry && (entry.value !== entry.originalValue || entry.comment !== entry.originalComment)

                    return (
                      <tr key={enr.id} style={{ borderBottom: index < paginatedEnrollments.length - 1 ? "1px solid #E8E6E3" : "none", backgroundColor: index % 2 === 0 ? "white" : "#FAFAF8", height: "48px" }}>
                        <td className="px-6 py-3 font-sans" style={{ fontSize: "14px", fontWeight: 600, color: "#1E1A17" }}>{user?.lastname || ""}</td>
                        <td className="px-6 py-3 font-sans" style={{ fontSize: "14px", fontWeight: 400, color: "#1E1A17" }}>{user?.firstname || ""}</td>
                        <td className="px-6 py-3">
                          <div className="flex justify-center">
                            <Input
                              type="number" 
                              min="0" 
                              max={currentSectionMaxScore} 
                              step="0.5"
                              value={entry?.value || ""} 
                              onChange={(e) => handleGradeChange(enr.id, e.target.value)}
                              placeholder="—" 
                              disabled={isArchived} 
                              className="text-center"
                              style={{ 
                                width: "90px", 
                                borderRadius: "8px", 
                                borderColor: hasError ? "#EF4444" : isModified ? "#F59E0B" : hasValue ? "#2C4A6E" : "#D1D5DB", 
                                borderWidth: "1px", 
                                color: "#1E1A17",
                                backgroundColor: isModified ? "#FEF3C7" : "white"
                              }}
                            />
                          </div>
                          {hasError && entry?.error && <p className="text-center mt-1 font-sans" style={{ fontSize: "11px", color: "#EF4444" }}>{entry.error}</p>}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <Input
                              type="text"
                              value={entry?.comment || ""}
                              onChange={(e) => handleCommentChange(enr.id, e.target.value)}
                              placeholder="Ajouter un commentaire..."
                              disabled={isArchived}
                              className="flex-1"
                              style={{ 
                                fontSize: "13px",
                                borderRadius: "8px",
                                borderColor: "#D1D5DB"
                              }}
                            />
                            {entry?.comment && entry.comment !== entry.originalComment && (
                              <Badge style={{ backgroundColor: "#FEF3C7", color: "#B45309", fontSize: "10px" }}>
                                Modifié
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <Badge variant="secondary" style={{ 
                            backgroundColor: hasValue && entry?.isValid ? (isModified ? "#FEF3C7" : isExistingGrade ? "#DBEAFE" : "#D1FAE5") : "#F3F4F6", 
                            color: hasValue && entry?.isValid ? (isModified ? "#B45309" : isExistingGrade ? "#1E40AF" : "#065F46") : "#6B7280", 
                            border: "none", 
                            fontWeight: 500 
                          }}>
                            {hasValue && entry?.isValid ? (isModified ? "Modifié" : isExistingGrade ? "Enregistré" : "Saisi") : "Non saisi"}
                          </Badge>
                        </td>
                        <td className="px-6 py-3 text-center">
                          {hasValue && entry?.isValid && isModified && isExistingGrade && (
                            <Button
                              size="sm"
                              onClick={() => handleUpdateSingleGrade(enr.id)}
                              disabled={isArchived}
                              style={{
                                backgroundColor: "#F59E0B",
                                color: "white",
                                fontSize: "12px",
                                padding: "4px 12px",
                                height: "32px"
                              }}
                            >
                              <RefreshCwIcon className="h-3 w-3 mr-1" />
                              Mettre à jour
                            </Button>
                          )}
                          {hasValue && entry?.isValid && !isModified && isExistingGrade && (
                            <span style={{ fontSize: "12px", color: "#6B7280" }}>À jour</span>
                          )}
                          {!hasValue && (
                            <span style={{ fontSize: "12px", color: "#9CA3AF" }}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {sortedEnrollments.length > itemsPerPage && (
            <div className="flex items-center justify-center gap-4">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} style={{ borderColor: "#D1CECC" }}>Précédent</Button>
              <span style={{ color: "#78756F", fontSize: "14px" }}>Page {currentPage} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} style={{ borderColor: "#D1CECC" }}>Suivant</Button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {hasChanges && (
              <Button 
                size="lg" 
                disabled={hasErrors || isArchived} 
                onClick={handleSaveAllGrades}
                style={{ 
                  backgroundColor: (hasErrors || isArchived) ? "#9CA3AF" : "#5A7085", 
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
                Enregistrer toutes les modifications ({getModifiedEntries.length})
              </Button>
            )}
            {!hasChanges && (
              <div style={{ fontSize: "14px", color: "#6B7280", padding: "10px 0" }}>
                Aucune modification à enregistrer
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}