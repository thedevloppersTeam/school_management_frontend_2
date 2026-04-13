"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { CPMSLYearCard } from "@/components/school/cpmsl-year-card"
import { CreateAcademicYearModalV2 } from "@/components/school/create-academic-year-modal-v2"
import { PlusIcon, AlertTriangleIcon, SchoolIcon } from "lucide-react"
import {
  fetchAllAcademicYears,
  fetchSteps,
  fetchClassSessions,
  type AcademicYear,
} from "@/lib/api/dashboard"

// ── Types locaux ──────────────────────────────────────────────────────────────

interface YearCard {
  year: {
    id: string
    name: string
    status: 'active' | 'preparation' | 'archived'
    endDate?: string
  }
  stats?: {
    periods:  { current: number; total: number; complete: boolean }
    classes:  { current: number; complete: boolean }
    subjects: { current: number; complete: boolean }
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

function deriveStatus(year: AcademicYear): 'active' | 'preparation' | 'archived' {
  if (year.isCurrent) return 'active'
  return 'preparation'
}

// ── Calcul des dates des étapes ───────────────────────────────────────────────

function computeStepDates(
  yearStart: string,
  yearEnd: string,
  count: number
): Array<{ startDate: string; endDate: string }> {
  const start = new Date(yearStart).getTime()
  const end   = new Date(yearEnd).getTime()
  const slice = (end - start) / count

  return Array.from({ length: count }, (_, i) => ({
    startDate: new Date(start + i * slice).toISOString(),
    endDate:   new Date(start + (i + 1) * slice).toISOString(),
  }))
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AcademicYearsPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [years, setYears]               = useState<AcademicYear[]>([])
  const [yearCards, setYearCards]       = useState<YearCard[]>([])
  const [loading, setLoading]           = useState(true)
  const [creating, setCreating]         = useState(false)
  const [activatingId, setActivatingId] = useState<string | null>(null)

  // ── Chargement ────────────────────────────────────────────────────────────

  const loadYears = useCallback(async () => {
    setLoading(true)
    try {
      const allYears = await fetchAllAcademicYears()
      setYears(allYears)

      const cards = await Promise.all(
        allYears.map(async (year) => {
          const status = deriveStatus(year)

          if (status === 'archived') {
            return { year: { id: year.id, name: year.name, status, endDate: year.endDate } }
          }

          try {
            const [steps, sessions] = await Promise.all([
              fetchSteps(year.id),
              fetchClassSessions(year.id),
            ])
            return {
              year: { id: year.id, name: year.name, status, endDate: year.endDate },
              stats: {
                periods: { current: steps.length, total: 4, complete: steps.length >= 4 },
                classes: { current: sessions.length, complete: sessions.length > 0 },
                subjects: { current: 0, complete: false }
              }
            }
          } catch {
            return { year: { id: year.id, name: year.name, status, endDate: year.endDate } }
          }
        })
      )

      setYearCards(cards)
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les années scolaires", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadYears() }, [loadYears])

  // ── Activation d'une année ────────────────────────────────────────────────

  const handleActivateYear = async (yearId: string) => {
    const target = years.find(y => y.id === yearId)
    if (!target) return

    setActivatingId(yearId)
    try {
      const res = await fetch(`/api/academic-years/set-current/${yearId}`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Erreur activation')
      }

      toast({
        title: "Année activée",
        description: `${target.name} est maintenant l'année scolaire active.`
      })
      await loadYears()
    } catch (e: any) {
      toast({ title: "Erreur d'activation", description: e.message, variant: "destructive" })
    } finally {
      setActivatingId(null)
    }
  }

  // ── Création d'une année ──────────────────────────────────────────────────

  const handleCreateYear = async (data: {
    name: string
    startDate?: string
    endDate?: string
    numberOfPeriods?: 4 | 5
    copyFromYearId?: string
  }) => {
    setCreating(true)
    try {
      const yearStart = data.startDate || new Date(new Date().getFullYear(), 8, 1).toISOString()
      const yearEnd   = data.endDate   || new Date(new Date().getFullYear() + 1, 5, 30).toISOString()

      const res = await fetch('/api/academic-years/create', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:       data.name,
          yearString: data.name,
          startDate:  yearStart,
          endDate:    yearEnd,
        })
      })

      if (!res.ok) throw new Error('Erreur création année')
      const { year } = await res.json()
      const newYearId = year.id

      const stepCount = data.numberOfPeriods || 4
      const stepNames = ['1ère Étape', '2ème Étape', '3ème Étape', '4ème Étape', '5ème Étape']
        .slice(0, stepCount)

      const stepDates = computeStepDates(yearStart, yearEnd, stepCount)

      await Promise.all(
        stepNames.map((name, index) =>
          fetch(`/api/academic-years/${newYearId}/steps/create`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              stepNumber: index + 1,
              startDate:  stepDates[index].startDate,
              endDate:    stepDates[index].endDate,
            })
          })
        )
      )

      const classesRes = await fetch('/api/classes/', { credentials: 'include' })
      if (classesRes.ok) {
        const classes: Array<{ id: string }> = await classesRes.json()

        if (classes.length > 0) {
          await Promise.all(
            classes.map(cls =>
              fetch('/api/class-sessions/create', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  classId:        cls.id,
                  academicYearId: newYearId,
                })
              })
            )
          )
        }
      }

      if (data.copyFromYearId && newYearId) {
        const sessionsRes = await fetch(
          `/api/class-sessions?academicYearId=${data.copyFromYearId}`,
          { credentials: 'include' }
        )
        const sourceSessions: Array<{ id: string; classId: string }> =
          sessionsRes.ok ? await sessionsRes.json() : []

        await Promise.all(sourceSessions.map(async (sourceSession) => {
          const subjectsRes = await fetch(
            `/api/class-subjects?classSessionId=${sourceSession.id}`,
            { credentials: 'include' }
          )
          if (!subjectsRes.ok) return
          const sourceSubjects: Array<{ subjectId: string; coefficientOverride: number | null }> =
            await subjectsRes.json()

          const existingSessionRes = await fetch(
            `/api/class-sessions?academicYearId=${newYearId}&classId=${sourceSession.classId}`,
            { credentials: 'include' }
          )
          const existingSessions = existingSessionRes.ok ? await existingSessionRes.json() : []
          const targetSessionId = existingSessions[0]?.id
          if (!targetSessionId) return

          await Promise.all(sourceSubjects.map(cs =>
            fetch('/api/class-subjects/create', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                classSessionId:      targetSessionId,
                subjectId:           cs.subjectId,
                coefficientOverride: cs.coefficientOverride ?? null,
              })
            })
          ))
        }))

        toast({
          title: "Année créée avec copie",
          description: `${data.name} créée — structure copiée.`
        })
      } else {
        toast({
          title: "Année créée",
          description: `${data.name} créée avec ${stepCount} étapes.`
        })
      }

      await loadYears()
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message || "Impossible de créer l'année scolaire", variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  const handleConfigure = (yearId: string) => {
    router.push(`/admin/academic-year/${yearId}/config`)
  }

  // ── Données pour le modal ─────────────────────────────────────────────────

  const activeYear    = years.find(y => y.isCurrent)
  const archivedYears = years.filter(y => deriveStatus(y) === 'archived')
  const hasActiveYear = !!activeYear

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="space-y-1">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-48" />
        </div>
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Années Scolaires
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérez les années académiques de votre établissement
          </p>
        </div>

        <CreateAcademicYearModalV2
          activeYear={activeYear as any}
          archivedYears={archivedYears as any}
          hasActiveYear={hasActiveYear}
          onSubmit={handleCreateYear}
          trigger={
            <Button variant="outline" className="gap-2" disabled={creating}>
              <PlusIcon className="h-4 w-4" />
              {creating ? 'Création...' : 'Nouvelle année'}
            </Button>
          }
        />
      </div>

      {/* Warning if active year exists */}
      {hasActiveYear && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertTriangleIcon className="h-4 w-4 !text-amber-600" />
          <AlertTitle>Année active : {activeYear!.name}</AlertTitle>
          <AlertDescription>
            Pour changer d&apos;année active, activez une année en préparation — l&apos;année courante sera automatiquement désactivée.
          </AlertDescription>
        </Alert>
      )}

      {/* Year cards list */}
      <div className="space-y-3">
        {yearCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <SchoolIcon className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              Aucune année scolaire
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Créez votre première année pour commencer
            </p>
          </div>
        ) : (
          yearCards.map(card => (
            <CPMSLYearCard
              key={card.year.id}
              year={card.year}
              stats={card.stats}
              onConfigure={handleConfigure}
              onActivate={card.year.status === 'preparation' ? handleActivateYear : undefined}
              isActivating={activatingId === card.year.id}
            />
          ))
        )}
      </div>
    </div>
  )
}
