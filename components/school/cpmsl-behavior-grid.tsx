"use client"

import { useState, useEffect, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { StatCard } from "@/components/school/stat-card"
import {
  SaveIcon, LockIcon, UsersIcon, FileTextIcon,
  AlertTriangleIcon, CheckCircle2Icon, SearchIcon, InboxIcon,
} from "lucide-react"
import type { ApiClassSession } from "@/lib/api/students"
import type { AcademicYearStep } from "@/lib/api/dashboard"
import type { ApiEnrollment } from "@/lib/api/grades"
import { fetchEnrollments } from "@/lib/api/grades"
import { cn } from "@/lib/utils"

// Types API

interface ApiAttitude {
  id: string
  label: string
  academicYearId: string
}

interface ApiAttitudeResponse {
  attitudeId: string
  value: boolean
}

interface ApiBehavior {
  id: string
  enrollmentId: string
  stepId: string
  absences: number | null
  retards: number | null
  devoirsManques: number | null
  leconsNonSues: number | null
  respectUniforme: number | null
  discipline: number | null
  pointsForts: string | null
  defis: string | null
  remarque: string | null
  attitudeResponses: ApiAttitudeResponse[]
}

// Types internes

interface BehaviorEntry {
  behaviorId: string | null
  enrollmentId: string
  absences: string
  retards: string
  devoirsManques: string
  leconsNonSues: string
  respectUniforme: string
  discipline: string
  attitudeResponses: Map<string, boolean | null>
  pointsForts: string
  defis: string
  remarque: string
}

type BehaviorExtraFields = {
  leconsNonSues: string
  respectUniforme: string
  discipline: string
  cleanRemarque: string
}

type NumericBehaviorField =
  | "absences"
  | "retards"
  | "devoirsManques"
  | "leconsNonSues"
  | "respectUniforme"
  | "discipline"

type TextBehaviorField = "pointsForts" | "defis" | "remarque"

type BehaviorFilter = "all" | "filled" | "missing"

// Props

interface CPMSLBehaviorGridProps {
  yearId: string
  sessions: ApiClassSession[]
  steps: AcademicYearStep[]
}

// Helpers

function getStudentInitials(enrollment: ApiEnrollment): string {
  const f = enrollment.student?.user?.firstname?.[0] ?? ""
  const l = enrollment.student?.user?.lastname?.[0] ?? ""
  return `${f}${l}`.toUpperCase()
}

function getStudentName(enrollment: ApiEnrollment): string {
  const first = enrollment.student?.user?.firstname ?? ""
  const last  = enrollment.student?.user?.lastname ?? ""
  return `${first} ${last}`.trim() || (enrollment.student?.studentCode ?? "—")
}

function extractBehaviorExtrasFromRemarque(remarque: string | null): BehaviorExtraFields {
  const source = remarque ?? ""
  const markerPattern = /\[\[\s*(LECONS_NON_SUES|RESPECT_UNIFORME|DISCIPLINE)\s*=\s*([^\]]*)\]\]/gi
  const values: BehaviorExtraFields = {
    leconsNonSues: "",
    respectUniforme: "",
    discipline: "",
    cleanRemarque: "",
  }

  let match: RegExpExecArray | null
  while ((match = markerPattern.exec(source)) !== null) {
    const key = match[1].toUpperCase()
    const value = match[2].trim()
    if (key === "LECONS_NON_SUES" && values.leconsNonSues === "") values.leconsNonSues = value
    if (key === "RESPECT_UNIFORME" && values.respectUniforme === "") values.respectUniforme = value
    if (key === "DISCIPLINE" && values.discipline === "") values.discipline = value
  }

  values.cleanRemarque = source
    .replace(markerPattern, "")
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter((line, index, lines) => line.trim() !== "" || (index > 0 && index < lines.length - 1))
    .join("\n")
    .trim()

  return values
}

// Ancienne logique supprimée : on ne cache plus les valeurs numériques dans `remarque`.
// Les anciennes remarques contenant des marqueurs sont encore lues par
// extractBehaviorExtrasFromRemarque(), mais à la sauvegarde les valeurs sont
// envoyées dans des colonnes séparées.
function parseNullableInt(value: string): number | null {
  return value.trim() === "" ? null : Number.parseInt(value, 10)
}

