"use client"

import { useState } from "react"
import * as React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { PlusIcon, SearchIcon, LockIcon, UnlockIcon, ChevronDownIcon, ChevronRightIcon, PencilIcon, Trash2Icon } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ClosePeriodModal } from "@/components/school/close-period-modal"
import { ReopenPeriodModalV2 } from "@/components/school/reopen-period-modal-v2"
import { CreatePeriodModalV2 } from "@/components/school/create-period-modal-v2"
import { AddClassroomModal } from "@/components/school/add-classroom-modal"
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
  description?: string
}

interface Classroom {
  id: string
  name: string
  levelId: string
  capacity: number
  description?: string
}

interface Student {
  id: string
  classroomId: string
  levelId: string
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
  onAddPeriod?: (data: {
    name: string
    type: 'normal' | 'blanc'
    startDate: string
    endDate: string
    description?: string
  }) => void
  onClosePeriod?: (periodId: string) => void
  onReopenPeriod?: (periodId: string, reason: string) => void
  onAddLevel?: (data: {
    niveau: 'Fondamentale' | 'Nouveau Secondaire'
    name: string
    filieres?: string[]
    description?: string
  }) => void
  onAddSubjectParent?: (data: {
    name: string
    code: string
    rubrique: 'R1' | 'R2' | 'R3'
    coefficient: number
  }) => void
  onAddSubjectChild?: (parentId: string, data: {
    name: string
    code: string
    type: 'L' | 'C' | 'N' | 'P' | 'T'
    coefficient: number
  }) => void
  onEditSubjectParent?: (parentId: string, data: {
    name: string
    rubrique: 'R1' | 'R2' | 'R3'
    coefficient: number
  }) => void
  onDeleteSubjectParent?: (parentId: string) => void
  onEditSubjectChild?: (childId: string, data: {
    name: string
    type: 'L' | 'C' | 'N' | 'P' | 'T'
    coefficient: number
  }) => void
  onDeleteSubjectChild?: (childId: string) => void
  onAddClassroom?: (levelId: string) => void
  onEditClassroom?: (classroomId: string) => void
  onDeleteClassroom?: (classroomId: string) => void
  onEditLevel?: (levelId: string, data: { description?: string }) => void
  onDeleteLevel?: (levelId: string) => void
}

