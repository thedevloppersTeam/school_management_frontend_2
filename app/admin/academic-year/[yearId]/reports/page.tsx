"use client"

import { useParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArchivedYearBanner } from "@/components/archived-year-banner"
import { CPMSLBulletinsSection } from "@/components/cpmsl-bulletins-section"
import { CPMSLRapportsSection } from "@/components/cpmsl-rapports-section"
import { useAcademicYear } from "@/hooks/use-academic-year"

export default function ReportsPage() {
  const params = useParams()
  const yearId = params.yearId as string
  const { academicYear, isArchived, loading } = useAcademicYear(yearId)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "36px", fontWeight: 700, letterSpacing: "-0.03em", color: "#2A3740" }}>
          Bulletins
        </h1>
        <p style={{ fontSize: "13px", fontWeight: 400, color: "hsl(var(--muted-foreground))" }}>
          Année {academicYear?.name}
        </p>
      </div>

      {isArchived && <ArchivedYearBanner yearName={academicYear?.name || ''} />}

      <Tabs defaultValue="bulletins" className="space-y-6">
        <TabsList style={{ backgroundColor: "#F0F4F7", borderRadius: "8px", padding: "4px" }}>
          <TabsTrigger value="bulletins" className="data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>
            Bulletins
          </TabsTrigger>
          <TabsTrigger value="rapports" className="data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>
            Rapports
          </TabsTrigger>
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