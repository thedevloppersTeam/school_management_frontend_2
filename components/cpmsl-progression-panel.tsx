"use client"

import { useState, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { CheckCircle2Icon, ClockIcon } from "lucide-react"
import type { AcademicStep, ClassSession, ClassSubject, Enrollment, Grade } from "@/types"

interface CPMSLProgressionPanelProps {
  steps: AcademicStep[]
  sessions: ClassSession[]
  allEnrollments: Enrollment[]
  allClassSubjects: ClassSubject[]
  allGrades: Grade[]
}

interface SessionProgress {
  sessionId: string
  sessionName: string
  classTypeName: string
  totalExpected: number
  totalEntered: number
  percentage: number
}

export function CPMSLProgressionPanel({
  steps,
  sessions,
  allEnrollments,
  allClassSubjects,
  allGrades,
}: CPMSLProgressionPanelProps) {
  const [selectedStep, setSelectedStep] = useState<string>("")

  const sessionProgressList = useMemo<SessionProgress[]>(() => {
    if (!selectedStep) return []

    return sessions.map(session => {
      const sessionEnrollments = allEnrollments.filter(e => e.classSessionId === session.id)
      const sessionSubjects = allClassSubjects.filter(cs => cs.classSessionId === session.id)

      if (sessionEnrollments.length === 0 || sessionSubjects.length === 0) {
        return {
          sessionId: session.id,
          sessionName: `${session.class?.classType?.name || ""} ${session.class?.letter || ""}`,
          classTypeName: session.class?.classType?.name || "",
          totalExpected: 0,
          totalEntered: 0,
          percentage: 0,
        }
      }

      const totalExpected = sessionEnrollments.length * sessionSubjects.length
      const totalEntered = allGrades.filter(g =>
        g.stepId === selectedStep &&
        sessionEnrollments.some(e => e.id === g.enrollmentId) &&
        sessionSubjects.some(cs => cs.id === g.classSubjectId)
      ).length

      const percentage = totalExpected > 0 ? Math.round((totalEntered / totalExpected) * 100) : 0

      return {
        sessionId: session.id,
        sessionName: `${session.class?.classType?.name || ""} ${session.class?.letter || ""}`,
        classTypeName: session.class?.classType?.name || "",
        totalExpected,
        totalEntered,
        percentage,
      }
    })
  }, [selectedStep, sessions, allEnrollments, allClassSubjects, allGrades])

  // Group by class type
  const groupedByClassType = useMemo(() => {
    const groups: Record<string, SessionProgress[]> = {}
    sessionProgressList.forEach(p => {
      if (!groups[p.classTypeName]) groups[p.classTypeName] = []
      groups[p.classTypeName].push(p)
    })
    return Object.keys(groups).sort().map(name => ({
      classTypeName: name,
      sessions: groups[name].sort((a, b) => a.sessionName.localeCompare(b.sessionName))
    }))
  }, [sessionProgressList])

  const kpiSummary = useMemo(() => {
    const complete = sessionProgressList.filter(c => c.percentage === 100).length
    const inProgress = sessionProgressList.filter(c => c.percentage > 0 && c.percentage < 100).length
    const notStarted = sessionProgressList.filter(c => c.percentage === 0).length
    const total = sessionProgressList.length
    return { complete, inProgress, notStarted, total }
  }, [sessionProgressList])

  const getProgressBarColor = (percentage: number): string => {
    if (percentage === 100) return "#2D7D46"
    if (percentage >= 50) return "#5A7085"
    if (percentage > 0) return "#C48B1A"
    return "#E8E6E3"
  }

  return (
    <div className="space-y-6">
      {/* Selector */}
      <div className="flex items-center gap-4">
        <div className="w-[200px]">
          <Select value={selectedStep} onValueChange={setSelectedStep}>
            <SelectTrigger style={{ backgroundColor: "white", border: "1px solid #E8E6E3", borderRadius: "8px" }}>
              <SelectValue placeholder="Sélectionner une étape" />
            </SelectTrigger>
            <SelectContent>
              {steps.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Empty State */}
      {!selectedStep && (
        <Card className="p-12 text-center" style={{ border: "1px solid #E8E6E3", borderRadius: "8px" }}>
          <p style={{ color: "#78756F", fontSize: "14px" }}>Sélectionnez une étape pour voir la progression de la saisie.</p>
        </Card>
      )}

      {/* KPI Summary */}
      {selectedStep && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-6" style={{ border: "1px solid #E8E6E3", borderRadius: "8px" }}>
            <div className="space-y-2">
              <p style={{ fontSize: "12px", fontWeight: 500, textTransform: "uppercase", color: "#78756F" }}>Classes complètes</p>
              <div className="flex items-baseline gap-2">
                <p style={{ fontFamily: "var(--font-serif)", fontSize: "28px", fontWeight: 600, color: "#2A3740" }}>{kpiSummary.complete} / {kpiSummary.total}</p>
                <p style={{ fontSize: "14px", color: "#78756F" }}>({kpiSummary.total > 0 ? Math.round((kpiSummary.complete / kpiSummary.total) * 100) : 0}%)</p>
              </div>
            </div>
          </Card>
          <Card className="p-6" style={{ border: "1px solid #E8E6E3", borderRadius: "8px" }}>
            <div className="space-y-2">
              <p style={{ fontSize: "12px", fontWeight: 500, textTransform: "uppercase", color: "#78756F" }}>Classes en cours</p>
              <div className="flex items-baseline gap-2">
                <p style={{ fontFamily: "var(--font-serif)", fontSize: "28px", fontWeight: 600, color: "#2A3740" }}>{kpiSummary.inProgress} / {kpiSummary.total}</p>
                <p style={{ fontSize: "14px", color: "#78756F" }}>({kpiSummary.total > 0 ? Math.round((kpiSummary.inProgress / kpiSummary.total) * 100) : 0}%)</p>
              </div>
            </div>
          </Card>
          <Card className="p-6" style={{ border: "1px solid #E8E6E3", borderRadius: "8px" }}>
            <div className="space-y-2">
              <p style={{ fontSize: "12px", fontWeight: 500, textTransform: "uppercase", color: "#78756F" }}>Classes non démarrées</p>
              <div className="flex items-baseline gap-2">
                <p style={{ fontFamily: "var(--font-serif)", fontSize: "28px", fontWeight: 600, color: "#2A3740" }}>{kpiSummary.notStarted} / {kpiSummary.total}</p>
                <p style={{ fontSize: "14px", color: "#78756F" }}>({kpiSummary.total > 0 ? Math.round((kpiSummary.notStarted / kpiSummary.total) * 100) : 0}%)</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Progression List */}
      {selectedStep && (
        <Card className="p-6" style={{ border: "1px solid #E8E6E3", borderRadius: "8px", backgroundColor: "white" }}>
          <div className="space-y-6">
            {groupedByClassType.map(group => (
              <div key={group.classTypeName} className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1" style={{ backgroundColor: "#E8E6E3" }} />
                  <p style={{ color: "#78756F", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "12px", fontWeight: 500 }}>{group.classTypeName}</p>
                  <div className="h-px flex-1" style={{ backgroundColor: "#E8E6E3" }} />
                </div>
                <div className="space-y-2">
                  {group.sessions.map(session => (
                    <div key={session.sessionId} className="flex items-center gap-4 p-3 rounded-lg transition-colors hover:bg-[#F5F4F2]">
                      <div style={{ width: "120px", flexShrink: 0 }}>
                        <p className="font-medium" style={{ fontSize: "14px", color: "#2A3740" }}>{session.sessionName}</p>
                      </div>
                      <div className="flex-1">
                        <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "#E8E6E3" }}>
                          <div className="h-full transition-all duration-300" style={{ width: `${session.percentage}%`, backgroundColor: getProgressBarColor(session.percentage) }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-3" style={{ minWidth: "180px" }}>
                        <p className="font-semibold" style={{ fontSize: "14px", color: "#2A3740" }}>{session.percentage}%</p>
                        <p style={{ fontSize: "14px", color: "#78756F" }}>{session.totalEntered} / {session.totalExpected} notes</p>
                        {session.percentage === 100 && <CheckCircle2Icon className="h-5 w-5" style={{ color: "#2D7D46" }} />}
                        {session.percentage === 0 && <ClockIcon className="h-5 w-5" style={{ color: "#78756F" }} />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
