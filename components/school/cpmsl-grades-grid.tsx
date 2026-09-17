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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/components/ui/use-toast"
import type { ApiClassSession } from "@/lib/api/students"
import type { AcademicYearStep } from "@/lib/api/dashboard"
import type { ApiClassSubject, ApiEnrollment, ApiGrade, CreateGradePayload } from "@/lib/api/grades"
import { effectiveMaxScore } from "@/lib/api/grades"
import { cn } from "@/lib/utils"
import { parseDecimal } from "@/lib/decimal"
import { parseScore, validateScoreInput } from "@/lib/grades/score-input"
import { invalidateExclusionsCache } from "@/lib/api/bulletin"
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
type SortKey = 'lastName' | 'firstName' | 'studentCode' | 'globalNote' | 'sectionTotal'

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
  /**
   * Remonte le nombre de saisies en attente. La page parente en a besoin :
   * Radix demonte le contenu d'un onglet inactif, donc quitter « Saisie »
   * detruit cet etat — et desenregistre `beforeunload` avec lui. Le garde-fou
   * interne ne peut pas voir ce qui se passe au-dessus de lui.
   */
  onDirtyChange?:         (count: number) => void
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
  onDirtyChange,
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
  const [searchQuery,  setSearchQuery]  = useState("")
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: null })

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
        label: s.class.letter,
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
    guardContextChange("de salle", () => {
      setSelectedLetter(sessionId)
      onSessionChange(sessionId)
    })
  }

  const selectedClassSubject = useMemo(
    () => classSubjects.find(cs => cs.id === selectedClassSubjectId),
    [classSubjects, selectedClassSubjectId]
  )
  // Note max effective : l'override de l'affectation (par filière) prime sur la
  // note max de la matière.
  const maxScore = selectedClassSubject
    ? effectiveMaxScore(selectedClassSubject)
    : 10

  // ── Portée : tronc commun / examen officiel (filière) / toutes ────────────
  // La salle a-t-elle des matières d'examen ? (sinon on masque le filtre)
  const hasExamSubjects = useMemo(
    () => classSubjects.some(cs => cs.trackId != null),
    [classSubjects]
  )
  const [subjectScope, setSubjectScope] = useState<'all' | 'common' | 'exam'>('all')

  const visibleClassSubjects = useMemo(() => {
    if (subjectScope === 'common') return classSubjects.filter(cs => cs.trackId == null)
    if (subjectScope === 'exam') return classSubjects.filter(cs => cs.trackId != null)
    return classSubjects
  }, [classSubjects, subjectScope])

  const subjectSections = useMemo(
    () => (selectedClassSubject?.subject.sections ?? [])
      .map(sec => ({ ...sec, maxScore: parseDecimal(sec.maxScore) ?? 0 }))
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
    [selectedClassSubject]
  )
  const subjectHasSections = (selectedClassSubject?.subject.hasSections ?? false) && subjectSections.length > 0

  // Filière : une matière d'examen officiel ne concerne QUE les élèves de sa
  // filière. Une matière du tronc commun concerne toute la salle.
  const enrollmentsForSubject = useMemo(() => {
    const trackId = selectedClassSubject?.trackId ?? null
    if (!trackId) return enrollments
    return enrollments.filter(e => e.trackId === trackId)
  }, [enrollments, selectedClassSubject])



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

  }, [existingGrades, selectedClassSubjectId, selectedStepId, subjectHasSections])


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

      // Le bulletin met les dispenses en cache par (session, étape). Sans cette
      // invalidation, accorder ou retirer une dispense ne change rien au
      // bulletin jusqu'au rechargement complet de la page.
      invalidateExclusionsCache(selectedSessionId, selectedStepId)

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

  // ── Validation DR-004 : notes au pas de 0,25 ─────────────────────────────
  //
  // Cette grille est aujourd'hui le SEUL endroit du système où DR-004 est
  // opposé : ni les gestionnaires de route `app/api/**`, ni le backend ne le
  // vérifient (backlog E8). Un appel API direct passe donc n'importe quelle
  // valeur — raison de plus pour que la barrière d'ici ne fuie pas.

  // DR-004 vit dans lib/grades/score-input.ts, qui delegue lui-meme le verdict
  // a isValidGrade() de lib/bulletin/compute.ts — la meme regle, en Decimal,
  // que celle qui calcule le bulletin.
  const validateScoreAgainst = validateScoreInput

  function validateScore(value: string) {
    return validateScoreAgainst(value, maxScore)
  }

  function handleGradeChange(enrollmentId: string, value: string) {
    const validation = validateScore(value)
    setGradeEntries(prev => {
      const next = new Map(prev)
      next.set(enrollmentId, { enrollmentId, value, isValid: validation.isValid, error: validation.error })
      return next
    })
  }

  function validateSectionScore(value: string, max: number) {
    return validateScoreAgainst(value, max)
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
        raw += parseScore(entry.value) ?? 0
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

  // Le compteur affiche « X / Y notes saisies ». Les deux nombres mentaient.
  //
  // Y valait `enrollments.length`, soit TOUTE la salle, alors que les lignes
  // affichées sont filtrées par filière : sur une matière d'examen officiel,
  // l'écran annonçait « 12 / 45 » là où seuls 12 élèves sont à noter, et
  // laissait croire à 33 notes en retard qui n'existaient pas.
  //
  // X, en mode sections, comptait les élèves ayant AU MOINS UNE sous-matière
  // remplie : « 30 / 30 » pouvait s'afficher avec la moitié des cellules vides.
  // Un élève n'est saisi que si toutes ses sous-matières applicables le sont.
  const enteredCount = useMemo(() => {
    if (entryMode === 'global') {
      let count = 0
      for (const enrollment of enrollmentsForSubject) {
        const entry = gradeEntries.get(enrollment.id)
        if (entry?.value.trim() && entry.isValid) count++
      }
      return count
    }

    let count = 0
    for (const enrollment of enrollmentsForSubject) {
      const studentMap = sectionEntries.get(enrollment.id)
      const excluded = exclusionsByEnrollment.get(enrollment.id) ?? new Set<string>()
      const applicable = subjectSections.filter(sec => !excluded.has(sec.id))
      if (applicable.length === 0) continue
      const allFilled = applicable.every(sec => {
        const entry = studentMap?.get(sec.id)
        return !!entry?.value.trim() && entry.isValid
      })
      if (allFilled) count++
    }
    return count
  }, [
    entryMode,
    gradeEntries,
    sectionEntries,
    enrollmentsForSubject,
    exclusionsByEnrollment,
    subjectSections,
  ])
  // ── EP-006 : détection des modifications non enregistrées ─────────────────
  //
  // On compare ce qui a été tapé (gradeEntries / sectionEntries) avec
  // existingGrades (ce qui est déjà en base) pour détecter :
  //   - Nouvelles notes saisies mais pas encore enregistrées
  //   - Notes modifiées dont la valeur diffère de l'existante
  //   - Notes existantes effacées, donc en attente de suppression
  //
  // On compte les DEUX modes, pas seulement celui qui est affiché : basculer
  // Global ↔ Sections ne sauve rien et n'efface rien, or ne regarder que le
  // mode actif éteignait l'alerte alors que le travail restait en attente.
  //
  // Le compte, et non un booléen, sert à nommer l'enjeu dans le garde-fou :
  // « 23 notes non enregistrées » se décide mieux que « des modifications ».
  const pendingChangeCount = useMemo(() => {
    if (isLocked) return 0
    if (!selectedClassSubjectId || !selectedStepId) return 0

    let count = 0

    const globalExisting = new Map(
      existingGrades
        .filter(g =>
          g.classSubjectId === selectedClassSubjectId &&
          g.stepId === selectedStepId &&
          g.sectionId === null
        )
        .map(g => [g.enrollmentId, g])
    )

    for (const [enrollmentId, entry] of gradeEntries) {
      const existing = globalExisting.get(enrollmentId)
      // Note existante effacée = suppression en attente
      if (!entry.value?.trim()) {
        if (existing) count++
        continue
      }
      if (!entry.isValid) continue
      if (!existing) { count++; continue }
      if (parseScore(entry.value) !== Number(existing.studentScore)) count++
    }

    const sectionExisting = new Map<string, Map<string, ApiGrade>>()
    existingGrades
      .filter(g =>
        g.classSubjectId === selectedClassSubjectId &&
        g.stepId === selectedStepId &&
        g.sectionId !== null
      )
      .forEach(g => {
        const m = sectionExisting.get(g.enrollmentId) ?? new Map<string, ApiGrade>()
        m.set(g.sectionId!, g)
        sectionExisting.set(g.enrollmentId, m)
      })

    for (const [enrollmentId, studentMap] of sectionEntries) {
      for (const [sectionId, entry] of studentMap) {
        const existing = sectionExisting.get(enrollmentId)?.get(sectionId)
        // Note de section existante effacée = suppression en attente
        if (!entry.value?.trim()) {
          if (existing) count++
          continue
        }
        if (!entry.isValid) continue
        if (!existing) { count++; continue }
        if (parseScore(entry.value) !== Number(existing.studentScore)) count++
      }
    }

    return count
  }, [
    gradeEntries,
    sectionEntries,
    existingGrades,
    selectedClassSubjectId,
    selectedStepId,
    isLocked,
  ])

  const missingCount = Math.max(0, enrollmentsForSubject.length - enteredCount)

  const hasUnsavedChanges = pendingChangeCount > 0

  useEffect(() => { onDirtyChange?.(pendingChangeCount) }, [pendingChangeCount, onDirtyChange])
  // Au demontage, la page ne doit pas rester bloquee sur un compte perime.
  useEffect(() => () => { onDirtyChange?.(0) }, [onDirtyChange])

  // Alerte native du navigateur : fermeture d'onglet, F5, saisie d'une URL.
  // Elle ne couvre PAS les sélecteurs de contexte de cet écran, puisqu'on ne
  // quitte pas la page — c'est le rôle de `guardContextChange` ci-dessous.
  useUnsavedChangesWarning(hasUnsavedChanges)

  // ── Garde-fou sur les changements de contexte ─────────────────────────────
  //
  // Changer de salle, d'étape ou de matière fait recharger les notes, ce qui
  // réécrit gradeEntries/sectionEntries dans le useEffect de pré-remplissage.
  // Sans ce garde-fou, une saisie en attente disparaissait sans un mot : les
  // quatre sélecteurs sont à quelques pixels au-dessus du tableau, et le clic
  // de travers est le geste le plus facile de l'écran.
  const [pendingContextChange, setPendingContextChange] =
    useState<{ label: string; apply: () => void } | null>(null)

  function guardContextChange(label: string, apply: () => void) {
    if (!hasUnsavedChanges) {
      apply()
      return
    }
    setPendingContextChange({ label, apply })
  }
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
        const score = parseScore(entry.value)
        if (score === null) return
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
          const score = parseScore(entry.value)
          if (score === null) return
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

  // ── Navigation clavier de la grille ───────────────────────────────────────
  //
  // C'est ici que se passe le vrai travail : trente notes d'affilée, au
  // clavier. L'ancien handler interceptait Tab sans jamais tester `shiftKey`
  // et sans relâcher le focus en fin de page — Shift+Tab ne remontait pas, et
  // la dernière cellule piégeait le focus : ni la pagination ni le bouton
  // Enregistrer n'étaient atteignables (échec WCAG 2.1.2).
  //
  // Chaque cellule de note porte data-grid-row / data-grid-col. Une
  // sous-matière dispensée n'a pas de champ : la recherche saute les trous
  // plutôt que de s'y arrêter.

  function findCell(row: number, col: number): HTMLInputElement | null {
    return document.querySelector<HTMLInputElement>(
      `input[data-grid-row="${row}"][data-grid-col="${col}"]`
    )
  }

  function focusCell(cell: HTMLInputElement | null): boolean {
    if (!cell) return false
    cell.focus()
    cell.select()
    return true
  }

  // Première cellule existante dans la colonne, à partir de `from` inclus.
  function findInColumn(from: number, col: number, rowCount: number, step: 1 | -1) {
    for (let r = from; r >= 0 && r < rowCount; r += step) {
      const cell = findCell(r, col)
      if (cell) return cell
    }
    return null
  }

  // Ordre de tabulation : on descend la colonne, puis on repart en haut de la
  // colonne suivante. C'est l'ordre de la correction — « toutes les dictées,
  // puis toutes les grammaires » — et non l'ordre du DOM, qui ferait traverser
  // le nom, le code et le bouton de dispense à chaque élève.
  function findNextCell(
    row: number,
    col: number,
    colCount: number,
    rowCount: number,
    step: 1 | -1
  ): HTMLInputElement | null {
    const inColumn = findInColumn(row + step, col, rowCount, step)
    if (inColumn) return inColumn

    for (let c = col + step; c >= 0 && c < colCount; c += step) {
      const entry = findInColumn(step === 1 ? 0 : rowCount - 1, c, rowCount, step)
      if (entry) return entry
    }
    return null
  }

  // Collage d'une colonne entière — depuis Excel, LibreOffice ou un relevé
  // manuscrit recopié. Une seule valeur garde le comportement natif ; à partir
  // de deux, on distribue vers le bas dans la colonne. Chaque valeur passe par
  // handleGradeChange/handleSectionGradeChange, donc par DR-004 : le collage ne
  // contourne pas la validation.
  function handleGridPaste(
    e: React.ClipboardEvent<HTMLInputElement>,
    row: number,
    col: number,
    rowCount: number,
    applyAt: (row: number, value: string) => void
  ) {
    const tokens = e.clipboardData
      .getData('text')
      .split(/[\r\n\t;]+/)
      .map(t => t.trim())
      .filter(Boolean)
    if (tokens.length <= 1) return

    e.preventDefault()
    let r = row
    for (const token of tokens) {
      // Sauter les sous-matières dispensées, qui n'ont pas de champ.
      while (r < rowCount && !findCell(r, col)) r++
      if (r >= rowCount) break
      applyAt(r, token)
      r++
    }
  }

  function handleGridKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    row: number,
    col: number,
    colCount: number,
    rowCount: number
  ) {
    // Ctrl/Cmd + S : enregistrer sans lâcher le clavier. Le bouton est en bas
    // de la carte, hors écran pendant la saisie.
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault()
      handleSaveGrades()
      return
    }

    // Haut / Bas : changer de ligne. Les champs sont en `type="text"` depuis
    // le passage à `inputMode="decimal"`, donc plus d'incrément natif à
    // neutraliser — mais le preventDefault reste nécessaire pour empêcher le
    // navigateur de déplacer le curseur dans le champ au lieu de changer de
    // ligne.
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      focusCell(findInColumn(row + step, col, rowCount, step))
      return
    }

    // Entrée : cellule suivante dans la colonne, comme dans un tableur.
    if (e.key === 'Enter') {
      e.preventDefault()
      focusCell(findInColumn(row + 1, col, rowCount, 1))
      return
    }

    if (e.key !== 'Tab') return

    const next = findNextCell(row, col, colCount, rowCount, e.shiftKey ? -1 : 1)
    // Plus rien au-delà : on ne bloque pas. Le focus doit pouvoir sortir de la
    // grille vers la pagination et le bouton Enregistrer.
    if (!next) return
    e.preventDefault()
    focusCell(next)
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
      const isModified = existing && hasValue && !hasError && parseScore(entry!.value) !== Number(existing.studentScore)
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

      if (existing && value && entry?.isValid && parseScore(value) !== Number(existing.studentScore)) {
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

  // La colonne « Statut » a été retirée : elle coûtait une colonne entière pour
  // un signal qui appartient à la cellule. Mais elle portait une information que
  // la couleur de cellule ne portait PAS — enregistré / en attente — et la
  // perdre reviendrait à cacher à l'utilisatrice ce qui est déjà en base.
  // Ce signal descend donc dans le champ lui-même, en mots ET en couleur :
  // jamais par la couleur seule, sans quoi il disparaîtrait pour un lecteur
  // d'écran comme pour un daltonien.
  const BADGE_WORDING: Record<BadgeKind, string> = {
    modified: 'modifié, non enregistré',
    entered:  'saisi, non enregistré',
    saved:    'enregistré',
    empty:    'non saisi',
  }

  // Le vert ne dit plus « syntaxiquement valide » — il le disait sur toute note,
  // y compris un 2/20, si bien que trente cellules vertes ne distinguaient plus
  // rien. Il ne reste qu'un seul axe de couleur : en attente ou en base.
  function cellStateClass(kind: BadgeKind): string {
    if (kind === 'modified' || kind === 'entered') {
      return 'border-warning-border bg-warning-soft/50 text-warning-ink'
    }
    if (kind === 'saved') return 'border-input text-foreground'
    return ''
  }

  // ── Recherche + tri stable ────────────────────────────────────────────────

  const initialSortedEnrollments = useMemo(() => {
    return enrollmentsForSubject
      .map((enrollment, index) => ({ enrollment, index }))
      .sort((a, b) => {
        const byLastName = compareTextValues(a.enrollment.student.user.lastname, b.enrollment.student.user.lastname)
        if (byLastName !== 0) return byLastName
        const byFirstName = compareTextValues(a.enrollment.student.user.firstname, b.enrollment.student.user.firstname)
        if (byFirstName !== 0) return byFirstName
        return a.index - b.index
      })
      .map(({ enrollment }, index) => ({ enrollment, index }))
  }, [enrollmentsForSubject])

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

    // Le comparateur est appelé O(n log n) fois et `sectionRowTotal` reparcourt
    // les sous-matières à chaque appel : on calcule une fois, avant le tri.
    const sectionTotals = sortConfig.key === 'sectionTotal'
      ? new Map(filteredEnrollmentsBeforeSort.map(
          ({ enrollment }) => [enrollment.id, sectionRowTotal(enrollment.id)] as const
        ))
      : null

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
          case 'globalNote': {
            const scoreA = gradeEntries.get(enrollmentA.id)?.value
            const scoreB = gradeEntries.get(enrollmentB.id)?.value
            comparison = compareNullableNumbers(
              scoreA?.trim() ? parseScore(scoreA) : null,
              scoreB?.trim() ? parseScore(scoreB) : null,
              direction
            )
            break
          }
          case 'sectionTotal': {
            const totalA = sectionTotals!.get(enrollmentA.id)!
            const totalB = sectionTotals!.get(enrollmentB.id)!
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
  function handleSort(key: SortKey) {
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
      <TableHead aria-sort={ariaSort} className={cn("sticky top-0 z-10 h-9 bg-muted px-3 py-1.5 font-semibold", className)}>
        <button
          type="button"
          onClick={() => handleSort(key)}
          className={cn(
            "inline-flex w-full items-center gap-1.5 rounded-sm py-1 text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
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

  function renderTableRow(enrollment: ApiEnrollment, rowIndex: number) {
    const entry    = gradeEntries.get(enrollment.id)
    const hasValue = !!entry?.value?.trim()
    const hasError = hasValue && entry && !entry.isValid
    const errorId  = `note-error-${enrollment.id}`
    const studentName = `${enrollment.student.user.firstname} ${enrollment.student.user.lastname}`
    const kind     = getBadgeKind(enrollment.id)

    return (
      <TableRow key={enrollment.id} className="group">
        <TableCell className="min-w-[132px] px-2 py-1 pl-6 text-xs font-semibold text-foreground">
          {enrollment.student.user.lastname}
        </TableCell>
        <TableCell className="min-w-[116px] px-2 py-1 text-xs text-foreground">
          {enrollment.student.user.firstname}
        </TableCell>
        <TableCell className="min-w-[104px] px-2 py-1">
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {enrollment.student.studentCode}
          </code>
        </TableCell>
        <TableCell className="min-w-[104px] px-2 py-1 pr-6">
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center justify-center gap-1.5">
              <Input
                type="text" inputMode="decimal" autoComplete="off"
                value={entry?.value || ''} placeholder="—" disabled={isLocked}
                onChange={e => handleGradeChange(enrollment.id, e.target.value)}
                onPaste={e => handleGridPaste(
                  e, rowIndex, 0, filteredEnrollments.length,
                  (r, v) => handleGradeChange(filteredEnrollments[r].id, v)
                )}
                className={cn(
                  "h-7 w-16 border-input bg-background px-1 text-center text-sm font-semibold tabular-nums",
                  !hasError && cellStateClass(kind),
                  hasError && "border-destructive focus-visible:ring-destructive"
                )}
                onKeyDown={e => handleGridKeyDown(e, rowIndex, 0, 1, filteredEnrollments.length)}
                aria-label={`Note de ${studentName} sur ${maxScore} — ${BADGE_WORDING[kind]}`}
                title={BADGE_WORDING[kind]}
                aria-invalid={!!hasError}
                aria-describedby={hasError ? errorId : undefined}
                data-grid-row={rowIndex}
                data-grid-col={0}
              />
              <span className="text-xs font-medium text-muted-foreground">/ {maxScore}</span>
            </div>
            {hasError && entry?.error && (
              <p id={errorId} role="alert" className="text-2xs text-destructive">{entry.error}</p>
            )}
          </div>
        </TableCell>
      </TableRow>
    )
  }

  function renderSectionsTableRow(enrollment: ApiEnrollment, rowIndex: number) {
    const studentMap = sectionEntries.get(enrollment.id)
    const total = sectionRowTotal(enrollment.id)
    const excluded = exclusionsByEnrollment.get(enrollment.id) ?? new Set<string>()
    const excludedHere = subjectSections.filter((sec) => excluded.has(sec.id)).length
    const studentName = `${enrollment.student.user.firstname} ${enrollment.student.user.lastname}`
    return (
      <TableRow key={enrollment.id} className="group">
        <TableCell className="min-w-[142px] px-2 py-1 pl-6 text-xs font-semibold text-foreground">
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
              <Badge variant="outline" className="border-warning-border bg-warning-soft text-3xs text-warning-ink">
                {excludedHere} exclue(s)
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="min-w-[116px] px-2 py-1 text-xs text-foreground">
          {enrollment.student.user.firstname}
        </TableCell>
        <TableCell className="min-w-[104px] px-2 py-1">
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {enrollment.student.studentCode}
          </code>
        </TableCell>
        {subjectSections.map((sec, colIndex) => {
          const isExcluded = excluded.has(sec.id)
          const entry = studentMap?.get(sec.id)
          const hasValue = !!entry?.value?.trim()
          const hasError = hasValue && entry && !entry.isValid
          const errorId = `note-error-${enrollment.id}-${sec.id}`
          const kind = getBadgeKind(enrollment.id)
          return (
            <TableCell key={sec.id} className={cn("min-w-[104px] px-2 py-1 align-top", isExcluded && "bg-muted/30")}>
              {isExcluded ? (
                <div className="flex flex-col items-center gap-0.5">
                  <span className="inline-flex items-center gap-1 text-3xs font-medium text-muted-foreground">
                    <MinusCircleIcon className="h-3 w-3" /> Exclue
                  </span>
                  <span className="text-3xs text-muted-foreground">non comptée</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-0.5">
                  <div className="flex items-center justify-center gap-1.5">
                    <Input
                      type="text" inputMode="decimal" autoComplete="off"
                      value={entry?.value || ''} placeholder="—" disabled={isLocked}
                      onChange={e => handleSectionGradeChange(enrollment.id, sec.id, e.target.value)}
                      onPaste={e => handleGridPaste(
                        e, rowIndex, colIndex, filteredEnrollments.length,
                        (r, v) => handleSectionGradeChange(filteredEnrollments[r].id, sec.id, v)
                      )}
                      className={cn(
                        "h-7 w-16 border-input bg-background px-1 text-center text-sm font-semibold tabular-nums",
                        !hasError && cellStateClass(kind),
                        hasError && "border-destructive focus-visible:ring-destructive"
                      )}
                      onKeyDown={e => handleGridKeyDown(
                        e, rowIndex, colIndex, subjectSections.length, filteredEnrollments.length
                      )}
                      aria-label={`${sec.name} — ${studentName}, sur ${sec.maxScore} — ${BADGE_WORDING[kind]}`}
                      title={BADGE_WORDING[kind]}
                      aria-invalid={!!hasError}
                      aria-describedby={hasError ? errorId : undefined}
                      data-grid-row={rowIndex}
                      data-grid-col={colIndex}
                    />
                    <span className="text-2xs font-medium text-muted-foreground tabular-nums">/ {sec.maxScore}</span>
                  </div>
                  {hasError && entry?.error && (
                    <p id={errorId} role="alert" className="text-3xs text-destructive">{entry.error}</p>
                  )}
                </div>
              )}
            </TableCell>
          )
        })}
        <TableCell className="min-w-[104px] px-2 py-1 pr-6 text-center">
          {total.raw > 0 || total.complete ? (
            <span
              className={cn(
                "inline-flex min-w-[88px] items-center justify-center rounded-md border px-2 py-0.5 tabular-nums text-sm font-bold text-foreground",
                total.complete ? "border-border bg-muted" : "border-warning-border bg-warning-soft text-warning-ink"
              )}
              title={total.complete ? "Total complet" : "Total partiel (toutes les sections ne sont pas saisies)"}
            >
              {total.raw.toFixed(2)} <span className="text-muted-foreground font-normal">/ {total.max}</span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
      </TableRow>
    )
  }

  // ── Spinner shared ────────────────────────────────────────────────────────
  function renderSpinner() {
    return (
      <Card className="border bg-card shadow-sm">
        <CardContent className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border border-muted border-t-primary" />
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
                  {headerLabel} &middot; {enteredCount} / {enrollmentsForSubject.length} notes saisies
                  </span>
                  {hasUnsavedChanges && (
                <Badge
          variant="outline"
          className="border-warning-border bg-warning-soft text-warning-ink text-2xs font-medium"
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
          <div className="flex max-w-md flex-1 items-center gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou code..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {searchQuery.trim() && (
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {filteredEnrollments.length} / {enrollmentsForSubject.length}
              </span>
            )}
          </div>
          {sortConfig.direction && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSortConfig({ key: null, direction: null })
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
                      ? "bg-primary text-primary-foreground"
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
                      ? "bg-primary text-primary-foreground"
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
              <h2 className="mt-4 text-base font-semibold text-foreground">
                Aucun élève trouvé
              </h2>
              <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                {searchQuery ? "Modifiez vos critères de recherche." : "Aucun élève inscrit dans cette classe."}
              </p>
            </div>
          ) : entryMode === 'sections' ? (
            <Table
              containerClassName="cpmsl-scroll max-h-[min(60vh,640px)] overflow-y-auto"
              style={{ minWidth: `${466 + subjectSections.length * 104}px` }}
            >
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {renderSortableHead('lastName', 'Nom', 'pl-6', 'left', 'Trier par nom')}
                    {renderSortableHead('firstName', 'Prénom', undefined, 'left', 'Trier par prénom')}
                    {renderSortableHead('studentCode', 'Code', undefined, 'left', 'Trier par code élève')}
                    {subjectSections.map(sec => (
                      <TableHead key={sec.id} className="sticky top-0 z-10 min-w-[104px] bg-muted px-3 py-1.5 text-center font-semibold">
                        <div className="flex flex-col items-center gap-0.5">
                          <span>{sec.name}</span>
                          <span className="text-3xs font-normal text-muted-foreground">/ {sec.maxScore}</span>
                        </div>
                      </TableHead>
                    ))}
                    {renderSortableHead('sectionTotal', `Total / ${maxScore}`, 'min-w-[104px] pr-6', 'center', 'Trier par total')}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEnrollments.map((enrollment, i) => renderSectionsTableRow(enrollment, i))}
                </TableBody>
            </Table>
          ) : (
            <Table
              containerClassName="cpmsl-scroll max-h-[min(60vh,640px)] overflow-y-auto"
              style={{ minWidth: "456px" }}
            >
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {renderSortableHead('lastName', 'Nom', 'pl-6', 'left', 'Trier par nom')}
                  {renderSortableHead('firstName', 'Prénom', undefined, 'left', 'Trier par prénom')}
                  {renderSortableHead('studentCode', 'Code', undefined, 'left', 'Trier par code élève')}
                  {renderSortableHead('globalNote', `Note / ${maxScore}`, 'min-w-[104px] pr-6', 'center', 'Trier par note')}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEnrollments.map((enrollment, i) => renderTableRow(enrollment, i))}
              </TableBody>
            </Table>
          )}
        </CardContent>


        {/* Save button */}
        {!isLocked && filteredEnrollments.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-col items-start justify-between gap-2 p-4 sm:flex-row sm:items-center">
              {/* Ce que produit une cellule vide n'était dit nulle part. Elle
                  saisissait vers un bulletin qu'elle ne voit pas, sans savoir
                  qu'un oubli s'imprime comme une absence pénalisante.
                  Règle arbitrée par la MOA le 2026-09-09, cf. E5 et
                  docs/CALCUL-BULLETIN.md. */}
              {missingCount > 0 ? (
                <p className="max-w-prose text-xs text-muted-foreground">
                  <span className="font-medium text-warning-ink tabular-nums">
                    {missingCount} élève{missingCount > 1 ? "s" : ""}
                  </span>{" "}
                  sans note. À l&apos;impression, une note manquante compte{" "}
                  <strong className="font-medium text-foreground">0</strong> et
                  <strong className="font-medium text-foreground"> conserve son barème</strong>{" "}
                  au dénominateur — ce n&apos;est pas la même chose qu&apos;une dispense.
                </p>
              ) : (
                <span />
              )}
              <Button
                className="shrink-0"
                onClick={handleSaveGrades}
                disabled={!selectedClassSubjectId || !selectedStepId || hasErrors || saving}
              >
                {saving ? (
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border border-primary-foreground border-t-transparent" />
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
            <h2 className="mt-4 text-base font-semibold text-foreground">
              Aucune sélection
            </h2>
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
              <Select
                value={selectedStepId}
                onValueChange={v => guardContextChange("d'étape", () => onStepChange(v))}
              >
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    {isLocked && <LockIcon className="h-4 w-4 text-warning-ink" />}
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
                onValueChange={v => guardContextChange("de matière", () => onClassSubjectChange(v))}
                disabled={!selectedSessionId || loadingSession}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingSession ? "Chargement..." : "Sélectionner une matière"} />
                </SelectTrigger>
                <SelectContent>
                  {visibleClassSubjects.map(cs => (
                    <SelectItem key={cs.id} value={cs.id}>
                      {cs.subject.name}
                      {cs.track ? ` — Examen ${cs.track.code}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Portée — visible seulement si la salle a des matières d'examen */}
          {hasExamSubjects && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
              <span className="text-xs font-medium text-muted-foreground">Matières :</span>
              <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
                {([
                  { key: 'all',    label: 'Toutes' },
                  { key: 'common', label: 'Tronc commun' },
                  { key: 'exam',   label: 'Examen officiel' },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSubjectScope(opt.key)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      subjectScope === opt.key
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {selectedClassSubject?.track && (
                <span className="text-xs text-info-ink">
                  Seuls les élèves de la filière {selectedClassSubject.track.code} sont affichés.
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bannière étape clôturée */}
      {showContent && isLocked && (
        <Alert className="border-warning-border bg-warning-soft text-warning-ink">
          <LockIcon className="h-4 w-4 !text-warning-ink" />
          <AlertTitle>Étape clôturée</AlertTitle>
          <AlertDescription>
            Réouvrez l&apos;étape depuis la Configuration pour saisir des notes.
          </AlertDescription>
        </Alert>
      )}

      {renderMainContent()}

      {/* Garde-fou : changement de contexte avec des notes en attente */}
      <AlertDialog
        open={!!pendingContextChange}
        onOpenChange={(o) => { if (!o) setPendingContextChange(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingChangeCount} note{pendingChangeCount > 1 ? "s" : ""} non
              enregistrée{pendingChangeCount > 1 ? "s" : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Changer {pendingContextChange?.label} recharge la grille et efface{" "}
              {pendingChangeCount > 1 ? "ces saisies" : "cette saisie"}.
              Enregistrez d&apos;abord pour {pendingChangeCount > 1 ? "les" : "la"} conserver.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revenir à la saisie</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                pendingContextChange?.apply()
                setPendingContextChange(null)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Abandonner {pendingChangeCount > 1 ? "les modifications" : "la modification"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            <Button onClick={saveExclusions} disabled={savingExclusions}>
              {savingExclusions ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
