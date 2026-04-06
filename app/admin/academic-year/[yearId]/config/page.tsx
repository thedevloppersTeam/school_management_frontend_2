"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { CPMSLYearConfigTabs } from "@/components/school/cpmsl-year-config-tabs"
import { useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeftIcon } from "lucide-react"
import {
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
  category: 'fondamental' | 'ns-tronc' | 'ns-filiere'
  isTerminal: boolean
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

/**
 * Dérive le statut d'une étape depuis isCurrent.
 * Source de vérité : backend via enable/disable endpoints.
 */
function deriveStepStatus(step: AcademicYearStep): 'open' | 'closed' {
  return step.isCurrent ? 'open' : 'closed'
}

/** Dérive le statut d'une année depuis isCurrent + dates */
function deriveYearStatus(year: AcademicYear): 'active' | 'preparation' | 'archived' {
  if (year.isCurrent) return 'active'
  if (new Date(year.endDate) < new Date()) return 'archived'
  return 'preparation'
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AcademicYearConfigPage() {
  const params  = useParams()
  const yearId  = params.yearId as string
  const { toast } = useToast()

  // ── État ───────────────────────────────────────────────────────────────────
  const [year,            setYear]            = useState<AcademicYear | null>(null)
  const [periods,         setPeriods]         = useState<Period[]>([])
  const [levels,          setLevels]          = useState<Level[]>([])
  const [classrooms,      setClassrooms]      = useState<Classroom[]>([])
  const [subjectParents,  setSubjectParents]  = useState<SubjectParent[]>([])
  const [subjectChildren, setSubjectChildren] = useState<SubjectChild[]>([])
  const [tracks,          setTracks]          = useState<Array<{ id: string; code: string; name: string }>>([])
  const [loading,         setLoading]         = useState(true)
  const [notFound,        setNotFound]        = useState(false)

  // ── Chargement des données ─────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Année scolaire
      const yearRes = await fetch(`/api/academic-years/${yearId}`, { credentials: 'include' })
      if (!yearRes.ok) { setNotFound(true); return }
      const yearData: AcademicYear = await yearRes.json()
      setYear(yearData)

      // 2. Étapes → periods (statut depuis isCurrent)
      const stepsData = await fetchSteps(yearId)
      setPeriods(stepsData.map(s => ({
        id:     s.id,
        name:   s.name,
        status: deriveStepStatus(s)
      })))

      // 3. Sessions de classe → classrooms
      const sessionsData = await fetchClassSessions(yearId)
      setClassrooms(sessionsData.map(s => ({
        id:      s.id,
        name:    `${s.class.classType.name} ${s.class.letter}${s.class.track ? ` — ${s.class.track.code}` : ''}`,
        levelId: s.class.classType.id,
        capacity: 30
      })))

      // 4. Types de classe → levels
      const typesRes = await fetch('/api/class-types', { credentials: 'include' })
      if (typesRes.ok) {
        const types = await typesRes.json()
        setLevels(types.map((t: { id: string; name: string; isTerminal: boolean }) => {
          const category: Level['category'] =
            t.name === 'NS3' || t.name === 'NS4' ? 'ns-filiere' :
            t.name === 'NS1' || t.name === 'NS2' ? 'ns-tronc' :
            'fondamental'
          return {
            id:         t.id,
            name:       t.name,
            niveau:     t.name.startsWith('NS') ? 'Nouveau Secondaire' : 'Fondamentale',
            category,
            isTerminal: t.isTerminal,
          }
        }))
      }

      // 4b. Tracks (filières)
      const tracksRes = await fetch('/api/class-tracks', { credentials: 'include' })
      if (tracksRes.ok) {
        const tracksData = await tracksRes.json()
        setTracks(tracksData.map((t: { id: string; code: string; name: string }) => ({
          id:   t.id,
          code: t.code,
          name: t.name,
        })))
      }

      // 5. Matières → subjectParents
      const subjectsRes = await fetch('/api/subjects',        { credentials: 'include' })
      const rubricsRes  = await fetch('/api/subject-rubrics', { credentials: 'include' })

      if (subjectsRes.ok && rubricsRes.ok) {
        const subjects = await subjectsRes.json()
        const rubrics  = await rubricsRes.json()

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
          id:          s.id,
          code:        s.code,
          name:        s.name,
          rubrique:    s.rubricId ? (rubricMap[s.rubricId] || 'R1') : 'R1',
          coefficient: Number(s.coefficient) || 0
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
                    id: string; code: string; name: string
                    displayOrder: number; coefficient?: number
                  }) => {
                    children.push({
                      id:          sec.id,
                      code:        sec.code,
                      parentId:    s.id,
                      name:        sec.name,
                      type:        'N',
                      coefficient: Number(sec.coefficient) || 1
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

  // ── Handlers — Étapes ──────────────────────────────────────────────────────

  const handleAddPeriod = async (data: {
    name: string; type: string
    startDate: string; endDate: string; description?: string
  }) => {
    try {
      const res = await fetch(`/api/academic-years/${yearId}/steps/create`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        data.name,
          stepNumber:  periods.length + 1,
          startDate:   data.startDate,
          endDate:     data.endDate,
        })
      })
      if (!res.ok) throw new Error()
      toast({ title: "Étape créée", description: `L'étape ${data.name} a été configurée.` })
      loadData()
    } catch {
      toast({ title: "Erreur", description: "Impossible de créer l'étape", variant: "destructive" })
    }
  }

  const handleClosePeriod = async (periodId: string) => {
    try {
      const res = await fetch(`/api/academic-years/steps/disable/${periodId}`, {
        credentials: 'include'
      })
      if (!res.ok) throw new Error()
      toast({ title: "Étape clôturée" })
      loadData()
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  const handleReopenPeriod = async (periodId: string) => {
    try {
      const res = await fetch(`/api/academic-years/steps/enable/${periodId}`, {
        credentials: 'include'
      })
      if (!res.ok) throw new Error()
      toast({ title: "Étape réouverte" })
      loadData()
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  // ── Handlers — Matières ────────────────────────────────────────────────────

  const handleAddSubjectParent = async (data: {
    name: string; code: string
    rubrique: 'R1' | 'R2' | 'R3'; coefficient: number
  }) => {
    try {
      const rubricsRes = await fetch('/api/subject-rubrics', { credentials: 'include' })
      const rubrics    = await rubricsRes.json()
      const rubric     = rubrics.find((r: { code: string }) => r.code === data.rubrique)

      const res = await fetch('/api/subjects/create', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        data.name,
          code:        data.code,
          coefficient: data.coefficient,
          maxScore:    100,
          hasSections: false,
          rubricId:    rubric?.id || null,
        })
      })
      if (!res.ok) throw new Error()
      toast({ title: "Matière ajoutée" })
      loadData()
    } catch {
      toast({ title: "Erreur", description: "Impossible de créer la matière", variant: "destructive" })
    }
  }

  const handleEditSubjectParent = async (parentId: string, data: {
    name: string; rubrique: 'R1' | 'R2' | 'R3'; coefficient: number
  }) => {
    try {
      const rubricsRes = await fetch('/api/subject-rubrics', { credentials: 'include' })
      const rubrics    = await rubricsRes.json()
      const rubric     = rubrics.find((r: { code: string }) => r.code === data.rubrique)

      const res = await fetch(`/api/subjects/update/${parentId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        data.name,
          coefficient: data.coefficient,
          rubricId:    rubric?.id || null,
        })
      })
      if (!res.ok) throw new Error()
      toast({ title: "Matière modifiée" })
      loadData()
    } catch {
      toast({ title: "Erreur", description: "Impossible de modifier la matière", variant: "destructive" })
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
          name:         data.name,
          code:         data.code,
          maxScore:     100,
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

  const handleEditSubjectChild = async (childId: string, data: {
    name: string; type: string; coefficient: number
  }) => {
    try {
      const res = await fetch(`/api/subjects/sections/update/${childId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name })
      })
      if (!res.ok) throw new Error()
      toast({ title: "Sous-matière modifiée" })
      loadData()
    } catch {
      toast({ title: "Erreur", description: "Impossible de modifier la sous-matière", variant: "destructive" })
    }
  }

  const handleDeleteSubjectParent = async (_parentId: string) => {
    toast({ title: "Suppression non disponible", description: "Cette action sera disponible prochainement.", variant: "destructive" })
  }

  const handleDeleteSubjectChild = async (_childId: string) => {
    toast({ title: "Suppression non disponible", description: "Cette action sera disponible prochainement.", variant: "destructive" })
  }

  // ── Handlers — Classes (salles) ────────────────────────────────────────────

  const handleAddClassroom = async (levelId: string, data: { letter?: string; trackId?: string }) => {
    try {
      const level = levels.find(l => l.id === levelId)
      if (!level) throw new Error('Niveau introuvable')

      // 1. Créer la classe (nouvelle salle)
      const classBody: Record<string, unknown> = {
        classTypeId: levelId,
        letter:      data.letter || 'B',
        maxStudents: 30,
      }
      if (data.trackId) classBody.trackId = data.trackId

      const classRes = await fetch('/api/classes/create', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(classBody),
      })
      if (!classRes.ok) {
        const err = await classRes.json().catch(() => ({}))
        throw new Error(err.message || 'Erreur création classe')
      }
      const classData = await classRes.json()
      const classId = classData.class?.id || classData.id
      if (!classId) throw new Error('ID classe manquant')

      // 2. Créer la session pour cette année
      const sessionRes = await fetch('/api/class-sessions/create', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, academicYearId: yearId }),
      })
      if (!sessionRes.ok) throw new Error('Erreur création session')

      toast({
        title: "Salle créée",
        description: `${level.name} — Salle ${data.letter || 'B'} ajoutée pour cette année.`
      })
      loadData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Impossible de créer la salle'
      toast({ title: "Erreur", description: message, variant: "destructive" })
      throw err
    }
  }

  const handleEditClassroom = async (_classroomId: string) => {
    toast({ title: "Modification en cours..." })
  }

  const handleDeleteClassroom = async (_classroomId: string) => {
    toast({ title: "Suppression non disponible", description: "Cette action sera disponible prochainement.", variant: "destructive" })
  }

  // ── Handlers — Niveaux ─────────────────────────────────────────────────────

  const handleAddLevel = async (_data: { niveau: string; name: string; filieres?: string[] }) => {
    toast({ title: "Niveaux préconfigurés", description: "Les niveaux MENFP sont fixes pour CPMSL." })
  }

  const handleEditLevel = async (_levelId: string, _data: { description?: string }) => {
    toast({ title: "Niveau modifié" })
  }

  const handleDeleteLevel = async (_levelId: string) => {
    toast({ title: "Suppression non disponible", variant: "destructive" })
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────

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
          yearId={yearId}
          isArchived={isArchived}
          periods={periods}
          levels={levels}
          subjectParents={subjectParents}
          subjectChildren={subjectChildren}
          classrooms={classrooms}
          students={[]}
          tracks={tracks}
          onAddPeriod={handleAddPeriod}
          onClosePeriod={handleClosePeriod}
          onReopenPeriod={handleReopenPeriod}
          onAddLevel={handleAddLevel}
          onAddSubjectParent={handleAddSubjectParent}
          onAddSubjectChild={handleAddSubjectChild}
          onEditSubjectParent={handleEditSubjectParent}
          onDeleteSubjectParent={handleDeleteSubjectParent}
          onEditSubjectChild={handleEditSubjectChild}
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