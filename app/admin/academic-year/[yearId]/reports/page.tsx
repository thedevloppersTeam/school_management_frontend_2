"use client"

import { useParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { ArchivedYearBanner } from "@/components/school/archived-year-banner"
import { CPMSLBulletinsSection } from "@/components/school/cpmsl-bulletins-section"
import { CPMSLRapportsSection } from "@/components/school/cpmsl-rapports-section"
import { useAcademicYear } from "@/hooks/use-academic-year"

export default function ReportsPage() {
  const params = useParams()
  const yearId = params.yearId as string
  const { academicYear, isArchived, loading } = useAcademicYear(yearId)

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Bulletins
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Année {academicYear?.name}
        </p>
      </div>

      {isArchived && <ArchivedYearBanner yearName={academicYear?.name || ''} />}

      <Tabs defaultValue="bulletins" className="space-y-6">
        <TabsList>
          <TabsTrigger value="bulletins">Bulletins</TabsTrigger>
          <TabsTrigger value="rapports">Rapports</TabsTrigger>
        </TabsList>

        <TabsContent value="bulletins">
          <CPMSLBulletinsSection
            academicYearId={yearId}
            isArchived={isArchived}
          />
        </TabsContent>

        <TabsContent value="rapports">
          <CPMSLRapportsSection
            academicYearId={yearId}
            isArchived={isArchived}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
