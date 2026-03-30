"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { CPMSLYearConfigTabs } from "@/components/school/cpmsl-year-config-tabs"
import { ArrowLeftIcon, LoaderIcon, AlertTriangleIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ApiStep {
  id: string
  name: string
  stepNumber: number
  startDate?: string | null
  endDate?: string | null
  status?: string
}

interface ApiAcademicYear {
  id: string
  name: string
  yearString: string
  isCurrent: boolean
  startDate?: string
  endDate?: string
}

export default function AcademicYearConfigPage() {
  const params = useParams()
  const yearId = params.yearId as string
  const [year, setYear] = useState<ApiAcademicYear | null>(null)
  const [steps, setSteps] = useState<ApiStep[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [yearRes, stepsRes] = await Promise.all([
        fetch(`/api/academic-years/${yearId}`, { credentials: "include" }),
        fetch(`/api/academic-years/${yearId}/steps`, { credentials: "include" }),
      ])
      if (!yearRes.ok) throw new Error("Impossible de charger l'année scolaire")
      const found: ApiAcademicYear = await yearRes.json()
      if (!found?.id) throw new Error("Année académique introuvable")
      setYear(found)

      if (stepsRes.ok) {
        const stepsData: ApiStep[] = await stepsRes.json()
        setSteps(stepsData.sort((a, b) => a.stepNumber - b.stepNumber))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }, [yearId])

  useEffect(() => { loadData() }, [loadData])

  if (loading) return (
    <div style={{ backgroundColor: '#FAFAF8', minHeight: '100vh' }}>
      <div className="p-4 sm:p-6 space-y-4">
        <Link href="/admin/academic-years" className="inline-flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#5A7085', fontSize: '14px', fontWeight: 500 }}>
          <ArrowLeftIcon className="h-4 w-4" />Années Scolaires
        </Link>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
          <div style={{ textAlign: "center" }}>
            <LoaderIcon className="h-8 w-8" style={{ color: "#5A7085", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
            <p className="font-sans" style={{ fontSize: 14, color: "#78756F" }}>Chargement...</p>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    </div>
  )

  if (error || !year) return (
    <div style={{ backgroundColor: '#FAFAF8', minHeight: '100vh' }}>
      <div className="p-4 sm:p-6 space-y-4">
        <Link href="/admin/academic-years" className="inline-flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#5A7085', fontSize: '14px', fontWeight: 500 }}>
          <ArrowLeftIcon className="h-4 w-4" />Années Scolaires
        </Link>
        <div className="flex flex-col items-center justify-center py-12">
          <AlertTriangleIcon className="h-10 w-10 mb-4" style={{ color: "#C43C3C" }} />
          <p className="font-sans mb-6" style={{ fontSize: 14, color: "#C43C3C" }}>{error ?? "Année introuvable"}</p>
          <Button onClick={loadData} style={{ backgroundColor: "#5A7085", color: "white" }}>Réessayer</Button>
        </div>
      </div>
    </div>
  )

  const mappedSteps = steps.map(s => ({
    id: s.id,
    name: s.name,
    stepNumber: s.stepNumber,
    startDate: s.startDate ?? "",
    endDate: s.endDate ?? "",
    status: (s.status === 'closed' ? 'closed' : 'open') as 'open' | 'closed',
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
          yearId={yearId}
          yearName={year.name}
          isArchived={!year.isCurrent}
          periods={mappedSteps}
          onPeriodsChanged={loadData}
        />
      </div>
    </div>
  )
}
