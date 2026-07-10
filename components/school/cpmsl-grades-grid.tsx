"use client"

import { useState, useEffect, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  SaveIcon,
  LockIcon,
  SearchIcon,
  InboxIcon,
  SettingsIcon,
  MinusCircleIcon,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import type { ApiClassSession } from "@/lib/api/students"
import type { AcademicYearStep } from "@/lib/api/dashboard"
import type { ApiClassSubject, ApiEnrollment, ApiGrade, CreateGradePayload } from "@/lib/api/grades"
import { cn } from "@/lib/utils"
import { parseDecimal } from "@/lib/decimal"
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning"

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

type SortDirection = 'asc' | 'desc' | null
type SortKey = 'lastName' | 'firstName' | 'studentCode' | 'status' | 'globalNote' | 'sectionTotal'

interface SortConfig {
  key: SortKey | null
  direction: SortDirection
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
  onSaveGrades:           (toCreate: CreateGradePayload[], toUpdate: UpdateGradePayload[], toDelete: string[]) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sessionLabel(session: ApiClassSession): string {
  const { classType, letter, track } = session.class
  const base = `${classType.name} ${letter}`
  return track ? `${base} ${track.code}` : base
}

const frenchCollator = new Intl.Collator('fr', {
  numeric: true,
  sensitivity: 'base',
})

function compareTextValues(a: string | null | undefined, b: string | null | undefined) {
  return frenchCollator.compare(a?.trim() ?? '', b?.trim() ?? '')
}

function compareNullableNumbers(
  a: number | null | undefined,
  b: number | null | undefined,
  direction: Exclude<SortDirection, null>
) {
  const aMissing = a === null || a === undefined || Number.isNaN(a)
  const bMissing = b === null || b === undefined || Number.isNaN(b)
  if (aMissing && bMissing) return 0
  if (aMissing) return 1
  if (bMissing) return -1
  return direction === 'asc' ? a - b : b - a
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
  const { toast } = useToast()
  const [gradeEntries, setGradeEntries] = useState<Map<string, GradeEntry>>(new Map())
  // Section mode: enrollmentId -> sectionId -> entry
  const [sectionEntries, setSectionEntries] = useState<Map<string, Map<string, GradeEntry>>>(new Map())
  const [entryMode, setEntryMode] = useState<'global' | 'sections'>('global')

  // Exclusions de sous-matières pour le contexte courant.
  // IMPORTANT : une dispense est scoped par élève + matière + étape/période.
  // Elle ne doit pas être chargée/appliquée globalement sur toute l'année.
  const [exclusionsByEnrollment, setExclusionsByEnrollment] = useState<Map<string, Set<string>>>(new Map())

  // Exclusions-editor modal state
  const [exclusionTarget, setExclusionTarget] = useState<ApiEnrollment | null>(null)
  const [exclusionDraft, setExclusionDraft] = useState<Set<string>>(new Set())
  const [savingExclusions, setSavingExclusions] = useState(false)
  const [currentPage,  setCurrentPage]  = useState(1)
  const [searchQuery,  setSearchQuery]  = useState("")
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: null })
  const PAGE_SIZE_OPTIONS = [15, 25, 50, 100]

  // ── Classe / Salle split ────────────────────────────────────────────────
  const [selectedClassTypeId, setSelectedClassTypeId] = useState("")
  const [selectedLetter, setSelectedLetter]           = useState("")

  const classTypes = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    sessions.forEach(s => {
      const ct = s.class.classType
      if (!map.has(ct.id)) map.set(ct.id, { id: ct.id, name: ct.name })
    })
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [sessions])

  const availableLetters = useMemo(() => {
    if (!selectedClassTypeId) return []
    return sessions
      .filter(s => s.class.classType.id === selectedClassTypeId)
      .map(s => ({
        sessionId: s.id,
        letter: s.class.letter,
        track: s.class.track,
        label: s.class.track ? `${s.class.letter} — ${s.class.track.code}` : s.class.letter,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [sessions, selectedClassTypeId])

  // Sync selectedClassTypeId/selectedLetter from selectedSessionId (e.g. when navigating from Avancement)
  useEffect(() => {
    if (!selectedSessionId) return
    const session = sessions.find(s => s.id === selectedSessionId)
    if (session) {
      setSelectedClassTypeId(session.class.classType.id)
      setSelectedLetter(session.id)
    }
  }, [selectedSessionId, sessions])

  function handleClassTypeChange(classTypeId: string) {
    setSelectedClassTypeId(classTypeId)
    setSelectedLetter("")
    // Don't call onSessionChange yet — wait for letter selection
  }

  function handleLetterChange(sessionId: string) {
    setSelectedLetter(sessionId)
    onSessionChange(sessionId)
  }

  const selectedClassSubject = useMemo(
    () => classSubjects.find(cs => cs.id === selectedClassSubjectId),
    [classSubjects, selectedClassSubjectId]
  )
  const maxScore = parseDecimal(selectedClassSubject?.subject.maxScore) ?? 10

  const subjectSections = useMemo(
    () => (selectedClassSubject?.subject.sections ?? [])
      .map(sec => ({ ...sec, maxScore: parseDecimal(sec.maxScore) ?? 0 }))
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
    [selectedClassSubject]
  )
  const subjectHasSections = (selectedClassSubject?.subject.hasSections ?? false) && subjectSections.length > 0


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
    const newGlobalEntries = new Map<string, GradeEntry>()
    const newSectionEntries = new Map<string, Map<string, GradeEntry>>()
    let hasGlobalGrades = false
    let hasSectionGrades = false

    existingGrades
      .filter(g => g.classSubjectId === selectedClassSubjectId && g.stepId === selectedStepId)
      .forEach(g => {
        const value = String(g.studentScore)
        if (g.sectionId === null) {
          newGlobalEntries.set(g.enrollmentId, { enrollmentId: g.enrollmentId, value, isValid: true })
          hasGlobalGrades = true
        } else {
          const studentMap = newSectionEntries.get(g.enrollmentId) ?? new Map<string, GradeEntry>()
          studentMap.set(g.sectionId, { enrollmentId: g.enrollmentId, value, isValid: true })
          newSectionEntries.set(g.enrollmentId, studentMap)
          hasSectionGrades = true
        }
      })

    setGradeEntries(newGlobalEntries)
    setSectionEntries(newSectionEntries)

    // Auto-detect mode:
    //   - subject has no sections → 'global' (only option)
    //   - subject has sections    → 'sections' (always — the structured intent)
    //     Note: orphan global grades on a sectioned subject still display
    //     in the bulletin thanks to the fallback in buildSubjectEntries.
    //     The toggle remains visible so the teacher can switch to 'global'
    //     deliberately if needed.
    if (!subjectHasSections) {
      setEntryMode('global')
    } else if (hasSectionGrades || !hasGlobalGrades) {
      setEntryMode('sections')
    } else {
      // hasSections + only global data exists → still default to sections,
      // but the UI will show a hint about the existing global entries below.
      setEntryMode('sections')
    }

    setCurrentPage(1)
  }, [existingGrades, selectedClassSubjectId, selectedStepId, subjectHasSections])

  useEffect(() => { setCurrentPage(1) }, [selectedSessionId, selectedClassSubjectId, selectedStepId])

  // Charge les exclusions uniquement pour la classe + matière + étape active.
  // Avant, le fetch ne passait que classSessionId : la même dispense suivait
  // l'élève sur toutes les étapes de l'année. Le stepId est maintenant
  // obligatoire dans le contrat frontend/backend.
  useEffect(() => {
    if (!selectedSessionId || !selectedClassSubjectId || !selectedStepId) {
      setExclusionsByEnrollment(new Map())
      return
    }

    let cancelled = false
    const params = new URLSearchParams({
      classSessionId: selectedSessionId,
      classSubjectId: selectedClassSubjectId,
      stepId: selectedStepId,
    })

    fetch(`/api/enrollments/excluded-sections?${params.toString()}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Array<{ enrollmentId: string; sectionId: string }>) => {
        if (cancelled) return
        const m = new Map<string, Set<string>>()
        for (const row of rows) {
          const set = m.get(row.enrollmentId) ?? new Set<string>()
          set.add(row.sectionId)
          m.set(row.enrollmentId, set)
        }
        setExclusionsByEnrollment(m)
      })
      .catch(() => { if (!cancelled) setExclusionsByEnrollment(new Map()) })
    return () => { cancelled = true }
  }, [selectedSessionId, selectedClassSubjectId, selectedStepId])

  // ── Exclusions editor handlers ────────────────────────────────────────────
  function openExclusionsEditor(enrollment: ApiEnrollment) {
    const current = exclusionsByEnrollment.get(enrollment.id) ?? new Set<string>()
    setExclusionTarget(enrollment)
    setExclusionDraft(new Set(current))
  }

  function toggleDraftSection(sectionId: string) {
    setExclusionDraft((prev) => {
      const next = new Set(prev)
      if (next.has(sectionId)) next.delete(sectionId); else next.add(sectionId)
      return next
    })
  }

  async function saveExclusions() {
    if (!exclusionTarget) return
    setSavingExclusions(true)
    try {
      // Le draft concerne uniquement la matière + l'étape actuellement sélectionnées.
      // On n'envoie donc pas une liste globale annuelle d'exclusions.
      const finalSet = new Set<string>(exclusionDraft)

      const res = await fetch(`/api/enrollments/${exclusionTarget.id}/excluded-sections`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classSubjectId: selectedClassSubjectId,
          stepId: selectedStepId,
          sectionIds: [...finalSet],
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? 'Échec')

      setExclusionsByEnrollment((prev) => {
        const next = new Map(prev)
        next.set(exclusionTarget.id, finalSet)
        return next
      })
      toast({ title: "Sections mises à jour" })
      setExclusionTarget(null)
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible d'enregistrer",
        variant: "destructive",
      })
    } finally {
      setSavingExclusions(false)
    }
  }

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

  function validateSectionScore(value: string, max: number): { isValid: boolean; error?: string } {
    if (!value || value.trim() === '') return { isValid: true }
    const num = parseFloat(value)
    if (isNaN(num)) return { isValid: false, error: 'Valeur invalide' }
    if (num < 0 || num > max) return { isValid: false, error: `Entre 0 et ${max}` }
    if (Math.round(num * 4 * 1e10) / 1e10 !== Math.round(num * 4))
      return { isValid: false, error: 'Multiples de 0.25 uniquement' }
    return { isValid: true }
  }

  function handleSectionGradeChange(enrollmentId: string, sectionId: string, value: string) {
    const section = subjectSections.find(s => s.id === sectionId)
    const sectionMax = section ? section.maxScore : 0
    const validation = validateSectionScore(value, sectionMax)
    setSectionEntries(prev => {
      const next = new Map(prev)
      const studentMap = new Map(next.get(enrollmentId) ?? new Map<string, GradeEntry>())
      studentMap.set(sectionId, { enrollmentId, value, isValid: validation.isValid, error: validation.error })
      next.set(enrollmentId, studentMap)
      return next
    })
  }

  function sectionRowTotal(enrollmentId: string): { raw: number; max: number; complete: boolean } {
    const studentMap = sectionEntries.get(enrollmentId)
    const excluded = exclusionsByEnrollment.get(enrollmentId) ?? new Set<string>()
    let raw = 0
    let filledMax = 0
    let totalMax = 0
    let complete = true
    for (const sec of subjectSections) {
      if (excluded.has(sec.id)) continue // excluded sections drop from the denominator
      totalMax += sec.maxScore
      const entry = studentMap?.get(sec.id)
      if (entry && entry.value.trim() && entry.isValid) {
        raw += parseFloat(entry.value)
        filledMax += sec.maxScore
      } else {
        complete = false
      }
    }
    return { raw, max: totalMax, complete: complete && filledMax === totalMax }
  }

  const hasErrors = useMemo(() => {
    if (entryMode === 'global') {
      return Array.from(gradeEntries.values()).some(e => !e.isValid)
    }
    for (const studentMap of sectionEntries.values()) {
      for (const entry of studentMap.values()) {
        if (!entry.isValid) return true
      }
    }
    return false
  }, [entryMode, gradeEntries, sectionEntries])

  const enteredCount = useMemo(() => {
    if (entryMode === 'global') {
      return Array.from(gradeEntries.values()).filter(e => e.value && e.isValid).length
    }
    // In sections mode, count students who have at least one valid section entry
    let count = 0
    for (const studentMap of sectionEntries.values()) {
      const hasAny = Array.from(studentMap.values()).some(e => e.value.trim() && e.isValid)
      if (hasAny) count++
    }
    return count
  }, [entryMode, gradeEntries, sectionEntries])
  // ── EP-006 : détection des modifications non enregistrées ─────────────────
//
// On compare gradeEntries (ce que l'utilisateur a tapé) avec
// existingGrades (ce qui est déjà en base) pour détecter :
//   - Nouvelles notes saisies mais pas encore enregistrées
//   - Notes modifiées dont la valeur diffère de l'existante
//
// Quand hasUnsavedChanges = true, le browser demande confirmation
// avant de quitter la page (fermeture onglet, F5, navigation URL…).
// Protège contre la perte de 10-40 saisies en 1 clic accidentel.
const hasUnsavedChanges = useMemo(() => {
  if (isLocked) return false
  if (!selectedClassSubjectId || !selectedStepId) return false

  if (entryMode === 'global') {
    const existingMap = new Map(
      existingGrades
        .filter(g =>
          g.classSubjectId === selectedClassSubjectId &&
          g.stepId === selectedStepId &&
          g.sectionId === null
        )
        .map(g => [g.enrollmentId, g])
    )

    for (const [enrollmentId, entry] of gradeEntries) {
      const existing = existingMap.get(enrollmentId)
      // Note existante effacée = suppression en attente
      if (!entry.value?.trim()) {
        if (existing) return true
        continue
      }
      if (!entry.isValid) continue
      const scoreTyped = parseFloat(entry.value)
      if (!existing) return true
      if (scoreTyped !== Number(existing.studentScore)) return true
    }
    return false
  }

  // sections mode
  const existingSectionMap = new Map<string, Map<string, ApiGrade>>()
  existingGrades
    .filter(g =>
      g.classSubjectId === selectedClassSubjectId &&
      g.stepId === selectedStepId &&
      g.sectionId !== null
    )
    .forEach(g => {
      const m = existingSectionMap.get(g.enrollmentId) ?? new Map<string, ApiGrade>()
      m.set(g.sectionId!, g)
      existingSectionMap.set(g.enrollmentId, m)
    })

  for (const [enrollmentId, studentMap] of sectionEntries) {
    for (const [sectionId, entry] of studentMap) {
      const existing = existingSectionMap.get(enrollmentId)?.get(sectionId)
      // Note existante effacée = suppression en attente
      if (!entry.value?.trim()) {
        if (existing) return true
        continue
      }
      if (!entry.isValid) continue
      const scoreTyped = parseFloat(entry.value)
      if (!existing) return true
      if (scoreTyped !== Number(existing.studentScore)) return true
    }
  }
  return false
}, [
  entryMode,
  gradeEntries,
  sectionEntries,
  existingGrades,
  selectedClassSubjectId,
  selectedStepId,
  isLocked,
])

// Active le warning beforeunload du browser quand dirty
useUnsavedChangesWarning(hasUnsavedChanges)
  // ── Save ─────────────────────────────────────────────────────────────────

  function handleSaveGrades() {
    if (!selectedClassSubjectId || !selectedStepId || hasErrors || isLocked) return

    const toCreate: CreateGradePayload[] = []
    const toUpdate: UpdateGradePayload[] = []
    // Une note existante dont la cellule a été vidée est retirée complètement
    // (pas mise à 0) — comme si elle n'avait jamais été saisie.
    const toDelete: string[] = []

    if (entryMode === 'global') {
      const existingMap = new Map(
        existingGrades
          .filter(g => g.classSubjectId === selectedClassSubjectId && g.stepId === selectedStepId && g.sectionId === null)
          .map(g => [g.enrollmentId, g])
      )

      gradeEntries.forEach((entry, enrollmentId) => {
        const existing = existingMap.get(enrollmentId)
        if (!entry.value?.trim()) {
          if (existing) toDelete.push(existing.id)
          return
        }
        if (!entry.isValid) return
        const score = parseFloat(entry.value)
        if (!existing) {
          toCreate.push({ enrollmentId, classSubjectId: selectedClassSubjectId, stepId: selectedStepId, studentScore: score, gradeType: 'EXAM' })
        } else if (score !== Number(existing.studentScore)) {
          toUpdate.push({ gradeId: existing.id, studentScore: score, gradeType: 'EXAM' })
        }
      })
    } else {
      // sections mode — one Grade row per section per student
      const existingSectionMap = new Map<string, Map<string, ApiGrade>>()
      existingGrades
        .filter(g => g.classSubjectId === selectedClassSubjectId && g.stepId === selectedStepId && g.sectionId !== null)
        .forEach(g => {
          const m = existingSectionMap.get(g.enrollmentId) ?? new Map<string, ApiGrade>()
          m.set(g.sectionId!, g)
          existingSectionMap.set(g.enrollmentId, m)
        })

      sectionEntries.forEach((studentMap, enrollmentId) => {
        const excluded = exclusionsByEnrollment.get(enrollmentId) ?? new Set<string>()
        studentMap.forEach((entry, sectionId) => {
          // Don't write grades for sections explicitly excluded for this student.
          if (excluded.has(sectionId)) return
          const existing = existingSectionMap.get(enrollmentId)?.get(sectionId)
          if (!entry.value?.trim()) {
            if (existing) toDelete.push(existing.id)
            return
          }
          if (!entry.isValid) return
          const score = parseFloat(entry.value)
          if (!existing) {
            toCreate.push({ enrollmentId, classSubjectId: selectedClassSubjectId, sectionId, stepId: selectedStepId, studentScore: score, gradeType: 'EXAM' })
          } else if (score !== Number(existing.studentScore)) {
            toUpdate.push({ gradeId: existing.id, studentScore: score, gradeType: 'EXAM' })
          }
        })
      })
    }

    if (toCreate.length === 0 && toUpdate.length === 0 && toDelete.length === 0) return
    onSaveGrades(toCreate, toUpdate, toDelete)
  }

  const headerLabel = useMemo(() => {
    return [
      selectedSession ? sessionLabel(selectedSession) : null,
      selectedStep?.name,
      selectedClassSubject?.subject.name,
    ].filter(Boolean).join(' — ')
  }, [selectedSession, selectedStep, selectedClassSubject])

  // ── Badge helper ──────────────────────────────────────────────────────────

  type BadgeKind = 'modified' | 'saved' | 'entered' | 'empty'
  function getBadgeKind(enrollmentId: string): BadgeKind {
    if (entryMode === 'global') {
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
      // Note existante effacée → suppression en attente d'enregistrement
      const isCleared  = existing && !hasValue

      if (isModified || isCleared) return 'modified'
      if (existing)   return 'saved'
      if (hasValue && !hasError) return 'entered'
      return 'empty'
    }

    // sections mode — aggregate over the row's sections
    const studentMap = sectionEntries.get(enrollmentId)
    const existingForRow = new Map(
      existingGrades
        .filter(g =>
          g.enrollmentId === enrollmentId &&
          g.classSubjectId === selectedClassSubjectId &&
          g.stepId === selectedStepId &&
          g.sectionId !== null
        )
        .map(g => [g.sectionId!, g])
    )

    let anyValue = false
    let anyModified = false
    let allSavedAndUnchanged = subjectSections.length > 0 && existingForRow.size > 0

    for (const sec of subjectSections) {
      const entry = studentMap?.get(sec.id)
      const existing = existingForRow.get(sec.id)
      const value = entry?.value?.trim() ?? ''
      if (value) anyValue = true

      if (existing && value && entry?.isValid && parseFloat(value) !== Number(existing.studentScore)) {
        anyModified = true
        allSavedAndUnchanged = false
      }
      // Note de section existante effacée → suppression en attente
      if (existing && !value) {
        anyModified = true
        allSavedAndUnchanged = false
      }
      if (!existing) allSavedAndUnchanged = false
    }

    if (anyModified) return 'modified'
    if (allSavedAndUnchanged) return 'saved'
    if (anyValue) return 'entered'
    return 'empty'
  }

  function renderBadge(enrollmentId: string) {
    const kind = getBadgeKind(enrollmentId)
    switch (kind) {
      case 'modified':
        return <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">Modifié</Badge>
      case 'saved':
        return <Badge className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">Enregistré</Badge>
      case 'entered':
        return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Saisi</Badge>
      default:
        return <Badge variant="secondary">Non saisi</Badge>
    }
  }

  // ── Recherche + tri stable ────────────────────────────────────────────────

  const initialSortedEnrollments = useMemo(() => {
    return enrollments
      .map((enrollment, index) => ({ enrollment, index }))
      .sort((a, b) => {
        const byLastName = compareTextValues(a.enrollment.student.user.lastname, b.enrollment.student.user.lastname)
        if (byLastName !== 0) return byLastName
        const byFirstName = compareTextValues(a.enrollment.student.user.firstname, b.enrollment.student.user.firstname)
        if (byFirstName !== 0) return byFirstName
        return a.index - b.index
      })
      .map(({ enrollment }, index) => ({ enrollment, index }))
  }, [enrollments])

  const filteredEnrollmentsBeforeSort = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('fr')
    if (!q) return initialSortedEnrollments
    return initialSortedEnrollments.filter(({ enrollment }) => {
      const first = enrollment.student.user.firstname?.toLocaleLowerCase('fr') ?? ""
      const last  = enrollment.student.user.lastname?.toLocaleLowerCase('fr')  ?? ""
      const code  = enrollment.student.studentCode?.toLocaleLowerCase('fr')    ?? ""
      return first.includes(q) || last.includes(q) || code.includes(q)
    })
  }, [initialSortedEnrollments, searchQuery])

  const sortedEnrollments = (() => {
    const direction = sortConfig.direction
    if (!sortConfig.key || !direction) {
      return filteredEnrollmentsBeforeSort.map(({ enrollment }) => enrollment)
    }

    const statusOrder: Record<BadgeKind, number> = {
      empty: 0,
      entered: 2,
      modified: 3,
      saved: 4,
    }

    return [...filteredEnrollmentsBeforeSort]
      .sort((a, b) => {
        const enrollmentA = a.enrollment
        const enrollmentB = b.enrollment
        let comparison = 0

        switch (sortConfig.key) {
          case 'lastName':
            comparison = compareTextValues(enrollmentA.student.user.lastname, enrollmentB.student.user.lastname)
            break
          case 'firstName':
            comparison = compareTextValues(enrollmentA.student.user.firstname, enrollmentB.student.user.firstname)
            break
          case 'studentCode':
            comparison = compareTextValues(enrollmentA.student.studentCode, enrollmentB.student.studentCode)
            break
          case 'status':
            comparison = statusOrder[getBadgeKind(enrollmentA.id)] - statusOrder[getBadgeKind(enrollmentB.id)]
            break
          case 'globalNote': {
            const scoreA = gradeEntries.get(enrollmentA.id)?.value
            const scoreB = gradeEntries.get(enrollmentB.id)?.value
            comparison = compareNullableNumbers(
              scoreA?.trim() ? parseFloat(scoreA) : null,
              scoreB?.trim() ? parseFloat(scoreB) : null,
              direction
            )
            break
          }
          case 'sectionTotal': {
            const totalA = sectionRowTotal(enrollmentA.id)
            const totalB = sectionRowTotal(enrollmentB.id)
            comparison = compareNullableNumbers(
              totalA.complete || totalA.raw > 0 ? totalA.raw : null,
              totalB.complete || totalB.raw > 0 ? totalB.raw : null,
              direction
            )
            break
          }
        }

        if (comparison === 0) return a.index - b.index
        return direction === 'asc' || sortConfig.key === 'globalNote' || sortConfig.key === 'sectionTotal'
          ? comparison
          : -comparison
      })
      .map(({ enrollment }) => enrollment)
  })()

  const filteredEnrollments = sortedEnrollments
  const totalPages = Math.max(1, Math.ceil(filteredEnrollments.length / itemsPerPage))
  const paginatedEnrollments = filteredEnrollments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const paginationWindow = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1)
    if (currentPage <= 3) return [1, 2, 3, 4, 'ellipsis-right', totalPages]
    if (currentPage >= totalPages - 2) {
      return [1, 'ellipsis-left', totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    }
    return [1, 'ellipsis-left', currentPage - 1, currentPage, currentPage + 1, 'ellipsis-right', totalPages]
  }, [currentPage, totalPages])

  function handleSort(key: SortKey) {
    setCurrentPage(1)
    setSortConfig(prev => {
      if (prev.key !== key) return { key, direction: 'asc' }
      if (prev.direction === 'asc') return { key, direction: 'desc' }
      return { key: null, direction: null }
    })
  }

  function renderSortableHead(
    key: SortKey,
    label: string,
    className?: string,
    align: 'left' | 'center' = 'left',
    description?: string
  ) {
    const activeDirection = sortConfig.key === key ? sortConfig.direction : null
    const ariaSort = activeDirection === 'asc' ? 'ascending' : activeDirection === 'desc' ? 'descending' : 'none'
    const Icon = activeDirection === 'asc'
      ? ArrowUpIcon
      : activeDirection === 'desc'
        ? ArrowDownIcon
        : ArrowUpDownIcon

    return (
      <TableHead aria-sort={ariaSort} className={cn("h-12 bg-muted/60 font-semibold", className)}>
        <button
          type="button"
          onClick={() => handleSort(key)}
          className={cn(
            "inline-flex w-full items-center gap-1.5 rounded-sm py-1 text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            align === 'center' && "justify-center text-center",
            activeDirection ? "text-foreground" : "text-muted-foreground"
          )}
          aria-label={`${description ?? `Trier par ${label}`}. ${
            activeDirection === 'asc'
              ? 'Tri ascendant actif, activer le tri descendant.'
              : activeDirection === 'desc'
                ? "Tri descendant actif, réinitialiser le tri."
                : 'Activer le tri ascendant.'
          }`}
        >
          <span>{label}</span>
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </button>
      </TableHead>
    )
  }

  // ── Table row ─────────────────────────────────────────────────────────────

  function renderTableRow(enrollment: ApiEnrollment) {
    const entry    = gradeEntries.get(enrollment.id)
    const hasValue = !!entry?.value?.trim()
    const hasError = hasValue && entry && !entry.isValid

    return (
      <TableRow key={enrollment.id} className="group">
        <TableCell className="min-w-[160px] pl-6 font-semibold text-foreground">
          {enrollment.student.user.lastname}
        </TableCell>
        <TableCell className="min-w-[150px] text-foreground">
          {enrollment.student.user.firstname}
        </TableCell>
        <TableCell className="min-w-[116px]">
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {enrollment.student.studentCode}
          </code>
        </TableCell>
        <TableCell className="min-w-[156px]">
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-2 py-1">
              <Input
                type="number" min="0" max={String(maxScore)} step="0.25"
                value={entry?.value || ''} placeholder="—" disabled={isLocked}
                onChange={e => handleGradeChange(enrollment.id, e.target.value)}
                className={cn(
                  "h-10 w-28 border-input bg-background text-center text-base font-semibold tabular-nums shadow-sm",
                  hasValue && !hasError && "border-emerald-300 bg-emerald-50/60 text-emerald-900",
                  hasError && "border-destructive focus-visible:ring-destructive"
                )}
                onKeyDown={e => {
                  if (e.key !== 'Tab') return
                  e.preventDefault()
                  const idx = paginatedEnrollments.findIndex(en => en.id === enrollment.id)
                  if (idx >= paginatedEnrollments.length - 1) return
                  const nextId = paginatedEnrollments[idx + 1].id
                  const next = document.querySelector(`input[data-enrollment-id="${nextId}"]`) as HTMLInputElement
                  next?.focus()
                }}
                data-enrollment-id={enrollment.id}
              />
              <span className="text-xs font-medium text-muted-foreground">/ {maxScore}</span>
            </div>
            {hasError && entry?.error && (
              <p className="text-[11px] text-destructive">{entry.error}</p>
            )}
          </div>
        </TableCell>
        <TableCell className="pr-6 text-center">
          {renderBadge(enrollment.id)}
        </TableCell>
      </TableRow>
    )
  }

  function renderSectionsTableRow(enrollment: ApiEnrollment) {
    const studentMap = sectionEntries.get(enrollment.id)
    const total = sectionRowTotal(enrollment.id)
    const excluded = exclusionsByEnrollment.get(enrollment.id) ?? new Set<string>()
    const excludedHere = subjectSections.filter((sec) => excluded.has(sec.id)).length
    return (
      <TableRow key={enrollment.id} className="group">
        <TableCell className="min-w-[170px] pl-6 font-semibold text-foreground">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => openExclusionsEditor(enrollment)}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Configurer les sous-matières applicables à cet élève"
              disabled={isLocked}
            >
              <SettingsIcon className="h-3.5 w-3.5" />
            </button>
            <span>{enrollment.student.user.lastname}</span>
            {excludedHere > 0 && (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[10px] text-amber-700">
                {excludedHere} exclue(s)
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="min-w-[150px] text-foreground">
          {enrollment.student.user.firstname}
        </TableCell>
        <TableCell className="min-w-[118px]">
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {enrollment.student.studentCode}
          </code>
        </TableCell>
        {subjectSections.map(sec => {
          const isExcluded = excluded.has(sec.id)
          const entry = studentMap?.get(sec.id)
          const hasValue = !!entry?.value?.trim()
          const hasError = hasValue && entry && !entry.isValid
          return (
            <TableCell key={sec.id} className={cn("min-w-[156px] align-top", isExcluded && "bg-muted/30")}>
              {isExcluded ? (
                <div className="flex flex-col items-center gap-0.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                    <MinusCircleIcon className="h-3 w-3" /> Exclue
                  </span>
                  <span className="text-[10px] text-muted-foreground">non comptée</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-2 py-1">
                    <Input
                      type="number" min="0" max={String(sec.maxScore)} step="0.25"
                      value={entry?.value || ''} placeholder="—" disabled={isLocked}
                      onChange={e => handleSectionGradeChange(enrollment.id, sec.id, e.target.value)}
                      className={cn(
                        "h-10 w-24 border-input bg-background text-center text-base font-semibold tabular-nums shadow-sm",
                        hasValue && !hasError && "border-emerald-300 bg-emerald-50/60 text-emerald-900",
                        hasError && "border-destructive focus-visible:ring-destructive"
                      )}
                    />
                    <span className="text-[11px] font-medium text-muted-foreground tabular-nums">/ {sec.maxScore}</span>
                  </div>
                  {hasError && entry?.error && (
                    <p className="text-[10px] text-destructive">{entry.error}</p>
                  )}
                </div>
              )}
            </TableCell>
          )
        })}
        <TableCell className="min-w-[124px] text-center">
          {total.raw > 0 || total.complete ? (
            <span
              className={cn(
                "inline-flex min-w-[104px] items-center justify-center rounded-lg border px-2 py-1 tabular-nums text-sm font-bold",
                total.complete ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50",
                total.complete ? "text-emerald-700" : "text-amber-700"
              )}
              title={total.complete ? "Total complet" : "Total partiel (toutes les sections ne sont pas saisies)"}
            >
              {total.raw.toFixed(2)} <span className="text-muted-foreground font-normal">/ {total.max}</span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="min-w-[126px] pr-6 text-center">
          {renderBadge(enrollment.id)}
        </TableCell>
      </TableRow>
    )
  }

  // ── Pagination footer ─────────────────────────────────────────────────────

  function renderPaginationFooter() {
    if (filteredEnrollments.length <= 15) return null
    return (
      <>
        <Separator />
        <div className="flex flex-col items-center justify-between gap-3 px-4 py-3 sm:flex-row">
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">
              Page <span className="font-medium text-foreground tabular-nums">{currentPage}</span>{" "}
              sur <span className="font-medium text-foreground tabular-nums">{totalPages}</span>
              {" "}&middot; {filteredEnrollments.length} élève(s)
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Afficher</span>
              <Select
                value={String(itemsPerPage)}
                onValueChange={v => { setItemsPerPage(Number(v)); setCurrentPage(1) }}
              >
                <SelectTrigger className="h-8 w-[72px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map(size => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {totalPages > 1 && (
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={e => { e.preventDefault(); if (currentPage > 1) setCurrentPage(p => p - 1) }}
                    className={cn(currentPage === 1 && "pointer-events-none opacity-50")}
                  />
                </PaginationItem>
                {paginationWindow.map((p, idx) => {
                  if (typeof p === 'string') {
                    return (
                      <PaginationItem key={`${p}-${idx}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )
                  }
                  return (
                    <PaginationItem key={p}>
                      <PaginationLink
                        href="#"
                        isActive={currentPage === p}
                        onClick={e => { e.preventDefault(); setCurrentPage(p) }}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  )
                })}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={e => { e.preventDefault(); if (currentPage < totalPages) setCurrentPage(p => p + 1) }}
                    className={cn(currentPage === totalPages && "pointer-events-none opacity-50")}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      </>
    )
  }

  // ── Spinner shared ────────────────────────────────────────────────────────
  function renderSpinner() {
    return (
      <Card className="border bg-card shadow-sm">
        <CardContent className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-muted border-t-primary" />
        </CardContent>
      </Card>
    )
  }

  // ── Grades table section ──────────────────────────────────────────────────
  function renderGradesSection() {
    if (loadingGrades) return renderSpinner()

    return (
      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <CardTitle className="text-base font-semibold">Saisie des notes</CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2">
                  <span>
                  {headerLabel} &middot; {enteredCount} / {enrollments.length} notes saisies
                  </span>
                  {hasUnsavedChanges && (
                <Badge
          variant="outline"
          className="border-amber-300 bg-amber-50 text-amber-800 text-[11px] font-medium"
        >
          Modifications non enregistrées
        </Badge>
                )}
              </CardDescription>
          </div>
          </div>
        </CardHeader>

        <Separator />

        {/* Search toolbar + mode toggle */}
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou code..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-9"
            />
          </div>
          {sortConfig.direction && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSortConfig({ key: null, direction: null })
                setCurrentPage(1)
              }}
              className="shrink-0"
            >
              <ArrowUpDownIcon className="mr-2 h-4 w-4" />
              Réinitialiser le tri
            </Button>
          )}
          {subjectHasSections && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Mode :</span>
              <div className="inline-flex overflow-hidden rounded-md border bg-muted/30">
                <button
                  type="button"
                  onClick={() => setEntryMode('global')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors",
                    entryMode === 'global'
                      ? "bg-[#2C4A6E] text-white"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  Note globale
                </button>
                <button
                  type="button"
                  onClick={() => setEntryMode('sections')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors",
                    entryMode === 'sections'
                      ? "bg-[#2C4A6E] text-white"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  Par sections ({subjectSections.length})
                </button>
              </div>
            </div>
          )}
        </div>

        <Separator />

        <CardContent className="p-0">
          {filteredEnrollments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <InboxIcon className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">
                Aucun élève trouvé
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery ? "Modifiez vos critères de recherche." : "Aucun élève inscrit dans cette classe."}
              </p>
            </div>
          ) : entryMode === 'sections' ? (
            <div className="overflow-x-auto">
              <Table style={{ minWidth: `${580 + subjectSections.length * 168}px` }}>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {renderSortableHead('lastName', 'Nom', 'pl-6', 'left', 'Trier par nom')}
                    {renderSortableHead('firstName', 'Prénom', undefined, 'left', 'Trier par prénom')}
                    {renderSortableHead('studentCode', 'Code', undefined, 'left', 'Trier par code élève')}
                    {subjectSections.map(sec => (
                      <TableHead key={sec.id} className="min-w-[156px] bg-muted/60 text-center font-semibold">
                        <div className="flex flex-col items-center gap-0.5">
                          <span>{sec.name}</span>
                          <span className="text-[10px] font-normal text-muted-foreground">/ {sec.maxScore}</span>
                        </div>
                      </TableHead>
                    ))}
                    {renderSortableHead('sectionTotal', `Total / ${maxScore}`, 'min-w-[124px]', 'center', 'Trier par total')}
                    {renderSortableHead('status', 'Statut', 'min-w-[126px] pr-6', 'center', 'Trier par statut de saisie')}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEnrollments.map(enrollment => renderSectionsTableRow(enrollment))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Table style={{ minWidth: "720px" }}>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {renderSortableHead('lastName', 'Nom', 'pl-6', 'left', 'Trier par nom')}
                  {renderSortableHead('firstName', 'Prénom', undefined, 'left', 'Trier par prénom')}
                  {renderSortableHead('studentCode', 'Code', undefined, 'left', 'Trier par code élève')}
                  {renderSortableHead('globalNote', `Note / ${maxScore}`, 'min-w-[156px]', 'center', 'Trier par note')}
                  {renderSortableHead('status', 'Statut', 'min-w-[126px] pr-6', 'center', 'Trier par statut de saisie')}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEnrollments.map(enrollment => renderTableRow(enrollment))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {renderPaginationFooter()}

        {/* Save button */}
        {!isLocked && filteredEnrollments.length > 0 && (
          <>
            <Separator />
            <div className="flex justify-end p-4">
              <Button
                onClick={handleSaveGrades}
                disabled={!selectedClassSubjectId || !selectedStepId || hasErrors || saving}
              >
                {saving ? (
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <SaveIcon className="mr-2 h-4 w-4" />
                )}
                {saving ? "Enregistrement..." : "Enregistrer les notes"}
              </Button>
            </div>
          </>
        )}
      </Card>
    )
  }

  // ── Main content ──────────────────────────────────────────────────────────
  function renderMainContent() {
    if (loadingSession) return renderSpinner()
    if (!showContent) {
      return (
        <Card className="border bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <InboxIcon className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              Aucune sélection
            </h3>
            <p className="mt-1 max-w-[320px] text-center text-sm text-muted-foreground">
              Choisissez une classe, une étape et une matière pour commencer la saisie des notes.
            </p>
          </CardContent>
        </Card>
      )
    }
    return renderGradesSection()
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Sélecteurs */}
      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Sélection</CardTitle>
          <CardDescription>Classe, salle, étape et matière pour la saisie</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Classe */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Classe</label>
              <Select value={selectedClassTypeId} onValueChange={handleClassTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une classe" />
                </SelectTrigger>
                <SelectContent>
                  {classTypes.map(ct => (
                    <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Salle */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Salle</label>
              <Select
                value={selectedLetter}
                onValueChange={handleLetterChange}
                disabled={!selectedClassTypeId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!selectedClassTypeId ? "Choisir une classe d'abord" : "Sélectionner une salle"} />
                </SelectTrigger>
                <SelectContent>
                  {availableLetters.map(l => (
                    <SelectItem key={l.sessionId} value={l.sessionId}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Étape */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Étape</label>
              <Select value={selectedStepId} onValueChange={onStepChange}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    {isLocked && <LockIcon className="h-4 w-4 text-amber-600" />}
                    <SelectValue placeholder="Sélectionner une étape" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {steps.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{s.isCurrent ? " (active)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Matière */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Matière</label>
              <Select
                value={selectedClassSubjectId}
                onValueChange={onClassSubjectChange}
                disabled={!selectedSessionId || loadingSession}
              >
                <SelectTrigger>
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
        </CardContent>
      </Card>

      {/* Bannière étape clôturée */}
      {showContent && isLocked && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <LockIcon className="h-4 w-4 !text-amber-600" />
          <AlertTitle>Étape clôturée</AlertTitle>
          <AlertDescription>
            Réouvrez l&apos;étape depuis la Configuration pour saisir des notes.
          </AlertDescription>
        </Alert>
      )}

      {renderMainContent()}

      {/* Exclusions editor — dispense scoped par élève + matière + étape */}
      <Dialog open={!!exclusionTarget} onOpenChange={(o) => { if (!o) setExclusionTarget(null) }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Sous-matières applicables</DialogTitle>
            <DialogDescription>
              {exclusionTarget && (
                <>
                  {exclusionTarget.student.user.firstname} {exclusionTarget.student.user.lastname}
                  {selectedClassSubject && <> · {selectedClassSubject.subject.name}</>}.
                  Décochez une sous-matière pour que l&apos;élève ne soit <strong>pas évalué</strong> dessus
                  uniquement pour cette étape/période — son maximum baisse d&apos;autant et la moyenne est calculée sur le nouveau total.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 py-1">
            {subjectSections.map((sec) => {
              const isIncluded = !exclusionDraft.has(sec.id)
              return (
                <label
                  key={sec.id}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 hover:bg-muted/40"
                >
                  <div className="flex items-center gap-2">
                    <Checkbox checked={isIncluded} onCheckedChange={() => toggleDraftSection(sec.id)} />
                    <span className="text-sm font-medium text-foreground">{sec.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">/ {sec.maxScore}</span>
                </label>
              )
            })}
            {(() => {
              const includedMax = subjectSections
                .filter((s) => !exclusionDraft.has(s.id))
                .reduce((sum, s) => sum + s.maxScore, 0)
              const fullMax = subjectSections.reduce((sum, s) => sum + s.maxScore, 0)
              return (
                <p className="pt-2 text-xs text-muted-foreground">
                  Total après exclusions : <strong className="text-foreground tabular-nums">{includedMax}</strong>{" "}
                  / <span className="tabular-nums">{fullMax}</span> points.
                </p>
              )
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExclusionTarget(null)} disabled={savingExclusions}>
              Annuler
            </Button>
            <Button onClick={saveExclusions} disabled={savingExclusions} className="bg-[#2C4A6E] text-white hover:bg-[#1F3856]">
              {savingExclusions ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
