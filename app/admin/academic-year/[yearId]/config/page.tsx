"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { CPMSLYearConfigTabs } from "@/components/school/cpmsl-year-config-tabs"
import { useToast } from "@/components/ui/use-toast"
import { academicYears, periods, levels, subjectParents, subjectChildren, classrooms, students } from "@/lib/data/school-data"
import { ArrowLeftIcon } from "lucide-react"

export default function AcademicYearConfigPage() {
  const params = useParams()
  const yearId = params.yearId as string
  const { toast } = useToast()

  const year = academicYears.find(y => y.id === yearId)

  if (!year) {
    return (
      <div style={{ backgroundColor: '#FAFAF8', minHeight: '100vh', padding: '32px' }}>
        <div style={{ color: '#C43C3C', fontSize: '16px' }}>
          Année académique introuvable
        </div>
      </div>
    )
  }

  const yearPeriods = periods
    .filter(p => p.academicYearId === year.id)
    .slice(0, 4)
    .map(p => ({ id: p.id, name: p.name, status: p.status as 'open' | 'closed' }))

  const yearLevels = levels.filter(l => l.academicYearId === year.id).map(l => ({
    id: l.id, name: l.name, niveau: l.niveau, filiere: l.filiere
  }))

  const yearSubjectParents = subjectParents.filter(sp => sp.academicYearId === year.id).map(sp => ({
    id: sp.id, code: sp.code, name: sp.name, rubrique: sp.rubrique as 'R1' | 'R2' | 'R3', coefficient: sp.coefficients[0]?.valeur || 0
  }))

  const yearSubjectChildren = subjectChildren.filter(sc => sc.academicYearId === year.id).map(sc => ({
    id: sc.id, code: sc.code, parentId: sc.parentId, name: sc.name, type: sc.type, coefficient: sc.coefficient
  }))

  const yearClassrooms = classrooms.filter(c => c.academicYearId === year.id).map(c => ({
    id: c.id, name: c.name, levelId: c.levelId, capacity: c.capacity
  }))

  const yearStudents = students.filter(s => s.academicYearId === year.id).map(s => ({
    id: s.id, classroomId: s.classroomId, levelId: s.levelId
  }))

  return (
    <div style={{ backgroundColor: '#FAFAF8', minHeight: '100vh' }}>
      <div className="space-y-4 p-4 sm:p-6">
        <div>
          <Link
            href="/admin/academic-years"
            className="inline-flex items-center gap-2 hover:opacity-70 transition-opacity"
            style={{ color: '#5A7085', fontSize: '14px', fontWeight: 500, marginBottom: '16px' }}
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Années Scolaires
          </Link>

          <h1
            className="font-serif font-bold"
            style={{ fontSize: '36px', fontWeight: 700, lineHeight: '1.15', letterSpacing: '-0.03em', color: '#2A3740' }}
          >
            Configuration — {year.name}
          </h1>
          <p className="font-sans text-muted-foreground mt-1" style={{ fontSize: '13px', fontWeight: 400 }}>
            Configurez les étapes, classes et matières de l&apos;année
          </p>
        </div>

        <CPMSLYearConfigTabs
          yearName={year.name}
          isArchived={year.status === 'archived'}
          periods={yearPeriods}
          levels={yearLevels}
          subjectParents={yearSubjectParents}
          subjectChildren={yearSubjectChildren}
          classrooms={yearClassrooms}
          students={yearStudents}
          onAddPeriod={() => toast({ title: "Étape ajoutée", description: "La nouvelle étape a été configurée." })}
          onClosePeriod={() => toast({ title: "Étape clôturée" })}
          onReopenPeriod={() => toast({ title: "Étape réouverte" })}
          onAddLevel={() => toast({ title: "Niveau ajouté" })}
          onAddSubjectParent={() => toast({ title: "Matière ajoutée" })}
          onAddSubjectChild={() => toast({ title: "Sous-matière ajoutée" })}
          onEditSubjectParent={() => toast({ title: "Matière modifiée" })}
          onDeleteSubjectParent={() => toast({ title: "Matière supprimée", variant: "destructive" })}
          onEditSubjectChild={() => toast({ title: "Sous-matière modifiée" })}
          onDeleteSubjectChild={() => toast({ title: "Sous-matière supprimée", variant: "destructive" })}
          onAddClassroom={() => toast({ title: "Classe ajoutée" })}
          onEditClassroom={() => toast({ title: "Classe modifiée" })}
          onDeleteClassroom={() => toast({ title: "Classe supprimée", variant: "destructive" })}
          onEditLevel={() => toast({ title: "Niveau modifié" })}
          onDeleteLevel={() => toast({ title: "Niveau supprimé", variant: "destructive" })}
        />
      </div>
    </div>
  )
}
