"use client"

import { useState, useEffect, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { SaveIcon, LockIcon } from "lucide-react"
import type { ApiClassSession } from "@/lib/api/students"
import type { AcademicYearStep } from "@/lib/api/dashboard"
import type { ApiClassSubject, ApiEnrollment, ApiGrade, CreateGradePayload } from "@/lib/api/grades"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UpdateGradePayload {
  gradeId:      string
  studentScore: number
  gradeType:    'EXAM' | 'HOMEWORK' | 'ORAL'
}

interface GradeEntry {
  enrollmentId: string
  value:        string
  isValid:      boolean
  error?:       string
}

interface CPMSLGradesGridProps {
  sessions:               ApiClassSession[]
  steps:                  AcademicYearStep[]
  classSubjects:          ApiClassSubject[]
  enrollments:            ApiEnrollment[]
  existingGrades:         ApiGrade[]
  selectedSessionId:      string
  selectedClassSubjectId: string
  selectedStepId:         string
  loadingSession:         boolean
  loadingGrades:          boolean
  saving:                 boolean
  onSessionChange:        (sessionId: string) => void
  onClassSubjectChange:   (classSubjectId: string) => void
  onStepChange:           (stepId: string) => void
  onSaveGrades:           (toCreate: CreateGradePayload[], toUpdate: UpdateGradePayload[]) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sessionLabel(session: ApiClassSession): string {
  const { classType, letter, track } = session.class
  const base = `${classType.name} ${letter}`
  return track ? `${base} ${track.code}` : base
}

// ── Composant ─────────────────────────────────────────────────────────────────

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
  const [currentPage,  setCurrentPage]  = useState(1)
  const itemsPerPage = 25

  const selectedClassSubject = useMemo(
    () => classSubjects.find(cs => cs.id === selectedClassSubjectId),
    [classSubjects, selectedClassSubjectId]
  )
  const maxScore = (() => {
  const raw = selectedClassSubject?.subject.maxScore
  if (!raw) return 10
  if (typeof raw === 'object' && (raw as any).d) return Number((raw as any).d[0])
  return Number(raw) || 10
  })()


  const selectedStep = useMemo(
    () => steps.find(s => s.id === selectedStepId),
    [steps, selectedStepId]
  )

  const selectedSession = useMemo(
    () => sessions.find(s => s.id === selectedSessionId),
    [sessions, selectedSessionId]
  )

  const isLocked   = selectedStep ? !selectedStep.isCurrent : false   // +1
  const showContent = !!(selectedSessionId && selectedClassSubjectId && selectedStepId)

  // ── Pré-remplissage depuis les notes existantes ──────────────────────────

  useEffect(() => {
    const newEntries = new Map<string, GradeEntry>()
    existingGrades
      .filter(
        g =>
          g.classSubjectId === selectedClassSubjectId &&
          g.sectionId      === null &&
          g.stepId         === selectedStepId
      )
      .forEach(g => {
        newEntries.set(g.enrollmentId, {
          enrollmentId: g.enrollmentId,
          value:   String(g.studentScore),
          isValid: true,
        })
      })
    setGradeEntries(newEntries)
    setCurrentPage(1)
  }, [existingGrades, selectedClassSubjectId, selectedStepId])

  useEffect(() => { setCurrentPage(1) }, [selectedSessionId, selectedClassSubjectId, selectedStepId])

  // ── Tri alphabétique ──────────────────────────────────────────────────────

  const sortedEnrollments = useMemo(
    () =>
      [...enrollments].sort((a, b) =>
        `${a.student.user.lastname} ${a.student.user.firstname}`.localeCompare(
          `${b.student.user.lastname} ${b.student.user.firstname}`
        )
      ),
    [enrollments]
  )

  const totalPages           = Math.ceil(sortedEnrollments.length / itemsPerPage)
  const paginatedEnrollments = sortedEnrollments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // ── Validation BR-002 : multiples de 0.25 ────────────────────────────────

  function validateScore(value: string): { isValid: boolean; error?: string } {
    if (!value || value.trim() === '') return { isValid: true }
    const num = parseFloat(value)
    if (isNaN(num))                return { isValid: false, error: 'Valeur invalide' }
    if (num < 0 || num > maxScore) return { isValid: false, error: `Entre 0 et ${maxScore}` }
    if (Math.round(num * 4 * 1e10) / 1e10 !== Math.round(num * 4))
      return { isValid: false, error: 'Multiples de 0.25 uniquement' }
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

  // ── Save ─────────────────────────────────────────────────────────────────

  function handleSaveGrades() {
    if (!selectedClassSubjectId || !selectedStepId || hasErrors || isLocked) return

    const existingMap = new Map(
      existingGrades
        .filter(g => g.classSubjectId === selectedClassSubjectId && g.stepId === selectedStepId && g.sectionId === null)
        .map(g => [g.enrollmentId, g])
    )

    const toCreate: CreateGradePayload[] = []
    const toUpdate: UpdateGradePayload[] = []

    gradeEntries.forEach((entry, enrollmentId) => {
      if (!entry.value || !entry.isValid) return
      const score    = parseFloat(entry.value)
      const existing = existingMap.get(enrollmentId)

      if (!existing) {
        toCreate.push({ enrollmentId, classSubjectId: selectedClassSubjectId, stepId: selectedStepId, studentScore: score, gradeType: 'EXAM' })
      } else if (score !== Number(existing.studentScore)) {
        toUpdate.push({ gradeId: existing.id, studentScore: score, gradeType: 'EXAM' })
      }
    })

    if (toCreate.length === 0 && toUpdate.length === 0) return
    onSaveGrades(toCreate, toUpdate)
  }

  const headerLabel = useMemo(() => {
    return [
      selectedSession ? sessionLabel(selectedSession) : null,
      selectedStep?.name,
      selectedClassSubject?.subject.name,
    ].filter(Boolean).join(' — ')
  }, [selectedSession, selectedStep, selectedClassSubject])

  // ── Badge helper ──────────────────────────────────────────────────────────

  function getBadge(enrollmentId: string) {
    const entry    = gradeEntries.get(enrollmentId)
    const existing = existingGrades.find(
      g => g.enrollmentId === enrollmentId &&
           g.classSubjectId === selectedClassSubjectId &&
           g.stepId         === selectedStepId &&
           g.sectionId      === null
    )
    const hasValue   = !!entry?.value?.trim()
    const hasError   = hasValue && entry && !entry.isValid
    const isModified = existing && hasValue && !hasError && parseFloat(entry!.value) !== Number(existing.studentScore)

    if (isModified)                         return { label: 'Modifié',    bg: '#FEF6E0', color: '#854F0B' }
    if (existing && !hasValue)              return { label: 'Enregistré', bg: '#E0F2FE', color: '#0369A1' }
    if (existing && hasValue && !hasError)  return { label: 'Enregistré', bg: '#E0F2FE', color: '#0369A1' }
    if (!existing && hasValue && !hasError) return { label: 'Saisi',      bg: '#D1FAE5', color: '#065F46' }
    return { label: 'Non saisi', bg: '#F3F4F6', color: '#6B7280' }
  }

  // ── Spinner partagé ───────────────────────────────────────────────────────

  function renderSpinner() {
    return (
      <div className="flex items-center justify-center py-16 rounded-lg"
        style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: "#5A7085" }} />
      </div>
    )
  }

  // ── Bouton Save ───────────────────────────────────────────────────────────
  // Extracted: kills 3 ternaries that were nested 3 levels deep in the render.

  function renderSaveButton() {
    const isDisabled = !selectedClassSubjectId || !selectedStepId || hasErrors || saving  // +1 ||
    const bgColor    = isDisabled ? "#9CA3AF" : "#5A7085"

    return (
      <div className="flex items-center gap-3" style={{ marginTop: "24px" }}>
        <Button size="lg" disabled={isDisabled} onClick={handleSaveGrades}
          style={{ backgroundColor: bgColor, color: "#FFFFFF", fontSize: "14px", fontWeight: 600,
            borderRadius: "8px", padding: "10px 24px", display: "flex", alignItems: "center", gap: "8px" }}>
          {saving                                                      // +1 ternary
            ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            : <SaveIcon className="h-4 w-4" />}
          {saving ? 'Enregistrement...' : 'Enregistrer les notes'}    {/* +1 ternary */}
        </Button>
      </div>
    )
  }

  // ── Table row ─────────────────────────────────────────────────────────────

  function renderTableRow(enrollment: ApiEnrollment, index: number) {
    const entry    = gradeEntries.get(enrollment.id)
    const hasValue = !!entry?.value?.trim()
    const hasError = hasValue && entry && !entry.isValid     // +1 &&
    const badge    = getBadge(enrollment.id)

    return (
      <tr key={enrollment.id}
        style={{
          borderBottom:    index < paginatedEnrollments.length - 1 ? "1px solid #E8E6E3" : "none",  // +1
          backgroundColor: index % 2 === 0 ? "white" : "#FAFAF8",                                   // +1
          height: "48px",
        }}>
        <td className="px-6 py-3 font-sans" style={{ fontSize: "14px", fontWeight: 600, color: "#1E1A17" }}>
          {enrollment.student.user.lastname}
        </td>
        <td className="px-6 py-3 font-sans" style={{ fontSize: "14px", color: "#1E1A17" }}>
          {enrollment.student.user.firstname}
        </td>
        <td className="px-6 py-3 font-sans" style={{ fontSize: "13px", color: "#78756F" }}>
          {enrollment.student.studentCode}
        </td>
        <td className="px-6 py-3">
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <Input
                type="number" min="0" max={String(maxScore)} step="0.25"
                value={entry?.value || ''} placeholder="—" disabled={isLocked}
                onChange={e => handleGradeChange(enrollment.id, e.target.value)}
                className="text-center"
                style={{
                  width: "80px", borderRadius: "8px",
                  borderColor: hasError ? "#EF4444" : hasValue ? "#2C4A6E" : "#D1D5DB",  // +1 nested ternary
                  borderWidth: "1px", color: "#1E1A17",
                }}
                onKeyDown={e => {
                  if (e.key !== 'Tab') return                                // +1 early-return guard
                  e.preventDefault()
                  const idx    = paginatedEnrollments.findIndex(en => en.id === enrollment.id)
                  if (idx >= paginatedEnrollments.length - 1) return         // +1
                  const nextId = paginatedEnrollments[idx + 1].id
                  const next   = document.querySelector(`input[data-enrollment-id="${nextId}"]`) as HTMLInputElement
                  next?.focus()
                }}
                data-enrollment-id={enrollment.id}
              />
              <span className="font-sans text-xs" style={{ color: "#78756F" }}>/ {maxScore}</span>
            </div>
            {hasError && entry?.error && (                                    // +1 &&
              <p className="font-sans" style={{ fontSize: "11px", color: "#EF4444" }}>{entry.error}</p>
            )}
          </div>
        </td>
        <td className="px-6 py-3 text-center">
          <Badge variant="secondary"
            style={{ backgroundColor: badge.bg, color: badge.color, border: "none", fontWeight: 500 }}>
            {badge.label}
          </Badge>
        </td>
      </tr>
    )
  }

  // ── Section notes (table + pagination + save) ─────────────────────────────
  // Extracted: kills the loadingGrades ternary that was nested 2 levels deep.

  function renderGradesSection() {
    if (loadingGrades) return renderSpinner()    // +1 if

    return (
      <>
        {/* Tableau */}
        <div className="rounded-lg overflow-hidden"
          style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr style={{ backgroundColor: "#F1F5F9", borderBottom: "2px solid #D1D5DB" }}>
                  {["NOM", "PRÉNOM", "CODE", `NOTE / ${maxScore}`, "STATUT"].map((h, i) => (
                    <th key={h}
                      className={`px-6 py-3 font-sans font-bold uppercase ${i >= 3 ? "text-center" : "text-left"}`}  // +1 ternary
                      style={{ fontSize: "12px", letterSpacing: "0.06em", color: "#2C4A6E",
                        width: i === 0 ? "20%" : i === 1 ? "20%" : i === 2 ? "15%" : i === 3 ? "25%" : "20%" }}>    {/* +1 nested ternaries */}
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedEnrollments.map((enrollment, index) => renderTableRow(enrollment, index))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {sortedEnrollments.length > itemsPerPage && (                       // +1 &&
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{ borderColor: "#D1CECC", color: "#5C5955" }}>
                ← Précédent
              </Button>
              <span className="body-base" style={{ color: "#78756F" }}>
                Page {currentPage} sur {totalPages}
              </span>
              <Button variant="outline" size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{ borderColor: "#D1CECC", color: "#5C5955" }}>
                Suivant →
              </Button>
            </div>
          </div>
        )}

        {/* Bouton Save */}
        {!isLocked && renderSaveButton()}                                    {/* +1 && */}
      </>
    )
  }

  // ── Contenu principal ─────────────────────────────────────────────────────
  // Extracted: kills the loadingSession / !showContent ternary chain that was
  // the root of the nesting problem. Early returns flatten the flow.

  function renderMainContent() {
    if (loadingSession) return renderSpinner()   // +1
    if (!showContent)   return (                 // +1
      <div className="rounded-lg p-12 flex flex-col items-center justify-center text-center space-y-2"
        style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <p className="font-serif font-semibold" style={{ fontSize: "16px", color: "hsl(var(--muted-foreground))" }}>
          Choisissez une classe, une étape et une matière
        </p>
        <p className="font-sans" style={{ fontSize: "13px", color: "hsl(var(--muted-foreground))" }}>
          pour commencer la saisie des notes
        </p>
      </div>
    )

    return (
      <>
        {/* Header */}
        <div className="rounded-lg p-4 flex items-center justify-between"
          style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <h2 className="font-serif font-semibold" style={{ fontSize: "18px", color: "#2C4A6E" }}>
            {headerLabel}
          </h2>
          <div className="font-sans text-sm" style={{ color: "#5A7085" }}>
            {enteredCount} / {sortedEnrollments.length} notes saisies
          </div>
        </div>

        {renderGradesSection()}
      </>
    )
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Sélecteurs */}
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: "10px", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
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
                <div className="flex items-center gap-2">
                  {isLocked && <LockIcon className="h-4 w-4" style={{ color: "#C48B1A" }} />}  {/* +1 && */}
                  <SelectValue placeholder="Sélectionner une étape" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {steps.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}{s.isCurrent ? " (active)" : ""}  {/* +1 ternary */}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedClassSubjectId}
              onValueChange={onClassSubjectChange}
              disabled={!selectedSessionId || loadingSession}
            >
              <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px",
                opacity: !selectedSessionId || loadingSession ? 0.5 : 1 }}>  {/* +1 ternary */}
                <SelectValue placeholder={loadingSession ? "Chargement..." : "Sélectionner une matière"} />  {/* +1 ternary */}
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

      {/* Bannière étape clôturée */}
      {showContent && isLocked && (                                           // +1 &&
        <div className="rounded-lg p-4 flex items-center gap-3"
          style={{ backgroundColor: "#FEF6E0", border: "1px solid #C48B1A" }}>
          <LockIcon className="h-5 w-5 flex-shrink-0" style={{ color: "#C48B1A" }} />
<p className="text-sm font-medium" style={{ color: "#C48B1A" }}>
  Étape clôturée — réouvrez l&apos;étape depuis la Configuration pour saisir des notes
</p>
        </div>
      )}

      {renderMainContent()}

    </div>
  )
}