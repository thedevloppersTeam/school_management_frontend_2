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
  type AcademicYearStep
} from "@/lib/api/dashboard"

// ── Types locaux (format attendu par CPMSLYearConfigTabs) ─────────────────────

type Rubique = 'R1' | 'R2' | 'R3'

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
  rubrique: Rubique
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

function deriveStepStatus(step: AcademicYearStep): 'open' | 'closed' {
  return step.isCurrent ? 'open' : 'closed'
}

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

  const [year,            setYear]            = useState<AcademicYear | null>(null)
  const [periods,         setPeriods]         = useState<Period[]>([])
  const [levels,          setLevels]          = useState<Level[]>([])
  const [classrooms,      setClassrooms]      = useState<Classroom[]>([])
  const [subjectParents,  setSubjectParents]  = useState<SubjectParent[]>([])
  const [subjectChildren, setSubjectChildren] = useState<SubjectChild[]>([])
  const [tracks,          setTracks]          = useState<Array<{ id: string; code: string; name: string }>>([])
  const [loading,         setLoading]         = useState(true)
  const [notFound,        setNotFound]        = useState(false)

  // ── Chargement ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Année scolaire
      const yearRes = await fetch(`/api/academic-years/${yearId}`, { credentials: 'include' })
      if (!yearRes.ok) { setNotFound(true); return }
      const yearData: AcademicYear = await yearRes.json()
      setYear(yearData)

      // 2. Étapes → periods
      const stepsData = await fetchSteps(yearId)
        setPeriods(stepsData.map(s => ({
        id:     s.id,
        name:   s.name,
        status: deriveStepStatus(s)
      })))

      // 3. Sessions de classe → classrooms
      // FIX W1-06 : NS3/NS4 utilisent la filière comme label (pas la lettre)
      const sessionsData = await fetchClassSessions(yearId)
      setClassrooms(sessionsData.map(s => {
        const name = s.class.track
          ? `${s.class.classType.name} ${s.class.track.code}`   // NS3 LLA ✅
          : `${s.class.classType.name} ${s.class.letter}`       // 7e A   ✅
        return {
          id:       s.id,
          name,
          levelId:  s.class.classType.id,
          capacity: 30
        }
      }))

      // 4. Types de classe → levels
      const typesRes = await fetch('/api/class-types', { credentials: 'include' })
      if (typesRes.ok) {
        const types = await typesRes.json()
        setLevels(types.map((t: { id: string; name: string; isTerminal: boolean }) => {
          let category: Level['category'] = 'fondamental'
          if (t.name === 'NS3' || t.name === 'NS4') category = 'ns-filiere'
          else if (t.name === 'NS1' || t.name === 'NS2') category = 'ns-tronc'
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

      // 5. Matières + rubriques → subjectParents
      const subjectsRes = await fetch('/api/subjects',        { credentials: 'include' })
      const rubricsRes  = await fetch('/api/subject-rubrics', { credentials: 'include' })

      if (subjectsRes.ok && rubricsRes.ok) {
        const subjects = await subjectsRes.json()
        const rubrics  = await rubricsRes.json()

        const rubricMap: Record<string, Rubique> = {}
        rubrics.forEach((r: { id: string; code: string }) => {
          if (r.code === 'R1' || r.code === 'R2' || r.code === 'R3') {
            rubricMap[r.id] = r.code
          }
        })

        const parents: SubjectParent[] = subjects.map((s: {
          id: string; code: string; name: string
          rubricId?: string; coefficient: number
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
              } catch { /* ignorer erreurs par section */ }
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
          name:       data.name,
          stepNumber: periods.length + 1,
          startDate:  data.startDate || undefined,
          endDate:    data.endDate   || undefined,
        })
      })
      if (!res.ok) throw new Error(`Échec création étape`)
      toast({ title: "Étape créée", description: `${data.name} configurée.` })
      await loadData()
    } catch {
      toast({ title: "Erreur", description: "Impossible de créer l'étape", variant: "destructive" })
    }
  }

  const handleClosePeriod = async (periodId: string) => {
    try {
      const res = await fetch(`/api/academic-years/steps/disable/${periodId}`, {
        credentials: 'include'
      })
      if (!res.ok) throw new Error(`Échec clôture`)
      toast({ title: "Étape clôturée" })
      await loadData()
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  // FIX W1-05 : logging + await loadData + message d'erreur explicite
  const handleReopenPeriod = async (periodId: string) => {
    try {
      const res = await fetch(`/api/academic-years/steps/enable/${periodId}`, {
        credentials: 'include'
      })
      const body = await res.json().catch(() => null)
      console.log('[reopen] status:', res.status, 'body:', body)
      if (!res.ok) throw new Error(body?.message || `Erreur ${res.status}`)
      toast({ title: "Étape réouverte", description: "La saisie de notes est débloquée." })
      await loadData()
    } catch (err) {
  const message = err instanceof Error ? err.message : ''
  //console.error('[reopen] échec:', message)

  if (message.toLowerCase().includes('current step already exists')) {
    toast({
      title: "Une seule étape active à la fois",
      description: "Clôturez l'étape actuellement ouverte avant de réouvrir celle-ci.",
    })
  } else {
    toast({ title: "Erreur réouverture", description: message, variant: "destructive" })
  }
}
}

  // ── Handlers — Matières ────────────────────────────────────────────────────

  const handleAddSubjectParent = async (data: {
    name: string; code: string; rubrique: Rubique; coefficient: number
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
      if (!res.ok) throw new Error('Échec création matière')
      toast({ title: "Matière ajoutée" })
      await loadData()
    } catch {
      toast({ title: "Erreur", description: "Impossible de créer la matière", variant: "destructive" })
    }
  }

  const handleEditSubjectParent = async (parentId: string, data: {
    name: string; rubrique: Rubique; coefficient: number
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
      if (!res.ok) throw new Error('Échec mise à jour matière')
      toast({ title: "Matière modifiée" })
      await loadData()
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
      if (!res.ok) throw new Error('Échec création sous-matière')
      toast({ title: "Sous-matière ajoutée" })
      await loadData()
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
      if (!res.ok) throw new Error('Échec mise à jour sous-matière')
      toast({ title: "Sous-matière modifiée" })
      await loadData()
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

  // ── Handlers — Classes ─────────────────────────────────────────────────────

  const handleAddClassroom = async (levelId: string, data: { letter?: string; trackId?: string }) => {
    try {
      const level = levels.find(l => l.id === levelId)
      if (!level) throw new Error('Niveau introuvable')

      const classBody: Record<string, unknown> = {
        classTypeId: levelId,
        letter:      data.letter || 'A',
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

      const sessionRes = await fetch('/api/class-sessions/create', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, academicYearId: yearId }),
      })
      if (!sessionRes.ok) throw new Error('Erreur création session')

      toast({ title: "Classe créée", description: `${level.name} ajoutée pour cette année.` })
      await loadData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Impossible de créer la classe'
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
      <div className="space-y-8">
        <div className="space-y-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-80" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-[500px] w-full rounded-xl" />
      </div>
    )
  }

  if (notFound || !year) {
    return (
      <div className="p-8 text-destructive">
        Année académique introuvable.
      </div>
    )
  }

  const isArchived = deriveYearStatus(year) === 'archived'

  return (
    <div className="space-y-6">
        <div>
          <Link
            href="/admin/academic-years"
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Années Scolaires
          </Link>

          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Configuration — {year.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
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
  )
}