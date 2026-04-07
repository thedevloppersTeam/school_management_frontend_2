"use client"

import { useState, useEffect, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useToast } from "@/components/ui/use-toast"
import {
  SaveIcon, LockIcon, UsersIcon, FileTextIcon,
  AlertTriangleIcon, CheckCircle2Icon
} from "lucide-react"
import type { ApiClassSession } from "@/lib/api/students"
import type { AcademicYearStep } from "@/lib/api/dashboard"
import type { ApiEnrollment } from "@/lib/api/grades"
import { fetchEnrollments } from "@/lib/api/grades"

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

// ── Helpers ───────────────────────────────────────────────────────────────

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

function createBehaviorEntry(enr: ApiEnrollment, behaviorList: ApiBehavior[], attitudes: ApiAttitude[]): BehaviorEntry {
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

  // ── Pagination ────────────────────────────────────────────────────────────

  const sortedEnrollments = useMemo(() =>
    [...enrollments].sort((a, b) => getStudentName(a).localeCompare(getStudentName(b))),
    [enrollments]
  )

  const totalPages    = Math.ceil(sortedEnrollments.length / itemsPerPage)
  const paginatedEnrs = sortedEnrollments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

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

  // ── Dérivés ───────────────────────────────────────────────────────────────

  const selectedSession = sessions.find(s => s.id === selectedSessionId)
  const selectedStep    = steps.find(s => s.id === selectedStepId)
  const isLocked        = selectedStep ? !selectedStep.isCurrent : false
  const sessionLabel    = selectedSession
    ? `${selectedSession.class?.classType?.name ?? ""} ${selectedSession.class?.letter ?? ""}`.trim()
    : ""

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Sélecteurs */}
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: "10px", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <div style={{ padding: "24px", borderBottom: "1px solid #E8E6E3" }}>
          <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "15px", fontWeight: 600, color: "#3A4A57" }}>
            Sélection de la classe et de l'étape
          </h3>
        </div>
        <div style={{ padding: "24px" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select value={selectedSessionId} onValueChange={v => { setSelectedSessionId(v); setSelectedStepId("") }}>
              <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }}>
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
              <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px", opacity: !selectedSessionId ? 0.5 : 1 }}>
                <div className="flex items-center gap-2">
                  {isLocked && <LockIcon className="h-4 w-4" style={{ color: "#C48B1A" }} />}
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
        </div>
      </div>

      {/* État vide */}
      {(!selectedSessionId || !selectedStepId) && (
        <div className="rounded-lg p-12 flex flex-col items-center justify-center text-center space-y-2"
          style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <p className="font-serif font-semibold" style={{ fontSize: "16px", color: "hsl(var(--muted-foreground))" }}>
            Sélectionnez une classe et une étape
          </p>
          <p className="font-sans" style={{ fontSize: "13px", color: "hsl(var(--muted-foreground))" }}>
            pour saisir les comportements
          </p>
        </div>
      )}

      {/* Contenu principal */}
      {selectedSessionId && selectedStepId && (
        <>
          {/* Bannière verrouillage */}
          {isLocked && (
            <div className="rounded-lg p-4 flex items-center gap-3"
              style={{ backgroundColor: "#FEF6E0", border: "1px solid #C48B1A" }}>
              <LockIcon className="h-5 w-5" style={{ color: "#C48B1A" }} />
              <p className="text-sm font-medium" style={{ color: "#C48B1A" }}>
                Étape clôturée — les comportements ne peuvent plus être modifiés
              </p>
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total élèves",            value: kpis.total,          icon: <UsersIcon       className="h-6 w-6" style={{ color: "#5A7085" }} />, bg: "#F0F4F7" },
              { label: "Comportements saisis",    value: kpis.entered,        icon: <CheckCircle2Icon className="h-6 w-6" style={{ color: "#2D7D46" }} />, bg: "#E8F5EC" },
              { label: "Comportements manquants", value: kpis.missing,        icon: <AlertTriangleIcon className="h-6 w-6" style={{ color: "#C48B1A" }} />, bg: "#FEF6E0" },
              { label: "% complété",              value: `${kpis.percent}%`,  icon: <FileTextIcon    className="h-6 w-6" style={{ color: "#2B6CB0" }} />, bg: "#E3EFF9" },
            ].map(({ label, value, icon, bg }) => (
              <div key={label} className="rounded-lg p-4 flex items-center gap-3"
                style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <div className="flex items-center justify-center rounded-lg" style={{ width: "48px", height: "48px", backgroundColor: bg }}>
                  {icon}
                </div>
                <div>
                  <p className="font-sans text-xs font-medium" style={{ color: "#78756F" }}>{label}</p>
                  <p className="font-sans text-2xl font-bold" style={{ color: "#2A3740" }}>{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Titre section */}
          <div className="rounded-lg p-4" style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <h2 className="font-serif font-semibold" style={{ fontSize: "18px", color: "#2C4A6E" }}>
              Étape {selectedStep?.stepNumber} — {sessionLabel}
            </h2>
          </div>

          {/* Loading */}
          {loadingBehaviors && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: "#5A7085" }} />
            </div>
          )}

          {/* Tableau */}
          {!loadingBehaviors && (
            <div className="rounded-lg overflow-hidden" style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ backgroundColor: "#F1F5F9", borderBottom: "2px solid #D1D5DB" }}>
                      {["ÉLÈVE", "ABSENCES", "RETARDS", "DEVOIRS MANQUÉS", "ATTITUDES", "POINTS FORTS", "DÉFIS", "REMARQUE"].map((h, i) => (
                        <th key={h}
                          className={`px-4 py-3 font-sans font-bold uppercase ${i === 0 ? "text-left sticky left-0 bg-[#F1F5F9]" : i < 4 ? "text-center" : "text-left"}`}
                          style={{ fontSize: "12px", letterSpacing: "0.06em", color: "#2C4A6E",
                            minWidth: i === 0 ? "200px" : i < 4 ? "110px" : i === 4 ? "280px" : "250px" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedEnrs.map((enr, idx) => {
                      const e      = entries.get(enr.id) ?? {
                        behaviorId: null, enrollmentId: enr.id,
                        absences: "", retards: "", devoirsManques: "",
                        attitudeResponses: new Map(), pointsForts: "", defis: "", remarque: ""
                      }
                      const rowBg = idx % 2 === 0 ? "white" : "#FAFAF8"

                      return (
                        <tr key={enr.id} style={{ borderBottom: idx < paginatedEnrs.length - 1 ? "1px solid #E8E6E3" : "none", backgroundColor: rowBg }}>

                          {/* Élève */}
                          <td className="px-4 py-3 sticky left-0" style={{ backgroundColor: rowBg }}>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback style={{ backgroundColor: "#F0F4F7", color: "#5A7085" }}>
                                  {getStudentInitials(enr)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-sans font-semibold" style={{ fontSize: "14px", color: "#1E1A17" }}>
                                  {getStudentName(enr)}
                                </p>
                                <p className="font-sans" style={{ fontSize: "11px", color: "#78756F" }}>
                                  {enr.student?.studentCode ?? ""}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Absences / Retards / Devoirs */}
                          {(["absences", "retards", "devoirsManques"] as const).map(field => (
                            <td key={field} className="px-4 py-3 text-center">
                              <Input type="number" min="0" max="999" step="1"
                                value={e[field]} placeholder="0" disabled={isLocked}
                                onChange={ev => handleNumber(enr.id, field, ev.target.value)}
                                className="text-center"
                                style={{ width: "80px", borderRadius: "8px", borderColor: "#D1D5DB", margin: "0 auto" }}
                              />
                            </td>
                          ))}

                          {/* Attitudes — lecture seule, configurées dans Établissement → Attitudes */}
                          <td className="px-4 py-3">
                            {loadingAttitudes ? (
                              <p className="text-xs" style={{ color: "#78756F" }}>Chargement...</p>
                            ) : attitudes.length === 0 ? (
                              <p className="text-xs italic" style={{ color: "#A8A5A2" }}>
                                Aucune attitude — configurez-les dans Établissement → Attitudes
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {attitudes.map(att => {
                                  const resp = e.attitudeResponses.get(att.id)
                                  const renderAttitudeOption = (val: boolean) => (
                                    <label key={String(val)} className="flex items-center gap-1.5 cursor-pointer">
                                      <input type="radio"
                                        name={`att-${enr.id}-${att.id}`}
                                        checked={resp === val}
                                        onChange={() => handleAttitude(enr.id, att.id, val)}
                                        disabled={isLocked}
                                        className="h-4 w-4 cursor-pointer"
                                        style={{ accentColor: "#5A7085" }}
                                      />
                                      <span className="text-sm" style={{ color: "#1E1A17" }}>{val ? "Oui" : "Non"}</span>
                                    </label>
                                  )
                                  return (
                                    <div key={att.id} className="flex items-center gap-3">
                                      <span className="text-sm font-medium" style={{ color: "#1E1A17", minWidth: "130px" }}>
                                        {att.label}
                                      </span>
                                      <div className="flex items-center gap-3">
                                        {[true, false].map(renderAttitudeOption)}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </td>

                          {/* Textes libres */}
                          {(["pointsForts", "defis", "remarque"] as const).map(field => (
                            <td key={field} className="px-4 py-3">
                              <Textarea value={e[field]}
                                onChange={ev => handleText(enr.id, field, ev.target.value)}
                                placeholder={field === "pointsForts" ? "Points forts..." : field === "defis" ? "Défis..." : "Remarque..."}
                                disabled={isLocked} rows={2}
                                className="resize-vertical"
                                style={{ borderRadius: "8px", borderColor: "#D1D5DB", fontSize: "13px" }}
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                {e[field].length}/{field === "remarque" ? 500 : 300}
                              </p>
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination */}
          {sortedEnrollments.length > itemsPerPage && (
            <div className="flex items-center justify-center gap-4">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1} style={{ borderColor: "#D1CECC", color: "#5C5955" }}>
                ← Précédent
              </Button>
              <span className="text-sm" style={{ color: "#78756F" }}>
                Page {currentPage} sur {totalPages}
              </span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages} style={{ borderColor: "#D1CECC", color: "#5C5955" }}>
                Suivant →
              </Button>
            </div>
          )}

          {/* Bouton Save */}
          {!isLocked && (
            <div style={{ marginTop: "24px" }}>
              <Button size="lg" disabled={saving} onClick={handleSave}
                style={{ backgroundColor: saving ? "#9CA3AF" : "#5A7085", color: "#FFFFFF", fontSize: "14px", fontWeight: 600, borderRadius: "8px", padding: "10px 24px", display: "flex", alignItems: "center", gap: "8px" }}>
                {saving
                  ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  : <SaveIcon className="h-4 w-4" />}
                {saving ? "Enregistrement..." : "Enregistrer le comportement"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}