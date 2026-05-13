"use client"

import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import * as React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { PlusIcon, SearchIcon, LockIcon, UnlockIcon, ChevronDownIcon, ChevronRightIcon, CheckIcon, BookOpenIcon } from "lucide-react"
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { ClosePeriodModal } from "@/components/school/close-period-modal"
import { ReopenPeriodModalV2 } from "@/components/school/reopen-period-modal-v2"
import { CreatePeriodModalV2 } from "@/components/school/create-period-modal-v2"
import { AddClassSessionModal } from "@/components/school/add-class-session-modal"
import { DeleteClassroomModal } from "@/components/school/delete-classroom-modal"
import { EditClassroomModal } from "@/components/school/edit-classroom-modal"
import { CreateLevelModalV2 } from "@/components/school/create-level-modal-v2"
import { EditLevelModal } from "@/components/school/edit-level-modal"
import { DeleteLevelModal } from "@/components/school/delete-level-modal"
import { CreateSubjectParentModal } from "@/components/school/create-subject-parent-modal"
import { AddSubjectChildModal } from "@/components/school/add-subject-child-modal"
import { EditSubjectParentModal } from "@/components/school/edit-subject-parent-modal"
import { DeleteSubjectParentModal } from "@/components/school/delete-subject-parent-modal"
import { EditSubjectChildModal } from "@/components/school/edit-subject-child-modal"
import { DeleteSubjectChildModal } from "@/components/school/delete-subject-child-modal"
import { toMessage } from '@/lib/errors'
import {
  computeClassroomStatuses,
  type ClassroomStatus,
} from '@/lib/api/close-readiness'

interface Period { id: string; name: string; status: 'open' | 'closed' }
interface Track { id: string; code: string; name: string }
interface Level { id: string; name: string; niveau: string; filiere?: string; description?: string; category?: 'fondamental' | 'ns-tronc' | 'ns-filiere' }
interface Classroom { id: string; name: string; levelId: string; capacity: number; description?: string }
interface Student { id: string; classroomId: string; levelId: string }
interface SubjectParent { id: string; code: string; name: string; rubrique: 'R1' | 'R2' | 'R3'; coefficient: number }
interface SubjectChild { id: string; code: string; parentId: string; name: string; type: 'L' | 'C' | 'N' | 'P' | 'T'; coefficient: number }

interface CPMSLYearConfigTabsProps {
  yearName: string
  yearId: string
  isArchived?: boolean
  periods: Period[]
  levels: Level[]
  subjectParents: SubjectParent[]
  subjectChildren: SubjectChild[]
  classrooms: Classroom[]
  students: Student[]
  tracks?: Track[]
  onAddPeriod?: (data: { name: string; type: 'normal' | 'blanc'; startDate: string; endDate: string; description?: string }) => void
  onClosePeriod?: (periodId: string) => void
  onReopenPeriod?: (periodId: string, reason: string) => void
  onAddLevel?: (data: { niveau: 'Fondamentale' | 'Nouveau Secondaire'; name: string; filieres?: string[]; description?: string }) => void
  onAddSubjectParent?: (data: { name: string; code: string; rubrique: 'R1' | 'R2' | 'R3'; coefficient: number }) => void
  onAddSubjectChild?: (parentId: string, data: { name: string; code: string; type: 'L' | 'C' | 'N' | 'P' | 'T'; coefficient: number }) => void
  onEditSubjectParent?: (parentId: string, data: { name: string; rubrique: 'R1' | 'R2' | 'R3'; coefficient: number }) => void
  onDeleteSubjectParent?: (parentId: string) => void
  onEditSubjectChild?: (childId: string, data: { name: string; type: 'L' | 'C' | 'N' | 'P' | 'T'; coefficient: number }) => void
  onDeleteSubjectChild?: (childId: string) => void
  onAddClassroom?: (levelId: string, data: { letter?: string; trackId?: string }) => void
  onEditClassroom?: (classroomId: string) => void
  onDeleteClassroom?: (classroomId: string) => void
  onEditLevel?: (levelId: string, data: { description?: string }) => void
  onDeleteLevel?: (levelId: string) => void
}

export function CPMSLYearConfigTabs({
  yearName, yearId, isArchived,
  periods, levels, subjectParents, subjectChildren, classrooms, students, tracks = [],
  onAddPeriod, onClosePeriod, onReopenPeriod, onAddLevel,
  onAddSubjectParent, onAddSubjectChild, onEditSubjectParent, onDeleteSubjectParent,
  onEditSubjectChild, onDeleteSubjectChild,
  onAddClassroom, onEditClassroom, onDeleteClassroom, onEditLevel, onDeleteLevel
}: CPMSLYearConfigTabsProps) {

  const { toast } = useToast()

  const [searchClass, setSearchClass]           = useState("")
  const [searchSubject, setSearchSubject]       = useState("")
  const [expandedLevels, setExpandedLevels]     = useState<Set<string>>(new Set())
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set(['1']))

  // ── Modaux périodes ───────────────────────────────────────────────────────
  const [closePeriodModalOpen, setClosePeriodModalOpen]   = useState(false)
  const [reopenPeriodModalOpen, setReopenPeriodModalOpen] = useState(false)
  const [createPeriodModalOpen, setCreatePeriodModalOpen] = useState(false)
  const [selectedPeriod, setSelectedPeriod]               = useState<Period | null>(null)