function hasBehaviorData(entry: BehaviorEntry): boolean {
  const hasAttitude = Array.from(entry.attitudeResponses.values()).some(value => value !== null)
  return (
    entry.absences.trim() !== "" ||
    entry.retards.trim() !== "" ||
    entry.devoirsManques.trim() !== "" ||
    entry.leconsNonSues.trim() !== "" ||
    entry.respectUniforme.trim() !== "" ||
    entry.discipline.trim() !== "" ||
    hasAttitude ||
    entry.pointsForts.trim() !== "" ||
    entry.defis.trim() !== "" ||
    entry.remarque.trim() !== ""
  )
}

function buildBehaviorPayload(entry: BehaviorEntry, selectedStepId: string) {
  const attitudeResponses = Array.from(entry.attitudeResponses.entries())
    .filter(([, value]) => value !== null)
    .map(([attitudeId, value]) => ({ attitudeId, value: value as boolean }))

  return {
    enrollmentId: entry.enrollmentId,
    stepId: selectedStepId,

    absences: parseNullableInt(entry.absences),
    retards: parseNullableInt(entry.retards),
    devoirsManques: parseNullableInt(entry.devoirsManques),
    leconsNonSues: parseNullableInt(entry.leconsNonSues),
    respectUniforme: parseNullableInt(entry.respectUniforme),
    discipline: parseNullableInt(entry.discipline),

    pointsForts: entry.pointsForts.trim() || null,
    defis: entry.defis.trim() || null,
    remarque: entry.remarque.trim() || null,

    attitudeResponses,
  }
}

function createEmptyBehaviorEntry(enrollmentId: string): BehaviorEntry {
  return {
    behaviorId: null,
    enrollmentId,
    absences: "",
    retards: "",
    devoirsManques: "",
    leconsNonSues: "",
    respectUniforme: "",
    discipline: "",
    attitudeResponses: new Map<string, boolean | null>(),
    pointsForts: "",
    defis: "",
    remarque: "",
  }
}

function createBehaviorEntry(
  enr: ApiEnrollment,
  behaviorList: ApiBehavior[],
  attitudes: ApiAttitude[]
): BehaviorEntry {
  const existing = behaviorList.find(b => b.enrollmentId === enr.id)
  const attMap   = new Map<string, boolean | null>()
  attitudes.forEach(att => attMap.set(att.id, null))
  existing?.attitudeResponses.forEach(r => attMap.set(r.attitudeId, r.value))
  const parsedExtras = extractBehaviorExtrasFromRemarque(existing?.remarque ?? null)

  return {
    behaviorId:        existing?.id ?? null,
    enrollmentId:      enr.id,
    absences:          existing?.absences?.toString()       ?? "",
    retards:           existing?.retards?.toString()        ?? "",
    devoirsManques:    existing?.devoirsManques?.toString() ?? "",
    leconsNonSues:     existing?.leconsNonSues?.toString() ?? parsedExtras.leconsNonSues,
    respectUniforme:   existing?.respectUniforme?.toString() ?? parsedExtras.respectUniforme,
    discipline:        existing?.discipline?.toString() ?? parsedExtras.discipline,
    attitudeResponses: attMap,
    pointsForts:       existing?.pointsForts ?? "",
    defis:             existing?.defis       ?? "",
    remarque:          parsedExtras.cleanRemarque,
  }
}

// Composant

