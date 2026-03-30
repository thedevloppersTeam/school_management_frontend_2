"use client"

import { useState, useEffect, useCallback } from "react"
import * as React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { PlusIcon, SearchIcon, LockIcon, UnlockIcon, PencilIcon, LoaderIcon, XIcon, CheckCircle2Icon, AlertTriangleIcon, ChevronDownIcon, ChevronRightIcon } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ClosePeriodModal } from "@/components/school/close-period-modal"
import { ReopenPeriodModalV2 } from "@/components/school/reopen-period-modal-v2"
import { CreatePeriodModalV2 } from "@/components/school/create-period-modal-v2"

// ── Types ──────────────────────────────────────────────────────────────────────

interface Period {
  id: string
  name: string
  stepNumber: number
  startDate: string
  endDate: string
  status: 'open' | 'closed'
}

interface ApiClass {
  id: string
  letter: string
  classType: { id: string; name: string }
  track?: { id: string; name: string; code: string } | null
}

interface ApiClassSession {
  id: string
  class: ApiClass
}

interface ApiSubject {
  id: string
  name: string
  code: string
  coefficient: string | number
  maxScore: string | number
  hasSections: boolean
  rubricId?: string | null
}

interface ApiClassSubject {
  id: string
  subjectId: string
  classSessionId: string
  subject: ApiSubject
}