// WF-001 : état pour le calcul asynchrone des statuts
  const [closeReadiness, setCloseReadiness]   = useState<ClassroomStatus[]>([])
  const [readinessLoading, setReadinessLoading] = useState(false)


  // ── Modaux classes ────────────────────────────────────────────────────────
  const [addClassroomModalOpen, setAddClassroomModalOpen]       = useState(false)
  const [addClassroomSubmitting, setAddClassroomSubmitting]     = useState(false)
  const [deleteClassroomModalOpen, setDeleteClassroomModalOpen] = useState(false)
  const [editClassroomModalOpen, setEditClassroomModalOpen]     = useState(false)
  const [createLevelModalOpen, setCreateLevelModalOpen]         = useState(false)
  const [editLevelModalOpen, setEditLevelModalOpen]             = useState(false)
  const [deleteLevelModalOpen, setDeleteLevelModalOpen]         = useState(false)
  const [selectedLevel, setSelectedLevel]                       = useState<Level | null>(null)
  const [selectedClassroom, setSelectedClassroom]               = useState<Classroom | null>(null)

  // ── Modaux matières ───────────────────────────────────────────────────────
  const [createSubjectParentModalOpen, setCreateSubjectParentModalOpen] = useState(false)
  const [addSubjectChildModalOpen, setAddSubjectChildModalOpen]         = useState(false)
  const [editSubjectParentModalOpen, setEditSubjectParentModalOpen]     = useState(false)
  const [deleteSubjectParentModalOpen, setDeleteSubjectParentModalOpen] = useState(false)
  const [editSubjectChildModalOpen, setEditSubjectChildModalOpen]       = useState(false)
  const [deleteSubjectChildModalOpen, setDeleteSubjectChildModalOpen]   = useState(false)
  const [selectedSubjectParent, setSelectedSubjectParent] = useState<SubjectParent | null>(null)
  const [selectedSubjectChild, setSelectedSubjectChild]   = useState<SubjectChild | null>(null)

  // ── Affectation matières ──────────────────────────────────────────────────
  const [selectedSessionForAssign, setSelectedSessionForAssign] = useState("")
  const [classSubjects, setClassSubjects] = useState<Array<{
    id: string; subjectId: string; subjectName: string; subjectCode: string
    rubriqueCode?: string; coefficient: number; coefficientOverride: number | null
  }>>([])
  const [loadingClassSubjects, setLoadingClassSubjects] = useState(false)

  // ── Modal assignation ─────────────────────────────────────────────────────
  const [assignModalOpen, setAssignModalOpen]                 = useState(false)
  const [assignSessionId, setAssignSessionId]                 = useState('')
  const [assignSelectedSubjectIds, setAssignSelectedSubjectIds] = useState<Set<string>>(new Set())
  const [assignSubjectOverrides, setAssignSubjectOverrides]   = useState<Map<string, string>>(new Map())
  const [assignAlreadyAssigned, setAssignAlreadyAssigned]     = useState<Set<string>>(new Set())
  const [assignSubjectSearch, setAssignSubjectSearch]         = useState('')
  const [assignLoadingExisting, setAssignLoadingExisting]     = useState(false)
  const [assignSubmitting, setAssignSubmitting]               = useState(false)
  const [assignError, setAssignError]                         = useState('')

  // ── Modal edit coefficient override ──────────────────────────────────────
  const [editCoeffModalOpen, setEditCoeffModalOpen]           = useState(false)
  const [editCoeffClassSubject, setEditCoeffClassSubject]     = useState<{
    id: string; subjectName: string; coefficient: number; coefficientOverride: number | null
  } | null>(null)
  const [editCoeffValue, setEditCoeffValue]                   = useState('')
  const [editCoeffSubmitting, setEditCoeffSubmitting]         = useState(false)

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getClassroomsForLevel        = (levelId: string) => classrooms.filter(c => c.levelId === levelId)
  const getStudentCountForClassroom  = (classroomId: string) => students.filter(s => s.classroomId === classroomId).length
  const getTotalStudentCountForLevel = (levelId: string) => students.filter(s => s.levelId === levelId).length
  const totalClassrooms = classrooms.length
  const r1Count = subjectParents.filter(s => s.rubrique === 'R1').length
  const r2Count = subjectParents.filter(s => s.rubrique === 'R2').length
  const r3Count = subjectParents.filter(s => s.rubrique === 'R3').length

  const toggleLevelExpansion = (levelId: string) => {
    setExpandedLevels(prev => { const n = new Set(prev); n.has(levelId) ? n.delete(levelId) : n.add(levelId); return n })
  }
  const toggleSubjectExpansion = (subjectId: string) => {
    setExpandedSubjects(prev => { const n = new Set(prev); n.has(subjectId) ? n.delete(subjectId) : n.add(subjectId); return n })
  }


  // ── Handlers périodes ─────────────────────────────────────────────────────
  const handleClosePeriod = async (p: Period) => {
  // Ouvre le modal immédiatement avec un état de chargement
  setSelectedPeriod(p)
  setCloseReadiness([])
  setReadinessLoading(true)
  setClosePeriodModalOpen(true)

  // Calcul asynchrone du vrai statut
  try {
    const statuses = await computeClassroomStatuses(
      classrooms,
      levels,
      p.id
    )
    setCloseReadiness(statuses)
  } catch (err) {
    console.error('[close-readiness]', err)
    toast({
      title: "Erreur",
      description: toMessage(err, "lors du calcul de l'état de clôture"),
      variant: "destructive",
    })
    // On laisse closeReadiness vide → le modal affichera 0 partout,
    // le typed-name protège quand même contre une clôture accidentelle.
  } finally {
    setReadinessLoading(false)
  }
}
  const handleReopenPeriod = (p: Period) => { setSelectedPeriod(p); setReopenPeriodModalOpen(true) }

  // ── Handlers classes ──────────────────────────────────────────────────────
  const handleAddClassroom    = (l: Level) => { setSelectedLevel(l); setAddClassroomModalOpen(true) }
  const handleEditClassroom   = (c: Classroom, l: Level) => { setSelectedClassroom(c); setSelectedLevel(l); setEditClassroomModalOpen(true) }
  const handleDeleteClassroom = (c: Classroom, l: Level) => { setSelectedClassroom(c); setSelectedLevel(l); setDeleteClassroomModalOpen(true) }
  const handleEditLevel       = (l: Level) => { setSelectedLevel(l); setEditLevelModalOpen(true) }
  const handleDeleteLevel     = (l: Level) => { setSelectedLevel(l); setDeleteLevelModalOpen(true) }

  // ── Handlers matières ─────────────────────────────────────────────────────
  const handleAddSubjectChild     = (p: SubjectParent) => { setSelectedSubjectParent(p); setAddSubjectChildModalOpen(true) }
  const handleEditSubjectParent   = (p: SubjectParent) => { setSelectedSubjectParent(p); setEditSubjectParentModalOpen(true) }
  const handleDeleteSubjectParent = (p: SubjectParent) => { setSelectedSubjectParent(p); setDeleteSubjectParentModalOpen(true) }
  const handleEditSubjectChild    = (c: SubjectChild)  => { setSelectedSubjectChild(c); setEditSubjectChildModalOpen(true) }
  const handleDeleteSubjectChild  = (c: SubjectChild)  => { setSelectedSubjectChild(c); setDeleteSubjectChildModalOpen(true) }

  // ── Chargement matières d'une classe ──────────────────────────────────────
