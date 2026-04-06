"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { CPMSLYearCard } from "@/components/school/cpmsl-year-card"
import { CreateAcademicYearModalV2 } from "@/components/school/create-academic-year-modal-v2"
import { PlusIcon, AlertTriangleIcon } from "lucide-react"
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
// Divise l'année en N tranches égales

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
      // Dates réelles de l'année
      const yearStart = data.startDate || new Date(new Date().getFullYear(), 8, 1).toISOString()
      const yearEnd   = data.endDate   || new Date(new Date().getFullYear() + 1, 5, 30).toISOString()

      // ── Étape 1 : Créer l'année ──────────────────────────────────────────
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

      // ── Étape 2 : Créer les étapes avec dates réparties ──────────────────
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

      // ── Étape 3 : Créer les sessions pour toutes les classes existantes ──
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

      // ── Étape 4 (optionnelle) : Copie de structure ───────────────────────
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

          // Trouver la session déjà créée pour cette classe
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
          description: `${data.name} créée avec ${stepCount} étapes et ${
            classesRes.ok ? (await classesRes.json().catch(() => [])).length : 0
          } classes.`
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
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="font-serif font-bold"
            style={{ fontSize: '36px', fontWeight: 700, lineHeight: '1.15', letterSpacing: '-0.03em', color: '#2A3740' }}
          >
            Années Scolaires
          </h1>
          <p className="font-sans text-muted-foreground mt-1" style={{ fontSize: '13px' }}>
            Gérez les années académiques de votre établissement
          </p>
        </div>

        <CreateAcademicYearModalV2
          activeYear={activeYear as any}
          archivedYears={archivedYears as any}
          hasActiveYear={hasActiveYear}
          onSubmit={handleCreateYear}
          trigger={
            <Button
              variant="outline"
              className="gap-2"
              disabled={creating}
              style={{ backgroundColor: 'white', borderColor: '#2C4A6E', color: '#2C4A6E' }}
            >
              <PlusIcon className="h-4 w-4" />
              {creating ? 'Création...' : 'Nouvelle année'}
            </Button>
          }
        />
      </div>

      {/* Avertissement si année active existe */}
      {hasActiveYear && (
        <div
          className="flex items-start gap-3 rounded-lg p-4"
          style={{ backgroundColor: '#FEF6E0', border: '1px solid #C48B1A' }}
        >
          <AlertTriangleIcon className="h-5 w-5 mt-0.5 shrink-0" style={{ color: '#C48B1A' }} />
          <div>
            <p className="font-sans font-medium" style={{ fontSize: '13px', color: '#7A5214' }}>
              Année active : <strong>{activeYear!.name}</strong>
            </p>
            <p className="font-sans mt-0.5" style={{ fontSize: '12px', color: '#9A6824' }}>
              Pour changer d'année active, activez une année en préparation — l'année courante sera automatiquement désactivée.
            </p>
          </div>
        </div>
      )}

      {/* Liste des cards */}
      <div className="space-y-3">
        {yearCards.length === 0 ? (
          <div
            className="rounded-xl p-12 flex flex-col items-center justify-center text-center"
            style={{ backgroundColor: 'white', border: '1px solid #E8E6E3' }}
          >
            <p className="font-serif" style={{ fontSize: '20px', fontWeight: 600, color: '#3A4A57', marginBottom: '8px' }}>
              Aucune année scolaire
            </p>
            <p className="font-sans" style={{ fontSize: '14px', color: '#78756F' }}>
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