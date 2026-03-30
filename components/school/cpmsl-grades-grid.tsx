"use client"

import { useState, useEffect, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { SaveIcon } from "lucide-react"
import type { ApiClassSession } from "@/lib/api/students"
import type { AcademicYearStep } from "@/lib/api/dashboard"
import type { ApiClassSubject, ApiEnrollment, ApiGrade, CreateGradePayload } from "@/lib/api/grades"

interface GradeEntry {
  enrollmentId: string
  value: string
  isValid: boolean
  error?: string
}

interface CPMSLGradesGridProps {
  sessions: ApiClassSession[]
  steps: AcademicYearStep[]
  classSubjects: ApiClassSubject[]
  enrollments: ApiEnrollment[]
  existingGrades: ApiGrade[]
  selectedSessionId: string
  selectedClassSubjectId: string
  selectedStepId: string
  loadingSession: boolean
  loadingGrades: boolean
  saving: boolean
  onSessionChange: (sessionId: string) => void
  onClassSubjectChange: (classSubjectId: string) => void
  onStepChange: (stepId: string) => void
  onSaveGrades: (grades: CreateGradePayload[]) => void
}

function sessionLabel(session: ApiClassSession): string {
  const { classType, letter, track } = session.class
  const base = `${classType.name} ${letter}`
  return track ? `${base} ${track.code}` : base
}

export function CPMSLGradesGrid({
  sessions,
  steps,
  classSubjects,
  enrollments,
  existingGrades,
  selectedSessionId,
  selectedClassSubjectId,
  selectedStepId,
  loadingSession,
  loadingGrades,
  saving,
  onSessionChange,
  onClassSubjectChange,
  onStepChange,
  onSaveGrades,
}: CPMSLGradesGridProps) {
  const [gradeEntries, setGradeEntries] = useState<Map<string, GradeEntry>>(new Map())
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 25

  const selectedClassSubject = useMemo(
    () => classSubjects.find(cs => cs.id === selectedClassSubjectId),
    [classSubjects, selectedClassSubjectId]
  )
  const maxScore = selectedClassSubject?.subject.maxScore ?? 10

  const selectedStep = useMemo(
    () => steps.find(s => s.id === selectedStepId),
    [steps, selectedStepId]
  )

  const selectedSession = useMemo(
    () => sessions.find(s => s.id === selectedSessionId),
    [sessions, selectedSessionId]
  )

  // Pre-fill grade entries from existingGrades
  useEffect(() => {
    const newEntries = new Map<string, GradeEntry>()
    existingGrades
      .filter(
        g =>
          g.classSubjectId === selectedClassSubjectId &&
          g.sectionId === null &&
          g.stepId === selectedStepId
      )
      .forEach(g => {
        newEntries.set(g.enrollmentId, {
          enrollmentId: g.enrollmentId,
          value: g.studentScore.toString(),
          isValid: true,
        })
      })
    setGradeEntries(newEntries)
    setCurrentPage(1)
  }, [existingGrades, selectedClassSubjectId, selectedStepId])

  // Reset page on context change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedSessionId, selectedClassSubjectId, selectedStepId])

  const sortedEnrollments = useMemo(
    () =>
      [...enrollments].sort((a, b) =>
        `${a.student.user.lastname} ${a.student.user.firstname}`.localeCompare(
          `${b.student.user.lastname} ${b.student.user.firstname}`
        )
      ),
    [enrollments]
  )

  const totalPages = Math.ceil(sortedEnrollments.length / itemsPerPage)
  const paginatedEnrollments = sortedEnrollments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  function validateScore(value: string): { isValid: boolean; error?: string } {
    if (!value || value.trim() === '') return { isValid: true }
    const num = parseFloat(value)
    if (isNaN(num)) return { isValid: false, error: 'Valeur invalide' }
    if (num < 0 || num > maxScore) return { isValid: false, error: `Entre 0 et ${maxScore}` }
    if (Math.round(num * 4 * 1e10) / 1e10 !== Math.round(num * 4)) {
      return { isValid: false, error: 'Multiples de 0.25 uniquement' }
    }
    return { isValid: true }
  }

  function handleGradeChange(enrollmentId: string, value: string) {
    const validation = validateScore(value)
    setGradeEntries(prev => {
      const next = new Map(prev)
      next.set(enrollmentId, { enrollmentId, value, isValid: validation.isValid, error: validation.error })
      return next
    })
  }

  const hasErrors = useMemo(
    () => Array.from(gradeEntries.values()).some(e => !e.isValid),
    [gradeEntries]
  )

  const enteredCount = useMemo(
    () => Array.from(gradeEntries.values()).filter(e => e.value && e.isValid).length,
    [gradeEntries]
  )

  function handleSaveGrades() {
    if (!selectedClassSubjectId || !selectedStepId || hasErrors) return
    const existingByEnrollment = new Set(existingGrades.map(g => g.enrollmentId))
    const payload: CreateGradePayload[] = []
    gradeEntries.forEach((entry, enrollmentId) => {
      if (entry.value && entry.isValid && !existingByEnrollment.has(enrollmentId)) {
        payload.push({
          enrollmentId,
          classSubjectId: selectedClassSubjectId,
          stepId: selectedStepId,
          studentScore: parseFloat(entry.value),
          gradeType: 'EXAM',
        })
      }
    })
    onSaveGrades(payload)
  }

  const headerLabel = useMemo(() => {
    return [
      selectedSession ? sessionLabel(selectedSession) : null,
      selectedStep?.name,
      selectedClassSubject?.subject.name,
    ]
      .filter(Boolean)
      .join(' — ')
  }, [selectedSession, selectedStep, selectedClassSubject])

  const showContent = selectedSessionId && selectedClassSubjectId && selectedStepId

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
            Sélection de la classe et de l&apos;étape
          </h3>
        </div>
        <div style={{ padding: "24px" }}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select value={selectedSessionId} onValueChange={onSessionChange}>
              <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }}>
                <SelectValue placeholder="Sélectionner une classe" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map(s => (
                  <SelectItem key={s.id} value={s.id}>{sessionLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStepId} onValueChange={onStepChange}>
              <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }}>
                <SelectValue placeholder="Sélectionner une étape" />
              </SelectTrigger>
              <SelectContent>
                {steps.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedClassSubjectId}
              onValueChange={onClassSubjectChange}
              disabled={!selectedSessionId || loadingSession}
            >
              <SelectTrigger
                style={{
                  borderColor: "#D1CECC",
                  borderRadius: "8px",
                  opacity: !selectedSessionId || loadingSession ? 0.5 : 1,
                  cursor: !selectedSessionId || loadingSession ? "not-allowed" : "pointer",
                }}
              >
                <SelectValue placeholder={loadingSession ? "Chargement..." : "Sélectionner une matière"} />
              </SelectTrigger>
              <SelectContent>
                {classSubjects.map(cs => (
                  <SelectItem key={cs.id} value={cs.id}>{cs.subject.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {loadingSession ? (
        <div
          className="flex items-center justify-center py-16 rounded-lg"
          style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
        >
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: "#5A7085" }} />
        </div>
      ) : !showContent ? (
        <div
          className="rounded-lg p-12 flex flex-col items-center justify-center text-center space-y-2"
          style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
        >
          <p className="font-serif font-semibold" style={{ fontSize: "16px", color: "hsl(var(--muted-foreground))" }}>
            Choisissez une classe, une étape et une matière
          </p>
          <p className="font-sans" style={{ fontSize: "13px", fontWeight: 400, color: "hsl(var(--muted-foreground))" }}>
            pour commencer la saisie des notes
          </p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div
            className="rounded-lg p-4 flex items-center justify-between"
            style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
          >
            <h2 className="font-serif font-semibold" style={{ fontSize: "18px", color: "#2C4A6E" }}>
              {headerLabel}
            </h2>
            <div className="font-sans text-sm" style={{ color: "#5A7085" }}>
              {enteredCount} / {sortedEnrollments.length} notes saisies
            </div>
          </div>

          {loadingGrades ? (
            <div
              className="flex items-center justify-center py-16 rounded-lg"
              style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
            >
              <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: "#5A7085" }} />
            </div>
          ) : (
            <>
              {/* Grades Table */}
              <div
                className="rounded-lg overflow-hidden"
                style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead>
                      <tr style={{ backgroundColor: "#F1F5F9", borderBottom: "2px solid #D1D5DB" }}>
                        <th className="text-left px-6 py-3 font-sans font-bold uppercase" style={{ fontSize: "12px", letterSpacing: "0.06em", color: "#2C4A6E", width: "20%" }}>NOM</th>
                        <th className="text-left px-6 py-3 font-sans font-bold uppercase" style={{ fontSize: "12px", letterSpacing: "0.06em", color: "#2C4A6E", width: "20%" }}>PRÉNOM</th>
                        <th className="text-left px-6 py-3 font-sans font-bold uppercase" style={{ fontSize: "12px", letterSpacing: "0.06em", color: "#2C4A6E", width: "15%" }}>CODE</th>
                        <th className="text-center px-6 py-3 font-sans font-bold uppercase" style={{ fontSize: "12px", letterSpacing: "0.06em", color: "#2C4A6E", width: "25%" }}>NOTE / {maxScore}</th>
                        <th className="text-center px-6 py-3 font-sans font-bold uppercase" style={{ fontSize: "12px", letterSpacing: "0.06em", color: "#2C4A6E", width: "20%" }}>STATUT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedEnrollments.map((enrollment, index) => {
                        const entry = gradeEntries.get(enrollment.id)
                        const hasValue = !!entry?.value?.trim()
                        const hasError = hasValue && entry && !entry.isValid
                        const isExisting = existingGrades.some(g => g.enrollmentId === enrollment.id)

                        return (
                          <tr
                            key={enrollment.id}
                            style={{
                              borderBottom: index < paginatedEnrollments.length - 1 ? "1px solid #E8E6E3" : "none",
                              backgroundColor: index % 2 === 0 ? "white" : "#FAFAF8",
                              height: "48px",
                            }}
                          >
                            <td className="px-6 py-3 font-sans" style={{ fontSize: "14px", fontWeight: 600, color: "#1E1A17" }}>
                              {enrollment.student.user.lastname}
                            </td>
                            <td className="px-6 py-3 font-sans" style={{ fontSize: "14px", fontWeight: 400, color: "#1E1A17" }}>
                              {enrollment.student.user.firstname}
                            </td>
                            <td className="px-6 py-3 font-sans" style={{ fontSize: "13px", color: "#78756F" }}>
                              {enrollment.student.studentCode}
                            </td>
                            <td className="px-6 py-3">
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    max={maxScore}
                                    step="0.25"
                                    value={entry?.value || ''}
                                    onChange={e => handleGradeChange(enrollment.id, e.target.value)}
                                    placeholder="—"
                                    disabled={isExisting}
                                    className="text-center"
                                    style={{
                                      width: "80px",
                                      borderRadius: "8px",
                                      borderColor: hasError ? "#EF4444" : hasValue ? "#2C4A6E" : "#D1D5DB",
                                      borderWidth: "1px",
                                      color: "#1E1A17",
                                    }}
                                    onKeyDown={e => {
                                      if (e.key === 'Tab') {
                                        e.preventDefault()
                                        const currentIndex = paginatedEnrollments.findIndex(en => en.id === enrollment.id)
                                        if (currentIndex < paginatedEnrollments.length - 1) {
                                          const nextId = paginatedEnrollments[currentIndex + 1].id
                                          const nextInput = document.querySelector(`input[data-enrollment-id="${nextId}"]`) as HTMLInputElement
                                          nextInput?.focus()
                                        }
                                      }
                                    }}
                                    data-enrollment-id={enrollment.id}
                                  />
                                  <span className="font-sans text-xs" style={{ color: "#78756F" }}>/ {maxScore}</span>
                                </div>
                                {hasError && entry?.error && (
                                  <p className="font-sans" style={{ fontSize: "11px", color: "#EF4444" }}>{entry.error}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-3 text-center">
                              <Badge
                                variant="secondary"
                                style={{
                                  backgroundColor: isExisting ? "#E0F2FE" : hasValue && !hasError ? "#D1FAE5" : "#F3F4F6",
                                  color: isExisting ? "#0369A1" : hasValue && !hasError ? "#065F46" : "#6B7280",
                                  border: "none",
                                  fontWeight: 500,
                                }}
                              >
                                {isExisting ? 'Enregistré' : hasValue && !hasError ? 'Saisi' : 'Non saisi'}
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
              {sortedEnrollments.length > itemsPerPage && (
                <div className="flex items-center justify-center">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
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
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      style={{ borderColor: "#D1CECC", color: "#5C5955" }}
                    >
                      Suivant →
                    </Button>
                  </div>
                </div>
              )}

              {/* Save Button */}
              <div className="flex items-center gap-3" style={{ marginTop: "24px" }}>
                <Button
                  size="lg"
                  disabled={!selectedClassSubjectId || !selectedStepId || hasErrors || saving}
                  onClick={handleSaveGrades}
                  style={{
                    backgroundColor: !selectedClassSubjectId || !selectedStepId || hasErrors || saving ? "#9CA3AF" : "#5A7085",
                    color: "#FFFFFF",
                    fontSize: "14px",
                    fontWeight: 600,
                    borderRadius: "8px",
                    padding: "10px 24px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <SaveIcon className="h-4 w-4" />
                  {saving ? 'Enregistrement...' : 'Enregistrer les notes'}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
