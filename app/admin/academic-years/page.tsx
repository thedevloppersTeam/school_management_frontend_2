"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { CPMSLYearCard } from "@/components/school/cpmsl-year-card"
import { CreateAcademicYearModalV2 } from "@/components/school/create-academic-year-modal-v2"
import { academicYears, periods, levels, subjectParents } from "@/lib/data/school-data"
import { PlusIcon } from "lucide-react"

export default function AcademicYearsPage() {
  const router = useRouter()
  const { toast } = useToast()

  const handleConfigure = (yearId: string) => {
    router.push(`/admin/academic-year/${yearId}/config`)
  }

  const handleCreateYear = (data: {
    name: string
    startDate?: string
    endDate?: string
    copyFromYearId?: string
  }) => {
    toast({
      title: "Année scolaire créée",
      description: `L'année ${data.name} a été créée avec succès.`
    })
  }

  const activeYear = academicYears.find(y => y.status === 'active')
  const archivedYears = academicYears.filter(y => y.status === 'archived')

  const yearCards = academicYears.map(year => {
    const yearPeriods = periods.filter(p => p.academicYearId === year.id)
    const yearLevels = levels.filter(l => l.academicYearId === year.id)
    const yearSubjectParents = subjectParents.filter(sp => sp.academicYearId === year.id)

    return {
      year: {
        id: year.id,
        name: year.name,
        status: year.status as 'active' | 'preparation' | 'archived'
      },
      stats: year.status !== 'archived' ? {
        periods: { current: yearPeriods.length, total: 4, complete: yearPeriods.length >= 4 },
        classes: { current: yearLevels.length, complete: yearLevels.length > 0 },
        subjects: { current: yearSubjectParents.length, complete: yearSubjectParents.length > 0 }
      } : undefined
    }
  })

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="font-serif font-bold"
              style={{ fontSize: '36px', fontWeight: 700, lineHeight: '1.15', letterSpacing: '-0.03em', color: '#2A3740' }}
            >
              Années Scolaires
            </h1>
            <p className="font-sans text-muted-foreground mt-1" style={{ fontSize: '13px', fontWeight: 400 }}>
              Gérez les années académiques de votre établissement
            </p>
          </div>
          <CreateAcademicYearModalV2
            activeYear={activeYear}
            archivedYears={archivedYears}
            onSubmit={handleCreateYear}
            trigger={
              <Button
                variant="outline"
                className="gap-2"
                style={{ backgroundColor: 'white', borderColor: '#2C4A6E', color: '#2C4A6E' }}
              >
                <PlusIcon className="h-4 w-4" />
                Nouvelle année
              </Button>
            }
          />
        </div>

        <div className="space-y-3">
          {yearCards.map((card) => (
            <CPMSLYearCard
              key={card.year.id}
              year={card.year}
              stats={card.stats}
              onConfigure={handleConfigure}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
