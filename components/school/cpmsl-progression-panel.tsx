"use client"

import { useState, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { CheckCircle2Icon, ClockIcon } from "lucide-react"
import type { Level, Classroom, Period, Student, SubjectParent, SubjectChild, Grade } from "@/lib/data/school-data"

interface CPMSLProgressionPanelProps {
  levels: Level[]
  classrooms: Classroom[]
  periods: Period[]
  students: Student[]
  subjectParents: SubjectParent[]
  subjectChildren: SubjectChild[]
  grades: Grade[]
}

interface ClassroomProgress {
  classroomId: string
  classroomName: string
  levelId: string
  levelName: string
  levelOrder: number
  totalExpected: number
  totalEntered: number
  percentage: number
}

export function CPMSLProgressionPanel({
  levels,
  classrooms,
  periods,
  students,
  subjectParents,
  subjectChildren,
  grades
}: CPMSLProgressionPanelProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("")

  // Calculate progression for all classrooms in the selected period
  const classroomProgressList = useMemo<ClassroomProgress[]>(() => {
    if (!selectedPeriodId) return []

    return classrooms.map(classroom => {
      // Get students in this classroom
      const studentsInClassroom = students.filter(s => s.classroomId === classroom.id)

      if (studentsInClassroom.length === 0) {
        return {
          classroomId: classroom.id,
          classroomName: classroom.name,
          levelId: classroom.levelId,
          levelName: levels.find(l => l.id === classroom.levelId)?.name || "",
          levelOrder: 0,
          totalExpected: 0,
          totalEntered: 0,
          percentage: 0
        }
      }

      // Get the level for these students
      const studentLevel = levels.find(l => l.id === studentsInClassroom[0].levelId)

      // Get relevant subject children for this level
      const relevantSubjectChildren = subjectChildren.filter(sc => {
        const parent = subjectParents.find(sp => sp.id === sc.parentId)
        return parent?.levelIds.includes(studentLevel?.id || "")
      })

      // Calculate expected grades
      const totalExpected = studentsInClassroom.length * relevantSubjectChildren.length

      // Calculate entered grades
      const totalEntered = grades.filter(grade => {
        const isCorrectPeriod = grade.periodId === selectedPeriodId
        const isStudentInClassroom = studentsInClassroom.some(s => s.id === grade.studentId)
        const isRelevantSubject = relevantSubjectChildren.some(sc => sc.id === grade.subjectId)
        const hasValue = grade.value !== null && grade.value !== undefined
        return isCorrectPeriod && isStudentInClassroom && isRelevantSubject && hasValue
      }).length

      // Calculate percentage
      const percentage = totalExpected > 0 ? Math.round((totalEntered / totalExpected) * 100) : 0

      return {
        classroomId: classroom.id,
        classroomName: classroom.name,
        levelId: classroom.levelId,
        levelName: levels.find(l => l.id === classroom.levelId)?.name || "",
        levelOrder: 0,
        totalExpected,
        totalEntered,
        percentage
      }
    })
  }, [selectedPeriodId, classrooms, students, levels, subjectParents, subjectChildren, grades])

  // Group classrooms by level
  const groupedByLevel = useMemo(() => {
    const groups: Record<string, ClassroomProgress[]> = {}
    
    classroomProgressList.forEach(progress => {
      if (!groups[progress.levelName]) {
        groups[progress.levelName] = []
      }
      groups[progress.levelName].push(progress)
    })

    // Sort levels by order
    const sortedLevels = Object.keys(groups).sort((a, b) => {
      const levelA = levels.find(l => l.name === a)
      const levelB = levels.find(l => l.name === b)
      return 0
    })

    return sortedLevels.map(levelName => ({
      levelName,
      classrooms: groups[levelName].sort((a, b) => a.classroomName.localeCompare(b.classroomName))
    }))
  }, [classroomProgressList, levels])

  // Calculate KPI summary
  const kpiSummary = useMemo(() => {
    const complete = classroomProgressList.filter(c => c.percentage === 100).length
    const inProgress = classroomProgressList.filter(c => c.percentage > 0 && c.percentage < 100).length
    const notStarted = classroomProgressList.filter(c => c.percentage === 0).length
    const total = classroomProgressList.length

    return { complete, inProgress, notStarted, total }
  }, [classroomProgressList])

  // Get progress bar color
  const getProgressBarColor = (percentage: number): string => {
    if (percentage === 100) return "#2D7D46" // green
    if (percentage >= 50) return "#5A7085" // CPMSL primary blue
    if (percentage > 0) return "#C48B1A" // warning orange
    return "#E8E6E3" // neutral gray
  }

  return (
    <div className="space-y-6">
      {/* Selector Row */}
      <div className="flex items-center gap-4">
        <div className="w-[200px]">
          <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
            <SelectTrigger style={{ backgroundColor: "white", border: "1px solid #E8E6E3", borderRadius: "8px" }}>
              <SelectValue placeholder="Sélectionner une étape" />
            </SelectTrigger>
            <SelectContent>
              {periods.map(period => (
                <SelectItem key={period.id} value={period.id}>
                  {period.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Empty State */}
      {!selectedPeriodId && (
        <Card className="p-12 text-center" style={{ border: "1px solid #E8E6E3", borderRadius: "8px" }}>
          <p className="body-base" style={{ color: "#78756F" }}>
            Sélectionnez une étape pour voir la progression de la saisie.
          </p>
        </Card>
      )}

      {/* KPI Summary Bar */}
      {selectedPeriodId && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Complete */}
          <Card className="p-6" style={{ border: "1px solid #E8E6E3", borderRadius: "8px" }}>
            <div className="space-y-2">
              <p className="label-ui" style={{ color: "#78756F" }}>Classes complètes</p>
              <div className="flex items-baseline gap-2">
                <p style={{ fontFamily: "var(--font-serif)", fontSize: "28px", fontWeight: 600, color: "#2A3740" }}>
                  {kpiSummary.complete} / {kpiSummary.total}
                </p>
                <p className="body-base" style={{ color: "#78756F" }}>
                  ({kpiSummary.total > 0 ? Math.round((kpiSummary.complete / kpiSummary.total) * 100) : 0}%)
                </p>
              </div>
            </div>
          </Card>

          {/* In Progress */}
          <Card className="p-6" style={{ border: "1px solid #E8E6E3", borderRadius: "8px" }}>
            <div className="space-y-2">
              <p className="label-ui" style={{ color: "#78756F" }}>Classes en cours</p>
              <div className="flex items-baseline gap-2">
                <p style={{ fontFamily: "var(--font-serif)", fontSize: "28px", fontWeight: 600, color: "#2A3740" }}>
                  {kpiSummary.inProgress} / {kpiSummary.total}
                </p>
                <p className="body-base" style={{ color: "#78756F" }}>
                  ({kpiSummary.total > 0 ? Math.round((kpiSummary.inProgress / kpiSummary.total) * 100) : 0}%)
                </p>
              </div>
            </div>
          </Card>

          {/* Not Started */}
          <Card className="p-6" style={{ border: "1px solid #E8E6E3", borderRadius: "8px" }}>
            <div className="space-y-2">
              <p className="label-ui" style={{ color: "#78756F" }}>Classes non démarrées</p>
              <div className="flex items-baseline gap-2">
                <p style={{ fontFamily: "var(--font-serif)", fontSize: "28px", fontWeight: 600, color: "#2A3740" }}>
                  {kpiSummary.notStarted} / {kpiSummary.total}
                </p>
                <p className="body-base" style={{ color: "#78756F" }}>
                  ({kpiSummary.total > 0 ? Math.round((kpiSummary.notStarted / kpiSummary.total) * 100) : 0}%)
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Progression List */}
      {selectedPeriodId && (
        <Card className="p-6" style={{ border: "1px solid #E8E6E3", borderRadius: "8px", backgroundColor: "white" }}>
          <div className="space-y-6">
            {groupedByLevel.map(group => (
              <div key={group.levelName} className="space-y-3">
                {/* Level Header */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1" style={{ backgroundColor: "#E8E6E3" }} />
                  <p className="label-ui" style={{ color: "#78756F", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {group.levelName}
                  </p>
                  <div className="h-px flex-1" style={{ backgroundColor: "#E8E6E3" }} />
                </div>

                {/* Classroom Rows */}
                <div className="space-y-2">
                  {group.classrooms.map(classroom => (
                    <div
                      key={classroom.classroomId}
                      className="flex items-center gap-4 p-3 rounded-lg transition-colors hover:bg-[#F5F4F2]"
                    >
                      {/* Classroom Name */}
                      <div style={{ width: "120px", flexShrink: 0 }}>
                        <p className="body-base font-medium" style={{ color: "#2A3740" }}>
                          {classroom.classroomName}
                        </p>
                      </div>

                      {/* Progress Bar */}
                      <div className="flex-1">
                        <div
                          className="h-2.5 rounded-full overflow-hidden"
                          style={{ backgroundColor: "#E8E6E3" }}
                        >
                          <div
                            className="h-full transition-all duration-300"
                            style={{
                              width: `${classroom.percentage}%`,
                              backgroundColor: getProgressBarColor(classroom.percentage)
                            }}
                          />
                        </div>
                      </div>

                      {/* Percentage and Ratio */}
                      <div className="flex items-center gap-3" style={{ minWidth: "180px" }}>
                        <p className="body-base font-semibold" style={{ color: "#2A3740" }}>
                          {classroom.percentage}%
                        </p>
                        <p className="body-base" style={{ color: "#78756F" }}>
                          {classroom.totalEntered} / {classroom.totalExpected} notes
                        </p>
                        {classroom.percentage === 100 && (
                          <CheckCircle2Icon className="h-5 w-5" style={{ color: "#2D7D46" }} />
                        )}
                        {classroom.percentage === 0 && (
                          <ClockIcon className="h-5 w-5" style={{ color: "#78756F" }} />
                        )}
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