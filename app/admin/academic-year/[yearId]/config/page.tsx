"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { CPMSLYearConfigTabs } from "@/components/school/cpmsl-year-config-tabs"
import { useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeftIcon } from "lucide-react"
import {
  fetchActiveAcademicYear,
  fetchSteps,
  fetchClassSessions,
  type AcademicYear,
  type AcademicYearStep,
  type ClassSession
} from "@/lib/api/dashboard"

// ── Types locaux (format attendu par CPMSLYearConfigTabs) ─────────────────────

interface Period {
  id: string
  name: string
  status: 'open' | 'closed'
}

interface Level {
  id: string
  name: string
  niveau: string
  filiere?: string
}

interface Classroom {
  id: string
  name: string
  levelId: string
  capacity: number
}

interface SubjectParent {
  id: string
  code: string
  name: string
  rubrique: 'R1' | 'R2' | 'R3'
  coefficient: number
}

interface SubjectChild {
  id: string
  code: string
  parentId: string
  name: string
  type: 'L' | 'C' | 'N' | 'P' | 'T'
  coefficient: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Dérive le statut d'une étape depuis ses dates */
function deriveStepStatus(step: AcademicYearStep): 'open' | 'closed' {
  const today = new Date()
  const start = new Date(step.startDate)
  const end = new Date(step.endDate)
  return today >= start && today <= end ? 'open' : 'closed'
}

/** Dérive le statut d'une année depuis isCurrent + dates */
function deriveYearStatus(year: AcademicYear): 'active' | 'preparation' | 'archived' {
  if (year.isCurrent) return 'active'
  if (new Date(year.endDate) < new Date()) return 'archived'
  return 'preparation'
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AcademicYearConfigPage() {
  const params = useParams()
  const yearId = params.yearId as string
  const { toast } = useToast()

  // ── État ────────────────────────────────────────────────────────────────────
  const [year, setYear] = useState<AcademicYear | null>(null)
  const [periods, setPeriods] = useState<Period[]>([])
  const [levels, setLevels] = useState<Level[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [subjectParents, setSubjectParents] = useState<SubjectParent[]>([])
  const [subjectChildren, setSubjectChildren] = useState<SubjectChild[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // ── Chargement des données ──────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Année scolaire
      const yearRes = await fetch(`/api/academic-years/${yearId}`, {
        credentials: 'include'
      })
      if (!yearRes.ok) { setNotFound(true); return }
      const yearData: AcademicYear = await yearRes.json()
      setYear(yearData)

      // 2. Étapes → periods
      const stepsData = await fetchSteps(yearId)
      setPeriods(stepsData.map(s => ({
        id: s.id,
        name: s.name,
        status: deriveStepStatus(s)
      })))

      // 3. Sessions de classe → classrooms
      const sessionsData = await fetchClassSessions(yearId)
      setClassrooms(sessionsData.map(s => ({
        id: s.id,
        name: `${s.class.classType.name} ${s.class.letter}${s.class.track ? ` — ${s.class.track.code}` : ''}`,
        levelId: s.class.classType.id,
        capacity: 30
      })))

      // 4. Types de classe → levels
      const typesRes = await fetch('/api/class-types', { credentials: 'include' })
      if (typesRes.ok) {
        const types = await typesRes.json()
        setLevels(types.map((t: { id: string; name: string; isTerminal: boolean }) => ({
          id: t.id,
          name: t.name,
          niveau: t.isTerminal ? 'Nouveau Secondaire' : 'Fondamentale',
        })))
      }

      // 5. Matières → subjectParents
      const subjectsRes = await fetch('/api/subjects', { credentials: 'include' })
      const rubricsRes = await fetch('/api/subject-rubrics', { credentials: 'include' })

      if (subjectsRes.ok && rubricsRes.ok) {
        const subjects = await subjectsRes.json()
        const rubrics = await rubricsRes.json()

        const rubricMap: Record<string, 'R1' | 'R2' | 'R3'> = {}
        rubrics.forEach((r: { id: string; code: string }) => {
          if (r.code === 'R1' || r.code === 'R2' || r.code === 'R3') {
            rubricMap[r.id] = r.code
          }
        })

        const parents: SubjectParent[] = subjects.map((s: {
          id: string; code: string; name: string
          rubricId?: string; coefficient: number; hasSections: boolean
        }) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          rubrique: s.rubricId ? (rubricMap[s.rubricId] || 'R1') : 'R1',
          coefficient: s.coefficient
        }))
        setSubjectParents(parents)

        // 6. Sections → subjectChildren
        const children: SubjectChild[] = []
        await Promise.all(
          subjects
            .filter((s: { hasSections: boolean }) => s.hasSections)
            .map(async (s: { id: string }) => {
              try {
                const sectionsRes = await fetch(
                  `/api/subjects/${s.id}/sections`,
                  { credentials: 'include' }
                )
                if (sectionsRes.ok) {
                  const sections = await sectionsRes.json()
                  sections.forEach((sec: {
                    id: string; code: string; name: string; displayOrder: number
                  }) => {
                    children.push({
                      id: sec.id,
                      code: sec.code,
                      parentId: s.id,
                      name: sec.name,
                      type: 'N',
                      coefficient: 1
                    })
                  })
                }
              } catch { /* ignorer les erreurs par section */ }
            })
        )
        setSubjectChildren(children)
      }

    } catch (err) {
      console.error('[config] Erreur chargement:', err)
      toast({ title: "Erreur", description: "Impossible de charger la configuration", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [yearId, toast])

  useEffect(() => { loadData() }, [loadData])

  // ── Handlers — Étapes ───────────────────────────────────────────────────────
  const handleAddPeriod = async (data: {
    name: string; type: string
    startDate: string; endDate: string; description?: string
  }) => {
    try {
      const res = await fetch(
        `/api/academic-years/${yearId}/steps/create`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.name,
            stepNumber: periods.length + 1,
            startDate: data.startDate,
            endDate: data.endDate,
          })
        }
      )
      if (!res.ok) throw new Error()
      toast({ title: "Étape créée", description: `L'étape ${data.name} a été configurée.` })
      loadData()
    } catch {
      toast({ title: "Erreur", description: "Impossible de créer l'étape", variant: "destructive" })
    }
  }