const loadClassSubjects = async (sessionId: string) => {
  setLoadingClassSubjects(true)
  try {
    const res = await fetch(`/api/class-subjects?classSessionId=${sessionId}`, { credentials: 'include' })
    if (!res.ok) throw new Error(`Échec du chargement (HTTP ${res.status})`)
    const data = await res.json()
    setClassSubjects(data.map((cs: any) => ({
      id:                  cs.id,
      subjectId:           cs.subjectId,
      subjectName:         cs.subject?.name || '—',
      subjectCode:         cs.subject?.code || '—',
      rubriqueCode:        cs.subject?.rubric?.code,
      coefficient:         Number(cs.subject?.coefficient?.d?.[0] ?? cs.subject?.coefficient) || 1,
      coefficientOverride: cs.coefficientOverride != null
        ? Number(cs.coefficientOverride?.d?.[0] ?? cs.coefficientOverride)
        : null,
    })))
  } catch (err) {
    console.error('[affectation] erreur chargement class-subjects:', err)
    toast({
      title: "Erreur",
      description: toMessage(err, "lors du chargement des matières de la classe"),
      variant: "destructive",
    })
    setClassSubjects([])  // vider la liste au lieu d'afficher de l'obsolète
  } finally {
    setLoadingClassSubjects(false)
  }
}

  const handleSessionChangeForAssign = (sessionId: string) => {
    setSelectedSessionForAssign(sessionId)
    if (sessionId) loadClassSubjects(sessionId)
    else setClassSubjects([])
  }

  // ── Modal edit coefficient override ──────────────────────────────────────