export function CPMSLBehaviorGrid({ yearId, sessions, steps }: CPMSLBehaviorGridProps) {
  const { toast } = useToast()

  const [selectedSessionId, setSelectedSessionId] = useState("")
  const [selectedStepId,    setSelectedStepId]    = useState("")
  const [selectedClassTypeId, setSelectedClassTypeId] = useState("")

  // Sync classType when sessions arrive or the session changes externally
  useEffect(() => {
    const nextClassTypeId = selectedSessionId
      ? sessions.find(x => x.id === selectedSessionId)?.class.classType.id ?? ""
      : ""

    void Promise.resolve().then(() => {
      setSelectedClassTypeId(current => current === nextClassTypeId ? current : nextClassTypeId)
    })
  }, [selectedSessionId, sessions])

  const classTypeOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    sessions.forEach(s => {
      const ct = s.class?.classType
      if (ct && !map.has(ct.id)) map.set(ct.id, { id: ct.id, name: ct.name })
    })
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [sessions])

  const salleOptions = useMemo(() => {
    if (!selectedClassTypeId) return []
    return sessions
      .filter(s => s.class?.classType?.id === selectedClassTypeId)
      .map(s => ({
        sessionId: s.id,
        // For tracked classes (NS3/NS4) the track code stands in as the "salle".
        label: s.class.track?.code ?? s.class.letter ?? "",
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [sessions, selectedClassTypeId])

  function handleClassTypeChange(ctId: string) {
    setSelectedClassTypeId(ctId)
    setSelectedSessionId("")
    setSelectedStepId("")
  }

  const [attitudes,   setAttitudes]   = useState<ApiAttitude[]>([])
  const [enrollments, setEnrollments] = useState<ApiEnrollment[]>([])
  const [entries,     setEntries]     = useState<Map<string, BehaviorEntry>>(new Map())

  const [loadingAttitudes, setLoadingAttitudes] = useState(false)
  const [loadingBehaviors, setLoadingBehaviors] = useState(false)
  const [saving,           setSaving]           = useState(false)
  const [currentPage,      setCurrentPage]      = useState(1)
  const [searchQuery,      setSearchQuery]      = useState("")
  const [behaviorFilter,   setBehaviorFilter]   = useState<BehaviorFilter>("all")
  const itemsPerPage = 25

  // Chargement attitudes

  useEffect(() => {
    if (!yearId) return
    let cancelled = false

    void Promise.resolve().then(async () => {
      setLoadingAttitudes(true)
      try {
        const response = await fetch(`/api/attitudes?academicYearId=${yearId}`, { credentials: "include" })
        const data = await response.json()
        if (!cancelled) setAttitudes(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled) {
          toast({ title: "Erreur", description: "Impossible de charger les attitudes", variant: "destructive" })
        }
      } finally {
        if (!cancelled) setLoadingAttitudes(false)
      }
    })

    return () => { cancelled = true }
  }, [yearId, toast])

  // Chargement enrollments + behaviors

  useEffect(() => {
    if (!selectedSessionId || !selectedStepId) return
    let cancelled = false

    void Promise.resolve().then(async () => {
      setLoadingBehaviors(true)
      try {
        const [enrs, behs] = await Promise.all([
          fetchEnrollments(selectedSessionId),
          fetch(`/api/behaviors?classSessionId=${selectedSessionId}&stepId=${selectedStepId}`, { credentials: "include" })
            .then(r => r.json())
        ])

        if (cancelled) return

        const enrollmentList: ApiEnrollment[] = Array.isArray(enrs) ? enrs : []
        const behaviorList: ApiBehavior[]     = Array.isArray(behs) ? behs : []

        setEnrollments(enrollmentList)
        setCurrentPage(1)

        const newEntries = new Map<string, BehaviorEntry>()
        enrollmentList.forEach(enr => {
          newEntries.set(enr.id, createBehaviorEntry(enr, behaviorList, attitudes))
        })
        setEntries(newEntries)
      } catch {
        if (!cancelled) {
          toast({ title: "Erreur", description: "Impossible de charger les comportements", variant: "destructive" })
        }
      } finally {
        if (!cancelled) setLoadingBehaviors(false)
      }
    })

    return () => { cancelled = true }
  }, [selectedSessionId, selectedStepId, attitudes, toast])

  // Pagination + recherche

  const sortedEnrollments = useMemo(() =>
    [...enrollments].sort((a, b) => getStudentName(a).localeCompare(getStudentName(b))),
    [enrollments]
  )

  const filteredEnrollments = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return sortedEnrollments.filter(e => {
      const name = getStudentName(e).toLowerCase()
      const code = (e.student?.studentCode ?? "").toLowerCase()
      const matchesSearch = !q.trim() || name.includes(q) || code.includes(q)
      const entry = entries.get(e.id)
      const filled = entry ? hasBehaviorData(entry) : false
      const matchesFilter =
        behaviorFilter === "all" ||
        (behaviorFilter === "filled" && filled) ||
        (behaviorFilter === "missing" && !filled)
      return matchesSearch && matchesFilter
    })
  }, [sortedEnrollments, searchQuery, behaviorFilter, entries])

  const totalPages    = Math.max(1, Math.ceil(filteredEnrollments.length / itemsPerPage))
  const paginatedEnrs = filteredEnrollments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const paginationWindow = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1)
    if (currentPage <= 3) return [1, 2, 3, 4, 'ellipsis-right', totalPages]
    if (currentPage >= totalPages - 2) {
      return [1, 'ellipsis-left', totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    }
    return [1, 'ellipsis-left', currentPage - 1, currentPage, currentPage + 1, 'ellipsis-right', totalPages]
  }, [currentPage, totalPages])

  useEffect(() => {
    void Promise.resolve().then(() => setCurrentPage(1))
  }, [searchQuery, behaviorFilter])

  // KPIs

  const kpis = useMemo(() => {
    const total   = sortedEnrollments.length
    let   entered = 0
    sortedEnrollments.forEach(enr => {
      const e = entries.get(enr.id)
      if (!e) return
      if (hasBehaviorData(e)) entered++
    })
    return { total, entered, missing: total - entered, percent: total > 0 ? Math.round((entered / total) * 100) : 0 }
  }, [sortedEnrollments, entries])

  // Handlers

  function handleNumber(enrollmentId: string, field: NumericBehaviorField, value: string) {
    const max = field === "respectUniforme" || field === "discipline" ? 10 : 999
    if (value !== "" && (!/^\d+$/.test(value) || Number.parseInt(value, 10) > max)) return
    setEntries(prev => {
      const next = new Map(prev)
      const e = next.get(enrollmentId)
      if (e) next.set(enrollmentId, { ...e, [field]: value })
      return next
    })
  }

  function handleText(enrollmentId: string, field: TextBehaviorField, value: string) {
    const max = field === "remarque" ? 500 : 300
    if (value.length > max) return
    setEntries(prev => {
      const next = new Map(prev)
      const e = next.get(enrollmentId)
      if (e) next.set(enrollmentId, { ...e, [field]: value })
      return next
    })
  }

  function handleAttitude(enrollmentId: string, attitudeId: string, value: boolean) {
    setEntries(prev => {
      const next = new Map(prev)
      const e = next.get(enrollmentId)
      if (!e) return next
      const attMap = new Map(e.attitudeResponses)
      attMap.set(attitudeId, value)
      next.set(enrollmentId, { ...e, attitudeResponses: attMap })
      return next
    })
  }

  async function handleSave() {
    if (!selectedSessionId || !selectedStepId || isLocked) return
    setSaving(true)
    try {
      const entriesToSave = Array.from(entries.values()).filter(e => e.behaviorId || hasBehaviorData(e))

      if (entriesToSave.length === 0) {
        toast({
          title: "Aucune donnée à enregistrer",
          description: "Aucun comportement renseigné pour cette sélection.",
        })
        return
      }

      let successCount = 0
      let errorCount = 0

      for (const e of entriesToSave) {
        const body = buildBehaviorPayload(e, selectedStepId)

        try {
          if (e.behaviorId) {
            const updateBody = {
              stepId: body.stepId,

              absences: body.absences,
              retards: body.retards,
              devoirsManques: body.devoirsManques,
              leconsNonSues: body.leconsNonSues,
              respectUniforme: body.respectUniforme,
              discipline: body.discipline,

              pointsForts: body.pointsForts,
              defis: body.defis,
              remarque: body.remarque,

              attitudeResponses: body.attitudeResponses,
            }
            const res = await fetch(`/api/behaviors/update/${e.behaviorId}`, {
              method: "POST", credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(updateBody),
            })
            if (!res.ok) {
              const errorBody = await res.json().catch(() => null)
              throw new Error(errorBody?.error || errorBody?.message || `HTTP ${res.status}`)
            }
          } else {
            const res = await fetch("/api/behaviors/create", {
              method: "POST", credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            })
            if (!res.ok) {
              const errorBody = await res.json().catch(() => null)
              throw new Error(errorBody?.error || errorBody?.message || `HTTP ${res.status}`)
            }
            const created = await res.json().catch(() => null) as
              | (Partial<ApiBehavior> & { behavior?: Partial<ApiBehavior>; data?: Partial<ApiBehavior> })
              | null

            const createdId = created?.id ?? created?.behavior?.id ?? created?.data?.id
            if (createdId) {
              setEntries(prev => {
                const next  = new Map(prev)
                const entry = next.get(e.enrollmentId)
                if (entry) next.set(e.enrollmentId, { ...entry, behaviorId: createdId })
                return next
              })
            }
          }
          successCount++
        } catch (error) {
          errorCount++
          console.error("[CPMSLBehaviorGrid] save behavior:", error)
        }
      }

      if (successCount > 0 && errorCount === 0) {
        toast({ title: `${successCount} comportement${successCount > 1 ? "s" : ""} enregistré${successCount > 1 ? "s" : ""}.` })
      } else if (successCount > 0) {
        toast({
          title: "Enregistrement partiel",
          description: `${successCount} comportement${successCount > 1 ? "s" : ""} enregistré${successCount > 1 ? "s" : ""}, ${errorCount} erreur${errorCount > 1 ? "s" : ""}.`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Aucun comportement n'a pu être enregistré.",
          description: "Veuillez réessayer ou vérifier la connexion.",
          variant: "destructive",
        })
      }
    } finally {
      setSaving(false)
    }
  }


  // Helpers pour le rendu

  const numericFields: Array<{
    field: NumericBehaviorField
    label: string
    max: number
  }> = [
    { field: "absences", label: "Absences", max: 999 },
    { field: "retards", label: "Retards", max: 999 },
    { field: "devoirsManques", label: "Devoirs manqués", max: 999 },
    { field: "leconsNonSues", label: "Nombre de leçons non sues", max: 999 },
    { field: "respectUniforme", label: "Respect des prescrits de l'uniforme (/10)", max: 10 },
    { field: "discipline", label: "Discipline (/10)", max: 10 },
  ]

  const textFields: Array<{
    field: TextBehaviorField
    label: string
    placeholder: string
    max: number
  }> = [
    { field: "pointsForts", label: "Points forts", placeholder: "Points forts...", max: 300 },
    { field: "defis", label: "Défis", placeholder: "Défis...", max: 300 },
    { field: "remarque", label: "Remarque", placeholder: "Remarque visible...", max: 500 },
  ]

  function renderNumericField(entry: BehaviorEntry, field: NumericBehaviorField, label: string, max: number) {
    return (
      <label key={field} className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Input
          inputMode="numeric"
          pattern="[0-9]*"
          min={0}
          max={max}
          step={1}
          value={entry[field]}
          placeholder="0"
          disabled={isLocked}
          onChange={event => handleNumber(entry.enrollmentId, field, event.target.value)}
          className="h-9 text-center tabular-nums"
        />
      </label>
    )
  }

  function renderTextField(entry: BehaviorEntry, field: TextBehaviorField, label: string, placeholder: string, max: number) {
    return (
      <label key={field} className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className="text-[11px] text-muted-foreground tabular-nums">{entry[field].length} / {max}</span>
        </div>
        <Textarea
          value={entry[field]}
          onChange={event => handleText(entry.enrollmentId, field, event.target.value)}
          placeholder={placeholder}
          disabled={isLocked}
          rows={3}
          className="resize-y text-sm"
        />
      </label>
    )
  }

  function renderAttitudeRow(att: ApiAttitude, e: BehaviorEntry, enrollmentId: string, isLocked: boolean) {
    const resp = e.attitudeResponses.get(att.id)
    return (
      <div key={att.id} className="flex flex-col gap-2 rounded-md border bg-muted/20 p-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-medium text-foreground">
          {att.label}
        </span>
        <div className="flex items-center gap-3">
          {([true, false] as const).map(val => (
            <label key={String(val)} className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name={`att-${enrollmentId}-${att.id}`}
                checked={resp === val}
                onChange={() => handleAttitude(enrollmentId, att.id, val)}
                disabled={isLocked}
                className="h-4 w-4 cursor-pointer accent-primary"
              />
              <span className="text-sm text-foreground">{val ? "Oui" : "Non"}</span>
            </label>
          ))}
        </div>
      </div>
    )
  }

  // Dérivés

  const selectedSession = sessions.find(s => s.id === selectedSessionId)
  const selectedStep    = steps.find(s => s.id === selectedStepId)
  const isLocked        = selectedStep ? !selectedStep.isCurrent : false
  const sessionLabelStr = selectedSession
    ? `${selectedSession.class?.classType?.name ?? ""} ${selectedSession.class?.letter ?? ""}`.trim()
    : ""

  // Pagination footer
  function renderPaginationFooter() {
    if (totalPages <= 1) return null
    return (
      <>
        <Separator />
        <div className="flex flex-col items-center justify-between gap-3 px-4 py-3 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            Page <span className="font-medium text-foreground tabular-nums">{currentPage}</span>{" "}
            sur <span className="font-medium text-foreground tabular-nums">{totalPages}</span>
            {" "}&middot; {filteredEnrollments.length} élève(s)
          </p>
          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={ev => { ev.preventDefault(); if (currentPage > 1) setCurrentPage(p => p - 1) }}
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
                      onClick={ev => { ev.preventDefault(); setCurrentPage(p) }}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                )
              })}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={ev => { ev.preventDefault(); if (currentPage < totalPages) setCurrentPage(p => p + 1) }}
                  className={cn(currentPage === totalPages && "pointer-events-none opacity-50")}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </>
    )
  }

  // Rendu

  return (
    <div className="space-y-6">
      {/* Sélecteurs */}
      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Sélection</CardTitle>
          <CardDescription>Classe et étape pour la saisie des comportements</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select value={selectedClassTypeId} onValueChange={handleClassTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Classe" />
              </SelectTrigger>
              <SelectContent>
                {classTypeOptions.map(ct => (
                  <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedSessionId}
              onValueChange={v => { setSelectedSessionId(v); setSelectedStepId("") }}
              disabled={!selectedClassTypeId}
            >
              <SelectTrigger>
                <SelectValue placeholder={selectedClassTypeId ? "Salle" : "Choisir d'abord une classe"} />
              </SelectTrigger>
              <SelectContent>
                {salleOptions.map(opt => (
                  <SelectItem key={opt.sessionId} value={opt.sessionId}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStepId} onValueChange={setSelectedStepId} disabled={!selectedSessionId}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  {isLocked && <LockIcon className="h-4 w-4 text-amber-600" />}
                  <SelectValue placeholder="Étape" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {steps.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    Étape {s.stepNumber}{s.isCurrent ? " (active)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* État vide */}
      {(!selectedSessionId || !selectedStepId) && (
        <Card className="border bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <InboxIcon className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              Aucune sélection
            </h3>
            <p className="mt-1 max-w-[320px] text-center text-sm text-muted-foreground">
              Sélectionnez une classe et une étape pour saisir les comportements.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Contenu principal */}
      {selectedSessionId && selectedStepId && (
        <>
          {/* Bannière verrouillage */}
          {isLocked && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
              <LockIcon className="h-4 w-4 !text-amber-600" />
              <AlertTitle>Étape clôturée</AlertTitle>
              <AlertDescription>
                Les comportements ne peuvent plus être modifiés.
              </AlertDescription>
            </Alert>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total élèves"
              value={kpis.total}
              icon={UsersIcon}
              iconClassName="text-blue-600"
              iconBgClassName="bg-blue-50"
            />
            <StatCard
              label="Comportements saisis"
              value={kpis.entered}
              icon={CheckCircle2Icon}
              iconClassName="text-emerald-600"
              iconBgClassName="bg-emerald-50"
            />
            <StatCard
              label="Comportements manquants"
              value={kpis.missing}
              icon={AlertTriangleIcon}
              iconClassName="text-amber-600"
              iconBgClassName="bg-amber-50"
            />
            <StatCard
              label="% complété"
              value={`${kpis.percent}%`}
              icon={FileTextIcon}
              iconClassName="text-violet-600"
              iconBgClassName="bg-violet-50"
            />
          </div>

          {/* Cartes élèves */}
          <Card className="border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Étape {selectedStep?.stepNumber} - {sessionLabelStr}
                  </CardTitle>
                  <CardDescription>
                    {filteredEnrollments.length} élève{filteredEnrollments.length > 1 ? "s" : ""} affiché{filteredEnrollments.length > 1 ? "s" : ""} sur {sortedEnrollments.length} - {kpis.entered} / {kpis.total} saisis
                  </CardDescription>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">Classe sélectionnée : {selectedSession?.class?.classType?.name ?? "-"}</Badge>
                    <Badge variant="outline">Salle : {selectedSession?.class?.track?.code ?? selectedSession?.class?.letter ?? "-"}</Badge>
                    <Badge variant="outline">Étape : {selectedStep ? `Étape ${selectedStep.stepNumber}` : "-"}</Badge>
                    {isLocked && (
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                        <LockIcon className="mr-1 h-3 w-3 !text-amber-600" /> Étape clôturée
                      </Badge>
                    )}
                  </div>
                </div>
                {!isLocked && filteredEnrollments.length > 0 && (
                  <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                    {saving ? (
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <SaveIcon className="mr-2 h-4 w-4" />
                    )}
                    {saving ? "Enregistrement..." : "Enregistrer les comportements"}
                  </Button>
                )}
              </div>
            </CardHeader>

            <Separator />

            <div className="space-y-3 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-md">
                  <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Recherche par nom ou code élève..."
                    value={searchQuery}
                    onChange={event => setSearchQuery(event.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {([
                    ["all", "Tous"],
                    ["filled", "Saisis"],
                    ["missing", "Manquants"],
                  ] as const).map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      variant={behaviorFilter === value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setBehaviorFilter(value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {filteredEnrollments.length} élève{filteredEnrollments.length > 1 ? "s" : ""} affiché{filteredEnrollments.length > 1 ? "s" : ""} sur {sortedEnrollments.length}
              </p>
            </div>

            <Separator />

            <CardContent className="p-4">
              {loadingBehaviors ? (
                <div className="flex items-center justify-center py-16">
                  <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-muted border-t-primary" />
                </div>
              ) : filteredEnrollments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                    <InboxIcon className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-foreground">Aucun élève trouvé</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {searchQuery || behaviorFilter !== "all" ? "Modifiez vos critères de recherche." : "Aucun élève inscrit dans cette classe."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {paginatedEnrs.map(enr => {
                    const entry = entries.get(enr.id) ?? createEmptyBehaviorEntry(enr.id)
                    const filled = hasBehaviorData(entry)

                    return (
                      <Card key={enr.id} className="border bg-background shadow-sm">
                        <CardHeader className="pb-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-muted text-xs font-semibold text-muted-foreground">
                                  {getStudentInitials(enr)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <CardTitle className="text-sm font-semibold text-foreground">
                                  {getStudentName(enr)}
                                </CardTitle>
                                <CardDescription className="text-xs">
                                  Code élève : {enr.student?.studentCode ?? "-"}
                                </CardDescription>
                              </div>
                            </div>
                            <Badge variant={filled ? "default" : "outline"} className={cn(!filled && "text-muted-foreground")}>
                              {filled ? "Saisi" : "Manquant"}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-5">
                          <section className="space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suivi quantitatif</h4>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                              {numericFields.map(({ field, label, max }) => renderNumericField(entry, field, label, max))}
                            </div>
                          </section>

                          <section className="space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attitudes</h4>
                            {loadingAttitudes ? (
                              <p className="text-xs text-muted-foreground">Chargement...</p>
                            ) : attitudes.length === 0 ? (
                              <p className="text-xs italic text-muted-foreground">Aucune attitude configurée</p>
                            ) : (
                              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                                {attitudes.map(att => renderAttitudeRow(att, entry, enr.id, isLocked))}
                              </div>
                            )}
                          </section>

                          <section className="space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Commentaires</h4>
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                              {textFields.map(({ field, label, placeholder, max }) => renderTextField(entry, field, label, placeholder, max))}
                            </div>
                          </section>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </CardContent>

            {renderPaginationFooter()}
          </Card>
        </>
      )}
    </div>
  )
}