interface CPMSLYearConfigTabsProps {
  yearId: string
  yearName: string
  isArchived?: boolean
  periods: Period[]
  onPeriodsChanged?: () => void
  onAddPeriod?: (data: { name: string; type: 'normal' | 'blanc'; startDate: string; endDate: string; description?: string }) => void
  onClosePeriod?: (periodId: string) => void
  onReopenPeriod?: (periodId: string, reason: string) => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildClassName(c: ApiClass): string {
  const track = c.track ? ` ${c.track.code}` : ''
  return `${c.classType.name} ${c.letter}${track}`
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CPMSLYearConfigTabs({
  yearId,
  yearName: _yearName,
  isArchived,
  periods,
  onPeriodsChanged,
  onAddPeriod,
  onClosePeriod,
  onReopenPeriod,
}: CPMSLYearConfigTabsProps) {

  // ── Step state ────────────────────────────────────────────────────────────
  const [stepFormOpen, setStepFormOpen] = useState(false)
  const [editingStep, setEditingStep] = useState<Period | null>(null)
  const [stepForm, setStepForm] = useState({ startDate: '', endDate: '' })
  const [stepSaving, setStepSaving] = useState(false)
  const [stepError, setStepError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null)
  const [closePeriodModalOpen, setClosePeriodModalOpen] = useState(false)
  const [reopenPeriodModalOpen, setReopenPeriodModalOpen] = useState(false)
  const [createPeriodModalOpen, setCreatePeriodModalOpen] = useState(false)

  // ── Classes state ─────────────────────────────────────────────────────────
  const [allClasses, setAllClasses] = useState<ApiClass[]>([])
  const [classSessions, setClassSessions] = useState<ApiClassSession[]>([])
  const [classesLoading, setClassesLoading] = useState(false)
  const [classesError, setClassesError] = useState<string | null>(null)
  const [selectedClassId, setSelectedClassId] = useState('')
  const [sessionSaving, setSessionSaving] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [sessionSuccess, setSessionSuccess] = useState<string | null>(null)
  const [searchClass, setSearchClass] = useState('')

  // ── Subjects state ────────────────────────────────────────────────────────
  const [allSubjects, setAllSubjects] = useState<ApiSubject[]>([])
  const [subjectsLoading, setSubjectsLoading] = useState(false)
  const [subjectsError, setSubjectsError] = useState<string | null>(null)
  const [searchSubject, setSearchSubject] = useState('')
  // per-session subject assignment
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [sessionSubjects, setSessionSubjects] = useState<Record<string, ApiClassSubject[]>>({})
  const [sessionSubjectsLoading, setSessionSubjectsLoading] = useState<Record<string, boolean>>({})
  const [selectedSubjectId, setSelectedSubjectId] = useState<Record<string, string>>({})
  const [subjectSaving, setSubjectSaving] = useState<Record<string, boolean>>({})
  const [subjectError, setSubjectError] = useState<Record<string, string | null>>({})
  const [subjectSuccess, setSubjectSuccess] = useState<Record<string, string | null>>({})

  // ── Load classes data ─────────────────────────────────────────────────────
  const loadClassesData = useCallback(async () => {
    setClassesLoading(true)
    setClassesError(null)
    try {
      const [classesRes, sessionsRes] = await Promise.all([
        fetch('/api/classes', { credentials: 'include' }),
        fetch(`/api/class-sessions?academicYearId=${yearId}`, { credentials: 'include' }),
      ])
      if (classesRes.ok) {
        const raw = await classesRes.json()
        const data: ApiClass[] = Array.isArray(raw) ? raw : (raw.classes ?? raw.data ?? [])
        setAllClasses(data.sort((a, b) => buildClassName(a).localeCompare(buildClassName(b))))
      } else {
        setClassesError(`Erreur classes: ${classesRes.status}`)
      }
      if (sessionsRes.ok) {
        const raw = await sessionsRes.json()
        const data: ApiClassSession[] = Array.isArray(raw) ? raw : (raw.classSessions ?? raw.data ?? [])
        setClassSessions(data)
      } else {
        setClassesError(`Erreur sessions: ${sessionsRes.status}`)
      }
    } catch (e) {
      setClassesError(e instanceof Error ? e.message : 'Impossible de charger les classes')
    } finally {
      setClassesLoading(false)
    }
  }, [yearId])

  // ── Load all subjects ─────────────────────────────────────────────────────
  const loadSubjects = useCallback(async () => {
    setSubjectsLoading(true)
    setSubjectsError(null)
    try {
      const res = await fetch('/api/subjects', { credentials: 'include' })
      if (res.ok) {
        const raw = await res.json()
        const data: ApiSubject[] = Array.isArray(raw) ? raw : (raw.subjects ?? raw.data ?? [])
        setAllSubjects(data.sort((a, b) => a.name.localeCompare(b.name)))
      } else {
        setSubjectsError(`Erreur matieres: ${res.status}`)
      }
    } catch (e) {
      setSubjectsError(e instanceof Error ? e.message : 'Impossible de charger les matieres')
    } finally {
      setSubjectsLoading(false)
    }
  }, [])

  // ── Load subjects for one session ─────────────────────────────────────────
  const loadSessionSubjects = useCallback(async (sessionId: string) => {
    setSessionSubjectsLoading(p => ({ ...p, [sessionId]: true }))
    try {
      const res = await fetch(`/api/class-subjects?classSessionId=${sessionId}`, { credentials: 'include' })
      if (res.ok) {
        const raw = await res.json()
        const data: ApiClassSubject[] = Array.isArray(raw) ? raw : (raw.classSubjects ?? raw.data ?? [])
        setSessionSubjects(p => ({ ...p, [sessionId]: data }))
      }
    } catch {
      // silent
    } finally {
      setSessionSubjectsLoading(p => ({ ...p, [sessionId]: false }))
    }
  }, [])

  useEffect(() => { loadClassesData() }, [loadClassesData])
  useEffect(() => { loadSubjects() }, [loadSubjects])

  // ── Step helpers ──────────────────────────────────────────────────────────
  const nextStepNumber = periods.length + 1
  const autoStepName = `Etape ${nextStepNumber}`

  const openAddStep = () => {
    setEditingStep(null)
    setStepForm({ startDate: '', endDate: '' })
    setStepError(null)
    setStepFormOpen(true)
  }

  const openEditStep = (step: Period) => {
    setEditingStep(step)
    setStepForm({ startDate: step.startDate, endDate: step.endDate })
    setStepError(null)
    setStepFormOpen(true)
  }

  const closeStepForm = () => {
    setStepFormOpen(false)
    setEditingStep(null)
    setStepError(null)
  }

  const handleSaveStep = async () => {
    setStepSaving(true)
    setStepError(null)
    try {
      if (editingStep) {
        const res = await fetch(`/api/academic-years/steps/update/${editingStep.id}`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editingStep.name,
            ...(stepForm.startDate && { startDate: stepForm.startDate }),
            ...(stepForm.endDate && { endDate: stepForm.endDate }),
          }),
        })
        if (!res.ok) { const d = await res.json(); throw new Error(d.message ?? `Erreur ${res.status}`) }
      } else {
        const res = await fetch(`/api/academic-years/${yearId}/steps/create`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: autoStepName,
            stepNumber: nextStepNumber,
            ...(stepForm.startDate && { startDate: stepForm.startDate }),
            ...(stepForm.endDate && { endDate: stepForm.endDate }),
          }),
        })
        if (!res.ok) { const d = await res.json(); throw new Error(d.message ?? `Erreur ${res.status}`) }
      }
      closeStepForm()
      onPeriodsChanged?.()
    } catch (e) {
      setStepError(e instanceof Error ? e.message : 'Une erreur est survenue')
    } finally {
      setStepSaving(false)
    }
  }

  // ── Session helpers ───────────────────────────────────────────────────────
  const existingClassIds = new Set(classSessions.map(s => s.class.id))
  const availableClasses = allClasses.filter(c => !existingClassIds.has(c.id))

  const handleAddSession = async () => {
    if (!selectedClassId) return
    setSessionSaving(true)
    setSessionError(null)
    setSessionSuccess(null)
    try {
      const res = await fetch('/api/class-sessions/create', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: selectedClassId, academicYearId: yearId }),
      })
      if (!res.ok) {
        let msg = `Erreur ${res.status}`
        try { const d = await res.json(); msg = d.message ?? d.error ?? msg } catch { /* ignore */ }
        throw new Error(msg)
      }
      const added = allClasses.find(c => c.id === selectedClassId)
      setSessionSuccess(added ? `${buildClassName(added)} ajoutee` : 'Classe ajoutee')
      setSelectedClassId('')
      await loadClassesData()
    } catch (e) {
      setSessionError(e instanceof Error ? e.message : 'Une erreur est survenue')
    } finally {
      setSessionSaving(false)
    }
  }

  // ── Subject assignment helpers ────────────────────────────────────────────
  const toggleSession = (sessionId: string) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null)
    } else {
      setExpandedSession(sessionId)
      if (!sessionSubjects[sessionId]) {
        loadSessionSubjects(sessionId)
      }
    }
  }

  const handleAddSubjectToSession = async (sessionId: string) => {
    const subjectId = selectedSubjectId[sessionId]
    if (!subjectId) return
    setSubjectSaving(p => ({ ...p, [sessionId]: true }))
    setSubjectError(p => ({ ...p, [sessionId]: null }))
    setSubjectSuccess(p => ({ ...p, [sessionId]: null }))
    try {
      const res = await fetch('/api/class-subjects/create', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classSessionId: sessionId, subjectId }),
      })
      if (!res.ok) {
        let msg = `Erreur ${res.status}`
        try { const d = await res.json(); msg = d.message ?? d.error ?? msg } catch { /* ignore */ }
        throw new Error(msg)
      }
      const added = allSubjects.find(s => s.id === subjectId)
      setSubjectSuccess(p => ({ ...p, [sessionId]: added ? `${added.name} ajoutee` : 'Matiere ajoutee' }))
      setSelectedSubjectId(p => ({ ...p, [sessionId]: '' }))
      await loadSessionSubjects(sessionId)
    } catch (e) {
      setSubjectError(p => ({ ...p, [sessionId]: e instanceof Error ? e.message : 'Erreur' }))
    } finally {
      setSubjectSaving(p => ({ ...p, [sessionId]: false }))
    }
  }

  const getAvailableSubjectsForSession = (sessionId: string) => {
    const assigned = new Set((sessionSubjects[sessionId] ?? []).map(cs => cs.subjectId))
    return allSubjects.filter(s => !assigned.has(s.id))
  }

  // ── Period modals ─────────────────────────────────────────────────────────
  const handleClosePeriod = (period: Period) => { setSelectedPeriod(period); setClosePeriodModalOpen(true) }
  const handleReopenPeriod = (period: Period) => { setSelectedPeriod(period); setReopenPeriodModalOpen(true) }

  const getMockClassroomStatuses = () => [
    { className: '7e', classroomName: 'Salle A', gradesEntered: 24, totalGrades: 24, status: 'complete' as const },
  ]

  // ── Filtered ──────────────────────────────────────────────────────────────
  const filteredSessions = classSessions.filter(s =>
    buildClassName(s.class).toLowerCase().includes(searchClass.toLowerCase())
  )
  const filteredSubjects = allSubjects.filter(s =>
    s.name.toLowerCase().includes(searchSubject.toLowerCase()) ||
    s.code.toLowerCase().includes(searchSubject.toLowerCase())
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E6E3', borderRadius: '10px', overflow: 'hidden' }}>
      <Tabs defaultValue="periods" className="w-full">
        <div style={{ padding: '16px 24px 0 24px' }}>
          <TabsList style={{ backgroundColor: "#F0F4F7", borderRadius: "8px", padding: "4px" }}>
            <TabsTrigger value="periods" className="label-ui data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>
              <span className="data-[state=active]:text-[#3A4A57] text-[#78756F]">Etapes ({periods.length})</span>
            </TabsTrigger>
            <TabsTrigger value="classes" className="label-ui data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>
              <span className="data-[state=active]:text-[#3A4A57] text-[#78756F]">Classes ({classSessions.length})</span>
            </TabsTrigger>
            <TabsTrigger value="subjects" className="label-ui data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>
              <span className="data-[state=active]:text-[#3A4A57] text-[#78756F]">Matieres ({allSubjects.length})</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ══════════════ ETAPES ══════════════ */}
        <TabsContent value="periods" className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span style={{ color: '#5C5955', fontSize: '13px', fontWeight: 500 }}>{periods.length} / 5 etapes</span>
            {!isArchived && !stepFormOpen && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button onClick={openAddStep} disabled={periods.length >= 5}
                        style={{ backgroundColor: periods.length >= 5 ? '#E8E6E3' : '#5A7085', color: periods.length >= 5 ? '#A8A5A2' : '#FFFFFF', borderRadius: '8px' }}>
                        <PlusIcon className="mr-2 h-4 w-4" />Ajouter {autoStepName}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {periods.length >= 5 && <TooltipContent><p>Maximum 5 etapes</p></TooltipContent>}
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {stepFormOpen && (
            <div style={{ border: '1px solid #c3b595', borderRadius: '8px', padding: '16px', backgroundColor: '#FDFBF7' }}>
              <p className="font-sans" style={{ fontSize: '13px', fontWeight: 600, color: '#2A3740', marginBottom: '12px' }}>
                {editingStep ? `Modifier — ${editingStep.name}` : `Ajouter "${autoStepName}"`}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="space-y-1">
                  <label className="font-sans" style={{ fontSize: '12px', fontWeight: 500, color: '#5C5955' }}>
                    Date de debut <span style={{ color: '#A8A5A2', fontWeight: 400 }}>(optionnel)</span>
                  </label>
                  <Input type="date" value={stepForm.startDate} onChange={e => setStepForm(f => ({ ...f, startDate: e.target.value }))} className="h-9" style={{ borderColor: '#D1CECC' }} />
                </div>
                <div className="space-y-1">
                  <label className="font-sans" style={{ fontSize: '12px', fontWeight: 500, color: '#5C5955' }}>
                    Date de fin <span style={{ color: '#A8A5A2', fontWeight: 400 }}>(optionnel)</span>
                  </label>
                  <Input type="date" value={stepForm.endDate} onChange={e => setStepForm(f => ({ ...f, endDate: e.target.value }))} className="h-9" style={{ borderColor: '#D1CECC' }} />
                </div>
              </div>
              {stepError && (
                <div className="flex items-center gap-2 mt-3" style={{ color: '#C43C3C', fontSize: '13px' }}>
                  <AlertTriangleIcon className="h-4 w-4 flex-shrink-0" /><span>{stepError}</span>
                </div>
              )}
              <div className="flex items-center gap-2 mt-4">
                <Button onClick={handleSaveStep} disabled={stepSaving} style={{ backgroundColor: '#5A7085', color: '#FFFFFF', borderRadius: '8px' }}>
                  {stepSaving ? <LoaderIcon className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2Icon className="mr-2 h-4 w-4" />}
                  {editingStep ? 'Enregistrer' : 'Creer'}
                </Button>
                <Button type="button" variant="outline" onClick={closeStepForm} disabled={stepSaving} style={{ borderRadius: '8px' }}>
                  <XIcon className="mr-2 h-4 w-4" />Annuler
                </Button>
              </div>
            </div>
          )}

          <div style={{ border: '1px solid #E8E6E3', borderRadius: '8px', overflow: 'hidden' }}>
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '2px solid #D1D5DB' }}>
                  <th style={{ color: '#2C4A6E', fontSize: '12px', fontWeight: 700, padding: '12px 16px', textAlign: 'left', width: '5%', textTransform: 'uppercase', letterSpacing: '0.06em' }}>N</th>
                  <th style={{ color: '#2C4A6E', fontSize: '12px', fontWeight: 700, padding: '12px 16px', textAlign: 'left', width: '30%', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nom</th>
                  <th style={{ color: '#2C4A6E', fontSize: '12px', fontWeight: 700, padding: '12px 16px', textAlign: 'left', width: '20%', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Debut</th>
                  <th style={{ color: '#2C4A6E', fontSize: '12px', fontWeight: 700, padding: '12px 16px', textAlign: 'left', width: '20%', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fin</th>
                  <th style={{ color: '#2C4A6E', fontSize: '12px', fontWeight: 700, padding: '12px 16px', textAlign: 'left', width: '10%', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Statut</th>
                  <th style={{ color: '#2C4A6E', fontSize: '12px', fontWeight: 700, padding: '12px 16px', textAlign: 'center', width: '15%', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {periods.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#A8A5A2', fontSize: '13px' }}>Aucune etape — ajoutez Etape 1 pour commencer</td></tr>
                )}
                {periods.map((period, index) => (
                  <tr key={period.id} style={{ borderTop: index > 0 ? '1px solid #E8E6E3' : 'none', backgroundColor: '#FFFFFF' }} className="hover:bg-[#FAF8F3]">
                    <td style={{ padding: '12px 16px', color: '#78756F', fontSize: '13px', fontWeight: 500 }}>{period.stepNumber}</td>
                    <td style={{ padding: '12px 16px', color: '#1E1A17', fontSize: '14px', fontWeight: 600 }}>{period.name}</td>
                    <td style={{ padding: '12px 16px', color: '#5C5955', fontSize: '13px' }}>
                      {period.startDate ? new Date(period.startDate).toLocaleDateString('fr-FR') : <span style={{ color: '#A8A5A2' }}>-</span>}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#5C5955', fontSize: '13px' }}>
                      {period.endDate ? new Date(period.endDate).toLocaleDateString('fr-FR') : <span style={{ color: '#A8A5A2' }}>-</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {period.status === 'open'
                        ? <div style={{ backgroundColor: '#E8F5EC', color: '#2D7D46', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><UnlockIcon className="h-3 w-3" />Ouverte</div>
                        : <div style={{ backgroundColor: '#FEF6E0', color: '#C48B1A', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><LockIcon className="h-3 w-3" />Cloturee</div>
                      }
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {!isArchived && (
                        <div className="flex items-center justify-center gap-3">
                          <button onClick={() => openEditStep(period)} style={{ color: '#5A7085', fontSize: '13px', fontWeight: 500 }} className="hover:underline flex items-center gap-1">
                            <PencilIcon className="h-3.5 w-3.5" />Modifier
                          </button>
                          <button onClick={() => period.status === 'open' ? handleClosePeriod(period) : handleReopenPeriod(period)} style={{ color: '#5A7085', fontSize: '13px', fontWeight: 500 }} className="hover:underline">
                            {period.status === 'open' ? 'Cloturer' : 'Reouvrir'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ══════════════ CLASSES ══════════════ */}
        <TabsContent value="classes" className="p-6 space-y-4">
          {!isArchived && (
            <div style={{ border: '1px solid #D9E3EA', borderRadius: '8px', padding: '16px', backgroundColor: '#F8FAFB' }}>
              <p className="font-sans" style={{ fontSize: '13px', fontWeight: 600, color: '#2A3740', marginBottom: '12px' }}>
                Ajouter une classe a cette annee
              </p>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label className="font-sans" style={{ fontSize: '12px', fontWeight: 500, color: '#5C5955', display: 'block', marginBottom: '6px' }}>Classe disponible</label>
                  {classesLoading
                    ? <div className="flex items-center gap-2 h-9" style={{ color: '#A8A5A2', fontSize: '13px' }}><LoaderIcon className="h-4 w-4 animate-spin" />Chargement...</div>
                    : (
                      <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                        <SelectTrigger className="h-9" style={{ borderColor: '#D1CECC' }}>
                          <SelectValue placeholder={availableClasses.length === 0 ? 'Toutes les classes sont ajoutees' : 'Selectionnez une classe...'} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableClasses.map(c => <SelectItem key={c.id} value={c.id}>{buildClassName(c)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )
                  }
                </div>
                <Button onClick={handleAddSession} disabled={!selectedClassId || sessionSaving}
                  style={{ backgroundColor: '#5A7085', color: '#FFFFFF', borderRadius: '8px', height: '36px' }}>
                  {sessionSaving ? <LoaderIcon className="mr-2 h-4 w-4 animate-spin" /> : <PlusIcon className="mr-2 h-4 w-4" />}
                  Ajouter
                </Button>
              </div>
              {sessionError && <div className="flex items-center gap-2 mt-3" style={{ color: '#C43C3C', fontSize: '13px' }}><AlertTriangleIcon className="h-4 w-4 flex-shrink-0" /><span>{sessionError}</span></div>}
              {sessionSuccess && <div className="flex items-center gap-2 mt-3" style={{ color: '#2D7D46', fontSize: '13px' }}><CheckCircle2Icon className="h-4 w-4 flex-shrink-0" /><span>{sessionSuccess}</span></div>}
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <span style={{ color: '#5C5955', fontSize: '13px', fontWeight: 500 }}>{classSessions.length} classe{classSessions.length !== 1 ? 's' : ''} configuree{classSessions.length !== 1 ? 's' : ''}</span>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#A8A5A2' }} />
              <Input placeholder="Rechercher..." value={searchClass} onChange={e => setSearchClass(e.target.value)} style={{ paddingLeft: '36px', border: '1px solid #D1CECC', borderRadius: '8px' }} />
            </div>
          </div>

          {classesError && (
            <div className="flex items-center gap-2" style={{ color: '#C43C3C', fontSize: '13px' }}>
              <AlertTriangleIcon className="h-4 w-4" /><span>{classesError}</span>
              <button onClick={loadClassesData} style={{ color: '#5A7085', fontSize: '13px', textDecoration: 'underline' }}>Reessayer</button>
            </div>
          )}

          <div style={{ border: '1px solid #E8E6E3', borderRadius: '8px', overflow: 'hidden' }}>
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '2px solid #D1D5DB' }}>
                  <th style={{ color: '#2C4A6E', fontSize: '12px', fontWeight: 700, padding: '12px 16px', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nom</th>
                  <th style={{ color: '#2C4A6E', fontSize: '12px', fontWeight: 700, padding: '12px 16px', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lettre</th>
                  <th style={{ color: '#2C4A6E', fontSize: '12px', fontWeight: 700, padding: '12px 16px', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filiere</th>
                </tr>
              </thead>
              <tbody>
                {classesLoading && filteredSessions.length === 0 && (
                  <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center' }}><LoaderIcon className="h-5 w-5 animate-spin inline-block" style={{ color: '#5A7085' }} /></td></tr>
                )}
                {!classesLoading && filteredSessions.length === 0 && (
                  <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: '#A8A5A2', fontSize: '13px' }}>Aucune classe ajoutee pour cette annee</td></tr>
                )}
                {filteredSessions.map((session, index) => (
                  <tr key={session.id} style={{ borderTop: index > 0 ? '1px solid #E8E6E3' : 'none', backgroundColor: '#FFFFFF' }} className="hover:bg-[#FAF8F3]">
                    <td style={{ padding: '12px 16px', color: '#1E1A17', fontSize: '14px', fontWeight: 600 }}>{session.class.classType.name}</td>
                    <td style={{ padding: '12px 16px', color: '#1E1A17', fontSize: '14px', fontWeight: 500 }}>{session.class.letter}</td>
                    <td style={{ padding: '12px 16px', color: '#5C5955', fontSize: '13px' }}>
                      {session.class.track
                        ? <span style={{ backgroundColor: '#EEF2FF', color: '#3B5998', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>{session.class.track.code}</span>
                        : <span style={{ color: '#A8A5A2' }}>-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ══════════════ MATIERES ══════════════ */}
        <TabsContent value="subjects" className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <span style={{ color: '#5C5955', fontSize: '13px', fontWeight: 500 }}>
              {allSubjects.length} matiere{allSubjects.length !== 1 ? 's' : ''} disponible{allSubjects.length !== 1 ? 's' : ''}
            </span>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#A8A5A2' }} />
              <Input placeholder="Rechercher une matiere..." value={searchSubject} onChange={e => setSearchSubject(e.target.value)}
                style={{ paddingLeft: '36px', border: '1px solid #D1CECC', borderRadius: '8px' }} />
            </div>
          </div>

          {subjectsError && (
            <div className="flex items-center gap-2" style={{ color: '#C43C3C', fontSize: '13px' }}>
              <AlertTriangleIcon className="h-4 w-4" /><span>{subjectsError}</span>
              <button onClick={loadSubjects} style={{ color: '#5A7085', fontSize: '13px', textDecoration: 'underline' }}>Reessayer</button>
            </div>
          )}

          {/* ── All subjects catalogue ── */}
          {filteredSubjects.length > 0 && (
            <div style={{ border: '1px solid #E8E6E3', borderRadius: '8px', overflow: 'hidden' }}>
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '2px solid #D1D5DB' }}>
                    <th style={{ color: '#2C4A6E', fontSize: '12px', fontWeight: 700, padding: '10px 16px', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Code</th>
                    <th style={{ color: '#2C4A6E', fontSize: '12px', fontWeight: 700, padding: '10px 16px', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nom</th>
                    <th style={{ color: '#2C4A6E', fontSize: '12px', fontWeight: 700, padding: '10px 16px', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Coeff.</th>
                    <th style={{ color: '#2C4A6E', fontSize: '12px', fontWeight: 700, padding: '10px 16px', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Score max</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectsLoading
                    ? <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center' }}><LoaderIcon className="h-5 w-5 animate-spin inline-block" style={{ color: '#5A7085' }} /></td></tr>
                    : filteredSubjects.map((s, i) => (
                      <tr key={s.id} style={{ borderTop: i > 0 ? '1px solid #E8E6E3' : 'none', backgroundColor: '#FFFFFF' }} className="hover:bg-[#FAF8F3]">
                        <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '12px', fontWeight: 600, color: '#5A7085', textTransform: 'uppercase' }}>{s.code}</td>
                        <td style={{ padding: '10px 16px', color: '#1E1A17', fontSize: '14px', fontWeight: 600 }}>{s.name}</td>
                        <td style={{ padding: '10px 16px', color: '#5C5955', fontSize: '13px' }}>{String(s.coefficient)}</td>
                        <td style={{ padding: '10px 16px', color: '#5C5955', fontSize: '13px' }}>{String(s.maxScore)}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}

          {/* ── Assign subjects to class sessions ── */}
          <div style={{ marginTop: '24px' }}>
            <p className="font-sans" style={{ fontSize: '14px', fontWeight: 700, color: '#2A3740', marginBottom: '12px' }}>
              Assigner des matieres aux classes
            </p>

            {classSessions.length === 0 && (
              <div style={{ padding: '16px', backgroundColor: '#F8FAFB', borderRadius: '8px', border: '1px solid #D9E3EA', color: '#A8A5A2', fontSize: '13px', textAlign: 'center' }}>
                Aucune classe configuree — allez dans l&apos;onglet Classes pour en ajouter
              </div>
            )}

            <div className="space-y-2">
              {classSessions.map(session => {
                const isOpen = expandedSession === session.id
                const assigned = sessionSubjects[session.id] ?? []
                const loading = sessionSubjectsLoading[session.id] ?? false
                const available = getAvailableSubjectsForSession(session.id)
                const saving = subjectSaving[session.id] ?? false
                const err = subjectError[session.id] ?? null
                const success = subjectSuccess[session.id] ?? null

                return (
                  <div key={session.id} style={{ border: '1px solid #E8E6E3', borderRadius: '8px', overflow: 'hidden' }}>
                    {/* Session header */}
                    <button
                      onClick={() => toggleSession(session.id)}
                      className="w-full flex items-center justify-between hover:bg-[#F8FAFB]"
                      style={{ padding: '12px 16px', backgroundColor: '#FFFFFF', textAlign: 'left' }}
                    >
                      <div className="flex items-center gap-3">
                        {isOpen ? <ChevronDownIcon className="h-4 w-4" style={{ color: '#5A7085' }} /> : <ChevronRightIcon className="h-4 w-4" style={{ color: '#5A7085' }} />}
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#1E1A17' }}>{buildClassName(session.class)}</span>
                        <Badge style={{ backgroundColor: '#EEF2FF', color: '#3B5998', fontSize: '11px', fontWeight: 500 }}>
                          {assigned.length} matiere{assigned.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      {session.class.track && (
                        <span style={{ backgroundColor: '#EEF2FF', color: '#3B5998', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>
                          {session.class.track.code}
                        </span>
                      )}
                    </button>

                    {/* Expanded content */}
                    {isOpen && (
                      <div style={{ borderTop: '1px solid #E8E6E3', padding: '16px', backgroundColor: '#FAFAF8' }}>
                        {/* Add subject form */}
                        {!isArchived && (
                          <div className="flex items-end gap-3 mb-4">
                            <div style={{ flex: 1 }}>
                              <label className="font-sans" style={{ fontSize: '12px', fontWeight: 500, color: '#5C5955', display: 'block', marginBottom: '6px' }}>Ajouter une matiere</label>
                              <Select value={selectedSubjectId[session.id] ?? ''} onValueChange={v => setSelectedSubjectId(p => ({ ...p, [session.id]: v }))}>
                                <SelectTrigger className="h-9" style={{ borderColor: '#D1CECC' }}>
                                  <SelectValue placeholder={available.length === 0 ? 'Toutes les matieres sont assignees' : 'Selectionnez une matiere...'} />
                                </SelectTrigger>
                                <SelectContent>
                                  {available.map(s => (
                                    <SelectItem key={s.id} value={s.id}>{s.name} <span style={{ color: '#A8A5A2', fontSize: '11px' }}>({s.code})</span></SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              onClick={() => handleAddSubjectToSession(session.id)}
                              disabled={!selectedSubjectId[session.id] || saving}
                              style={{ backgroundColor: '#5A7085', color: '#FFFFFF', borderRadius: '8px', height: '36px' }}
                            >
                              {saving ? <LoaderIcon className="mr-2 h-4 w-4 animate-spin" /> : <PlusIcon className="mr-2 h-4 w-4" />}
                              Assigner
                            </Button>
                          </div>
                        )}
                        {err && <div className="flex items-center gap-2 mb-3" style={{ color: '#C43C3C', fontSize: '13px' }}><AlertTriangleIcon className="h-4 w-4" /><span>{err}</span></div>}
                        {success && <div className="flex items-center gap-2 mb-3" style={{ color: '#2D7D46', fontSize: '13px' }}><CheckCircle2Icon className="h-4 w-4" /><span>{success}</span></div>}

                        {/* Assigned subjects list */}
                        {loading ? (
                          <div className="flex items-center gap-2" style={{ color: '#A8A5A2', fontSize: '13px' }}>
                            <LoaderIcon className="h-4 w-4 animate-spin" />Chargement...
                          </div>
                        ) : assigned.length === 0 ? (
                          <p style={{ color: '#A8A5A2', fontSize: '13px' }}>Aucune matiere assignee a cette classe</p>
                        ) : (
                          <div style={{ border: '1px solid #E8E6E3', borderRadius: '6px', overflow: 'hidden' }}>
                            <table className="w-full">
                              <thead>
                                <tr style={{ backgroundColor: '#F1F5F9' }}>
                                  <th style={{ color: '#2C4A6E', fontSize: '11px', fontWeight: 700, padding: '8px 12px', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Code</th>
                                  <th style={{ color: '#2C4A6E', fontSize: '11px', fontWeight: 700, padding: '8px 12px', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Matiere</th>
                                  <th style={{ color: '#2C4A6E', fontSize: '11px', fontWeight: 700, padding: '8px 12px', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Coeff.</th>
                                </tr>
                              </thead>
                              <tbody>
                                {assigned.map((cs, i) => (
                                  <tr key={cs.id} style={{ borderTop: i > 0 ? '1px solid #E8E6E3' : 'none', backgroundColor: '#FFFFFF' }}>
                                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '11px', fontWeight: 600, color: '#5A7085', textTransform: 'uppercase' }}>{cs.subject.code}</td>
                                    <td style={{ padding: '8px 12px', color: '#1E1A17', fontSize: '13px', fontWeight: 500 }}>{cs.subject.name}</td>
                                    <td style={{ padding: '8px 12px', color: '#5C5955', fontSize: '13px' }}>{String(cs.subject.coefficient)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Modals ── */}
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
    </div>
  )
}