export function CPMSLYearConfigTabs({
  yearName,
  yearId,
  isArchived,
  periods,
  levels,
  subjectParents,
  subjectChildren,
  classrooms,
  students,
  onAddPeriod,
  onClosePeriod,
  onReopenPeriod,
  onAddLevel,
  onAddSubjectParent,
  onAddSubjectChild,
  onEditSubjectParent,
  onDeleteSubjectParent,
  onEditSubjectChild,
  onDeleteSubjectChild,
  onAddClassroom,
  onEditClassroom,
  onDeleteClassroom,
  onEditLevel,
  onDeleteLevel
}: CPMSLYearConfigTabsProps) {
  const [searchClass, setSearchClass] = useState("")
  const [searchSubject, setSearchSubject] = useState("")
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set())
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set(['1']))
  const [closePeriodModalOpen, setClosePeriodModalOpen] = useState(false)
  const [reopenPeriodModalOpen, setReopenPeriodModalOpen] = useState(false)
  const [createPeriodModalOpen, setCreatePeriodModalOpen] = useState(false)
  const [addClassroomModalOpen, setAddClassroomModalOpen] = useState(false)
  const [deleteClassroomModalOpen, setDeleteClassroomModalOpen] = useState(false)
  const [editClassroomModalOpen, setEditClassroomModalOpen] = useState(false)
  const [createLevelModalOpen, setCreateLevelModalOpen] = useState(false)
  const [editLevelModalOpen, setEditLevelModalOpen] = useState(false)
  const [deleteLevelModalOpen, setDeleteLevelModalOpen] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null)
  const [selectedLevel, setSelectedLevel] = useState<Level | null>(null)
  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null)
  const [createSubjectParentModalOpen, setCreateSubjectParentModalOpen] = useState(false)
  const [addSubjectChildModalOpen, setAddSubjectChildModalOpen] = useState(false)
  const [editSubjectParentModalOpen, setEditSubjectParentModalOpen] = useState(false)
  const [deleteSubjectParentModalOpen, setDeleteSubjectParentModalOpen] = useState(false)
  const [editSubjectChildModalOpen, setEditSubjectChildModalOpen] = useState(false)
  const [deleteSubjectChildModalOpen, setDeleteSubjectChildModalOpen] = useState(false)
  const [selectedSubjectParent, setSelectedSubjectParent] = useState<SubjectParent | null>(null)
  const [selectedSubjectChild, setSelectedSubjectChild] = useState<SubjectChild | null>(null)

  // ── Affectation des matières ───────────────────────────────────────────────
  const [selectedSessionForAssign, setSelectedSessionForAssign] = useState("")
  const [classSubjects, setClassSubjects] = useState<Array<{
    id: string
    subjectId: string
    subjectName: string
    subjectCode: string
    rubriqueCode?: string
    coefficient: number
    coefficientOverride?: number | null
  }>>([])
  const [loadingClassSubjects, setLoadingClassSubjects] = useState(false)
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [assignForm, setAssignForm] = useState({ subjectId: '', coefficientOverride: '' })
  const [assignSubmitting, setAssignSubmitting] = useState(false)

  const toggleLevelExpansion = (levelId: string) => {
    const newExpanded = new Set(expandedLevels)
    if (newExpanded.has(levelId)) {
      newExpanded.delete(levelId)
    } else {
      newExpanded.add(levelId)
    }
    setExpandedLevels(newExpanded)
  }

  const toggleSubjectExpansion = (subjectId: string) => {
    const newExpanded = new Set(expandedSubjects)
    if (newExpanded.has(subjectId)) {
      newExpanded.delete(subjectId)
    } else {
      newExpanded.add(subjectId)
    }
    setExpandedSubjects(newExpanded)
  }

  // Get classrooms for a specific level
  const getClassroomsForLevel = (levelId: string) => {
    return classrooms.filter(c => c.levelId === levelId)
  }

  // Get student count for a classroom
  const getStudentCountForClassroom = (classroomId: string) => {
    return students.filter(s => s.classroomId === classroomId).length
  }

  // Get total student count for a level (across all classrooms)
  const getTotalStudentCountForLevel = (levelId: string) => {
    return students.filter(s => s.levelId === levelId).length
  }

  // Calculate total classrooms
  const totalClassrooms = classrooms.length

  const r1Count = subjectParents.filter(s => s.rubrique === 'R1').length
  const r2Count = subjectParents.filter(s => s.rubrique === 'R2').length
  const r3Count = subjectParents.filter(s => s.rubrique === 'R3').length

  // Mock classroom grade statuses for close period modal
  const getMockClassroomStatuses = () => [
    {
      className: '7e',
      classroomName: 'Salle A',
      gradesEntered: 24,
      totalGrades: 24,
      status: 'complete' as const
    },
    {
      className: '7e',
      classroomName: 'Salle B',
      gradesEntered: 20,
      totalGrades: 24,
      status: 'incomplete' as const
    },
    {
      className: '8e',
      classroomName: 'Salle A',
      gradesEntered: 24,
      totalGrades: 24,
      status: 'complete' as const
    },
    {
      className: 'NSI',
      classroomName: 'LLA',
      gradesEntered: 0,
      totalGrades: 28,
      status: 'not-started' as const
    }
  ]

  const handleClosePeriod = (period: Period) => {
    setSelectedPeriod(period)
    setClosePeriodModalOpen(true)
  }

  const handleReopenPeriod = (period: Period) => {
    setSelectedPeriod(period)
    setReopenPeriodModalOpen(true)
  }

  const handleAddClassroom = (level: Level) => {
    setSelectedLevel(level)
    setAddClassroomModalOpen(true)
  }

  const handleEditClassroom = (classroom: Classroom, level: Level) => {
    setSelectedClassroom(classroom)
    setSelectedLevel(level)
    setEditClassroomModalOpen(true)
  }

  const handleDeleteClassroom = (classroom: Classroom, level: Level) => {
    setSelectedClassroom(classroom)
    setSelectedLevel(level)
    setDeleteClassroomModalOpen(true)
  }

  const handleEditLevel = (level: Level) => {
    setSelectedLevel(level)
    setEditLevelModalOpen(true)
  }

  const handleDeleteLevel = (level: Level) => {
    setSelectedLevel(level)
    setDeleteLevelModalOpen(true)
  }

  const handleAddSubjectChild = (parent: SubjectParent) => {
    setSelectedSubjectParent(parent)
    setAddSubjectChildModalOpen(true)
  }

  const handleEditSubjectParent = (parent: SubjectParent) => {
    setSelectedSubjectParent(parent)
    setEditSubjectParentModalOpen(true)
  }

  const handleDeleteSubjectParent = (parent: SubjectParent) => {
    setSelectedSubjectParent(parent)
    setDeleteSubjectParentModalOpen(true)
  }

  const handleEditSubjectChild = (child: SubjectChild) => {
    setSelectedSubjectChild(child)
    setEditSubjectChildModalOpen(true)
  }

  const handleDeleteSubjectChild = (child: SubjectChild) => {
    setSelectedSubjectChild(child)
    setDeleteSubjectChildModalOpen(true)
  }

  // ── Handlers Affectation ──────────────────────────────────────────────────

  const loadClassSubjects = async (sessionId: string) => {
    setLoadingClassSubjects(true)
    try {
      const res = await fetch(
        `/api/class-subjects?classSessionId=${sessionId}`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error()
      const data = await res.json()
      setClassSubjects(data.map((cs: {
        id: string
        subjectId: string
        coefficientOverride?: number | null
        subject?: {
          name: string
          code: string
          coefficient: number
          rubric?: { code: string }
        }
      }) => ({
        id: cs.id,
        subjectId: cs.subjectId,
        subjectName: cs.subject?.name || '—',
        subjectCode: cs.subject?.code || '—',
        rubriqueCode: cs.subject?.rubric?.code,
        coefficient: Number(cs.subject?.coefficient) || 1,
        coefficientOverride: cs.coefficientOverride != null ? Number(cs.coefficientOverride) : null,
      })))
    } catch {
      console.error('[affectation] erreur chargement class subjects')
    } finally {
      setLoadingClassSubjects(false)
    }
  }

  const handleSessionChangeForAssign = (sessionId: string) => {
    setSelectedSessionForAssign(sessionId)
    if (sessionId) loadClassSubjects(sessionId)
    else setClassSubjects([])
  }

  const handleAssignSubject = async () => {
    if (!selectedSessionForAssign || !assignForm.subjectId) return
    setAssignSubmitting(true)
    try {
      const res = await fetch('/api/class-subjects/create', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classSessionId: selectedSessionForAssign,
          subjectId: assignForm.subjectId,
          coefficientOverride: assignForm.coefficientOverride
            ? parseFloat(assignForm.coefficientOverride)
            : null,
        })
      })
      if (!res.ok) throw new Error()
      setAssignModalOpen(false)
      setAssignForm({ subjectId: '', coefficientOverride: '' })
      loadClassSubjects(selectedSessionForAssign)
    } catch {
      console.error('[affectation] erreur assignation')
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

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E8E6E3',
        borderRadius: '10px',
        overflow: 'hidden'
      }}
    >
      {/* Tabs */}
      <Tabs defaultValue="periods" className="w-full">
        <div style={{ padding: '16px 24px 0 24px' }}>
          <TabsList style={{ backgroundColor: "#F0F4F7", borderRadius: "8px", padding: "4px" }}>
            <TabsTrigger
              value="periods"
              className="label-ui data-[state=active]:bg-white data-[state=active]:shadow-sm"
              style={{ borderRadius: "6px" }}
            >
              <span className="data-[state=active]:text-[#3A4A57] text-[#78756F]">
                Étapes (4/4)
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="classes"
              className="label-ui data-[state=active]:bg-white data-[state=active]:shadow-sm"
              style={{ borderRadius: "6px" }}
            >
              <span className="data-[state=active]:text-[#3A4A57] text-[#78756F]">
                Classes ({levels.length})
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="subjects"
              className="label-ui data-[state=active]:bg-white data-[state=active]:shadow-sm"
              style={{ borderRadius: "6px" }}
            >
              <span className="data-[state=active]:text-[#3A4A57] text-[#78756F]">
                Matières ({subjectParents.length})
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Onglet Étapes */}
        <TabsContent value="periods" className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span style={{ color: '#5C5955', fontSize: '13px', fontWeight: 500 }}>
              {periods.length} / 4 étapes configurées
            </span>
            {!isArchived && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        onClick={() => setCreatePeriodModalOpen(true)}
                        disabled={periods.length >= 5}
                        style={{
                          backgroundColor: periods.length >= 5 ? '#E8E6E3' : '#5A7085',
                          color: periods.length >= 5 ? '#A8A5A2' : '#FFFFFF',
                          borderRadius: '8px',
                          cursor: periods.length >= 5 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <PlusIcon className="mr-2 h-4 w-4" />
                        Nouvelle étape
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {periods.length >= 5 && (
                    <TooltipContent>
                      <p>Maximum 5 étapes par année scolaire</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          <div
            style={{
              border: '1px solid #E8E6E3',
              borderRadius: '8px',
              overflow: 'hidden'
            }}
          >
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '2px solid #D1D5DB' }}>
                  <th
                    style={{
                      color: '#2C4A6E',
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '12px 16px',
                      textAlign: 'left',
                      width: '40%',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em'
                    }}
                  >
                    Nom
                  </th>
                  <th
                    style={{
                      color: '#2C4A6E',
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '12px 16px',
                      textAlign: 'left',
                      width: '35%',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em'
                    }}
                  >
                    Statut
                  </th>
                  <th
                    style={{
                      color: '#2C4A6E',
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '12px 16px',
                      textAlign: 'center',
                      width: '25%',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em'
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {periods.map((period, index) => (
                  <tr
                    key={period.id}
                    style={{
                      borderTop: index > 0 ? '1px solid #E8E6E3' : 'none',
                      backgroundColor: '#FFFFFF'
                    }}
                    className="hover:bg-[#FAF8F3]"
                  >
                    <td style={{ padding: '12px 16px', color: '#1E1A17', fontSize: '14px', fontWeight: 600 }}>
                      {period.name}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {period.status === 'open' ? (
                        <div
                          style={{
                            backgroundColor: '#E8F5EC',
                            color: '#2D7D46',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 500,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <UnlockIcon className="h-3 w-3" />
                          Ouverte
                        </div>
                      ) : (
                        <div
                          style={{
                            backgroundColor: '#FEF6E0',
                            color: '#C48B1A',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 500,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <LockIcon className="h-3 w-3" />
                          Clôturée
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => period.status === 'open' ? handleClosePeriod(period) : handleReopenPeriod(period)}
                        style={{
                          color: '#5A7085',
                          fontSize: '13px',
                          fontWeight: 500
                        }}
                        className="hover:underline"
                      >
                        {period.status === 'open' ? 'Clôturer' : 'Réouvrir'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Onglet Classes */}
        <TabsContent value="classes" className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <span style={{ color: '#5C5955', fontSize: '13px', fontWeight: 500 }}>
              {levels.length} classes · {totalClassrooms} salles
            </span>
            <div className="flex items-center gap-3">
              <div className="relative">
                <SearchIcon
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: '#A8A5A2' }}
                />
                <Input
                  placeholder="Rechercher une classe..."
                  value={searchClass}
                  onChange={(e) => setSearchClass(e.target.value)}
                  style={{
                    paddingLeft: '36px',
                    border: '1px solid #D1CECC',
                    borderRadius: '8px'
                  }}
                  className="focus:border-[#5A7085] focus:ring-[#5A7085]"
                />
              </div>
              {!isArchived && (
                <Button
                  onClick={() => setCreateLevelModalOpen(true)}
                  style={{
                    backgroundColor: '#5A7085',
                    color: '#FFFFFF',
                    borderRadius: '8px'
                  }}
                >
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Nouvelle classe
                </Button>
              )}
            </div>
          </div>

          <div
            style={{
              border: '1px solid #E8E6E3',
              borderRadius: '8px',
              overflow: 'hidden'
            }}
          >
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '2px solid #D1D5DB' }}>
                  <th
                    style={{
                      color: '#2C4A6E',
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '12px 16px',
                      textAlign: 'left',
                      width: '4%',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em'
                    }}
                  >
                  </th>
                  <th
                    style={{
                      color: '#2C4A6E',
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '12px 16px',
                      textAlign: 'left',
                      width: '12%',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em'
                    }}
                  >
                    Nom
                  </th>
                  <th
                    style={{
                      color: '#2C4A6E',
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '12px 16px',
                      textAlign: 'left',
                      width: '22%',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em'
                    }}
                  >
                    Niveau
                  </th>
                  <th
                    style={{
                      color: '#2C4A6E',
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '12px 16px',
                      textAlign: 'left',
                      width: '18%',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em'
                    }}
                  >
                    Groupes
                  </th>
                  <th
                    style={{
                      color: '#2C4A6E',
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '12px 16px',
                      textAlign: 'left',
                      width: '18%',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em'
                    }}
                  >
                    Élèves
                  </th>
                  <th
                    style={{
                      color: '#2C4A6E',
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '12px 16px',
                      textAlign: 'center',
                      width: '26%',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em'
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLevels.map((level, levelIndex) => {
                  const levelClassrooms = getClassroomsForLevel(level.id)
                  const isExpanded = expandedLevels.has(level.id)
                  const hasClassrooms = levelClassrooms.length > 0
                  const totalStudents = getTotalStudentCountForLevel(level.id)
                  const rowKey = `level-${level.id}`
                  
                  return (
                    <React.Fragment key={rowKey}>
                      {/* Classe Row */}
                      <tr
                        style={{
                          borderTop: levelIndex > 0 ? '1px solid #E8E6E3' : 'none',
                          backgroundColor: '#FFFFFF'
                        }}
                        className="hover:bg-[#FAF8F3]"
                      >
                        <td style={{ padding: '12px 16px' }}>
                          {hasClassrooms && (
                            <button
                              onClick={() => toggleLevelExpansion(level.id)}
                              style={{
                                color: '#5A7085',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              className="hover:bg-[#E8E6E3] rounded p-1"
                            >
                              {isExpanded ? (
                                <ChevronDownIcon className="h-4 w-4" />
                              ) : (
                                <ChevronRightIcon className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#1E1A17', fontSize: '14px', fontWeight: 600 }}>
                          {level.name}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#5C5955', fontSize: '14px' }}>
                          {level.niveau}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#5C5955', fontSize: '14px' }}>
                          {level.niveau === 'Fondamentale' 
                            ? `${levelClassrooms.length} ${levelClassrooms.length === 1 ? 'salle' : 'salles'}`
                            : `${levelClassrooms.length} ${levelClassrooms.length === 1 ? 'filière' : 'filières'}`
                          }
                        </td>
                        <td style={{ padding: '12px 16px', color: '#5C5955', fontSize: '14px', fontWeight: 400 }}>
                          {totalStudents} {totalStudents === 1 ? 'élève' : 'élèves'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {!isArchived && (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleAddClassroom(level)}
                                style={{
                                  color: '#5A7085',
                                  fontSize: '13px',
                                  fontWeight: 500
                                }}
                                className="hover:underline flex items-center gap-1"
                              >
                                <PlusIcon className="h-3 w-3" />
                                {level.niveau === 'Fondamentale' ? 'Ajouter salle' : 'Ajouter filière'}
                              </button>
                              <span style={{ color: '#D1CECC' }}>|</span>
                              <button
                                onClick={() => handleEditLevel(level)}
                                style={{
                                  color: '#5A7085',
                                  fontSize: '13px',
                                  fontWeight: 500
                                }}
                                className="hover:underline"
                              >
                                Modifier
                              </button>
                              <span style={{ color: '#D1CECC' }}>|</span>
                              <button
                                onClick={() => handleDeleteLevel(level)}
                                style={{
                                  color: '#C84A3D',
                                  fontSize: '13px',
                                  fontWeight: 500
                                }}
                                className="hover:underline"
                              >
                                Supprimer
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      
                      {/* Salle Rows (when expanded) */}
                      {isExpanded && levelClassrooms.map((classroom) => {
                        const studentCount = getStudentCountForClassroom(classroom.id)
                        const classroomKey = `classroom-${classroom.id}`
                        
                        return (
                          <tr
                            key={classroomKey}
                            style={{
                              borderTop: '1px solid #E8E6E3',
                              backgroundColor: '#FAFAF8'
                            }}
                            className="hover:bg-[#F5F4F2]"
                          >
                            <td style={{ padding: '12px 16px' }}></td>
                            <td style={{ padding: '12px 16px 12px 32px', color: '#1E1A17', fontSize: '14px' }}>
                              <div className="flex items-center gap-2">
                                <span style={{ color: '#A8A5A2' }}>└</span>
                                {level.niveau === 'Fondamentale' ? (
                                  <div className="flex items-center gap-2">
                                    <span
                                      style={{
                                        backgroundColor: '#F5F4F2',
                                        color: '#5C5955',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: 500,
                                        fontFamily: 'var(--font-sans)'
                                      }}
                                    >
                                      Salle
                                    </span>
                                    <span>{classroom.name}</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span
                                      style={{
                                        backgroundColor: '#EEF2FF',
                                        color: '#3B5998',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: 500,
                                        fontFamily: 'var(--font-sans)'
                                      }}
                                    >
                                      Filière
                                    </span>
                                    <span>{classroom.name}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px', color: '#78756F', fontSize: '13px' }}>
                              —
                            </td>
                            <td style={{ padding: '12px 16px', color: '#78756F', fontSize: '13px' }}>
                              —
                            </td>
                            <td style={{ padding: '12px 16px', color: '#5C5955', fontSize: '14px', fontWeight: 400 }}>
                              {studentCount} {studentCount === 1 ? 'élève' : 'élèves'}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              {!isArchived && (
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleEditClassroom(classroom, level)}
                                    style={{
                                      color: '#5C5955',
                                      fontSize: '13px',
                                      fontWeight: 500
                                    }}
                                    className="hover:underline"
                                  >
                                    Modifier
                                  </button>
                                  <span style={{ color: '#D1CECC' }}>|</span>
                                  <button
                                    onClick={() => handleDeleteClassroom(classroom, level)}
                                    style={{
                                      color: '#B91C1C',
                                      fontSize: '13px',
                                      fontWeight: 500
                                    }}
                                    className="hover:underline"
                                  >
                                    Supprimer
                                  </button>
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

        {/* Onglet Matières */}
        <TabsContent value="subjects" className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                style={{
                  backgroundColor: '#F1F5F9',
                  color: '#2C4A6E',
                  fontSize: '12px',
                  fontWeight: 500,
                  padding: '4px 10px'
                }}
              >
                {subjectParents.length} matières
              </Badge>
              <Badge
                variant="secondary"
                style={{
                  backgroundColor: '#F1F5F9',
                  color: '#2C4A6E',
                  fontSize: '12px',
                  fontWeight: 500,
                  padding: '4px 10px'
                }}
              >
                {subjectChildren.length} sous-matières
              </Badge>
              <Badge
                variant="secondary"
                style={{
                  backgroundColor: '#E3EFF9',
                  color: '#2B6CB0',
                  fontSize: '12px',
                  fontWeight: 500,
                  padding: '4px 10px'
                }}
              >
                R1: {r1Count}
              </Badge>
              <Badge
                variant="secondary"
                style={{
                  backgroundColor: '#E8F5EC',
                  color: '#2D7D46',
                  fontSize: '12px',
                  fontWeight: 500,
                  padding: '4px 10px'
                }}
              >
                R2: {r2Count}
              </Badge>
              <Badge
                variant="secondary"
                style={{
                  backgroundColor: '#FAF8F3',
                  color: '#B0A07A',
                  fontSize: '12px',
                  fontWeight: 500,
                  padding: '4px 10px'
                }}
              >
                R3: {r3Count}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <SearchIcon
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: '#A8A5A2' }}
                />
                <Input
                  placeholder="Rechercher une matière..."
                  value={searchSubject}
                  onChange={(e) => setSearchSubject(e.target.value)}
                  style={{
                    paddingLeft: '36px',
                    border: '1px solid #D1CECC',
                    borderRadius: '8px'
                  }}
                  className="focus:border-[#5A7085] focus:ring-[#5A7085]"
                />
              </div>
              {!isArchived && (
                <a
                  href="/admin/settings"
                  style={{
                    backgroundColor: '#5A7085',
                    color: '#FFFFFF',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    textDecoration: 'none'
                  }}
                >
                  <PlusIcon className="h-4 w-4" />
                  Gérer les matières
                </a>
              )}
            </div>
          </div>

          <div
            style={{
              border: '1px solid #E8E6E3',
              borderRadius: '8px',
              overflow: 'hidden'
            }}
          >
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '2px solid #D1D5DB' }}>
                  <th
                    style={{
                      color: '#2C4A6E',
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '12px 16px',
                      textAlign: 'left',
                      width: '4%',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em'
                    }}
                  >
                  </th>
                  <th
                    style={{
                      color: '#2C4A6E',
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '12px 16px',
                      textAlign: 'left',
                      width: '12%',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em'
                    }}
                  >
                    Code
                  </th>
                  <th
                    style={{
                      color: '#2C4A6E',
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '12px 16px',
                      textAlign: 'left',
                      width: '30%',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em'
                    }}
                  >
                    Nom
                  </th>
                  <th
                    style={{
                      color: '#2C4A6E',
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '12px 16px',
                      textAlign: 'left',
                      width: '15%',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em'
                    }}
                  >
                    Rubrique
                  </th>
                  <th
                    style={{
                      color: '#2C4A6E',
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '12px 16px',
                      textAlign: 'left',
                      width: '15%',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em'
                    }}
                  >
                    Coefficient
                  </th>
                  <th
                    style={{
                      color: '#2C4A6E',
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '12px 16px',
                      textAlign: 'center',
                      width: '24%',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em'
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSubjectParents.map((parent, parentIndex) => {
                  const children = subjectChildren.filter(c => c.parentId === parent.id)
                  const isExpanded = expandedSubjects.has(parent.id)
                  const hasChildren = children.length > 0

                  return (
                    <React.Fragment key={parent.id}>
                      {/* Parent Row */}
                      <tr
                        style={{
                          borderTop: parentIndex > 0 ? '1px solid #E8E6E3' : 'none',
                          backgroundColor: '#FFFFFF'
                        }}
                        className="hover:bg-[#FAF8F3]"
                      >
                        <td style={{ padding: '12px 16px' }}>
                          {hasChildren && (
                            <button
                              onClick={() => toggleSubjectExpansion(parent.id)}
                              style={{
                                color: '#5A7085',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              className="hover:bg-[#E8E6E3] rounded p-1"
                            >
                              {isExpanded ? (
                                <ChevronDownIcon className="h-4 w-4" />
                              ) : (
                                <ChevronRightIcon className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </td>
                        <td
                          style={{
                            padding: '12px 16px',
                            color: '#1E1A17',
                            fontSize: '12px',
                            fontWeight: 600,
                            fontFamily: 'monospace',
                            textTransform: 'uppercase'
                          }}
                        >
                          {parent.code}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#1E1A17', fontSize: '14px', fontWeight: 600 }}>
                          {parent.name}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <Badge
                            style={{
                              backgroundColor:
                                parent.rubrique === 'R1'
                                  ? '#E3EFF9'
                                  : parent.rubrique === 'R2'
                                  ? '#E8F5EC'
                                  : '#FAF8F3',
                              color:
                                parent.rubrique === 'R1'
                                  ? '#2B6CB0'
                                  : parent.rubrique === 'R2'
                                  ? '#2D7D46'
                                  : '#B0A07A',
                              fontSize: '12px',
                              fontWeight: 500
                            }}
                          >
                            {parent.rubrique}
                          </Badge>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#1E1A17', fontSize: '14px' }}>
                          {parent.coefficient}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div className="flex items-center justify-center gap-2">
                            {!isArchived && (
                              <>
                                <button
                                  onClick={() => handleAddSubjectChild(parent)}
                                  style={{
                                    color: '#2C4A6E',
                                    fontSize: '13px',
                                    fontWeight: 500
                                  }}
                                  className="hover:underline"
                                >
                                  Ajouter sous-matière
                                </button>
                                <span style={{ color: '#D1CECC' }}>|</span>
                              </>
                            )}
                            <button
                              onClick={() => handleEditSubjectParent(parent)}
                              style={{
                                color: '#5C5955',
                                fontSize: '13px',
                                fontWeight: 500
                              }}
                              className="hover:underline"
                            >
                              Modifier
                            </button>
                            <span style={{ color: '#D1CECC' }}>|</span>
                            <button
                              onClick={() => handleDeleteSubjectParent(parent)}
                              style={{
                                color: '#B91C1C',
                                fontSize: '13px',
                                fontWeight: 500
                              }}
                              className="hover:underline"
                            >
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Child Rows */}
                      {isExpanded && children.map((child) => (
                        <tr
                          key={child.id}
                          style={{
                            borderTop: '1px solid #E8E6E3',
                            backgroundColor: '#FAFAF8'
                          }}
                          className="hover:bg-[#F5F3EF]"
                        >
                          <td style={{ padding: '12px 16px' }}></td>
                          <td
                            style={{
                              padding: '12px 16px 12px 40px',
                              color: '#5C5955',
                              fontSize: '12px',
                              fontWeight: 600,
                              fontFamily: 'monospace',
                              textTransform: 'uppercase'
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span style={{ color: '#A8A5A2' }}>└</span>
                              {child.code}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#1E1A17', fontSize: '14px', fontWeight: 400 }}>
                            {child.name}
                          </td>
                          <td style={{ padding: '12px 16px' }}></td>
                          <td style={{ padding: '12px 16px', color: '#1E1A17', fontSize: '14px' }}>
                            {child.coefficient}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEditSubjectChild(child)}
                                style={{
                                  color: '#5C5955',
                                  fontSize: '13px',
                                  fontWeight: 500
                                }}
                                className="hover:underline"
                              >
                                Modifier
                              </button>
                              <span style={{ color: '#D1CECC' }}>|</span>
                              <button
                                onClick={() => handleDeleteSubjectChild(child)}
                                style={{
                                  color: '#B91C1C',
                                  fontSize: '13px',
                                  fontWeight: 500
                                }}
                                className="hover:underline"
                              >
                                Supprimer
                              </button>
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

          {/* ── Section Affectation aux classes ── */}
          <div style={{ marginTop: '32px', paddingTop: '32px', borderTop: '2px solid #E8E6E3' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: '#2A3740' }}>
                  Affectation aux classes
                </h3>
                <p style={{ fontSize: '13px', color: '#78756F', marginTop: '2px' }}>
                  Sélectionnez une classe pour voir et gérer ses matières assignées
                </p>
              </div>
              {selectedSessionForAssign && !isArchived && (
                <button
                  onClick={() => { setAssignForm({ subjectId: '', coefficientOverride: '' }); setAssignModalOpen(true) }}
                  style={{ backgroundColor: '#2C4A6E', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
                >
                  + Assigner une matière
                </button>
              )}
            </div>

            {/* Sélecteur de classe */}
            <div style={{ marginBottom: '16px', maxWidth: '300px' }}>
              <select
                value={selectedSessionForAssign}
                onChange={e => handleSessionChangeForAssign(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1CECC', fontSize: '14px', color: '#1E1A17', backgroundColor: 'white' }}
              >
                <option value="">— Choisir une classe —</option>
                {classrooms.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Table des matières assignées */}
            {selectedSessionForAssign && (
              loadingClassSubjects ? (
                <p style={{ fontSize: '13px', color: '#78756F' }}>Chargement...</p>
              ) : (
                <div style={{ border: '1px solid #E8E6E3', borderRadius: '8px', overflow: 'hidden' }}>
                  <table className="w-full">
                    <thead>
                      <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '2px solid #D1D5DB' }}>
                        {['Code', 'Matière', 'Rubrique', 'Coeff. global', 'Coeff. override'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2C4A6E' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {classSubjects.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#78756F', fontSize: '14px' }}>
                            Aucune matière assignée à cette classe
                          </td>
                        </tr>
                      ) : classSubjects.map((cs, i) => (
                        <tr key={cs.id} style={{ borderTop: i > 0 ? '1px solid #E8E6E3' : 'none', backgroundColor: 'white' }} className="hover:bg-[#FAF8F3]">
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '12px', fontWeight: 600, color: '#1E1A17', textTransform: 'uppercase' }}>
                            {cs.subjectCode}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: '#1E1A17' }}>
                            {cs.subjectName}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {cs.rubriqueCode ? (
                              <span style={{
                                backgroundColor: cs.rubriqueCode === 'R1' ? '#E3EFF9' : cs.rubriqueCode === 'R2' ? '#E8F5EC' : '#FAF8F3',
                                color: cs.rubriqueCode === 'R1' ? '#2B6CB0' : cs.rubriqueCode === 'R2' ? '#2D7D46' : '#B0A07A',
                                padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700
                              }}>
                                {cs.rubriqueCode}
                              </span>
                            ) : <span style={{ color: '#A8A5A2' }}>—</span>}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1E1A17' }}>{cs.coefficient}</td>
                          <td style={{ padding: '12px 16px', fontSize: '14px', color: cs.coefficientOverride ? '#2B6CB0' : '#A8A5A2' }}>
                            {cs.coefficientOverride ?? '—'}
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

          {/* Modal assignation */}
          {assignModalOpen && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', width: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 700, color: '#2A3740', marginBottom: '20px' }}>
                  Assigner une matière
                </h3>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#1E1A17', display: 'block', marginBottom: '6px' }}>Matière *</label>
                  <select
                    value={assignForm.subjectId}
                    onChange={e => setAssignForm(f => ({ ...f, subjectId: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1CECC', fontSize: '14px' }}
                  >
                    <option value="">Sélectionner une matière</option>
                    {subjectParents
                      .filter(s => !classSubjects.find(cs => cs.subjectId === s.id))
                      .map(s => (
                        <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                      ))
                    }
                  </select>
                </div>
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#1E1A17', display: 'block', marginBottom: '6px' }}>
                    Coefficient override (optionnel)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={assignForm.coefficientOverride}
                    onChange={e => setAssignForm(f => ({ ...f, coefficientOverride: e.target.value }))}
                    placeholder="Laisser vide pour utiliser le coefficient global"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1CECC', fontSize: '14px' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button
                    onClick={() => setAssignModalOpen(false)}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #D1CECC', backgroundColor: 'white', fontSize: '13px', cursor: 'pointer' }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleAssignSubject}
                    disabled={assignSubmitting || !assignForm.subjectId}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: assignSubmitting || !assignForm.subjectId ? '#9CA3AF' : '#2C4A6E', color: 'white', fontSize: '13px', fontWeight: 500, cursor: assignSubmitting || !assignForm.subjectId ? 'not-allowed' : 'pointer' }}
                  >
                    {assignSubmitting ? 'En cours...' : 'Assigner'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </TabsContent>
      </Tabs>
      {selectedPeriod && (
        <>
          <ClosePeriodModal
            open={closePeriodModalOpen}
            onOpenChange={setClosePeriodModalOpen}
            periodName={selectedPeriod.name}
            classroomStatuses={getMockClassroomStatuses()}
            onConfirm={() => onClosePeriod?.(selectedPeriod.id)}
          />
          <ReopenPeriodModalV2
            open={reopenPeriodModalOpen}
            onOpenChange={setReopenPeriodModalOpen}
            periodName={selectedPeriod.name}
            onConfirm={(reason) => onReopenPeriod?.(selectedPeriod.id, reason)}
          />
        </>
      )}
      <CreatePeriodModalV2
        open={createPeriodModalOpen}
        onOpenChange={setCreatePeriodModalOpen}
        existingPeriodsCount={periods.length}
        onSubmit={(data) => onAddPeriod?.(data)}
      />
      {selectedLevel && (
        <AddClassroomModal
          open={addClassroomModalOpen}
          onOpenChange={setAddClassroomModalOpen}
          level={selectedLevel}
          existingClassrooms={getClassroomsForLevel(selectedLevel.id)}
          onSubmit={(data) => {
            onAddClassroom?.(selectedLevel.id)
            console.log('Add classroom:', selectedLevel.id, data)
          }}
        />
      )}
      {selectedClassroom && selectedLevel && (
        <>
          <EditClassroomModal
            open={editClassroomModalOpen}
            onOpenChange={setEditClassroomModalOpen}
            classroom={selectedClassroom}
            level={selectedLevel}
            existingClassrooms={getClassroomsForLevel(selectedLevel.id)}
            onConfirm={(data) => {
              onEditClassroom?.(selectedClassroom.id)
              console.log('Edit classroom:', selectedClassroom.id, data)
              setEditClassroomModalOpen(false)
            }}
          />
          <DeleteClassroomModal
            open={deleteClassroomModalOpen}
            onOpenChange={setDeleteClassroomModalOpen}
            classroom={selectedClassroom}
            level={selectedLevel}
            studentCount={getStudentCountForClassroom(selectedClassroom.id)}
            onConfirm={() => {
              onDeleteClassroom?.(selectedClassroom.id)
              setDeleteClassroomModalOpen(false)
            }}
          />
        </>
      )}
      <CreateLevelModalV2
        open={createLevelModalOpen}
        onOpenChange={setCreateLevelModalOpen}
        existingLevels={levels}
        yearName={yearName}
        onSubmit={(data) => {
          onAddLevel?.(data)
          setCreateLevelModalOpen(false)
        }}
      />
      {selectedLevel && (
        <>
          <EditLevelModal
            open={editLevelModalOpen}
            onOpenChange={setEditLevelModalOpen}
            level={selectedLevel}
            onConfirm={(data) => {
              onEditLevel?.(selectedLevel.id, data)
              setEditLevelModalOpen(false)
            }}
          />
          <DeleteLevelModal
            open={deleteLevelModalOpen}
            onOpenChange={setDeleteLevelModalOpen}
            level={selectedLevel}
            classroomCount={getClassroomsForLevel(selectedLevel.id).length}
            studentCount={getTotalStudentCountForLevel(selectedLevel.id)}
            onConfirm={() => {
              onDeleteLevel?.(selectedLevel.id)
              setDeleteLevelModalOpen(false)
            }}
          />
        </>
      )}

      {/* Subject Modals */}
      <CreateSubjectParentModal
        open={createSubjectParentModalOpen}
        onOpenChange={setCreateSubjectParentModalOpen}
        yearName={yearName}
        existingSubjects={subjectParents}
        onSubmit={(data) => {
          onAddSubjectParent?.(data)
          setCreateSubjectParentModalOpen(false)
        }}
      />
      {selectedSubjectParent && (
        <>
          <AddSubjectChildModal
            open={addSubjectChildModalOpen}
            onOpenChange={setAddSubjectChildModalOpen}
            parent={selectedSubjectParent}
            existingChildren={subjectChildren}
            onSubmit={(data) => {
              onAddSubjectChild?.(selectedSubjectParent.id, data)
              setAddSubjectChildModalOpen(false)
            }}
          />
          <EditSubjectParentModal
            open={editSubjectParentModalOpen}
            onOpenChange={setEditSubjectParentModalOpen}
            subject={selectedSubjectParent}
            onSubmit={(data) => {
              onEditSubjectParent?.(selectedSubjectParent.id, data)
              setEditSubjectParentModalOpen(false)
            }}
          />
          <DeleteSubjectParentModal
            open={deleteSubjectParentModalOpen}
            onOpenChange={setDeleteSubjectParentModalOpen}
            subject={selectedSubjectParent}
            childCount={subjectChildren.filter(c => c.parentId === selectedSubjectParent.id).length}
            onConfirm={() => {
              onDeleteSubjectParent?.(selectedSubjectParent.id)
              setDeleteSubjectParentModalOpen(false)
            }}
          />
        </>
      )}
      {selectedSubjectChild && (
        <>
          <EditSubjectChildModal
            open={editSubjectChildModalOpen}
            onOpenChange={setEditSubjectChildModalOpen}
            child={selectedSubjectChild}
            parent={subjectParents.find(p => p.id === selectedSubjectChild.parentId)!}
            existingChildren={subjectChildren}
            onSubmit={(data) => {
              onEditSubjectChild?.(selectedSubjectChild.id, data)
              setEditSubjectChildModalOpen(false)
            }}
          />
          <DeleteSubjectChildModal
            open={deleteSubjectChildModalOpen}
            onOpenChange={setDeleteSubjectChildModalOpen}
            child={selectedSubjectChild}
            studentCount={32}
            onConfirm={() => {
              onDeleteSubjectChild?.(selectedSubjectChild.id)
              setDeleteSubjectChildModalOpen(false)
            }}
          />
        </>
      )}
    </div>
  )
}