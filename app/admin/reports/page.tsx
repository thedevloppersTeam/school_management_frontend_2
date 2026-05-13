"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ArchivedYearBanner } from "@/components/school/archived-year-banner"
import { CPMSLBulletinsSection } from "@/components/school/cpmsl-bulletins-section"
import { CPMSLRapportsSection } from "@/components/school/cpmsl-rapports-section"
import { fetchActiveAcademicYear, type AcademicYear } from "@/lib/api/dashboard"

export default function ReportsPage() {
  const [academicYear, setAcademicYear] = useState<AcademicYear | null>(null)
  const [isArchived, setIsArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [noCurrentYear, setNoCurrentYear] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const year = await fetchActiveAcademicYear()
        if (!year) {
          setNoCurrentYear(true)
          return
        }
        setAcademicYear(year)
        // l'année courante n'est jamais archivée — on garde la cohérence du flag
        const now = new Date()
        const endDate = new Date(year.endDate)
        setIsArchived(now > endDate && !year.isCurrent)
      } catch (error) {
        console.error("Error fetching academic year:", error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="space-y-1">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (noCurrentYear || !academicYear) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Bulletins</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Génération des bulletins et rapports statistiques
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          Aucune année scolaire n&apos;est marquée comme courante. Activez une année dans
          {" "}<a href="/admin/academic-years" className="font-semibold underline">Paramétrage &middot; Années Scolaires</a>{" "}
          avant de générer des bulletins.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Bulletins</h1>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <span>Génération des bulletins et rapports statistiques</span>
          <span>&middot;</span>
          <Badge variant="secondary" className="align-middle">
            {academicYear.name}
          </Badge>
        </div>
      </div>

      {isArchived && <ArchivedYearBanner yearName={academicYear.name} />}

      <Tabs defaultValue="bulletins" className="space-y-6">
        <TabsList>
          <TabsTrigger value="bulletins">Bulletins</TabsTrigger>
          <TabsTrigger value="rapports">Rapports</TabsTrigger>
        </TabsList>

        <TabsContent value="bulletins">
          <CPMSLBulletinsSection academicYearId={academicYear.id} isArchived={isArchived} />
        </TabsContent>

        <TabsContent value="rapports">
          <CPMSLRapportsSection academicYearId={academicYear.id} isArchived={isArchived} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