const openEditCoeffModal = (cs: typeof classSubjects[0]) => {
  setEditCoeffClassSubject({
    id:                  cs.id,
    subjectName:         cs.subjectName,
    coefficient:         cs.coefficient,
    coefficientOverride: cs.coefficientOverride ?? null,  // ← undefined → null
  })
  setEditCoeffValue(cs.coefficientOverride != null ? String(cs.coefficientOverride) : '')
  setEditCoeffModalOpen(true)
}

  const handleSaveCoeffOverride = async () => {
    if (!editCoeffClassSubject) return
    setEditCoeffSubmitting(true)
    try {
      const res = await fetch(`/api/class-subjects/update/${editCoeffClassSubject.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coefficientOverride: editCoeffValue !== '' ? parseFloat(editCoeffValue) : null
        })
      })
      if (!res.ok) throw new Error(`Échec de la mise à jour (HTTP ${res.status})`)
toast({ title: "Coefficient modifié" })
// ...
} catch (err) {
  console.error('[coeff-override]', err)
  toast({
    title: "Erreur",
    description: toMessage(err, "lors de la modification du coefficient"),
    variant: "destructive",
  })
} finally {
      setEditCoeffSubmitting(false)
    }
  }

  // ── Modal assignation ─────────────────────────────────────────────────────
  const loadAssignedSubjectsForSession = async (sessionId: string) => {
    setAssignLoadingExisting(true)
    try {
      const res = await fetch(`/api/class-subjects?classSessionId=${sessionId}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Échec du chargement')
      const data = await res.json()
      setAssignAlreadyAssigned(new Set(data.map((cs: { subjectId: string }) => cs.subjectId)))
    } catch {
      setAssignAlreadyAssigned(new Set())
    } finally {
      setAssignLoadingExisting(false)
    }
  }

  const openAssignModal = () => {
    const initialSession = selectedSessionForAssign || ''
    setAssignSessionId(initialSession)
    setAssignSelectedSubjectIds(new Set())
    setAssignSubjectOverrides(new Map())
    setAssignAlreadyAssigned(new Set())
    setAssignSubjectSearch('')
    setAssignError('')
    setAssignModalOpen(true)
    if (initialSession) loadAssignedSubjectsForSession(initialSession)
  }

  const handleAssignSessionChange = (sessionId: string) => {
    setAssignSessionId(sessionId)
    setAssignSelectedSubjectIds(new Set())
    setAssignSubjectOverrides(new Map())
    setAssignAlreadyAssigned(new Set())
    if (sessionId) loadAssignedSubjectsForSession(sessionId)
  }

  const toggleAssignSubject = (subjectId: string) => {
    if (assignAlreadyAssigned.has(subjectId)) return
    setAssignSelectedSubjectIds(prev => {
      const n = new Set(prev)
      if (n.has(subjectId)) {
        n.delete(subjectId)
        setAssignSubjectOverrides(o => {
          const m = new Map(o)
          m.delete(subjectId)
          return m
        })
      } else {
        n.add(subjectId)
      }
      return n
    })
  }

  const setSubjectOverride = (subjectId: string, value: string) => {
    setAssignSubjectOverrides(prev => {
      const m = new Map(prev)
      if (value === '') m.delete(subjectId)
      else m.set(subjectId, value)
      return m
    })
  }

  const toggleSelectAllSubjects = () => {
    const selectableIds = filteredAssignSubjects.filter(s => !assignAlreadyAssigned.has(s.id)).map(s => s.id)
    const allSelected = selectableIds.length > 0 && selectableIds.every(id => assignSelectedSubjectIds.has(id))
    setAssignSelectedSubjectIds(prev => {
      const n = new Set(prev)
      if (allSelected) {
        selectableIds.forEach(id => n.delete(id))
        setAssignSubjectOverrides(o => {
          const m = new Map(o)
          selectableIds.forEach(id => m.delete(id))
          return m
        })
      } else {
        selectableIds.forEach(id => n.add(id))
      }
      return n
    })
  }

  const handleAssignSubjectsToClass = async () => {
    if (!assignSessionId || assignSelectedSubjectIds.size === 0) return
    setAssignSubmitting(true)
    setAssignError('')
    let successCount = 0
    const failures: string[] = []
    try {
      await Promise.all(
        Array.from(assignSelectedSubjectIds).map(async subjectId => {
          const subject = subjectParents.find(s => s.id === subjectId)
          const overrideRaw = assignSubjectOverrides.get(subjectId)
          const override = overrideRaw && overrideRaw.trim() !== '' ? parseFloat(overrideRaw) : null
          const payload = {
            classSessionId:      assignSessionId,
            subjectId,
            teacherId:           null,
            coefficientOverride: override,
          }
          const res = await fetch('/api/class-subjects/create', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          if (!res.ok) {
            if (res.status !== 409) {
              const err = await res.json().catch(() => ({}))
              failures.push(`${subject?.name ?? subjectId} — ${err.message || `HTTP ${res.status}`}`)
            }
            return
          }
          successCount++
        })
      )

      if (successCount > 0) {
        toast({
          title: `${successCount} matière${successCount > 1 ? 's assignées' : ' assignée'}`,
          description: failures.length > 0 ? `${failures.length} échec(s) — voir la console.` : undefined,
        })
      }
      if (failures.length > 0) {
        console.error('[affectation] échecs:', failures)
        if (successCount === 0) {
          setAssignError(failures[0])
          return
        }
      }

      setAssignModalOpen(false)
      if (selectedSessionForAssign === assignSessionId) {
        await loadClassSubjects(assignSessionId)
      } else {
        setSelectedSessionForAssign(assignSessionId)
        await loadClassSubjects(assignSessionId)
      }
    } catch (err) {
      console.error('[affectation] erreur:', err)
      toast({
        title: "Erreur assignation",
        description: toMessage(err, "lors de l'assignation des matières"),
        variant: "destructive",
      })
    } finally {
      setAssignSubmitting(false)
    }
  }

  const filteredLevels = levels.filter(l =>
    l.name.toLowerCase().includes(searchClass.toLowerCase())
  )
  const filteredSubjectParents = subjectParents.filter(s =>
    s.name.toLowerCase().includes(searchSubject.toLowerCase()) ||
    s.code.toLowerCase().includes(searchSubject.toLowerCase())
  )
  const filteredAssignSubjects = subjectParents.filter(s => {
    if (!assignSubjectSearch.trim()) return true
    const q = assignSubjectSearch.toLowerCase()
    return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
  })
  const assignSelectedClass = classrooms.find(c => c.id === assignSessionId)

  return (
    <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E6E3', borderRadius: '10px', overflow: 'hidden' }}>
      <Tabs defaultValue="periods" className="w-full">
        <div style={{ padding: '16px 24px 0 24px' }}>
          <TabsList style={{ backgroundColor: "#F0F4F7", borderRadius: "8px", padding: "4px" }}>
            <TabsTrigger value="periods" className="label-ui data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>
              <span className="data-[state=active]:text-[#3A4A57] text-[#78756F]">Étapes ({periods.length}/5)</span>
            </TabsTrigger>
            <TabsTrigger value="classes" className="label-ui data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>
              <span className="data-[state=active]:text-[#3A4A57] text-[#78756F]">Classes ({levels.length})</span>
            </TabsTrigger>
            <TabsTrigger value="subjects" className="label-ui data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>
              <span className="data-[state=active]:text-[#3A4A57] text-[#78756F]">Matières ({subjectParents.length})</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Onglet Étapes ── */}
        <TabsContent value="periods" className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span style={{ color: '#5C5955', fontSize: '13px', fontWeight: 500 }}>{periods.length} / 5 étapes configurées</span>
            {!isArchived && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        onClick={() => setCreatePeriodModalOpen(true)}
                        disabled={periods.length >= 5}
                        style={{ backgroundColor: periods.length >= 5 ? '#E8E6E3' : '#5A7085', color: periods.length >= 5 ? '#A8A5A2' : '#FFFFFF', borderRadius: '8px' }}
                      >
                        <PlusIcon className="mr-2 h-4 w-4" />Nouvelle étape
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {periods.length >= 5 && <TooltipContent><p>Maximum 5 étapes par année scolaire</p></TooltipContent>}
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div style={{ border: '1px solid #E8E6E3', borderRadius: '8px', overflow: 'hidden' }}>
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '2px solid #D1D5DB' }}>
                  {['Nom', 'Statut', 'Actions'].map((h, i) => (
                    <th key={h} style={{ color: '#2C4A6E', fontSize: '12px', fontWeight: 700, padding: '12px 16px', textAlign: i === 2 ? 'center' : 'left', width: i === 0 ? '40%' : i === 1 ? '35%' : '25%', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.length === 0 ? (
                  <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: '#78756F', fontSize: '14px' }}>Aucune étape — cliquez sur &quot;Nouvelle étape&quot; pour commencer</td></tr>
                ) : periods.map((period, index) => (
                  <tr key={period.id} style={{ borderTop: index > 0 ? '1px solid #E8E6E3' : 'none', backgroundColor: '#FFFFFF' }} className="hover:bg-[#FAF8F3]">
                    <td style={{ padding: '12px 16px', color: '#1E1A17', fontSize: '14px', fontWeight: 600 }}>{period.name}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {period.status === 'open'
                        ? <div style={{ backgroundColor: '#E8F5EC', color: '#2D7D46', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px' }}><UnlockIcon className="h-3 w-3" />Ouverte</div>
                        : <div style={{ backgroundColor: '#FEF6E0', color: '#C48B1A', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px' }}><LockIcon className="h-3 w-3" />Clôturée</div>
                      }
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {!isArchived && (
                        <button onClick={() => period.status === 'open' ? handleClosePeriod(period) : handleReopenPeriod(period)} style={{ color: '#5A7085', fontSize: '13px', fontWeight: 500 }} className="hover:underline">
                          {period.status === 'open' ? 'Clôturer' : 'Réouvrir'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── Onglet Classes ── */}
        <TabsContent value="classes" className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <span style={{ color: '#5C5955', fontSize: '13px', fontWeight: 500 }}>{levels.length} classes · {totalClassrooms} salles / filières</span>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#A8A5A2' }} />
              <Input placeholder="Rechercher une classe..." value={searchClass} onChange={e => setSearchClass(e.target.value)} style={{ paddingLeft: '36px', border: '1px solid #D1CECC', borderRadius: '8px' }} className="focus:border-[#5A7085] focus:ring-[#5A7085]" />
            </div>
          </div>
          <div style={{ border: '1px solid #E8E6E3', borderRadius: '8px', overflow: 'hidden' }}>
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '2px solid #D1D5DB' }}>
                  <th style={{ color: '#2C4A6E', fontSize: '12px', fontWeight: 700, padding: '12px 16px', width: '4%', textTransform: 'uppercase', letterSpacing: '0.06em' }}></th>
                  <th style={{ color: '#2C4A6E', fontSize: '12px', fontWeight: 700, padding: '12px 16px', textAlign: 'left', width: '12%', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nom</th>
                  <th style={{ color: '#2C4A6E', fontSize: '12px', fontWeight: 700, padding: '12px 16px', textAlign: 'left', width: '22%', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Niveau</th>
                  <th style={{ color: '#2C4A6E', fontSize: '12px', fontWeight: 700, padding: '12px 16px', textAlign: 'left', width: '18%', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Groupes</th>
                  <th style={{ color: '#2C4A6E', fontSize: '12px', fontWeight: 700, padding: '12px 16px', textAlign: 'left', width: '18%', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Élèves</th>
                  <th style={{ color: '#2C4A6E', fontSize: '12px', fontWeight: 700, padding: '12px 16px', textAlign: 'center', width: '26%', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLevels.map((level, levelIndex) => {
                  const levelClassrooms = getClassroomsForLevel(level.id)
                  const isExpanded = expandedLevels.has(level.id)
                  const hasClassrooms = levelClassrooms.length > 0
                  const totalStudents = getTotalStudentCountForLevel(level.id)
                  const isFiliere = level.category === 'ns-filiere'
                  return (
                    <React.Fragment key={`level-${level.id}`}>
                      <tr style={{ borderTop: levelIndex > 0 ? '1px solid #E8E6E3' : 'none', backgroundColor: '#FFFFFF' }} className="hover:bg-[#FAF8F3]">
                        <td style={{ padding: '12px 16px' }}>
                          {hasClassrooms && (
                            <button onClick={() => toggleLevelExpansion(level.id)} style={{ color: '#5A7085', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="hover:bg-[#E8E6E3] rounded p-1">
                              {isExpanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                            </button>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#1E1A17', fontSize: '14px', fontWeight: 600 }}>{level.name}</td>
                        <td style={{ padding: '12px 16px', color: '#5C5955', fontSize: '14px' }}>{level.niveau}</td>
                        <td style={{ padding: '12px 16px', color: '#5C5955', fontSize: '14px' }}>
                          {`${levelClassrooms.length} ${isFiliere ? (levelClassrooms.length === 1 ? 'filière' : 'filières') : (levelClassrooms.length === 1 ? 'salle' : 'salles')}`}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#5C5955', fontSize: '14px' }}>{totalStudents} {totalStudents === 1 ? 'élève' : 'élèves'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {!isArchived && (
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => handleAddClassroom(level)} style={{ color: '#5A7085', fontSize: '13px', fontWeight: 500 }} className="hover:underline flex items-center gap-1">
                                <PlusIcon className="h-3 w-3" />{isFiliere ? 'Ajouter filière' : 'Ajouter salle'}
                              </button>
                              <span style={{ color: '#D1CECC' }}>|</span>
                              <button onClick={() => handleEditLevel(level)} style={{ color: '#5A7085', fontSize: '13px', fontWeight: 500 }} className="hover:underline">Modifier</button>
                              <span style={{ color: '#D1CECC' }}>|</span>
                              <button onClick={() => handleDeleteLevel(level)} style={{ color: '#C84A3D', fontSize: '13px', fontWeight: 500 }} className="hover:underline">Supprimer</button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {isExpanded && levelClassrooms.map(classroom => {
                        const studentCount = getStudentCountForClassroom(classroom.id)
                        return (
                          <tr key={`classroom-${classroom.id}`} style={{ borderTop: '1px solid #E8E6E3', backgroundColor: '#FAFAF8' }} className="hover:bg-[#F5F4F2]">
                            <td style={{ padding: '12px 16px' }}></td>
                            <td style={{ padding: '12px 16px 12px 32px', color: '#1E1A17', fontSize: '14px' }}>
                              <div className="flex items-center gap-2">
                                <span style={{ color: '#A8A5A2' }}>└</span>
                                {isFiliere
                                  ? <div className="flex items-center gap-2"><span style={{ backgroundColor: '#EEF2FF', color: '#3B5998', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>Filière</span><span>{classroom.name}</span></div>
                                  : <div className="flex items-center gap-2"><span style={{ backgroundColor: '#F5F4F2', color: '#5C5955', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>Salle</span><span>{classroom.name}</span></div>
                                }
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px', color: '#78756F', fontSize: '13px' }}>—</td>
                            <td style={{ padding: '12px 16px', color: '#78756F', fontSize: '13px' }}>—</td>
                            <td style={{ padding: '12px 16px', color: '#5C5955', fontSize: '14px' }}>{studentCount} {studentCount === 1 ? 'élève' : 'élèves'}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              {!isArchived && (
                                <div className="flex items-center justify-center gap-2">
                                  <button onClick={() => handleEditClassroom(classroom, level)} style={{ color: '#5C5955', fontSize: '13px', fontWeight: 500 }} className="hover:underline">Modifier</button>
                                  <span style={{ color: '#D1CECC' }}>|</span>
                                  <button onClick={() => handleDeleteClassroom(classroom, level)} style={{ color: '#B91C1C', fontSize: '13px', fontWeight: 500 }} className="hover:underline">Supprimer</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── Onglet Matières ── */}
        <TabsContent value="subjects" className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {[
                { label: `${subjectParents.length} matières`, bg: '#F1F5F9', color: '#2C4A6E' },
                { label: `${subjectChildren.length} sous-matières`, bg: '#F1F5F9', color: '#2C4A6E' },
                { label: `R1: ${r1Count}`, bg: '#E3EFF9', color: '#2B6CB0' },
                { label: `R2: ${r2Count}`, bg: '#E8F5EC', color: '#2D7D46' },
                { label: `R3: ${r3Count}`, bg: '#FAF8F3', color: '#B0A07A' },
              ].map(b => (
                <Badge key={b.label} variant="secondary" style={{ backgroundColor: b.bg, color: b.color, fontSize: '12px', fontWeight: 500, padding: '4px 10px' }}>{b.label}</Badge>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#A8A5A2' }} />
                <Input placeholder="Rechercher une matière..." value={searchSubject} onChange={e => setSearchSubject(e.target.value)} style={{ paddingLeft: '36px', border: '1px solid #D1CECC', borderRadius: '8px' }} className="focus:border-[#5A7085] focus:ring-[#5A7085]" />
              </div>
              {!isArchived && (
                <a href="/admin/settings" style={{ backgroundColor: '#5A7085', color: '#FFFFFF', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                  <PlusIcon className="h-4 w-4" />Gérer les matières
                </a>
              )}
            </div>
          </div>

          <div style={{ border: '1px solid #E8E6E3', borderRadius: '8px', overflow: 'hidden' }}>
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '2px solid #D1D5DB' }}>
                  <th style={{ color: '#2C4A6E', fontSize: '12px', fontWeight: 700, padding: '12px 16px', textAlign: 'left', width: '4%', textTransform: 'uppercase', letterSpacing: '0.06em' }}></th>
                  <th style={{ color: '#2C4A6E', fontSize: '12px', fontWeight: 700, padding: '12px 16px', textAlign: 'left', width: '12%', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Code</th>
                  <th style={{ color: '#2C4A6E', fontSize: '12px', fontWeight: 700, padding: '12px 16px', textAlign: 'left', width: '30%', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nom</th>
                  <th style={{ color: '#2C4A6E', fontSize: '12px', fontWeight: 700, padding: '12px 16px', textAlign: 'left', width: '15%', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rubrique</th>
                  <th style={{ color: '#2C4A6E', fontSize: '12px', fontWeight: 700, padding: '12px 16px', textAlign: 'left', width: '15%', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Coefficient</th>
                  <th style={{ color: '#2C4A6E', fontSize: '12px', fontWeight: 700, padding: '12px 16px', textAlign: 'center', width: '24%', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubjectParents.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#78756F', fontSize: '14px' }}>Aucune matière — utilisez &quot;Gérer les matières&quot; pour en ajouter</td></tr>
                ) : filteredSubjectParents.map((parent, parentIndex) => {
                  const children = subjectChildren.filter(c => c.parentId === parent.id)
                  const isExpanded = expandedSubjects.has(parent.id)
                  const hasChildren = children.length > 0
                  return (
                    <React.Fragment key={parent.id}>
                      <tr style={{ borderTop: parentIndex > 0 ? '1px solid #E8E6E3' : 'none', backgroundColor: '#FFFFFF' }} className="hover:bg-[#FAF8F3]">
                        <td style={{ padding: '12px 16px' }}>
                          {hasChildren && (
                            <button onClick={() => toggleSubjectExpansion(parent.id)} style={{ color: '#5A7085', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="hover:bg-[#E8E6E3] rounded p-1">
                              {isExpanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                            </button>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#1E1A17', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace', textTransform: 'uppercase' }}>{parent.code}</td>
                        <td style={{ padding: '12px 16px', color: '#1E1A17', fontSize: '14px', fontWeight: 600 }}>{parent.name}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <Badge style={{ backgroundColor: parent.rubrique === 'R1' ? '#E3EFF9' : parent.rubrique === 'R2' ? '#E8F5EC' : '#FAF8F3', color: parent.rubrique === 'R1' ? '#2B6CB0' : parent.rubrique === 'R2' ? '#2D7D46' : '#B0A07A', fontSize: '12px', fontWeight: 500 }}>{parent.rubrique}</Badge>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#1E1A17', fontSize: '14px' }}>{parent.coefficient}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div className="flex items-center justify-center gap-2">
                            {!isArchived && (<><button onClick={() => handleAddSubjectChild(parent)} style={{ color: '#2C4A6E', fontSize: '13px', fontWeight: 500 }} className="hover:underline">+ Sous-matière</button><span style={{ color: '#D1CECC' }}>|</span></>)}
                            <button onClick={() => handleEditSubjectParent(parent)} style={{ color: '#5C5955', fontSize: '13px', fontWeight: 500 }} className="hover:underline">Modifier</button>
                            <span style={{ color: '#D1CECC' }}>|</span>
                            <button onClick={() => handleDeleteSubjectParent(parent)} style={{ color: '#B91C1C', fontSize: '13px', fontWeight: 500 }} className="hover:underline">Supprimer</button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && children.map(child => (
                        <tr key={child.id} style={{ borderTop: '1px solid #E8E6E3', backgroundColor: '#FAFAF8' }} className="hover:bg-[#F5F3EF]">
                          <td style={{ padding: '12px 16px' }}></td>
                          <td style={{ padding: '12px 16px 12px 40px', color: '#5C5955', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace', textTransform: 'uppercase' }}>
                            <div className="flex items-center gap-2"><span style={{ color: '#A8A5A2' }}>└</span>{child.code}</div>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#1E1A17', fontSize: '14px' }}>{child.name}</td>
                          <td style={{ padding: '12px 16px' }}></td>
                          <td style={{ padding: '12px 16px', color: '#1E1A17', fontSize: '14px' }}>{child.coefficient}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => handleEditSubjectChild(child)} style={{ color: '#5C5955', fontSize: '13px', fontWeight: 500 }} className="hover:underline">Modifier</button>
                              <span style={{ color: '#D1CECC' }}>|</span>
                              <button onClick={() => handleDeleteSubjectChild(child)} style={{ color: '#B91C1C', fontSize: '13px', fontWeight: 500 }} className="hover:underline">Supprimer</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Affectation aux classes ── */}
          <div style={{ marginTop: '32px', paddingTop: '32px', borderTop: '2px solid #E8E6E3' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: '#2A3740' }}>Affectation aux classes</h3>
                <p style={{ fontSize: '13px', color: '#78756F', marginTop: '2px' }}>Assignez une matière à une ou plusieurs classes de cette année</p>
              </div>
              {!isArchived && subjectParents.length > 0 && classrooms.length > 0 && (
                <button onClick={openAssignModal} style={{ backgroundColor: '#2C4A6E', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                  + Assigner des matières
                </button>
              )}
            </div>

            <div style={{ marginBottom: '16px', maxWidth: '300px' }}>
              <select value={selectedSessionForAssign} onChange={e => handleSessionChangeForAssign(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1CECC', fontSize: '14px', color: '#1E1A17', backgroundColor: 'white' }}>
                <option value="">— Voir les matières d'une classe —</option>
                {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {selectedSessionForAssign && (
              loadingClassSubjects ? (
                <p style={{ fontSize: '13px', color: '#78756F' }}>Chargement...</p>
              ) : (
                <div style={{ border: '1px solid #E8E6E3', borderRadius: '8px', overflow: 'hidden' }}>
                  <table className="w-full">
                    <thead>
                      <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '2px solid #D1D5DB' }}>
                        {['Code', 'Matière', 'Rubrique', 'Coeff. global', 'Coeff. override', 'Actions'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2C4A6E' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {classSubjects.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#78756F', fontSize: '14px' }}>Aucune matière assignée à cette classe</td></tr>
                      ) : classSubjects.map((cs, i) => (
                        <tr key={cs.id} style={{ borderTop: i > 0 ? '1px solid #E8E6E3' : 'none', backgroundColor: 'white' }} className="hover:bg-[#FAF8F3]">
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '12px', fontWeight: 600, color: '#1E1A17', textTransform: 'uppercase' }}>{cs.subjectCode}</td>
                          <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: '#1E1A17' }}>{cs.subjectName}</td>
                          <td style={{ padding: '12px 16px' }}>
                            {cs.rubriqueCode
                              ? <span style={{ backgroundColor: cs.rubriqueCode === 'R1' ? '#E3EFF9' : cs.rubriqueCode === 'R2' ? '#E8F5EC' : '#FAF8F3', color: cs.rubriqueCode === 'R1' ? '#2B6CB0' : cs.rubriqueCode === 'R2' ? '#2D7D46' : '#B0A07A', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700 }}>{cs.rubriqueCode}</span>
                              : <span style={{ color: '#A8A5A2' }}>—</span>}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1E1A17' }}>{cs.coefficient}</td>
                          <td style={{ padding: '12px 16px', fontSize: '14px', color: cs.coefficientOverride ? '#2B6CB0' : '#A8A5A2', fontWeight: cs.coefficientOverride ? 600 : 400 }}>
                            {cs.coefficientOverride ?? '—'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {!isArchived && (
                              <button onClick={() => openEditCoeffModal(cs)} style={{ color: '#5A7085', fontSize: '13px', fontWeight: 500 }} className="hover:underline">
                                Modifier
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {!selectedSessionForAssign && (
              <div style={{ padding: '24px', textAlign: 'center', color: '#78756F', fontSize: '14px', backgroundColor: '#FAFAF8', borderRadius: '8px', border: '1px solid #E8E6E3' }}>
                Sélectionnez une classe pour voir ses matières assignées
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Modal Edit Coefficient Override ── */}
      {editCoeffModalOpen && editCoeffClassSubject && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '28px', width: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 700, color: '#2A3740', marginBottom: '8px' }}>
              Modifier le coefficient
            </h3>
            <p style={{ fontSize: '13px', color: '#78756F', marginBottom: '20px' }}>
              {editCoeffClassSubject.subjectName}
            </p>

            <div style={{ backgroundColor: '#F0F4F7', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
              <p style={{ fontSize: '12px', color: '#78756F', marginBottom: '2px' }}>Coefficient global</p>
              <p style={{ fontSize: '16px', fontWeight: 700, color: '#2A3740' }}>{editCoeffClassSubject.coefficient}</p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#1E1A17', display: 'block', marginBottom: '6px' }}>
                Coefficient override <span style={{ color: '#78756F', fontWeight: 400 }}>(laisser vide = coefficient global)</span>
              </label>
              <input
                type="number" step="0.5"
                value={editCoeffValue}
                onChange={e => setEditCoeffValue(e.target.value)}
                placeholder={String(editCoeffClassSubject.coefficient)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1CECC', fontSize: '14px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setEditCoeffModalOpen(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #D1CECC', backgroundColor: 'white', fontSize: '13px', cursor: 'pointer', color: '#5C5955' }}>
                Annuler
              </button>
              <button
                onClick={handleSaveCoeffOverride}
                disabled={editCoeffSubmitting}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: editCoeffSubmitting ? '#9CA3AF' : '#2C4A6E', color: 'white', fontSize: '13px', fontWeight: 500, cursor: editCoeffSubmitting ? 'not-allowed' : 'pointer' }}
              >
                {editCoeffSubmitting ? 'En cours...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Assignation (classe → matières) ── */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-[640px]">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <BookOpenIcon className="h-5 w-5 text-[#2C4A6E]" />
              Assigner des matières à une classe
            </DialogTitle>
            <DialogDescription>
              Choisissez la classe, puis sélectionnez les matières à lui assigner. Vous pouvez ajuster le coefficient pour chaque matière.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 overflow-hidden px-6 py-4">
            {assignError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {assignError}
              </div>
            )}

            {/* Step 1 — Classe */}
            <div className="space-y-2">
              <Label htmlFor="assign-class" className="text-sm font-semibold">
                Classe <span className="text-destructive">*</span>
              </Label>
              <Select value={assignSessionId} onValueChange={handleAssignSessionChange}>
                <SelectTrigger id="assign-class">
                  <SelectValue placeholder="Sélectionner une classe" />
                </SelectTrigger>
                <SelectContent>
                  {classrooms.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Aucune classe dans cette année</div>
                  ) : (
                    classrooms.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {assignSelectedClass && (
                <p className="text-xs text-muted-foreground">
                  {assignLoadingExisting
                    ? 'Vérification des matières déjà assignées...'
                    : `${assignAlreadyAssigned.size} matière${assignAlreadyAssigned.size > 1 ? 's' : ''} déjà assignée${assignAlreadyAssigned.size > 1 ? 's' : ''} à cette classe`}
                </p>
              )}
            </div>

            {/* Step 2 — Matières */}
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-sm font-semibold">
                  Matières <span className="text-destructive">*</span>{' '}
                  <span className="font-normal text-muted-foreground">
                    ({assignSelectedSubjectIds.size} sélectionnée{assignSelectedSubjectIds.size > 1 ? 's' : ''})
                  </span>
                </Label>
                <button
                  type="button"
                  onClick={toggleSelectAllSubjects}
                  disabled={!assignSessionId || subjectParents.length === 0}
                  className="text-xs font-medium text-[#2C4A6E] hover:underline disabled:text-muted-foreground disabled:no-underline"
                >
                  Tout sélectionner
                </button>
              </div>

              <div className="relative mb-2">
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom ou code..."
                  value={assignSubjectSearch}
                  onChange={e => setAssignSubjectSearch(e.target.value)}
                  className="pl-9"
                  disabled={!assignSessionId}
                />
              </div>

              <ScrollArea className="h-[300px] rounded-md border bg-muted/20">
                {!assignSessionId ? (
                  <div className="flex h-[300px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
                    Choisissez d&apos;abord une classe ci-dessus.
                  </div>
                ) : filteredAssignSubjects.length === 0 ? (
                  <div className="flex h-[300px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
                    Aucune matière ne correspond à votre recherche.
                  </div>
                ) : (
                  <ul className="divide-y divide-border bg-background">
                    {filteredAssignSubjects.map(s => {
                      const isAssigned = assignAlreadyAssigned.has(s.id)
                      const isChecked = assignSelectedSubjectIds.has(s.id)
                      return (
                        <li
                          key={s.id}
                          className={cn(
                            'flex items-start gap-3 px-3 py-2.5 transition-colors',
                            isAssigned && 'opacity-60',
                            !isAssigned && 'hover:bg-muted/40 cursor-pointer',
                            isChecked && !isAssigned && 'bg-[#F0F4F7]'
                          )}
                          onClick={() => toggleAssignSubject(s.id)}
                        >
                          <Checkbox
                            checked={isAssigned || isChecked}
                            disabled={isAssigned}
                            onCheckedChange={() => toggleAssignSubject(s.id)}
                            onClick={e => e.stopPropagation()}
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                                {s.code}
                              </code>
                              <span className="text-sm font-medium text-foreground">{s.name}</span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[10px] font-bold',
                                  s.rubrique === 'R1' && 'border-blue-200 bg-blue-50 text-blue-700',
                                  s.rubrique === 'R2' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                                  s.rubrique === 'R3' && 'border-amber-200 bg-amber-50 text-amber-700',
                                )}
                              >
                                {s.rubrique}
                              </Badge>
                              {isAssigned && (
                                <Badge variant="secondary" className="gap-1 text-[10px]">
                                  <CheckIcon className="h-3 w-3" />
                                  Déjà assignée
                                </Badge>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Coefficient global : <span className="tabular-nums">{s.coefficient}</span>
                            </p>
                            {isChecked && !isAssigned && (
                              <div className="mt-2 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                <Label htmlFor={`coef-${s.id}`} className="text-xs text-muted-foreground">
                                  Coeff. override :
                                </Label>
                                <Input
                                  id={`coef-${s.id}`}
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  value={assignSubjectOverrides.get(s.id) ?? ''}
                                  onChange={e => setSubjectOverride(s.id, e.target.value)}
                                  placeholder={String(s.coefficient)}
                                  className="h-7 w-24 text-xs"
                                />
                                <span className="text-[11px] text-muted-foreground">optionnel</span>
                              </div>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </ScrollArea>
            </div>
          </div>

          <DialogFooter className="border-t bg-muted/30 px-6 py-3">
            <div className="flex w-full items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {assignSelectedClass
                  ? <>Classe : <span className="font-medium text-foreground">{assignSelectedClass.name}</span></>
                  : 'Aucune classe sélectionnée'}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setAssignModalOpen(false)} disabled={assignSubmitting}>
                  Annuler
                </Button>
                <Button
                  size="sm"
                  onClick={handleAssignSubjectsToClass}
                  disabled={assignSubmitting || !assignSessionId || assignSelectedSubjectIds.size === 0}
                  className="bg-[#2C4A6E] text-white hover:bg-[#1F3856]"
                >
                  {assignSubmitting
                    ? 'Assignation...'
                    : `Assigner ${assignSelectedSubjectIds.size > 0 ? `${assignSelectedSubjectIds.size} ` : ''}matière${assignSelectedSubjectIds.size > 1 ? 's' : ''}`}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modaux périodes ── */}
      {selectedPeriod && (
        <>
<ClosePeriodModal
  open={closePeriodModalOpen}
  onOpenChange={setClosePeriodModalOpen}
  periodName={selectedPeriod.name}
  periodId={selectedPeriod.id}
  yearId={yearId}
  classroomStatuses={closeReadiness}
  loading={readinessLoading}
  onConfirm={() => onClosePeriod?.(selectedPeriod.id)}
/>
          <ReopenPeriodModalV2 open={reopenPeriodModalOpen} onOpenChange={setReopenPeriodModalOpen} periodName={selectedPeriod.name} onConfirm={reason => onReopenPeriod?.(selectedPeriod.id, reason)} />
        </>
      )}
      <CreatePeriodModalV2 open={createPeriodModalOpen} onOpenChange={setCreatePeriodModalOpen} existingPeriodsCount={periods.length} onSubmit={data => onAddPeriod?.(data)} />

      {/* ── Modaux classes ── */}
      {selectedLevel && (
        <AddClassSessionModal open={addClassroomModalOpen} onOpenChange={setAddClassroomModalOpen} level={{ id: selectedLevel.id, name: selectedLevel.name, category: selectedLevel.category || 'fondamental' }} tracks={tracks} submitting={addClassroomSubmitting} onSubmit={async data => { setAddClassroomSubmitting(true); onAddClassroom?.(selectedLevel.id, data); setAddClassroomSubmitting(false); setAddClassroomModalOpen(false) }} />
      )}
      {selectedClassroom && selectedLevel && (
        <>
          <EditClassroomModal open={editClassroomModalOpen} onOpenChange={setEditClassroomModalOpen} classroom={selectedClassroom} level={selectedLevel} existingClassrooms={getClassroomsForLevel(selectedLevel.id)} onConfirm={_data => { onEditClassroom?.(selectedClassroom.id); setEditClassroomModalOpen(false) }} />
          <DeleteClassroomModal open={deleteClassroomModalOpen} onOpenChange={setDeleteClassroomModalOpen} classroom={selectedClassroom} level={selectedLevel} studentCount={getStudentCountForClassroom(selectedClassroom.id)} onConfirm={() => { onDeleteClassroom?.(selectedClassroom.id); setDeleteClassroomModalOpen(false) }} />
        </>
      )}
      <CreateLevelModalV2 open={createLevelModalOpen} onOpenChange={setCreateLevelModalOpen} existingLevels={levels} yearName={yearName} onSubmit={data => { onAddLevel?.(data); setCreateLevelModalOpen(false) }} />
      {selectedLevel && (
        <>
          <EditLevelModal open={editLevelModalOpen} onOpenChange={setEditLevelModalOpen} level={selectedLevel} onConfirm={data => { onEditLevel?.(selectedLevel.id, data); setEditLevelModalOpen(false) }} />
          <DeleteLevelModal open={deleteLevelModalOpen} onOpenChange={setDeleteLevelModalOpen} level={selectedLevel} classroomCount={getClassroomsForLevel(selectedLevel.id).length} studentCount={getTotalStudentCountForLevel(selectedLevel.id)} onConfirm={() => { onDeleteLevel?.(selectedLevel.id); setDeleteLevelModalOpen(false) }} />
        </>
      )}

      {/* ── Modaux matières ── */}
      <CreateSubjectParentModal open={createSubjectParentModalOpen} onOpenChange={setCreateSubjectParentModalOpen} yearName={yearName} existingSubjects={subjectParents} onSubmit={data => { onAddSubjectParent?.(data); setCreateSubjectParentModalOpen(false) }} />
      {selectedSubjectParent && (
        <>
          <AddSubjectChildModal open={addSubjectChildModalOpen} onOpenChange={setAddSubjectChildModalOpen} parent={selectedSubjectParent} existingChildren={subjectChildren} onSubmit={data => { onAddSubjectChild?.(selectedSubjectParent.id, data); setAddSubjectChildModalOpen(false) }} />
          <EditSubjectParentModal open={editSubjectParentModalOpen} onOpenChange={setEditSubjectParentModalOpen} subject={selectedSubjectParent} onSubmit={data => { onEditSubjectParent?.(selectedSubjectParent.id, data); setEditSubjectParentModalOpen(false) }} />
          <DeleteSubjectParentModal open={deleteSubjectParentModalOpen} onOpenChange={setDeleteSubjectParentModalOpen} subject={selectedSubjectParent} childCount={subjectChildren.filter(c => c.parentId === selectedSubjectParent.id).length} onConfirm={() => { onDeleteSubjectParent?.(selectedSubjectParent.id); setDeleteSubjectParentModalOpen(false) }} />
        </>
      )}
      {selectedSubjectChild && (
        <>
          <EditSubjectChildModal open={editSubjectChildModalOpen} onOpenChange={setEditSubjectChildModalOpen} child={selectedSubjectChild} parent={subjectParents.find(p => p.id === selectedSubjectChild.parentId)!} existingChildren={subjectChildren} onSubmit={data => { onEditSubjectChild?.(selectedSubjectChild.id, data); setEditSubjectChildModalOpen(false) }} />
         <DeleteSubjectChildModal open={deleteSubjectChildModalOpen} onOpenChange={setDeleteSubjectChildModalOpen} child={selectedSubjectChild} studentCount={0} onConfirm={() => { onDeleteSubjectChild?.(selectedSubjectChild.id); setDeleteSubjectChildModalOpen(false) }} />
        </>
      )}
    </div>
  )
}