"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { CPMSLYearCard } from "@/components/school/cpmsl-year-card"
import { CreateAcademicYearModalV2 } from "@/components/school/create-academic-year-modal-v2"
import { fetchStudentsByYear, fetchClassSessionsForYear } from "@/lib/api/students"
import { PlusIcon, LoaderIcon, AlertTriangleIcon } from "lucide-react"

interface ApiAcademicYear {
  id: string
  name: string
  yearString: string
  startDate: string
  endDate: string
  isCurrent: boolean
  createdAt: string
  updatedAt: string
  steps: Array<{ id: string; name: string; stepNumber: number }>
}

interface YearStats {
  studentCount: number
  classCount: number
}

export default function AcademicYearsPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [years, setYears] = useState<ApiAcademicYear[]>([])
  const [statsMap, setStatsMap] = useState<Record<string, YearStats>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadYears = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/academic-years", { credentials: "include" })
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      const data: ApiAcademicYear[] = await res.json()
      const sorted = data.sort((a, b) => (a.isCurrent === b.isCurrent ? 0 : a.isCurrent ? -1 : 1))
      setYears(sorted)

      // Fetch students + classes for each year in parallel
      const statsEntries = await Promise.all(
        sorted.map(async (y) => {
          try {
            const [students, sessions] = await Promise.all([
              fetchStudentsByYear(y.id),
              fetchClassSessionsForYear(y.id),
            ])
            return [y.id, { studentCount: students.length, classCount: sessions.length }] as const
          } catch {
            return [y.id, { studentCount: 0, classCount: 0 }] as const
          }
        })
      )
      setStatsMap(Object.fromEntries(statsEntries))
    } catch {
      setError("Impossible de charger les années scolaires.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadYears() }, [loadYears])

  const handleConfigure = (yearId: string) => {
    router.push(`/admin/academic-year/${yearId}/config`)
  }

  const handleCreateYear = () => {
    toast({
      title: "Année scolaire créée",
      description: "L'année a été créée avec succès."
    })
    loadYears()
  }

  const activeYear = years.find(y => y.isCurrent)
  const archivedYears = years.filter(y => !y.isCurrent)

  const toModalYear = (y: ApiAcademicYear) => ({
    id: y.id,
    name: y.yearString,
    startDate: y.startDate,
    endDate: y.endDate,
    isActive: y.isCurrent,
    status: y.isCurrent ? "active" as const : "archived" as const,
    createdAt: y.createdAt,
  })

  if (loading) return (
    <div className="space-y-6">
      <h1 className="font-serif font-bold" style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.03em', color: '#2A3740' }}>
        Années Scolaires
      </h1>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <div style={{ textAlign: "center" }}>
          <LoaderIcon className="h-8 w-8" style={{ color: "#5A7085", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
          <p className="font-sans" style={{ fontSize: 14, color: "#78756F" }}>Chargement...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )

  if (error) return (
    <div className="space-y-6">
      <h1 className="font-serif font-bold" style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.03em', color: '#2A3740' }}>
        Années Scolaires
      </h1>
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangleIcon className="h-10 w-10 mb-4" style={{ color: "#C43C3C" }} />
        <p className="font-sans mb-6" style={{ fontSize: 14, color: "#C43C3C" }}>{error}</p>
        <Button onClick={loadYears} style={{ backgroundColor: "#5A7085", color: "white" }}>Réessayer</Button>
      </div>
    </div>
  )

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
            activeYear={activeYear ? toModalYear(activeYear) : undefined}
            archivedYears={archivedYears.map(toModalYear)}
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
          {years.map((y) => {
            const stats = statsMap[y.id]
            return (
              <CPMSLYearCard
                key={y.id}
                year={{
                  id: y.id,
                  name: y.name,
                  status: y.isCurrent ? "active" : "archived",
                }}
                stats={{
                  periods: { current: y.steps.length, total: y.steps.length || 4, complete: y.steps.length >= 4 },
                  classes: { current: stats?.classCount ?? 0, complete: (stats?.classCount ?? 0) > 0 },
                  students: { current: stats?.studentCount ?? 0 },
                }}
                onConfigure={handleConfigure}
              />
            )
          })}
          {years.length === 0 && (
            <div className="text-center py-12">
              <p className="font-sans" style={{ fontSize: 14, color: "#78756F" }}>
                Aucune année scolaire. Créez la première !
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}