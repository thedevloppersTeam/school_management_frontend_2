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

// ── Types API ─────────────────────────────────────────────────────────────────

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
  pointsForts: string | null
  defis: string | null
  remarque: string | null
  attitudeResponses: ApiAttitudeResponse[]
}

// ── Types internes ─────────────────────────────────────────────────────────────

interface BehaviorEntry {
  behaviorId: string | null
  enrollmentId: string
  absences: string
  retards: string
  devoirsManques: string
  attitudeResponses: Map<string, boolean | null>
  pointsForts: string
  defis: string
  remarque: string
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface CPMSLBehaviorGridProps {
  yearId: string
  sessions: ApiClassSession[]
  steps: AcademicYearStep[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function createBehaviorEntry(
  enr: ApiEnrollment,
  behaviorList: ApiBehavior[],
  attitudes: ApiAttitude[]
): BehaviorEntry {
  const existing = behaviorList.find(b => b.enrollmentId === enr.id)
  const attMap   = new Map<string, boolean | null>()
  attitudes.forEach(att => attMap.set(att.id, null))
  existing?.attitudeResponses.forEach(r => attMap.set(r.attitudeId, r.value))

  return {
    behaviorId:        existing?.id ?? null,
    enrollmentId:      enr.id,
    absences:          existing?.absences?.toString()       ?? "",
    retards:           existing?.retards?.toString()        ?? "",
    devoirsManques:    existing?.devoirsManques?.toString() ?? "",
    attitudeResponses: attMap,
    pointsForts:       existing?.pointsForts ?? "",
    defis:             existing?.defis       ?? "",
    remarque:          existing?.remarque    ?? "",
  }
}

// ── Composant ─────────────────────────────────────────────────────────────────

export function CPMSLBehaviorGrid({ yearId, sessions, steps }: CPMSLBehaviorGridProps) {
  const { toast } = useToast()

  const [selectedSessionId, setSelectedSessionId] = useState("")
  const [selectedStepId,    setSelectedStepId]    = useState("")

  const [attitudes,   setAttitudes]   = useState<ApiAttitude[]>([])
  const [enrollments, setEnrollments] = useState<ApiEnrollment[]>([])
  const [entries,     setEntries]     = useState<Map<string, BehaviorEntry>>(new Map())

  const [loadingAttitudes, setLoadingAttitudes] = useState(false)
  const [loadingBehaviors, setLoadingBehaviors] = useState(false)
  const [saving,           setSaving]           = useState(false)
  const [currentPage,      setCurrentPage]      = useState(1)
  const [searchQuery,      setSearchQuery]      = useState("")
  const itemsPerPage = 25

  // ── Chargement attitudes ──────────────────────────────────────────────────

  useEffect(() => {
    if (!yearId) return
    setLoadingAttitudes(true)
    fetch(`/api/attitudes?academicYearId=${yearId}`, { credentials: "include" })
      .then(r => r.json())
      .then(data => setAttitudes(Array.isArray(data) ? data : []))
      .catch(() => toast({ title: "Erreur", description: "Impossible de charger les attitudes", variant: "destructive" }))
      .finally(() => setLoadingAttitudes(false))
  }, [yearId])

  // ── Chargement enrollments + behaviors ────────────────────────────────────

  useEffect(() => {
    if (!selectedSessionId || !selectedStepId) return
    setLoadingBehaviors(true)
    Promise.all([
      fetchEnrollments(selectedSessionId),
      fetch(`/api/behaviors?classSessionId=${selectedSessionId}&stepId=${selectedStepId}`, { credentials: "include" })
        .then(r => r.json())
    ])
      .then(([enrs, behs]) => {
        const enrollmentList: ApiEnrollment[] = Array.isArray(enrs) ? enrs : []
        const behaviorList: ApiBehavior[]     = Array.isArray(behs) ? behs : []

        setEnrollments(enrollmentList)
        setCurrentPage(1)

        const newEntries = new Map<string, BehaviorEntry>()
        enrollmentList.forEach(enr => {
          newEntries.set(enr.id, createBehaviorEntry(enr, behaviorList, attitudes))
        })
        setEntries(newEntries)
      })
      .catch(() => toast({ title: "Erreur", description: "Impossible de charger les comportements", variant: "destructive" }))
      .finally(() => setLoadingBehaviors(false))
  }, [selectedSessionId, selectedStepId])

  // ── Pagination + recherche ─────────────────────────────────────────────────

  const sortedEnrollments = useMemo(() =>
    [...enrollments].sort((a, b) => getStudentName(a).localeCompare(getStudentName(b))),
    [enrollments]
  )

  const filteredEnrollments = useMemo(() => {
    if (!searchQuery.trim()) return sortedEnrollments
    const q = searchQuery.toLowerCase()
    return sortedEnrollments.filter(e => {
      const name = getStudentName(e).toLowerCase()
      const code = (e.student?.studentCode ?? "").toLowerCase()
      return name.includes(q) || code.includes(q)
    })
  }, [sortedEnrollments, searchQuery])

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

  useEffect(() => { setCurrentPage(1) }, [searchQuery])

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const total   = sortedEnrollments.length
    let   entered = 0
    sortedEnrollments.forEach(enr => {
      const e = entries.get(enr.id)
      if (!e) return
      const hasAttitude = Array.from(e.attitudeResponses.values()).some(v => v !== null)
      if (e.absences || e.retards || e.devoirsManques || hasAttitude || e.pointsForts || e.defis || e.remarque)
        entered++
    })
    return { total, entered, missing: total - entered, percent: total > 0 ? Math.round((entered / total) * 100) : 0 }
  }, [sortedEnrollments, entries])

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleNumber(enrollmentId: string, field: "absences" | "retards" | "devoirsManques", value: string) {
    if (value !== "" && !(/^\d{1,3}$/.test(value) && parseInt(value) >= 0)) return
    setEntries(prev => {
      const next = new Map(prev)
      const e = next.get(enrollmentId)
      if (e) next.set(enrollmentId, { ...e, [field]: value })
      return next
    })
  }

  function handleText(enrollmentId: string, field: "pointsForts" | "defis" | "remarque", value: string) {
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
    if (!selectedSessionId || !selectedStepId) return
    setSaving(true)
    try {
      const ops = Array.from(entries.values()).map(async e => {
        const attitudeResponses = Array.from(e.attitudeResponses.entries())
          .filter(([, v]) => v !== null)
          .map(([attitudeId, value]) => ({ attitudeId, value: value as boolean }))

        const body = {
          enrollmentId:   e.enrollmentId,
          stepId:         selectedStepId,
          absences:       e.absences       ? parseInt(e.absences)       : null,
          retards:        e.retards        ? parseInt(e.retards)        : null,
          devoirsManques: e.devoirsManques ? parseInt(e.devoirsManques) : null,
          pointsForts:    e.pointsForts    || null,
          defis:          e.defis          || null,
          remarque:       e.remarque       || null,
          attitudeResponses,
        }

        if (e.behaviorId) {
          const { enrollmentId, ...updateBody } = body
          await fetch(`/api/behaviors/update/${e.behaviorId}`, {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updateBody),
          })
        } else {
          const res = await fetch("/api/behaviors/create", {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
          if (res.ok) {
            const created: ApiBehavior = await res.json()
            setEntries(prev => {
              const next  = new Map(prev)
              const entry = next.get(e.enrollmentId)
              if (entry) next.set(e.enrollmentId, { ...entry, behaviorId: created.id })
              return next
            })
          }
        }
      })
      await Promise.all(ops)
      toast({ title: "Comportements enregistrés" })
    } catch {
      toast({ title: "Erreur", description: "Erreur lors de l'enregistrement", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  // ── Helpers pour le rendu ────────────────────────────────────────────────

  function renderAttitudeRow(att: ApiAttitude, e: BehaviorEntry, enrollmentId: string, isLocked: boolean) {
    const resp = e.attitudeResponses.get(att.id)
    return (
      <div key={att.id} className="flex items-center gap-3">
        <span className="min-w-[130px] text-sm font-medium text-foreground">
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

  // ── Dérivés ───────────────────────────────────────────────────────────────

  const selectedSession = sessions.find(s => s.id === selectedSessionId)
  const selectedStep    = steps.find(s => s.id === selectedStepId)
  const isLocked        = selectedStep ? !selectedStep.isCurrent : false
  const sessionLabelStr = selectedSession
    ? `${selectedSession.class?.classType?.name ?? ""} ${selectedSession.class?.letter ?? ""}`.trim()
    : ""

  // ── Pagination footer ─────────────────────────────────────────────────────
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

  // ── Rendu ─────────────────────────────────────────────────────────────────

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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select value={selectedSessionId} onValueChange={v => { setSelectedSessionId(v); setSelectedStepId("") }}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une classe" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {`${s.class?.classType?.name ?? ""} ${s.class?.letter ?? ""}`.trim()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStepId} onValueChange={setSelectedStepId} disabled={!selectedSessionId}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  {isLocked && <LockIcon className="h-4 w-4 text-amber-600" />}
                  <SelectValue placeholder="Sélectionner une étape" />
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

          {/* Table */}
          <Card className="border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Étape {selectedStep?.stepNumber} — {sessionLabelStr}
                  </CardTitle>
                  <CardDescription>
                    {filteredEnrollments.length} élève{filteredEnrollments.length > 1 ? 's' : ''} &middot; {kpis.entered} / {kpis.total} saisis
                  </CardDescription>
                </div>
                {isLocked && (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                    <LockIcon className="mr-1 h-3 w-3 !text-amber-600" /> Clôturée
                  </Badge>
                )}
              </div>
            </CardHeader>

            <Separator />

            {/* Search toolbar */}
            <div className="p-4">
              <div className="relative max-w-md">
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom ou code..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <Separator />

            <CardContent className="p-0">
              {loadingBehaviors ? (
                <div className="flex items-center justify-center py-16">
                  <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-muted border-t-primary" />
                </div>
              ) : filteredEnrollments.length === 0 ? (
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
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="sticky left-0 z-10 min-w-[200px] bg-card pl-6 font-semibold">Élève</TableHead>
                        <TableHead className="min-w-[100px] text-center font-semibold">Absences</TableHead>
                        <TableHead className="min-w-[100px] text-center font-semibold">Retards</TableHead>
                        <TableHead className="min-w-[110px] text-center font-semibold">Devoirs manqués</TableHead>
                        <TableHead className="min-w-[260px] font-semibold">Attitudes</TableHead>
                        <TableHead className="min-w-[220px] font-semibold">Points forts</TableHead>
                        <TableHead className="min-w-[220px] font-semibold">Défis</TableHead>
                        <TableHead className="min-w-[220px] pr-6 font-semibold">Remarque</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedEnrs.map(enr => {
                        const e = entries.get(enr.id) ?? {
                          behaviorId: null, enrollmentId: enr.id,
                          absences: "", retards: "", devoirsManques: "",
                          attitudeResponses: new Map<string, boolean | null>(),
                          pointsForts: "", defis: "", remarque: "",
                        }

                        return (
                          <TableRow key={enr.id}>
                            <TableCell className="sticky left-0 z-10 bg-card pl-6">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-muted text-xs text-muted-foreground">
                                    {getStudentInitials(enr)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-semibold text-foreground">
                                    {getStudentName(enr)}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {enr.student?.studentCode ?? ""}
                                  </p>
                                </div>
                              </div>
                            </TableCell>

                            {(["absences", "retards", "devoirsManques"] as const).map(field => (
                              <TableCell key={field} className="text-center">
                                <Input
                                  type="number" min="0" max="999" step="1"
                                  value={e[field]} placeholder="0" disabled={isLocked}
                                  onChange={ev => handleNumber(enr.id, field, ev.target.value)}
                                  className="mx-auto w-20 text-center tabular-nums"
                                />
                              </TableCell>
                            ))}

                            {/* Attitudes */}
                            <TableCell>
                              {loadingAttitudes ? (
                                <p className="text-xs text-muted-foreground">Chargement...</p>
                              ) : attitudes.length === 0 ? (
                                <p className="text-xs italic text-muted-foreground">
                                  Aucune attitude configurée
                                </p>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  {attitudes.map(att => renderAttitudeRow(att, e, enr.id, isLocked))}
                                </div>
                              )}
                            </TableCell>

                            {/* Textes libres */}
                            {(["pointsForts", "defis", "remarque"] as const).map(field => (
                              <TableCell
                                key={field}
                                className={cn(field === "remarque" && "pr-6")}
                              >
                                <Textarea
                                  value={e[field]}
                                  onChange={ev => handleText(enr.id, field, ev.target.value)}
                                  placeholder={
                                    field === "pointsForts" ? "Points forts..." :
                                    field === "defis"       ? "Défis..." :
                                                              "Remarque..."
                                  }
                                  disabled={isLocked}
                                  rows={2}
                                  className="resize-y text-sm"
                                />
                                <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                                  {e[field].length} / {field === "remarque" ? 500 : 300}
                                </p>
                              </TableCell>
                            ))}
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>

            {renderPaginationFooter()}

            {/* Save button */}
            {!isLocked && filteredEnrollments.length > 0 && (
              <>
                <Separator />
                <div className="flex justify-end p-4">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <SaveIcon className="mr-2 h-4 w-4" />
                    )}
                    {saving ? "Enregistrement..." : "Enregistrer le comportement"}
                  </Button>
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  )
}