"use client"

import { useState, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

import { SaveIcon, LockIcon, UsersIcon, FileTextIcon, AlertTriangleIcon, CheckCircle2Icon, XIcon, PlusIcon } from "lucide-react"
import type { Level, Period, Student, Classroom, Attitude, StudentBehavior, AttitudeResponse } from "@/lib/data/school-data"

interface CPMSLBehaviorGridProps {
  levels: Level[]
  classrooms: Classroom[]
  periods: Period[]
  students: Student[]
  attitudes: Attitude[]
  behaviors: StudentBehavior[]
  isArchived?: boolean
  onSaveBehaviors: (behaviors: StudentBehavior[]) => void
  onAddAttitude: (label: string, academicYearId: string) => Attitude
}

interface BehaviorEntry {
  studentId: string
  absences: string
  retards: string
  devoirsManques: string
  attitudeResponses: Map<string, boolean | null>  // attitudeId -> true(Oui)/false(Non)/null(unset)
  pointsForts: string
  defis: string
  remarque: string
}

export function CPMSLBehaviorGrid({
  levels,
  classrooms,
  periods,
  students,
  attitudes,
  behaviors,
  isArchived = false,
  onSaveBehaviors,
  onAddAttitude
}: CPMSLBehaviorGridProps) {
  const [selectedLevelId, setSelectedLevelId] = useState<string>("")
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>("")
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("")
  const [behaviorEntries, setBehaviorEntries] = useState<Map<string, BehaviorEntry>>(new Map())
  const [localAttitudes, setLocalAttitudes] = useState<Attitude[]>(attitudes)
  const [newAttitudeLabel, setNewAttitudeLabel] = useState("")
  const [showAddAttitudeInput, setShowAddAttitudeInput] = useState(false)
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
  const isLocked = isPeriodClosed || isArchived

  const filteredStudents = useMemo(() => {
    if (!selectedClassroomId) return []
    return students
      .filter(s => s.classroomId === selectedClassroomId)
      .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`))
  }, [selectedClassroomId, students])

  // Pagination
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedStudents = filteredStudents.slice(startIndex, startIndex + itemsPerPage)

  // Reset to page 1 when filters change
  useMemo(() => setCurrentPage(1), [selectedClassroomId, selectedPeriodId])

  // Initialize behavior entries from existing data
  useMemo(() => {
    if (!selectedClassroomId || !selectedPeriodId) return
    const newEntries = new Map<string, BehaviorEntry>()
    filteredStudents.forEach(student => {
      const existingBehavior = behaviors.find(
        b => b.studentId === student.id && b.periodId === selectedPeriodId && b.classroomId === selectedClassroomId
      )
      
      const attitudeResponsesMap = new Map<string, boolean | null>()
      if (existingBehavior) {
        // Initialize from existing responses
        existingBehavior.attitudeResponses.forEach(resp => {
          attitudeResponsesMap.set(resp.attitudeId, resp.value)
        })
      }
      // Ensure all current attitudes are in the map (with null if not set)
      localAttitudes.forEach(att => {
        if (!attitudeResponsesMap.has(att.id)) {
          attitudeResponsesMap.set(att.id, null)
        }
      })
      
      if (existingBehavior) {
        newEntries.set(student.id, {
          studentId: student.id,
          absences: existingBehavior.absences?.toString() || '',
          retards: existingBehavior.retards?.toString() || '',
          devoirsManques: existingBehavior.devoirsManques?.toString() || '',
          attitudeResponses: attitudeResponsesMap,
          pointsForts: existingBehavior.pointsForts || '',
          defis: existingBehavior.defis || '',
          remarque: existingBehavior.remarque || ''
        })
      } else {
        newEntries.set(student.id, {
          studentId: student.id,
          absences: '',
          retards: '',
          devoirsManques: '',
          attitudeResponses: attitudeResponsesMap,
          pointsForts: '',
          defis: '',
          remarque: ''
        })
      }
    })
    setBehaviorEntries(newEntries)
  }, [selectedClassroomId, selectedPeriodId, filteredStudents, behaviors, localAttitudes])

  const kpis = useMemo(() => {
    if (!selectedClassroomId || !selectedPeriodId) {
      return { totalStudents: 0, enteredBehaviors: 0, missingBehaviors: 0, progressPercentage: 0 }
    }
    const totalStudents = filteredStudents.length
    let enteredBehaviors = 0
    
    filteredStudents.forEach(student => {
      const entry = behaviorEntries.get(student.id)
      if (entry) {
        // A behavior is "saisi" if at least one field is non-null/non-empty
        const hasAttitudeResponse = Array.from(entry.attitudeResponses.values()).some(v => v !== null)
        const hasData = 
          entry.absences !== '' ||
          entry.retards !== '' ||
          entry.devoirsManques !== '' ||
          hasAttitudeResponse ||
          entry.pointsForts.trim() !== '' ||
          entry.defis.trim() !== '' ||
          entry.remarque.trim() !== ''
        
        if (hasData) enteredBehaviors++
      }
    })
    
    const missingBehaviors = totalStudents - enteredBehaviors
    const progressPercentage = totalStudents > 0 ? Math.round((enteredBehaviors / totalStudents) * 100) : 0
    
    return { totalStudents, enteredBehaviors, missingBehaviors, progressPercentage }
  }, [selectedClassroomId, selectedPeriodId, filteredStudents, behaviorEntries])

  const handleNumberChange = (studentId: string, field: 'absences' | 'retards' | 'devoirsManques', value: string) => {
    const newEntries = new Map(behaviorEntries)
    const entry = newEntries.get(studentId) || {
      studentId,
      absences: '',
      retards: '',
      devoirsManques: '',
      attitudeResponses: new Map<string, boolean | null>(),
      pointsForts: '',
      defis: '',
      remarque: ''
    }
    
    // Validate: only allow integers >= 0, max 3 digits
    if (value === '' || (/^\d{1,3}$/.test(value) && parseInt(value) >= 0)) {
      entry[field] = value
      newEntries.set(studentId, entry)
      setBehaviorEntries(newEntries)
    }
  }

  const handleTextChange = (studentId: string, field: 'pointsForts' | 'defis' | 'remarque', value: string) => {
    const newEntries = new Map(behaviorEntries)
    const entry = newEntries.get(studentId) || {
      studentId,
      absences: '',
      retards: '',
      devoirsManques: '',
      attitudeResponses: new Map<string, boolean | null>(),
      pointsForts: '',
      defis: '',
      remarque: ''
    }
    
    // Enforce character limits
    const maxLengths = { pointsForts: 300, defis: 300, remarque: 500 }
    if (value.length <= maxLengths[field]) {
      entry[field] = value
      newEntries.set(studentId, entry)
      setBehaviorEntries(newEntries)
    }
  }

  const handleAttitudeResponse = (studentId: string, attitudeId: string, value: boolean) => {
    const newEntries = new Map(behaviorEntries)
    const entry = newEntries.get(studentId)
    if (!entry) return
    
    entry.attitudeResponses.set(attitudeId, value)
    newEntries.set(studentId, entry)
    setBehaviorEntries(newEntries)
  }

  const handleAddNewAttitude = () => {
    if (!newAttitudeLabel.trim()) return
    
    const newAttitude = onAddAttitude(newAttitudeLabel.trim(), 'ay-2024')
    setLocalAttitudes([...localAttitudes, newAttitude])
    
    // Add this attitude to all students' response maps with null value
    const newEntries = new Map(behaviorEntries)
    newEntries.forEach((entry) => {
      entry.attitudeResponses.set(newAttitude.id, null)
    })
    setBehaviorEntries(newEntries)
    
    setNewAttitudeLabel("")
    setShowAddAttitudeInput(false)
  }

  const handleSaveBehaviors = () => {
    if (!selectedClassroomId || !selectedPeriodId) return
    
    const behaviorsToSave: StudentBehavior[] = []
    
    behaviorEntries.forEach((entry, studentId) => {
      const existingBehavior = behaviors.find(
        b => b.studentId === studentId && b.periodId === selectedPeriodId && b.classroomId === selectedClassroomId
      )
      
      // Convert Map to AttitudeResponse array (only include non-null responses)
      const attitudeResponses: AttitudeResponse[] = []
      entry.attitudeResponses.forEach((value, attitudeId) => {
        if (value !== null) {
          attitudeResponses.push({ attitudeId, value })
        }
      })
      
      const behavior: StudentBehavior = {
        id: existingBehavior?.id || `beh-${Date.now()}-${studentId}`,
        studentId,
        classroomId: selectedClassroomId,
        periodId: selectedPeriodId,
        academicYearId: 'ay-2024', // TODO: Get from context
        absences: entry.absences ? parseInt(entry.absences) : null,
        retards: entry.retards ? parseInt(entry.retards) : null,
        devoirsManques: entry.devoirsManques ? parseInt(entry.devoirsManques) : null,
        attitudeResponses,
        pointsForts: entry.pointsForts,
        defis: entry.defis,
        remarque: entry.remarque,
        createdAt: existingBehavior?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      behaviorsToSave.push(behavior)
    })
    
    onSaveBehaviors(behaviorsToSave)
  }

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

  // Empty state
  if (!selectedClassroomId || !selectedPeriodId) {
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select value={selectedLevelId} onValueChange={(value) => {
                setSelectedLevelId(value)
                setSelectedClassroomId("")
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

              <Select value={selectedClassroomId} onValueChange={setSelectedClassroomId} disabled={!selectedLevelId}>
                <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px", opacity: !selectedLevelId ? 0.5 : 1, cursor: !selectedLevelId ? "not-allowed" : "pointer" }}>
                  <SelectValue placeholder="Sélectionner une salle" style={{ color: "#A8A5A2" }} />
                </SelectTrigger>
                <SelectContent>
                  {filteredClassrooms.map(classroom => (
                    <SelectItem key={classroom.id} value={classroom.id}>{classroom.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
            </div>
          </div>
        </div>

        <div className="rounded-lg p-12 flex flex-col items-center justify-center text-center space-y-2" style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <p className="font-serif font-semibold" style={{ fontSize: "16px", color: "hsl(var(--muted-foreground))" }}>
            Sélectionnez une classe, une salle et une étape
          </p>
          <p className="font-sans" style={{ fontSize: "13px", fontWeight: 400, color: "hsl(var(--muted-foreground))" }}>
            pour saisir les comportements
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select value={selectedLevelId} onValueChange={(value) => {
              setSelectedLevelId(value)
              setSelectedClassroomId("")
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

            <Select value={selectedClassroomId} onValueChange={setSelectedClassroomId} disabled={isArchived || !selectedLevelId}>
              <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px", opacity: (isArchived || !selectedLevelId) ? 0.5 : 1, cursor: (isArchived || !selectedLevelId) ? "not-allowed" : "pointer" }}>
                <SelectValue placeholder="Sélectionner une salle" />
              </SelectTrigger>
              <SelectContent>
                {filteredClassrooms.map(classroom => (
                  <SelectItem key={classroom.id} value={classroom.id}>{classroom.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId} disabled={isArchived}>
              <SelectTrigger style={{ borderColor: "#D1CECC", borderRadius: "8px" }}>
                <div className="flex items-center gap-2">
                  {isLocked && <LockIcon className="h-4 w-4" style={{ color: "#C48B1A" }} />}
                  <SelectValue placeholder="Sélectionner une étape" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {periods.map(period => (
                  <SelectItem key={period.id} value={period.id}>{period.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Locked Period Banner */}
      {isLocked && (
        <div className="rounded-lg p-4 flex items-center gap-3" style={{ backgroundColor: "#FEF6E0", border: "1px solid #C48B1A" }}>
          <LockIcon className="h-5 w-5" style={{ color: "#C48B1A" }} />
          <p className="text-sm font-medium" style={{ color: "#C48B1A" }}>
            {isPeriodClosed ? "Étape clôturée — les comportements ne peuvent plus être modifiés" : "Année archivée — les données sont en lecture seule"}
          </p>
        </div>
      )}

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

      {/* Header Section */}
      <div className="rounded-lg p-4" style={{ backgroundColor: "white", border: "1px solid #E8E6E3", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <h2 className="font-serif font-semibold" style={{ fontSize: "18px", color: "#2C4A6E" }}>
          {selectedPeriodName} — {selectedLevelName}
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
              {paginatedStudents.map((student, index) => {
                const entry = behaviorEntries.get(student.id) || {
                  studentId: student.id,
                  absences: '',
                  retards: '',
                  devoirsManques: '',
                  attitudeResponses: new Map<string, boolean | null>(),
                  pointsForts: '',
                  defis: '',
                  remarque: ''
                }
                
                return (
                  <tr 
                    key={student.id} 
                    style={{ 
                      borderBottom: index < paginatedStudents.length - 1 ? "1px solid #E8E6E3" : "none",
                      backgroundColor: index % 2 === 0 ? "white" : "#FAFAF8"
                    }}
                  >
                    <td className="px-4 py-3 sticky left-0" style={{ backgroundColor: index % 2 === 0 ? "white" : "#FAFAF8" }}>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={student.avatar} />
                          <AvatarFallback style={{ backgroundColor: "#F0F4F7", color: "#5A7085" }}>
                            {student.firstName[0]}{student.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-sans font-semibold" style={{ fontSize: "14px", color: "#1E1A17" }}>
                            {student.firstName} {student.lastName}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        min="0"
                        max="999"
                        step="1"
                        value={entry.absences}
                        onChange={(e) => handleNumberChange(student.id, 'absences', e.target.value)}
                        placeholder="0"
                        disabled={isLocked}
                        className="text-center"
                        style={{
                          width: "80px",
                          borderRadius: "8px",
                          borderColor: "#D1D5DB",
                          margin: "0 auto"
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        min="0"
                        max="999"
                        step="1"
                        value={entry.retards}
                        onChange={(e) => handleNumberChange(student.id, 'retards', e.target.value)}
                        placeholder="0"
                        disabled={isLocked}
                        className="text-center"
                        style={{
                          width: "80px",
                          borderRadius: "8px",
                          borderColor: "#D1D5DB",
                          margin: "0 auto"
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        min="0"
                        max="999"
                        step="1"
                        value={entry.devoirsManques}
                        onChange={(e) => handleNumberChange(student.id, 'devoirsManques', e.target.value)}
                        placeholder="0"
                        disabled={isLocked}
                        className="text-center"
                        style={{
                          width: "80px",
                          borderRadius: "8px",
                          borderColor: "#D1D5DB",
                          margin: "0 auto"
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        {localAttitudes.map(attitude => {
                          const response = entry.attitudeResponses.get(attitude.id)
                          return (
                            <div key={attitude.id} className="flex items-center gap-3">
                              <span className="text-sm font-medium" style={{ color: "#1E1A17", minWidth: "140px" }}>
                                {attitude.label}
                              </span>
                              <div className="flex items-center gap-4">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`attitude-${student.id}-${attitude.id}`}
                                    checked={response === true}
                                    onChange={() => handleAttitudeResponse(student.id, attitude.id, true)}
                                    disabled={isLocked}
                                    className="h-4 w-4 cursor-pointer"
                                    style={{ accentColor: "#5A7085" }}
                                  />
                                  <span className="text-sm" style={{ color: "#1E1A17" }}>Oui</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`attitude-${student.id}-${attitude.id}`}
                                    checked={response === false}
                                    onChange={() => handleAttitudeResponse(student.id, attitude.id, false)}
                                    disabled={isLocked}
                                    className="h-4 w-4 cursor-pointer"
                                    style={{ accentColor: "#5A7085" }}
                                  />
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
                                <Input
                                  value={newAttitudeLabel}
                                  onChange={(e) => setNewAttitudeLabel(e.target.value)}
                                  placeholder="Nouvelle attitude..."
                                  className="flex-1"
                                  style={{ borderColor: "#D1D5DB", borderRadius: "6px", fontSize: "13px" }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddNewAttitude()
                                    if (e.key === 'Escape') {
                                      setShowAddAttitudeInput(false)
                                      setNewAttitudeLabel("")
                                    }
                                  }}
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  onClick={handleAddNewAttitude}
                                  disabled={!newAttitudeLabel.trim()}
                                  style={{ backgroundColor: "#5A7085", color: "white", fontSize: "13px" }}
                                >
                                  Créer
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setShowAddAttitudeInput(false)
                                    setNewAttitudeLabel("")
                                  }}
                                  style={{ fontSize: "13px" }}
                                >
                                  <XIcon className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowAddAttitudeInput(true)}
                                className="flex items-center gap-1.5 text-sm font-medium hover:underline"
                                style={{ color: "#5A7085" }}
                              >
                                <PlusIcon className="h-4 w-4" />
                                Ajouter une attitude
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Textarea
                        value={entry.pointsForts}
                        onChange={(e) => handleTextChange(student.id, 'pointsForts', e.target.value)}
                        placeholder="Points forts..."
                        disabled={isLocked}
                        rows={2}
                        className="resize-vertical"
                        style={{
                          borderRadius: "8px",
                          borderColor: "#D1D5DB",
                          fontSize: "13px"
                        }}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {entry.pointsForts.length}/300
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Textarea
                        value={entry.defis}
                        onChange={(e) => handleTextChange(student.id, 'defis', e.target.value)}
                        placeholder="Défis..."
                        disabled={isLocked}
                        rows={2}
                        className="resize-vertical"
                        style={{
                          borderRadius: "8px",
                          borderColor: "#D1D5DB",
                          fontSize: "13px"
                        }}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {entry.defis.length}/300
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Textarea
                        value={entry.remarque}
                        onChange={(e) => handleTextChange(student.id, 'remarque', e.target.value)}
                        placeholder="Remarque..."
                        disabled={isLocked}
                        rows={2}
                        className="resize-vertical"
                        style={{
                          borderRadius: "8px",
                          borderColor: "#D1D5DB",
                          fontSize: "13px"
                        }}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {entry.remarque.length}/500
                      </p>
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
          disabled={!selectedClassroomId || !selectedPeriodId || isLocked}
          onClick={handleSaveBehaviors}
          style={{
            backgroundColor: (!selectedClassroomId || !selectedPeriodId || isLocked) ? "#9CA3AF" : "#5A7085",
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
          Enregistrer le comportement
        </Button>
      </div>
    </div>
  )
}