  const handleClosePeriod = async (periodId: string) => {
    try {
      await fetch(`/api/academic-years/steps/disable/${periodId}`, { credentials: 'include' })
      toast({ title: "Étape clôturée" })
      loadData()
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handleReopenPeriod = async (periodId: string) => {
    try {
      await fetch(`/api/academic-years/steps/enable/${periodId}`, { credentials: 'include' })
      toast({ title: "Étape réouverte" })
      loadData()
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  // ── Handlers — Matières ─────────────────────────────────────────────────────
  const handleAddSubjectParent = async (data: {
    name: string; code: string
    rubrique: 'R1' | 'R2' | 'R3'; coefficient: number
  }) => {
    try {
      const rubricsRes = await fetch('/api/subject-rubrics', { credentials: 'include' })
      const rubrics = await rubricsRes.json()
      const rubric = rubrics.find((r: { code: string }) => r.code === data.rubrique)

      const res = await fetch('/api/subjects/create', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          code: data.code,
          coefficient: data.coefficient,
          maxScore: 100,
          hasSections: false,
          rubricId: rubric?.id || null,
        })
      })
      if (!res.ok) throw new Error()
      toast({ title: "Matière ajoutée" })
      loadData()
    } catch {
      toast({ title: "Erreur", description: "Impossible de créer la matière", variant: "destructive" })
    }
  }

  const handleAddSubjectChild = async (parentId: string, data: {
    name: string; code: string; type: string; coefficient: number
  }) => {
    try {
      const res = await fetch(`/api/subjects/${parentId}/sections/create`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          code: data.code,
          maxScore: 100,
          displayOrder: subjectChildren.filter(c => c.parentId === parentId).length + 1,
        })
      })
      if (!res.ok) throw new Error()
      toast({ title: "Sous-matière ajoutée" })
      loadData()
    } catch {
      toast({ title: "Erreur", description: "Impossible de créer la sous-matière", variant: "destructive" })
    }
  }

  const handleDeleteSubjectParent = async (parentId: string) => {
    toast({ title: "Suppression non disponible", description: "Cette action sera disponible prochainement.", variant: "destructive" })
  }

  const handleDeleteSubjectChild = async (childId: string) => {
    toast({ title: "Suppression non disponible", description: "Cette action sera disponible prochainement.", variant: "destructive" })
  }

  // ── Handlers — Classes ──────────────────────────────────────────────────────
  const handleAddClassroom = async (levelId: string) => {
    toast({ title: "Ajout de classe", description: "Utilisez la page Sessions de classe pour ajouter une classe." })
  }

  const handleEditClassroom = async (classroomId: string) => {
    toast({ title: "Modification en cours..." })
  }

  const handleDeleteClassroom = async (classroomId: string) => {
    toast({ title: "Suppression non disponible", description: "Cette action sera disponible prochainement.", variant: "destructive" })
  }

  // ── Handlers — Niveaux ──────────────────────────────────────────────────────
  const handleAddLevel = async (data: {
    niveau: string; name: string; filieres?: string[]
  }) => {
    toast({ title: "Ajout de niveau", description: "Les niveaux sont préconfigurés pour CPMSL." })
  }

  const handleEditLevel = async (levelId: string, data: { description?: string }) => {
    toast({ title: "Niveau modifié" })
  }

  const handleDeleteLevel = async (levelId: string) => {
    toast({ title: "Suppression non disponible", variant: "destructive" })
  }

  // ── Rendu ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    )
  }

  if (notFound || !year) {
    return (
      <div style={{ padding: '32px', color: '#C43C3C', fontSize: '16px' }}>
        Année académique introuvable.
      </div>
    )
  }

  const isArchived = deriveYearStatus(year) === 'archived'

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
          isArchived={isArchived}
          periods={periods}
          levels={levels}
          subjectParents={subjectParents}
          subjectChildren={subjectChildren}
          classrooms={classrooms}
          students={[]}
          onAddPeriod={handleAddPeriod}
          onClosePeriod={handleClosePeriod}
          onReopenPeriod={handleReopenPeriod}
          onAddLevel={handleAddLevel}
          onAddSubjectParent={handleAddSubjectParent}
          onAddSubjectChild={handleAddSubjectChild}
          onEditSubjectParent={() => toast({ title: "Modification en cours..." })}
          onDeleteSubjectParent={handleDeleteSubjectParent}
          onEditSubjectChild={() => toast({ title: "Modification en cours..." })}
          onDeleteSubjectChild={handleDeleteSubjectChild}
          onAddClassroom={handleAddClassroom}
          onEditClassroom={handleEditClassroom}
          onDeleteClassroom={handleDeleteClassroom}
          onEditLevel={handleEditLevel}
          onDeleteLevel={handleDeleteLevel}
        />
      </div>
    </div>
  )
}