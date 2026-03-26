"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { CPMSLGradesGrid } from "@/components/school/cpmsl-grades-grid"
import { CPMSLBehaviorGrid } from "@/components/school/cpmsl-behavior-grid"
import { CPMSLProgressionPanel } from "@/components/school/cpmsl-progression-panel"
import { grades, students, subjectParents, subjectChildren, periods, levels, academicYears, classrooms, attitudes, studentBehaviors, type Attitude } from "@/lib/data/school-data"
import { AlertTriangleIcon } from "lucide-react"

export default function GradesPage() {
  const params = useParams()
  const yearId = (params.yearId as string) || 'ay-2024'
  const { toast } = useToast()
  const currentYear = academicYears.find(y => y.id === yearId)
  const activeYear = academicYears.find(y => y.isActive)
  const isArchived = currentYear?.status === 'archived'
  const [activeTab, setActiveTab] = useState<string>("notes")
  const [localAttitudes, setLocalAttitudes] = useState<Attitude[]>(attitudes)

  const yearLevels = levels.filter(l => l.academicYearId === yearId)
  const yearPeriods = periods.filter(p => p.academicYearId === yearId)
  const yearStudents = students.filter(s => s.academicYearId === yearId)
  const yearSubjectParents = subjectParents.filter(sp => sp.academicYearId === yearId)
  const yearSubjectChildren = subjectChildren.filter(sc => sc.academicYearId === yearId)
  const yearGrades = grades.filter(g => g.academicYearId === yearId)
  const yearClassrooms = classrooms.filter(c => c.academicYearId === yearId)
  const yearAttitudes = localAttitudes.filter(a => a.academicYearId === yearId)
  const yearBehaviors = studentBehaviors.filter(b => b.academicYearId === yearId)

  const handleAddAttitude = (label: string, academicYearId: string): Attitude => {
    const newAttitude: Attitude = { id: `att-new-${Date.now()}`, label, academicYearId }
    setLocalAttitudes([...localAttitudes, newAttitude])
    return newAttitude
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "36px", fontWeight: 700, letterSpacing: "-0.03em", color: "#2A3740" }}>
          Notes
        </h1>
        <p style={{ fontSize: "13px", fontFamily: "Inter", fontWeight: 400, color: "hsl(var(--muted-foreground))" }}>
          Année {activeYear?.name}
        </p>
      </div>

      {isArchived && currentYear && (
        <div className="rounded-lg p-4 flex items-center gap-3" style={{ backgroundColor: "#FEF6E0", border: "1px solid #C48B1A" }}>
          <AlertTriangleIcon className="h-5 w-5" style={{ color: "#C48B1A" }} />
          <div>
            <p className="label-ui" style={{ color: "#C48B1A" }}>Année {currentYear.name} — Archivée</p>
            <p className="body-base" style={{ color: "#C48B1A" }}>Année archivée — les données sont en lecture seule</p>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList style={{ backgroundColor: "#F0F4F7", borderRadius: "8px", padding: "4px" }}>
          <TabsTrigger value="notes" className="label-ui data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>
            <span className="data-[state=active]:text-[#3A4A57] text-[#78756F]">Notes</span>
          </TabsTrigger>
          <TabsTrigger value="comportement" className="label-ui data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>
            <span className="data-[state=active]:text-[#3A4A57] text-[#78756F]">Comportement</span>
          </TabsTrigger>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="progression-v2" disabled={true} className="label-ui" style={{ borderRadius: "6px", color: "#A8A5A2", cursor: "not-allowed", opacity: 0.6 }}>
                  Progression
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Disponible prochainement</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TabsTrigger value="progression" className="label-ui data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>
            <span className="data-[state=active]:text-[#3A4A57] text-[#78756F]">Avancement</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notes">
          <CPMSLGradesGrid
            levels={yearLevels}
            periods={yearPeriods}
            students={yearStudents}
            subjectParents={yearSubjectParents}
            subjectChildren={yearSubjectChildren}
            grades={yearGrades}
            classrooms={yearClassrooms}
            isArchived={isArchived}
            onSaveGrades={() => toast({ title: "Notes enregistrées", description: "Les notes ont été sauvegardées avec succès." })}
            onClosePeriod={() => toast({ title: "Étape clôturée", description: "L'étape a été clôturée." })}
          />
        </TabsContent>

        <TabsContent value="comportement">
          <CPMSLBehaviorGrid
            levels={yearLevels}
            classrooms={yearClassrooms}
            periods={yearPeriods}
            students={yearStudents}
            attitudes={yearAttitudes}
            behaviors={yearBehaviors}
            isArchived={isArchived}
            onSaveBehaviors={() => toast({ title: "Comportements enregistrés", description: "Les évaluations de comportement ont été sauvegardées." })}
            onAddAttitude={handleAddAttitude}
          />
        </TabsContent>

        <TabsContent value="progression">
          <CPMSLProgressionPanel
            levels={yearLevels}
            classrooms={yearClassrooms}
            periods={yearPeriods}
            students={yearStudents}
            subjectParents={yearSubjectParents}
            subjectChildren={yearSubjectChildren}
            grades={yearGrades}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
