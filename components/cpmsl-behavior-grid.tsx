"use client"

import { useState, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { SaveIcon, LockIcon, UsersIcon, FileTextIcon, AlertTriangleIcon, CheckCircle2Icon, XIcon, PlusIcon } from "lucide-react"
import type { AcademicStep, ClassSession, Enrollment } from "@/types"

interface BehaviorEntry {
  studentId: string
  absences: string
  retards: string
  devoirsManques: string
  attitudeResponses: Map<string, boolean | null>
  pointsForts: string
  defis: string
  remarque: string
}

interface Attitude {
  id: string
  label: string
}

interface CPMSLBehaviorGridProps {
  steps: AcademicStep[]
  sessions: ClassSession[]
  enrollments: Enrollment[]
  isArchived?: boolean
}

export function CPMSLBehaviorGrid({ steps, sessions, enrollments, isArchived = false }: CPMSLBehaviorGridProps) {
  const [selectedSession, setSelectedSession] = useState<string>("")
  const [selectedStep, setSelectedStep] = useState<string>("")
  const [behaviorEntries, setBehaviorEntries] = useState<Map<string, BehaviorEntry>>(new Map())
  const [localAttitudes, setLocalAttitudes] = useState<Attitude[]>([
    { id: "att-1", label: "Respect des règles" },
    { id: "att-2", label: "Participation en classe" },
    { id: "att-3", label: "Travail en équipe" },
  ])
  const [newAttitudeLabel, setNewAttitudeLabel] = useState("")
  const [showAddAttitudeInput, setShowAddAttitudeInput] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 25

  const isLocked = isArchived

  const filteredEnrollments = useMemo(() => {
    if (!selectedSession) return []
    return enrollments.filter(e => e.classSessionId === selectedSession)
      .sort((a, b) => {
        const nameA = `${a.student?.user?.lastname || ""} ${a.student?.user?.firstname || ""}`
        const nameB = `${b.student?.user?.lastname || ""} ${b.student?.user?.firstname || ""}`
        return nameA.localeCompare(nameB)
      })
  }, [selectedSession, enrollments])

  const totalPages = Math.ceil(filteredEnrollments.length / itemsPerPage)
  const paginatedEnrollments = filteredEnrollments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  useMemo(() => setCurrentPage(1), [selectedSession, selectedStep])

  // Initialize behavior entries
  useMemo(() => {
    if (!selectedSession || !selectedStep) return
    const newEntries = new Map<string, BehaviorEntry>()
    filteredEnrollments.forEach(enr => {
      const attitudeResponsesMap = new Map<string, boolean | null>()
      localAttitudes.forEach(att => attitudeResponsesMap.set(att.id, null))
      newEntries.set(enr.id, {
        studentId: enr.id,
        absences: "",
        retards: "",
        devoirsManques: "",
        attitudeResponses: attitudeResponsesMap,
        pointsForts: "",
        defis: "",
        remarque: "",
      })
    })
    setBehaviorEntries(newEntries)
  }, [selectedSession, selectedStep, filteredEnrollments, localAttitudes])

  const kpis = useMemo(() => {
    const totalStudents = filteredEnrollments.length
    let enteredBehaviors = 0
    filteredEnrollments.forEach(enr => {
      const entry = behaviorEntries.get(enr.id)
      if (entry) {
        const hasAttitudeResponse = Array.from(entry.attitudeResponses.values()).some(v => v !== null)
        const hasData = entry.absences !== "" || entry.retards !== "" || entry.devoirsManques !== "" || hasAttitudeResponse || entry.pointsForts.trim() !== "" || entry.defis.trim() !== "" || entry.remarque.trim() !== ""
        if (hasData) enteredBehaviors++
      }
    })
    const missingBehaviors = totalStudents - enteredBehaviors
    const progressPercentage = totalStudents > 0 ? Math.round((enteredBehaviors / totalStudents) * 100) : 0
    return { totalStudents, enteredBehaviors, missingBehaviors, progressPercentage }
  }, [filteredEnrollments, behaviorEntries])

  const handleNumberChange = (enrollmentId: string, field: "absences" | "retards" | "devoirsManques", value: string) => {
    if (value === "" || (/^\d{1,3}$/.test(value) && parseInt(value) >= 0)) {
      const newEntries = new Map(behaviorEntries)
      const entry = newEntries.get(enrollmentId)
      if (entry) {
        entry[field] = value
        newEntries.set(enrollmentId, entry)
        setBehaviorEntries(newEntries)
      }
    }
  }

  const handleTextChange = (enrollmentId: string, field: "pointsForts" | "defis" | "remarque", value: string) => {
    const maxLengths = { pointsForts: 300, defis: 300, remarque: 500 }
    if (value.length <= maxLengths[field]) {
      const newEntries = new Map(behaviorEntries)
      const entry = newEntries.get(enrollmentId)
      if (entry) {
        entry[field] = value
        newEntries.set(enrollmentId, entry)
        setBehaviorEntries(newEntries)
      }
    }
  }

  const handleAttitudeResponse = (enrollmentId: string, attitudeId: string, value: boolean) => {
    const newEntries = new Map(behaviorEntries)
    const entry = newEntries.get(enrollmentId)
    if (entry) {
      entry.attitudeResponses.set(attitudeId, value)
      newEntries.set(enrollmentId, entry)
      setBehaviorEntries(newEntries)
    }
  }

  const handleAddNewAttitude = () => {
    if (!newAttitudeLabel.trim()) return
    const newAttitude: Attitude = { id: `att-new-${Date.now()}`, label: newAttitudeLabel.trim() }
    setLocalAttitudes([...localAttitudes, newAttitude])
    const newEntries = new Map(behaviorEntries)
    newEntries.forEach(entry => { entry.attitudeResponses.set(newAttitude.id, null) })
    setBehaviorEntries(newEntries)
    setNewAttitudeLabel("")
    setShowAddAttitudeInput(false)
  }

  const selectedSessionObj = sessions.find(s => s.id === selectedSession)
  const sessionDisplayName = selectedSessionObj ? `${selectedSessionObj.class?.classType?.name || ""} ${selectedSessionObj.class?.letter || ""}` : ""
  const selectedStepName = steps.find(s => s.id === selectedStep)?.name || ""

  // Empty state
  if (!selectedSession || !selectedStep) {
    return (
      <div className="space-y-6">
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: "10px", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ padding: "24px", borderBottom: "1px solid #E8E6E3" }}>
            <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "15px", fontWeight: 600, color: "#3A4A57" }}>
              Sélection de la classe et de l&apos;étape
            </h3>
          </div>
          <div style={{ padding: "24px" }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select value={selectedSession} onValueChange={setSelectedSession}>
                <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }}>
                  <SelectValue placeholder="Sélectionner une classe" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map(s => (<SelectItem key={s.id} value={s.id}>{s.class?.classType?.name || ""} {s.class?.letter || s.id.slice(0, 6)}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={selectedStep} onValueChange={setSelectedStep}>
                <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }}>
                  <SelectValue placeholder="Sélectionner une étape" />
                </SelectTrigger>
                <SelectContent>
                  {steps.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="rounded-lg p-12 flex flex-col items-center justify-center text-center space-y-2" style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <p className="font-serif font-semibold" style={{ fontSize: "16px", color: "hsl(var(--muted-foreground))" }}>Sélectionnez une classe et une étape</p>
          <p className="font-sans" style={{ fontSize: "13px", fontWeight: 400, color: "hsl(var(--muted-foreground))" }}>pour saisir les comportements</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Selectors */}
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: "10px", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <div style={{ padding: "24px", borderBottom: "1px solid #E8E6E3" }}>
          <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "15px", fontWeight: 600, color: "#3A4A57" }}>Sélection de la classe et de l&apos;étape</h3>
        </div>
        <div style={{ padding: "24px" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select value={selectedSession} onValueChange={setSelectedSession} disabled={isArchived}>
              <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }}>
                <SelectValue placeholder="Sélectionner une classe" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map(s => (<SelectItem key={s.id} value={s.id}>{s.class?.classType?.name || ""} {s.class?.letter || s.id.slice(0, 6)}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={selectedStep} onValueChange={setSelectedStep} disabled={isArchived}>
              <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }}>
                {isLocked && <LockIcon className="h-4 w-4 mr-2" style={{ color: "#C48B1A" }} />}
                <SelectValue placeholder="Sélectionner une étape" />
              </SelectTrigger>
              <SelectContent>
                {steps.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg p-4 flex items-center gap-3" style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div className="flex items-center justify-center rounded-lg" style={{ width: "48px", height: "48px", backgroundColor: "#F0F4F7" }}>
            <UsersIcon className="h-6 w-6" style={{ color: "#5A7085" }} />
          </div>
          <div>
            <p className="font-sans text-xs font-medium" style={{ color: "#78756F" }}>Total élèves</p>
            <p className="font-sans text-2xl font-bold" style={{ color: "#2A3740" }}>{kpis.totalStudents}</p>
          </div>
        </div>
        <div className="rounded-lg p-4 flex items-center gap-3" style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div className="flex items-center justify-center rounded-lg" style={{ width: "48px", height: "48px", backgroundColor: "#E8F5EC" }}>
            <CheckCircle2Icon className="h-6 w-6" style={{ color: "#2D7D46" }} />
          </div>
          <div>
            <p className="font-sans text-xs font-medium" style={{ color: "#78756F" }}>Comportements saisis</p>
            <p className="font-sans text-2xl font-bold" style={{ color: "#2A3740" }}>{kpis.enteredBehaviors}</p>
          </div>
        </div>
        <div className="rounded-lg p-4 flex items-center gap-3" style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div className="flex items-center justify-center rounded-lg" style={{ width: "48px", height: "48px", backgroundColor: "#FEF6E0" }}>
            <AlertTriangleIcon className="h-6 w-6" style={{ color: "#C48B1A" }} />
          </div>
          <div>
            <p className="font-sans text-xs font-medium" style={{ color: "#78756F" }}>Comportements manquants</p>
            <p className="font-sans text-2xl font-bold" style={{ color: "#2A3740" }}>{kpis.missingBehaviors}</p>
          </div>
        </div>
        <div className="rounded-lg p-4 flex items-center gap-3" style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div className="flex items-center justify-center rounded-lg" style={{ width: "48px", height: "48px", backgroundColor: "#E3EFF9" }}>
            <FileTextIcon className="h-6 w-6" style={{ color: "#2B6CB0" }} />
          </div>
          <div>
            <p className="font-sans text-xs font-medium" style={{ color: "#78756F" }}>% complété</p>
            <p className="font-sans text-2xl font-bold" style={{ color: "#2A3740" }}>{kpis.progressPercentage}%</p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="rounded-lg p-4" style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <h2 className="font-serif font-semibold" style={{ fontSize: "18px", color: "#2C4A6E" }}>
          {selectedStepName} — {sessionDisplayName}
        </h2>
      </div>

      {/* Behavior Table */}
      <div className="rounded-lg overflow-hidden" style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "#F1F5F9", borderBottom: "2px solid #D1D5DB" }}>
                <th className="text-left px-4 py-3 font-sans font-bold uppercase sticky left-0 bg-[#F1F5F9]" style={{ fontSize: "12px", letterSpacing: "0.06em", color: "#2C4A6E", minWidth: "200px" }}>ÉLÈVE</th>
                <th className="text-center px-4 py-3 font-sans font-bold uppercase" style={{ fontSize: "12px", letterSpacing: "0.06em", color: "#2C4A6E", minWidth: "100px" }}>ABSENCES</th>
                <th className="text-center px-4 py-3 font-sans font-bold uppercase" style={{ fontSize: "12px", letterSpacing: "0.06em", color: "#2C4A6E", minWidth: "100px" }}>RETARDS</th>
                <th className="text-center px-4 py-3 font-sans font-bold uppercase" style={{ fontSize: "12px", letterSpacing: "0.06em", color: "#2C4A6E", minWidth: "140px" }}>DEVOIRS MANQUÉS</th>
                <th className="text-left px-4 py-3 font-sans font-bold uppercase" style={{ fontSize: "12px", letterSpacing: "0.06em", color: "#2C4A6E", minWidth: "300px" }}>ATTITUDES</th>
                <th className="text-left px-4 py-3 font-sans font-bold uppercase" style={{ fontSize: "12px", letterSpacing: "0.06em", color: "#2C4A6E", minWidth: "250px" }}>POINTS FORTS</th>
                <th className="text-left px-4 py-3 font-sans font-bold uppercase" style={{ fontSize: "12px", letterSpacing: "0.06em", color: "#2C4A6E", minWidth: "250px" }}>DÉFIS</th>
                <th className="text-left px-4 py-3 font-sans font-bold uppercase" style={{ fontSize: "12px", letterSpacing: "0.06em", color: "#2C4A6E", minWidth: "300px" }}>REMARQUE</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEnrollments.map((enr, index) => {
                const user = enr.student?.user
                const entry = behaviorEntries.get(enr.id) || { studentId: enr.id, absences: "", retards: "", devoirsManques: "", attitudeResponses: new Map<string, boolean | null>(), pointsForts: "", defis: "", remarque: "" }
                return (
                  <tr key={enr.id} style={{ borderBottom: index < paginatedEnrollments.length - 1 ? "1px solid #E8E6E3" : "none", backgroundColor: index % 2 === 0 ? "white" : "#FAFAF8" }}>
                    <td className="px-4 py-3 sticky left-0" style={{ backgroundColor: index % 2 === 0 ? "white" : "#FAFAF8" }}>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback style={{ backgroundColor: "#F0F4F7", color: "#5A7085" }}>{(user?.firstname || "?")[0]}{(user?.lastname || "?")[0]}</AvatarFallback>
                        </Avatar>
                        <p className="font-sans font-semibold" style={{ fontSize: "14px", color: "#1E1A17" }}>{user?.firstname || ""} {user?.lastname || ""}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Input type="number" min="0" max="999" value={entry.absences} onChange={(e) => handleNumberChange(enr.id, "absences", e.target.value)} placeholder="0" disabled={isLocked} className="text-center" style={{ width: "80px", borderRadius: "8px", borderColor: "#D1D5DB", margin: "0 auto" }} /></td>
                    <td className="px-4 py-3"><Input type="number" min="0" max="999" value={entry.retards} onChange={(e) => handleNumberChange(enr.id, "retards", e.target.value)} placeholder="0" disabled={isLocked} className="text-center" style={{ width: "80px", borderRadius: "8px", borderColor: "#D1D5DB", margin: "0 auto" }} /></td>
                    <td className="px-4 py-3"><Input type="number" min="0" max="999" value={entry.devoirsManques} onChange={(e) => handleNumberChange(enr.id, "devoirsManques", e.target.value)} placeholder="0" disabled={isLocked} className="text-center" style={{ width: "80px", borderRadius: "8px", borderColor: "#D1D5DB", margin: "0 auto" }} /></td>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        {localAttitudes.map(attitude => {
                          const response = entry.attitudeResponses.get(attitude.id)
                          return (
                            <div key={attitude.id} className="flex items-center gap-3">
                              <span className="text-sm font-medium" style={{ color: "#1E1A17", minWidth: "140px" }}>{attitude.label}</span>
                              <div className="flex items-center gap-4">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input type="radio" name={`attitude-${enr.id}-${attitude.id}`} checked={response === true} onChange={() => handleAttitudeResponse(enr.id, attitude.id, true)} disabled={isLocked} className="h-4 w-4 cursor-pointer" style={{ accentColor: "#5A7085" }} />
                                  <span className="text-sm" style={{ color: "#1E1A17" }}>Oui</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input type="radio" name={`attitude-${enr.id}-${attitude.id}`} checked={response === false} onChange={() => handleAttitudeResponse(enr.id, attitude.id, false)} disabled={isLocked} className="h-4 w-4 cursor-pointer" style={{ accentColor: "#5A7085" }} />
                                  <span className="text-sm" style={{ color: "#1E1A17" }}>Non</span>
                                </label>
                              </div>
                            </div>
                          )
                        })}
                        {!isLocked && (
                          <div className="mt-3 pt-2 border-t border-border">
                            {showAddAttitudeInput ? (
                              <div className="flex items-center gap-2">
                                <Input value={newAttitudeLabel} onChange={(e) => setNewAttitudeLabel(e.target.value)} placeholder="Nouvelle attitude..." className="flex-1" style={{ borderColor: "#D1D5DB", borderRadius: "6px", fontSize: "13px" }} onKeyDown={(e) => { if (e.key === "Enter") handleAddNewAttitude(); if (e.key === "Escape") { setShowAddAttitudeInput(false); setNewAttitudeLabel("") } }} autoFocus />
                                <Button size="sm" onClick={handleAddNewAttitude} disabled={!newAttitudeLabel.trim()} style={{ backgroundColor: "#5A7085", color: "white", fontSize: "13px" }}>Créer</Button>
                                <Button size="sm" variant="ghost" onClick={() => { setShowAddAttitudeInput(false); setNewAttitudeLabel("") }} style={{ fontSize: "13px" }}><XIcon className="h-4 w-4" /></Button>
                              </div>
                            ) : (
                              <button onClick={() => setShowAddAttitudeInput(true)} className="flex items-center gap-1.5 text-sm font-medium hover:underline" style={{ color: "#5A7085" }}><PlusIcon className="h-4 w-4" />Ajouter une attitude</button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3"><Textarea value={entry.pointsForts} onChange={(e) => handleTextChange(enr.id, "pointsForts", e.target.value)} placeholder="Points forts..." disabled={isLocked} rows={2} className="resize-vertical" style={{ borderRadius: "8px", borderColor: "#D1D5DB", fontSize: "13px" }} /><p className="text-xs text-muted-foreground mt-1">{entry.pointsForts.length}/300</p></td>
                    <td className="px-4 py-3"><Textarea value={entry.defis} onChange={(e) => handleTextChange(enr.id, "defis", e.target.value)} placeholder="Défis..." disabled={isLocked} rows={2} className="resize-vertical" style={{ borderRadius: "8px", borderColor: "#D1D5DB", fontSize: "13px" }} /><p className="text-xs text-muted-foreground mt-1">{entry.defis.length}/300</p></td>
                    <td className="px-4 py-3"><Textarea value={entry.remarque} onChange={(e) => handleTextChange(enr.id, "remarque", e.target.value)} placeholder="Remarque..." disabled={isLocked} rows={2} className="resize-vertical" style={{ borderRadius: "8px", borderColor: "#D1D5DB", fontSize: "13px" }} /><p className="text-xs text-muted-foreground mt-1">{entry.remarque.length}/500</p></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filteredEnrollments.length > itemsPerPage && (
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} style={{ borderColor: "#D1CECC", color: "#5C5955" }}>← Précédent</Button>
            <span style={{ color: "#78756F", fontSize: "14px" }}>Page {currentPage} sur {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} style={{ borderColor: "#D1CECC", color: "#5C5955" }}>Suivant →</Button>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex items-center gap-3" style={{ marginTop: "24px" }}>
        <Button size="lg" disabled={isLocked} style={{ backgroundColor: isLocked ? "#9CA3AF" : "#5A7085", color: "#FFFFFF", fontSize: "14px", fontWeight: 600, borderRadius: "8px", padding: "10px 24px", display: "flex", alignItems: "center", gap: "8px" }}>
          <SaveIcon className="h-4 w-4" />Enregistrer le comportement
        </Button>
      </div>
    </div>
  )
}
