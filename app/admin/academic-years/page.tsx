"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { CPMSLYearCard } from "@/components/school/cpmsl-year-card"
import { CreateAcademicYearModalV2 } from "@/components/school/create-academic-year-modal-v2"
import { PlusIcon } from "lucide-react"
import {
  fetchAllAcademicYears,
  fetchSteps,
  fetchClassSessions,
  type AcademicYear,
  type AcademicYearStep,
  type ClassSession
} from "@/lib/api/dashboard"

// ── Types locaux ──────────────────────────────────────────────────────────────

interface YearCard {
  year: {
    id: string
    name: string
    status: 'active' | 'preparation' | 'archived'
  }
  stats?: {
    periods: { current: number; total: number; complete: boolean }
    classes: { current: number; complete: boolean }
    subjects: { current: number; complete: boolean }
  }
}

// ── Helper : dériver le statut depuis les données backend ─────────────────────

function deriveStatus(year: AcademicYear): 'active' | 'preparation' | 'archived' {
  if (year.isCurrent) return 'active'
  if (new Date(year.endDate) < new Date()) return 'archived'
  return 'preparation'
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AcademicYearsPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [years, setYears] = useState<AcademicYear[]>([])
  const [yearCards, setYearCards] = useState<YearCard[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  // ── Chargement des années + stats ─────────────────────────────────────────

  const loadYears = useCallback(async () => {
    setLoading(true)
    try {
      const allYears = await fetchAllAcademicYears()
      setYears(allYears)

      // Pour chaque année, charger les étapes et sessions en parallèle
      const cards = await Promise.all(
        allYears.map(async (year) => {
          const status = deriveStatus(year)

          // Pas de stats pour les années archivées
          if (status === 'archived') {
            return { year: { id: year.id, name: year.name, status } }
          }

          try {
            const [steps, sessions] = await Promise.all([
              fetchSteps(year.id),
              fetchClassSessions(year.id),
            ])

            return {
              year: { id: year.id, name: year.name, status },
              stats: {
                periods: {
                  current: steps.length,
                  total: 4,
                  complete: steps.length >= 4
                },
                classes: {
                  current: sessions.length,
                  complete: sessions.length > 0
                },
                subjects: {
                  current: 0, // chargé séparément si nécessaire
                  complete: false
                }
              }
            }
          } catch {
            return { year: { id: year.id, name: year.name, status } }
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

  // ── Création d'une année ──────────────────────────────────────────────────

  const handleCreateYear = async (data: {
    name: string
    startDate?: string
    endDate?: string
    copyFromYearId?: string
  }) => {
    setCreating(true)
    try {
      const res = await fetch('/api/academic-years/create', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          yearString: data.name,
          startDate: data.startDate || new Date().toISOString(),
          endDate: data.endDate || new Date(
            new Date().getFullYear() + 1, 5, 30
          ).toISOString(),
        })
      })

      if (!res.ok) throw new Error('Erreur création')

      toast({
        title: "Année créée",
        description: `L'année ${data.name} a été créée avec succès.`
      })

      // Recharger la liste
      loadYears()
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de créer l'année scolaire",
        variant: "destructive"
      })
    } finally {
      setCreating(false)
    }
  }

  // ── Naviguer vers la config d'une année ──────────────────────────────────

  const handleConfigure = (yearId: string) => {
    router.push(`/admin/academic-year/${yearId}/config`)
  }

  // ── Données pour le modal ─────────────────────────────────────────────────

  const activeYear = years.find(y => y.isCurrent)
  const archivedYears = years.filter(y => deriveStatus(y) === 'archived')

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
          activeYear={activeYear as any}
          archivedYears={archivedYears as any}
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
            />
          ))
        )}
      </div>
    </div>
  )
}