// app/admin/settings/school/page.tsx
"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { CPMSLSchoolInfoForm }      from "@/components/school/cpmsl-school-info-form"
import { CPMSLCalendarManagement } from "@/components/school/cpmsl-calendar-management"
import { Button }   from "@/components/ui/button"
import { Input }    from "@/components/ui/input"
import { Label }    from "@/components/ui/label"
import { Badge }    from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlusIcon, ChevronRightIcon, ChevronDownIcon, CheckCircle2Icon, ZapIcon, Trash2Icon } from "lucide-react"

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface SchoolInfo  { name: string; motto?: string; foundedYear?: number; logo?: string; address?: string; phone?: string; email?: string }
interface Holiday     { id: string; name: string; date: string }
interface SchoolEvent { id: string; title: string; date: string; type: 'exam'|'holiday'|'meeting'|'other'|'ceremony'|'trip'; academicYearId: string }
interface Rubric      { id: string; name: string; code: string; description?: string }
interface Section     { id: string; name: string; code: string; maxScore: number; displayOrder: number }
interface Subject     { id: string; name: string; code: string; maxScore: number; coefficient: number; hasSections: boolean; rubricId?: string; rubric?: Rubric; sections?: Section[] }
interface ClassType   { id: string; name: string; code?: string; isTerminal: boolean }
interface Class       { id: string; classTypeId: string; classType?: ClassType; letter: string; maxStudents?: number }
interface Attitude    { id: string; label: string; academicYearId: string }
interface RubricForm  { name: string; code: string; description: string }
interface SubjectForm { name: string; code: string; maxScore: string; coefficient: string; hasSections: boolean; rubricId: string }
interface SectionForm { name: string; code: string; maxScore: string; cycles: string[] }
interface ClassForm   { maxStudents: string }

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const CLASS_TYPES_SEED = [
  { name: '1ère AF', code: '1AF', isTerminal: false },
  { name: '2ème AF', code: '2AF', isTerminal: false },
  { name: '3ème AF', code: '3AF', isTerminal: false },
  { name: '4ème AF', code: '4AF', isTerminal: false },
  { name: '5ème AF', code: '5AF', isTerminal: false },
  { name: '6ème AF', code: '6AF', isTerminal: false },
  { name: '7ème AF', code: '7AF', isTerminal: false },
  { name: '8ème AF', code: '8AF', isTerminal: false },
  { name: '9ème AF', code: '9AF', isTerminal: true  },
  { name: 'NS1',     code: 'NS1', isTerminal: false },
  { name: 'NS2',     code: 'NS2', isTerminal: false },
  { name: 'NS3',     code: 'NS3', isTerminal: false },
  { name: 'NS4',     code: 'NS4', isTerminal: true  },
]

const DEFAULT_SCHOOL_INFO: SchoolInfo = {
  name: "Cours Privé Mixte Saint Léonard",
  motto: "", foundedYear: undefined, logo: "", address: "", phone: "", email: "",
}

const CYCLES_MENFP = [
  { key: '1er Cycle',  label: '1er Cycle',  description: '1ère → 4ème AF' },
  { key: '2ème Cycle', label: '2ème Cycle', description: '5ème → 6ème AF' },
  { key: '3ème Cycle', label: '3ème Cycle', description: '7ème → 9ème AF' },
  { key: 'Secondaire', label: 'Secondaire', description: 'NS1 → NS4'      },
]

const TAB_LABELS: Record<string, string> = {
  general:     'Informations générales',
  calendar:    'Calendrier scolaire',
  referentiel: 'Matières & Rubriques',
  classes:     'Classes',
  attitudes:   'Attitudes',
}

const TH = { fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#2C4A6E' }

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE-LEVEL HELPERS  (complexity score: independent from SchoolSettingsPage)
// ═══════════════════════════════════════════════════════════════════════════════

// complexity: 1
function getSectionCycles(sectionId: string): string[] {
  try {
    const raw = localStorage.getItem(`section-cycles-${sectionId}`)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

// complexity: 0
function saveSectionCycles(sectionId: string, cycles: string[]): void {
  localStorage.setItem(`section-cycles-${sectionId}`, JSON.stringify(cycles))
}

// complexity: 0
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/proxy?path=${encodeURIComponent(path)}`, { credentials: 'include', ...options })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

// complexity: 3
function rubricColor(code?: string) {
  if (code === 'R1') return { bg: '#E3EFF9', color: '#2B6CB0' }
  if (code === 'R2') return { bg: '#E8F5EC', color: '#2D7D46' }
  if (code === 'R3') return { bg: '#FAF8F3', color: '#B0A07A' }
  return { bg: '#F0F4F7', color: '#5A7085' }
}

// complexity: 3
function rubricWeight(code: string) {
  if (code === 'R1') return '70%'
  if (code === 'R2') return '25%'
  if (code === 'R3') return '5%'
  return '—'
}

// complexity: 3
function extractLetters(words: string[]): string {
  if (words.length === 1) return words[0].slice(0, 3)
  if (words.length === 2) return words[0].slice(0, 2) + words[1].slice(0, 1)
  return words.map(w => w[0]).join('').slice(0, 3)
}

// complexity: 1
function generateCode(name: string, existingCount: number): string {
  const words = name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z\s]/g, '').toUpperCase().trim()
    .split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  return `${extractLetters(words)}-${String(existingCount + 1).padStart(3, '0')}`
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK  (complexity per function: ≤ 6 each, all independent)
// ═══════════════════════════════════════════════════════════════════════════════

function useSchoolSettings() {
  const { toast } = useToast()

  // data
  const [schoolInfo,        setSchoolInfo]        = useState<SchoolInfo>(DEFAULT_SCHOOL_INFO)
  const [loadingSchoolInfo, setLoadingSchoolInfo] = useState(false)
  const [schoolInfoLoaded,  setSchoolInfoLoaded]  = useState(false)
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [events,   setEvents]   = useState<SchoolEvent[]>([])
  const [rubrics,  setRubrics]  = useState<Rubric[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loadingRef,        setLoadingRef]        = useState(false)
  const [referentielLoaded, setReferentielLoaded] = useState(false)
  const [expandedSubjects,  setExpandedSubjects]  = useState<Set<string>>(new Set())
  const [classTypes,     setClassTypes]     = useState<ClassType[]>([])
  const [classes,        setClasses]        = useState<Class[]>([])
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [classesLoaded,  setClassesLoaded]  = useState(false)
  const [initializing,   setInitializing]   = useState(false)
  const [attitudes,        setAttitudes]        = useState<Attitude[]>([])
  const [loadingAttitudes, setLoadingAttitudes] = useState(false)
  const [attitudesLoaded,  setAttitudesLoaded]  = useState(false)
  const [currentYearId,    setCurrentYearId]    = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("general")

  // modals
  const [rubricModal,     setRubricModal]     = useState(false)
  const [subjectModal,    setSubjectModal]    = useState(false)
  const [sectionModal,    setSectionModal]    = useState(false)
  const [attitudeModal,   setAttitudeModal]   = useState(false)
  const [classModal,      setClassModal]      = useState(false)
  const [submitting,      setSubmitting]      = useState(false)
  const [editingRubric,   setEditingRubric]   = useState<Rubric | null>(null)
  const [editingSubject,  setEditingSubject]  = useState<Subject | null>(null)
  const [editingClass,    setEditingClass]    = useState<Class | null>(null)
  const [editingAttitude, setEditingAttitude] = useState<Attitude | null>(null)
  const [sectionParentId, setSectionParentId] = useState<string | null>(null)
  const [rubricForm,    setRubricForm]    = useState<RubricForm>({ name: '', code: '', description: '' })
  const [subjectForm,   setSubjectForm]   = useState<SubjectForm>({ name: '', code: '', maxScore: '100', coefficient: '1', hasSections: false, rubricId: '' })
  const [sectionForm,   setSectionForm]   = useState<SectionForm>({ name: '', code: '', maxScore: '100', cycles: [] })
  const [classForm,     setClassForm]     = useState<ClassForm>({ maxStudents: '30' })
  const [attitudeLabel, setAttitudeLabel] = useState("")

  // ── Loaders ────────────────────────────────────────────── complexity: 1 each

  const loadReferentiel = useCallback(async () => {
    setLoadingRef(true)
    try {
      const [rubricsData, subjectsData] = await Promise.all([
        apiFetch<Rubric[]>('/api/subject-rubrics/'),
        apiFetch<Subject[]>('/api/subjects/'),
      ])
      setRubrics(rubricsData)
      setSubjects(subjectsData.map(s => ({ ...s, sections: [], rubric: rubricsData.find(r => r.id === s.rubricId) })))
    } catch (err) { console.error('[settings] referentiel:', err) }
    finally { setLoadingRef(false) }
  }, [])

  const loadClasses = useCallback(async () => {
    setLoadingClasses(true)
    try {
      const [ctData, clData] = await Promise.all([
        apiFetch<ClassType[]>('/api/class-types/'),
        apiFetch<Class[]>('/api/classes/'),
      ])
      setClassTypes(ctData)
      setClasses(clData.map(c => ({ ...c, classType: ctData.find(ct => ct.id === c.classTypeId) })))
    } catch (err) { console.error('[settings] classes:', err) }
    finally { setLoadingClasses(false) }
  }, [])

  const loadAttitudes = useCallback(async (yearId: string) => {
    setLoadingAttitudes(true)
    try {
      const data = await fetch(`/api/attitudes?academicYearId=${yearId}`, { credentials: 'include' }).then(r => r.json())
      setAttitudes(Array.isArray(data) ? data : [])
    } catch (err) { console.error('[settings] attitudes:', err) }
    finally { setLoadingAttitudes(false) }
  }, [])

  // ── Effects ────────────────────────────────────────────── complexity: 4 / 3

  useEffect(() => {
    if (activeTab === 'referentiel' && !referentielLoaded) { loadReferentiel(); setReferentielLoaded(true) }
    if (activeTab === 'classes'     && !classesLoaded)     { loadClasses();     setClassesLoaded(true) }
    if (activeTab === 'attitudes'   && !attitudesLoaded) {
      setAttitudesLoaded(true)
      fetch('/api/academic-years/current', { credentials: 'include' }).then(r => r.json())
        .then(data => {
          const yearId = data?.id ?? data?.academicYear?.id
          if (yearId) { setCurrentYearId(yearId); loadAttitudes(yearId) }
        })
        .catch(err => console.error('[settings] current year:', err))
    }
  }, [activeTab, referentielLoaded, classesLoaded, attitudesLoaded, loadReferentiel, loadClasses, loadAttitudes])

  useEffect(() => {
    if (activeTab !== 'general' || schoolInfoLoaded) return
    setSchoolInfoLoaded(true)
    setLoadingSchoolInfo(true)
    fetch('/api/school-info', { credentials: 'include' }).then(r => r.json())
      .then(data => {
        if (data) setSchoolInfo({ name: data.name ?? DEFAULT_SCHOOL_INFO.name, motto: data.motto ?? '', foundedYear: data.foundedYear, logo: data.logo ?? '', address: data.address ?? '', phone: data.phone ?? '', email: data.email ?? '' })
      })
      .catch(err => console.error('[settings] school-info:', err))
      .finally(() => setLoadingSchoolInfo(false))
  }, [activeTab, schoolInfoLoaded])

  // ── School info ─────────────────────────────────────────── complexity: 1

  const handleSaveSchoolInfo = async (info: SchoolInfo) => {
    setSchoolInfo(info)
    try {
      await fetch('/api/school-info/update', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(info) })
      toast({ title: "Paramètres enregistrés" })
    } catch { toast({ title: "Erreur", description: "Impossible de sauvegarder", variant: "destructive" }) }
  }

  // ── Calendar ─────────────────────────────────────────────── complexity: 0-1

  const handleAddHoliday    = (d: { name: string; date: string }) => setHolidays(p => [...p, { id: `h-${Date.now()}`, ...d }])
  const handleEditHoliday   = (id: string, d: { name: string; date: string }) => setHolidays(p => p.map(h => h.id === id ? { ...h, ...d } : h))
  const handleDeleteHoliday = (id: string) => setHolidays(p => p.filter(h => h.id !== id))
  const handleAddEvent      = (d: { title: string; date: string; type: SchoolEvent['type'] }) => setEvents(p => [...p, { id: `e-${Date.now()}`, ...d, academicYearId: '' }])
  const handleEditEvent     = (id: string, d: { title: string; date: string; type: SchoolEvent['type'] }) => setEvents(p => p.map(e => e.id === id ? { ...e, ...d } : e))
  const handleDeleteEvent   = (id: string) => setEvents(p => p.filter(e => e.id !== id))

  // ── Rubric handlers ──────────────────────────────────────── complexity: 2

  const openCreateRubric = () => { setEditingRubric(null); setRubricForm({ name: '', code: '', description: '' }); setRubricModal(true) }
  const openEditRubric   = (r: Rubric) => { setEditingRubric(r); setRubricForm({ name: r.name, code: r.code, description: r.description || '' }); setRubricModal(true) }

  const handleSaveRubric = async () => {
    setSubmitting(true)
    try {
      if (editingRubric) {
        await apiFetch(`/api/subject-rubrics/update/${editingRubric.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rubricForm) })
        toast({ title: "Rubrique modifiée" })
      } else {
        await apiFetch('/api/subject-rubrics/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rubricForm) })
        toast({ title: "Rubrique créée" })
      }
      setRubricModal(false); loadReferentiel()
    } catch { toast({ title: "Erreur", variant: "destructive" }) }
    finally { setSubmitting(false) }
  }

  // ── Subject handlers ─────────────────────────────────────── complexity: 2

  const openCreateSubject = () => { setEditingSubject(null); setSubjectForm({ name: '', code: '', maxScore: '100', coefficient: '1', hasSections: false, rubricId: '' }); setSubjectModal(true) }
  const openEditSubject   = (s: Subject) => { setEditingSubject(s); setSubjectForm({ name: s.name, code: s.code, maxScore: String(s.maxScore), coefficient: String(s.coefficient), hasSections: s.hasSections, rubricId: s.rubricId || '' }); setSubjectModal(true) }

  const handleSubjectNameChange = (name: string) => {
    setSubjectForm(f => ({ ...f, name, ...(!editingSubject && { code: generateCode(name, subjects.length) }) }))
  }

  const handleSaveSubject = async () => {
    setSubmitting(true)
    try {
      const body = { name: subjectForm.name, code: subjectForm.code, maxScore: Number.parseFloat(subjectForm.maxScore), coefficient: Number.parseFloat(subjectForm.coefficient), hasSections: subjectForm.hasSections, rubricId: subjectForm.rubricId || null }
      if (editingSubject) {
        await apiFetch(`/api/subjects/update/${editingSubject.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        toast({ title: "Matière modifiée" })
      } else {
        await apiFetch('/api/subjects/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        toast({ title: "Matière créée" })
      }
      setSubjectModal(false); loadReferentiel()
    } catch { toast({ title: "Erreur", variant: "destructive" }) }
    finally { setSubmitting(false) }
  }

  // ── Section handlers ─────────────────────────────────────── complexity: 4

  const openCreateSection = (subjectId: string) => { setSectionParentId(subjectId); setSectionForm({ name: '', code: '', maxScore: '100', cycles: [] }); setSectionModal(true) }

  const handleSectionNameChange = (name: string) => {
    const parent = subjects.find(s => s.id === sectionParentId)
    setSectionForm(f => ({ ...f, name, code: generateCode(name, parent?.sections?.length || 0) }))
  }

  const toggleSectionCycle = (key: string, checked: boolean) => {
    setSectionForm(f => ({ ...f, cycles: checked ? [...f.cycles, key] : f.cycles.filter(c => c !== key) }))
  }

  const handleSaveSection = async () => {
    if (!sectionParentId) return
    setSubmitting(true)
    try {
      const parent = subjects.find(s => s.id === sectionParentId)
      const result = await apiFetch<any>(`/api/subjects/${sectionParentId}/sections/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sectionForm.name, code: sectionForm.code, maxScore: parseFloat(sectionForm.maxScore), displayOrder: (parent?.sections?.length || 0) + 1 })
      })
      const sectionId = result?.section?.id
      if (sectionId && sectionForm.cycles.length > 0) saveSectionCycles(sectionId, sectionForm.cycles)
      toast({ title: "Sous-matière créée" }); setSectionModal(false); loadReferentiel()
    } catch { toast({ title: "Erreur", variant: "destructive" }) }
    finally { setSubmitting(false) }
  }

  // ── Expand ───────────────────────────────────────────────── complexity: 4

  const toggleExpand = async (subjectId: string) => {
    setExpandedSubjects(prev => { const n = new Set(prev); n.has(subjectId) ? n.delete(subjectId) : n.add(subjectId); return n })
    const subject = subjects.find(s => s.id === subjectId)
    if (subject?.hasSections && (!subject.sections || subject.sections.length === 0)) {
      try {
        const sections = await apiFetch<Section[]>(`/api/subjects/${subjectId}/sections`)
        setSubjects(prev => prev.map(s => s.id === subjectId ? { ...s, sections } : s))
      } catch { /* ignore */ }
    }
  }

  // ── Attitude handlers ────────────────────────────────────── complexity: 3

  const openCreateAttitude = () => { setEditingAttitude(null); setAttitudeLabel(""); setAttitudeModal(true) }
  const openEditAttitude   = (a: Attitude) => { setEditingAttitude(a); setAttitudeLabel(a.label); setAttitudeModal(true) }

  const handleSaveAttitude = async () => {
    if (!attitudeLabel.trim() || !currentYearId) return
    setSubmitting(true)
    try {
      if (editingAttitude) {
        await fetch(`/api/attitudes/update/${editingAttitude.id}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: attitudeLabel.trim() }) })
        toast({ title: "Attitude modifiée" })
      } else {
        await fetch('/api/attitudes/create', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: attitudeLabel.trim(), academicYearId: currentYearId }) })
        toast({ title: "Attitude créée" })
      }
      setAttitudeModal(false); loadAttitudes(currentYearId)
    } catch { toast({ title: "Erreur", variant: "destructive" }) }
    finally { setSubmitting(false) }
  }

  const handleDeleteAttitude = async (attitude: Attitude) => {
    if (!currentYearId) return
    try {
      await fetch(`/api/attitudes/delete/${attitude.id}`, { method: 'POST', credentials: 'include' })
      toast({ title: "Attitude supprimée" }); loadAttitudes(currentYearId)
    } catch { toast({ title: "Erreur", variant: "destructive" }) }
  }

  // ── Class handlers ───────────────────────────────────────── complexity: 4

  const handleInitializeClasses = async () => {
    setInitializing(true)
    try {
      const createdTypes: any[] = []
      for (const ct of CLASS_TYPES_SEED) {
        const res = await apiFetch<any>('/api/class-types/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ct) })
        createdTypes.push(res)
      }
      await Promise.all(createdTypes.map((res: any) => {
        const id = res?.classType?.id ?? res?.data?.id ?? res?.id
        if (!id) return Promise.resolve()
        return apiFetch('/api/classes/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classTypeId: id, letter: 'A', maxStudents: 30 }) })
      }))
      toast({ title: "Initialisation réussie", description: "13 niveaux et 13 classes créés." })
      await loadClasses()
    } catch { toast({ title: "Erreur", description: "Impossible d'initialiser", variant: "destructive" }) }
    finally { setInitializing(false) }
  }

  const openEditClass = (c: Class) => { setEditingClass(c); setClassForm({ maxStudents: String(c.maxStudents || 30) }); setClassModal(true) }

  const handleSaveClass = async () => {
    if (!editingClass) return
    setSubmitting(true)
    try {
      await apiFetch(`/api/classes/update/${editingClass.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ maxStudents: parseInt(classForm.maxStudents) || undefined }) })
      toast({ title: "Classe modifiée" }); setClassModal(false); setClassesLoaded(false); loadClasses()
    } catch { toast({ title: "Erreur", variant: "destructive" }) }
    finally { setSubmitting(false) }
  }

  return {
    activeTab, setActiveTab,
    schoolInfo, loadingSchoolInfo, handleSaveSchoolInfo,
    holidays, events, handleAddHoliday, handleEditHoliday, handleDeleteHoliday, handleAddEvent, handleEditEvent, handleDeleteEvent,
    loadingRef, rubrics, subjects, expandedSubjects, toggleExpand,
    openCreateRubric, openEditRubric, openCreateSubject, openEditSubject, openCreateSection,
    loadingClasses, classTypes, classes, initializing, handleInitializeClasses, openEditClass,
    loadingAttitudes, attitudes, currentYearId, openCreateAttitude, openEditAttitude, handleDeleteAttitude,
    rubricModal, setRubricModal, subjectModal, setSubjectModal, sectionModal, setSectionModal,
    attitudeModal, setAttitudeModal, classModal, setClassModal, submitting,
    editingRubric, editingSubject, editingClass, editingAttitude,
    rubricForm, setRubricForm, subjectForm, setSubjectForm, sectionForm, setSectionForm, classForm, setClassForm,
    attitudeLabel, setAttitudeLabel, sectionParentId,
    handleSubjectNameChange, handleSectionNameChange, toggleSectionCycle,
    handleSaveRubric, handleSaveSubject, handleSaveSection, handleSaveAttitude, handleSaveClass,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB COMPONENTS  (complexity: 1 each — only the early-return guard)
// ═══════════════════════════════════════════════════════════════════════════════

interface ReferentielTabProps {
  loading: boolean; rubrics: Rubric[]; subjects: Subject[]; expandedSubjects: Set<string>
  onCreateRubric: () => void; onEditRubric: (r: Rubric) => void
  onCreateSubject: () => void; onEditSubject: (s: Subject) => void
  onCreateSection: (id: string) => void; onToggleExpand: (id: string) => void
}

function ReferentielTab({ loading, rubrics, subjects, expandedSubjects, onCreateRubric, onEditRubric, onCreateSubject, onEditSubject, onCreateSection, onToggleExpand }: ReferentielTabProps) {
  if (loading) return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>
  return (
    <>
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E8E6E3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8E6E3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: '#2A3740' }}>Rubriques ({rubrics.length})</h3>
            <p style={{ fontSize: '13px', color: '#78756F', marginTop: '2px' }}>Formule BR-001 : R1 × 70% + R2 × 25% + R3 × 5%</p>
          </div>
          <Button onClick={onCreateRubric} disabled={rubrics.length >= 3} title={rubrics.length >= 3 ? "Maximum 3 rubriques" : undefined}
            style={{ backgroundColor: rubrics.length >= 3 ? '#9CA3AF' : '#2C4A6E', color: 'white', borderRadius: '8px' }}>
            <PlusIcon className="mr-2 h-4 w-4" />Nouvelle rubrique
          </Button>
        </div>
        <div style={{ padding: '24px' }}>
          <div style={{ borderRadius: '8px', border: '1px solid #E8E6E3', overflow: 'hidden' }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: '#F1F5F9', borderBottom: '2px solid #D1D5DB' }}>
                  <TableHead style={TH}>Code</TableHead><TableHead style={TH}>Nom</TableHead>
                  <TableHead style={TH}>Description</TableHead><TableHead style={TH}>Poids BR-001</TableHead>
                  <TableHead style={{ ...TH, textAlign: 'center' }}>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rubrics.length === 0
                  ? <TableRow><TableCell colSpan={5} style={{ textAlign: 'center', color: '#78756F', padding: '32px' }}>Aucune rubrique — créez R1, R2, R3</TableCell></TableRow>
                  : rubrics.map((r, i) => {
                      const c = rubricColor(r.code)
                      return (
                        <TableRow key={r.id} style={{ borderTop: i > 0 ? '1px solid #E8E6E3' : 'none' }}>
                          <TableCell><Badge style={{ backgroundColor: c.bg, color: c.color, border: 'none', fontWeight: 700 }}>{r.code}</Badge></TableCell>
                          <TableCell style={{ fontWeight: 600, color: '#1E1A17', fontSize: '14px' }}>{r.name}</TableCell>
                          <TableCell style={{ color: '#78756F', fontSize: '13px' }}>{r.description || '—'}</TableCell>
                          <TableCell style={{ fontWeight: 700, color: c.color, fontSize: '14px' }}>{rubricWeight(r.code)}</TableCell>
                          <TableCell style={{ textAlign: 'center' }}>
                            <button onClick={() => onEditRubric(r)} style={{ fontSize: '13px', fontWeight: 500, color: '#5A7085', background: 'none', border: 'none', cursor: 'pointer' }}>Modifier</button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E8E6E3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8E6E3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: '#2A3740' }}>Matières ({subjects.length})</h3>
            <p style={{ fontSize: '13px', color: '#78756F', marginTop: '2px' }}>Référentiel global — assignées aux classes dans la configuration de l&apos;année</p>
          </div>
          <Button onClick={onCreateSubject} disabled={rubrics.length === 0} title={rubrics.length === 0 ? "Créez d'abord les rubriques" : undefined}
            style={{ backgroundColor: rubrics.length === 0 ? '#9CA3AF' : '#2C4A6E', color: 'white', borderRadius: '8px' }}>
            <PlusIcon className="mr-2 h-4 w-4" />Nouvelle matière
          </Button>
        </div>
        <div style={{ padding: '24px' }}>
          <div style={{ borderRadius: '8px', border: '1px solid #E8E6E3', overflow: 'hidden' }}>
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: '#F1F5F9', borderBottom: '2px solid #D1D5DB' }}>
                  <TableHead style={{ ...TH, width: '3%' }}></TableHead>
                  <TableHead style={TH}>Code</TableHead><TableHead style={TH}>Nom</TableHead>
                  <TableHead style={TH}>Rubrique</TableHead><TableHead style={TH}>Coeff.</TableHead>
                  <TableHead style={TH}>Max</TableHead><TableHead style={{ ...TH, textAlign: 'center' }}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.length === 0
                  ? <TableRow><TableCell colSpan={7} style={{ textAlign: 'center', color: '#78756F', padding: '32px' }}>
                      {rubrics.length === 0 ? "Créez d'abord les rubriques (R1, R2, R3)" : "Aucune matière — créez la première"}
                    </TableCell></TableRow>
                  : subjects.map((subject, i) => {
                      const isExpanded = expandedSubjects.has(subject.id)
                      const c = rubricColor(subject.rubric?.code)
                      return (
                        <React.Fragment key={subject.id}>
                          <TableRow style={{ borderTop: i > 0 ? '1px solid #E8E6E3' : 'none', backgroundColor: 'white' }} className="hover:bg-[#FAF8F3]">
                            <TableCell style={{ padding: '12px 8px' }}>
                              {subject.hasSections && (
                                <button onClick={() => onToggleExpand(subject.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5A7085', display: 'flex' }}>
                                  {isExpanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                                </button>
                              )}
                            </TableCell>
                            <TableCell style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 600, color: '#1E1A17', textTransform: 'uppercase' }}>{subject.code}</TableCell>
                            <TableCell style={{ fontWeight: 600, color: '#1E1A17', fontSize: '14px' }}>{subject.name}</TableCell>
                            <TableCell>
                              {subject.rubric
                                ? <Badge style={{ backgroundColor: c.bg, color: c.color, border: 'none' }}>{subject.rubric.code}</Badge>
                                : <span style={{ color: '#A8A5A2' }}>—</span>}
                            </TableCell>
                            <TableCell style={{ fontSize: '14px' }}>{subject.coefficient}</TableCell>
                            <TableCell style={{ fontSize: '14px' }}>{subject.maxScore}</TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => onCreateSection(subject.id)} style={{ fontSize: '12px', fontWeight: 500, color: '#2C4A6E', background: 'none', border: 'none', cursor: 'pointer' }}>+ Section</button>
                                <span style={{ color: '#D1CECC' }}>|</span>
                                <button onClick={() => onEditSubject(subject)} style={{ fontSize: '13px', fontWeight: 500, color: '#5A7085', background: 'none', border: 'none', cursor: 'pointer' }}>Modifier</button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded && subject.sections?.map(section => {
                            const cycles = getSectionCycles(section.id)
                            return (
                              <TableRow key={section.id} style={{ borderTop: '1px solid #E8E6E3', backgroundColor: '#FAFAF8' }}>
                                <TableCell></TableCell>
                                <TableCell style={{ paddingLeft: '24px', fontFamily: 'monospace', fontSize: '11px', color: '#78756F', textTransform: 'uppercase' }}>
                                  <span style={{ color: '#A8A5A2' }}>└ </span>{section.code}
                                </TableCell>
                                <TableCell style={{ fontSize: '13px', color: '#1E1A17' }}>{section.name}</TableCell>
                                <TableCell>
                                  <div className="flex gap-1 flex-wrap">
                                    {cycles.length > 0
                                      ? cycles.map(cyc => <span key={cyc} style={{ backgroundColor: '#E3EFF9', color: '#2B6CB0', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>{cyc}</span>)
                                      : <span style={{ color: '#A8A5A2', fontSize: '12px' }}>Tous les cycles</span>}
                                  </div>
                                </TableCell>
                                <TableCell style={{ fontSize: '13px', color: '#78756F' }}>{section.maxScore}</TableCell>
                                <TableCell></TableCell>
                              </TableRow>
                            )
                          })}
                        </React.Fragment>
                      )
                    })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  )
}

function ClassesTab({ loading, classTypes, classes, initializing, onInitialize, onEditClass }: {
  loading: boolean; classTypes: ClassType[]; classes: Class[]
  initializing: boolean; onInitialize: () => void; onEditClass: (c: Class) => void
}) {
  if (loading) return <Skeleton className="h-64 w-full" />
  return (
    <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E8E6E3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8E6E3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: '#2A3740' }}>Classes ({classes.length} / {classTypes.length || 13})</h3>
          <p style={{ fontSize: '13px', color: '#78756F', marginTop: '2px' }}>Référentiel permanent — salle A par défaut pour chaque niveau</p>
        </div>
        {classTypes.length === 0 && (
          <Button onClick={onInitialize} disabled={initializing} style={{ backgroundColor: '#2C4A6E', color: 'white', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ZapIcon className="h-4 w-4" />{initializing ? 'Initialisation...' : 'Initialiser niveaux & classes'}
          </Button>
        )}
        {classes.length > 0 && (
          <div className="flex items-center gap-2" style={{ color: '#2D7D46', fontSize: '13px', fontWeight: 500 }}>
            <CheckCircle2Icon className="h-4 w-4" />Classes initialisées
          </div>
        )}
      </div>
      <div style={{ padding: '24px' }}>
        {classTypes.length === 0
          ? (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <p style={{ fontSize: '16px', fontWeight: 600, color: '#3A4A57', marginBottom: '8px' }}>Aucun niveau configuré</p>
              <p style={{ fontSize: '13px', color: '#78756F', marginBottom: '24px' }}>Cliquez sur &quot;Initialiser niveaux &amp; classes&quot; pour créer les 13 niveaux MENFP.</p>
              <Button onClick={onInitialize} disabled={initializing} style={{ backgroundColor: '#2C4A6E', color: 'white', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <ZapIcon className="h-4 w-4" />{initializing ? 'Initialisation en cours...' : 'Initialiser niveaux & classes'}
              </Button>
            </div>
          )
          : (
            <div style={{ borderRadius: '8px', border: '1px solid #E8E6E3', overflow: 'hidden' }}>
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: '#F1F5F9', borderBottom: '2px solid #D1D5DB' }}>
                    <TableHead style={TH}>Niveau</TableHead><TableHead style={TH}>Type</TableHead>
                    <TableHead style={TH}>Max élèves</TableHead>
                    <TableHead style={{ ...TH, textAlign: 'center' }}>Statut</TableHead>
                    <TableHead style={{ ...TH, textAlign: 'center' }}>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classTypes.map((ct, i) => {
                    const cls = classes.find(c => c.classTypeId === ct.id)
                    return (
                      <TableRow key={ct.id} style={{ borderTop: i > 0 ? '1px solid #E8E6E3' : 'none' }}>
                        <TableCell style={{ fontWeight: 700, color: '#1E1A17', fontSize: '14px' }}>{ct.name}</TableCell>
                        <TableCell>
                          {ct.isTerminal
                            ? <Badge style={{ backgroundColor: '#FEF6E0', color: '#C48B1A', border: 'none', fontSize: '11px' }}>Examen</Badge>
                            : <Badge style={{ backgroundColor: '#F0F4F7', color: '#5A7085', border: 'none', fontSize: '11px' }}>Standard</Badge>}
                        </TableCell>
                        <TableCell style={{ fontSize: '13px', color: '#78756F' }}>{cls?.maxStudents ?? '—'}</TableCell>
                        <TableCell style={{ textAlign: 'center' }}>
                          {cls
                            ? <Badge style={{ backgroundColor: '#E8F5EC', color: '#2D7D46', border: 'none', fontSize: '11px' }}>✓ Créée</Badge>
                            : <Badge style={{ backgroundColor: '#FEF6E0', color: '#C48B1A', border: 'none', fontSize: '11px' }}>En attente</Badge>}
                        </TableCell>
                        <TableCell style={{ textAlign: 'center' }}>
                          {cls
                            ? <button onClick={() => onEditClass(cls)} style={{ fontSize: '13px', fontWeight: 500, color: '#5A7085', background: 'none', border: 'none', cursor: 'pointer' }}>Modifier</button>
                            : <span style={{ color: '#D1CECC', fontSize: '13px' }}>—</span>}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
      </div>
    </div>
  )
}

function AttitudesTab({ loading, attitudes, currentYearId, onCreateAttitude, onEditAttitude, onDeleteAttitude }: {
  loading: boolean; attitudes: Attitude[]; currentYearId: string | null
  onCreateAttitude: () => void; onEditAttitude: (a: Attitude) => void; onDeleteAttitude: (a: Attitude) => void
}) {
  if (loading) return <Skeleton className="h-64 w-full" />
  return (
    <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E8E6E3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8E6E3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: '#2A3740' }}>Attitudes ({attitudes.length})</h3>
          <p style={{ fontSize: '13px', color: '#78756F', marginTop: '2px' }}>Caractéristiques de comportement — Oui / Non par élève</p>
        </div>
        <Button onClick={onCreateAttitude} disabled={!currentYearId} title={!currentYearId ? "Aucune année active" : undefined}
          style={{ backgroundColor: !currentYearId ? '#9CA3AF' : '#2C4A6E', color: 'white', borderRadius: '8px' }}>
          <PlusIcon className="mr-2 h-4 w-4" />Nouvelle attitude
        </Button>
      </div>
      {!currentYearId && (
        <div style={{ padding: '32px', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: '#C48B1A' }}>Aucune année scolaire active. Activez une année dans la configuration.</p>
        </div>
      )}
      {currentYearId && (
        <div style={{ padding: '24px' }}>
          {attitudes.length === 0
            ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', border: '1px dashed #D1CECC', borderRadius: '8px' }}>
                <p style={{ fontSize: '15px', fontWeight: 600, color: '#3A4A57', marginBottom: '6px' }}>Aucune attitude configurée</p>
                <p style={{ fontSize: '13px', color: '#78756F', marginBottom: '20px' }}>Exemples : Respectueux(se), Ponctuel(le), Attentif(ve)</p>
                <Button onClick={onCreateAttitude} style={{ backgroundColor: '#2C4A6E', color: 'white', borderRadius: '8px' }}>
                  <PlusIcon className="mr-2 h-4 w-4" />Créer la première attitude
                </Button>
              </div>
            )
            : (
              <div style={{ borderRadius: '8px', border: '1px solid #E8E6E3', overflow: 'hidden' }}>
                <Table>
                  <TableHeader>
                    <TableRow style={{ backgroundColor: '#F1F5F9', borderBottom: '2px solid #D1D5DB' }}>
                      <TableHead style={TH}>#</TableHead><TableHead style={TH}>Libellé</TableHead>
                      <TableHead style={{ ...TH, textAlign: 'center' }}>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attitudes.map((att, i) => (
                      <TableRow key={att.id} style={{ borderTop: i > 0 ? '1px solid #E8E6E3' : 'none' }}>
                        <TableCell style={{ width: '48px', color: '#A8A5A2', fontSize: '13px', fontWeight: 500 }}>{i + 1}</TableCell>
                        <TableCell style={{ fontWeight: 600, color: '#1E1A17', fontSize: '14px' }}>{att.label}</TableCell>
                        <TableCell style={{ textAlign: 'center' }}>
                          <div className="flex items-center justify-center gap-3">
                            <button onClick={() => onEditAttitude(att)} style={{ fontSize: '13px', fontWeight: 500, color: '#5A7085', background: 'none', border: 'none', cursor: 'pointer' }}>Modifier</button>
                            <span style={{ color: '#D1CECC' }}>|</span>
                            <button onClick={() => onDeleteAttitude(att)} style={{ fontSize: '13px', fontWeight: 500, color: '#C43C3C', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Trash2Icon className="h-3.5 w-3.5" />Supprimer
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL COMPONENTS  (complexity: 0 each — pure JSX, no branches in the function body)
// ═══════════════════════════════════════════════════════════════════════════════

function RubricModal({ open, onOpenChange, form, onChange, editing, submitting, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; form: RubricForm; onChange: (f: RubricForm) => void
  editing: Rubric | null; submitting: boolean; onSave: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ backgroundColor: 'white', borderRadius: '12px' }}>
        <DialogHeader>
          <DialogTitle className="font-serif" style={{ fontSize: '22px', fontWeight: 700, color: '#2A3740' }}>{editing ? 'Modifier la rubrique' : 'Nouvelle rubrique'}</DialogTitle>
          <DialogDescription className="sr-only">Formulaire rubrique</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label style={{ fontSize: '13px', fontWeight: 500 }}>Code * <span style={{ color: '#78756F', fontWeight: 400 }}>(ex: R1)</span></Label>
              <Input value={form.code} onChange={e => onChange({ ...form, code: e.target.value.toUpperCase() })} disabled={!!editing}
                style={{ borderColor: '#D1CECC', backgroundColor: editing ? '#F5F4F2' : 'white' }} placeholder="R1" />
              {editing && <p style={{ fontSize: '11px', color: '#78756F' }}>Le code ne peut pas être modifié</p>}
            </div>
            <div className="space-y-1">
              <Label style={{ fontSize: '13px', fontWeight: 500 }}>Nom *</Label>
              <Input value={form.name} onChange={e => onChange({ ...form, name: e.target.value })} style={{ borderColor: '#D1CECC' }} placeholder="Ex: Évaluation continue" />
            </div>
          </div>
          <div className="space-y-1">
            <Label style={{ fontSize: '13px', fontWeight: 500 }}>Description</Label>
            <Input value={form.description} onChange={e => onChange({ ...form, description: e.target.value })} style={{ borderColor: '#D1CECC' }} />
          </div>
          <div style={{ backgroundColor: '#F0F4F7', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#5A7085' }}>
            <strong>Poids BR-001 :</strong> R1 = 70% · R2 = 25% · R3 = 5%
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} style={{ borderColor: '#D1CECC' }}>Annuler</Button>
          <Button onClick={onSave} disabled={submitting || !form.name || !form.code} style={{ backgroundColor: '#2C4A6E', color: 'white' }}>
            {submitting ? 'En cours...' : editing ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SubjectModal({ open, onOpenChange, form, onChange, onNameChange, rubrics, editing, submitting, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; form: SubjectForm; onChange: (f: SubjectForm) => void
  onNameChange: (name: string) => void; rubrics: Rubric[]; editing: Subject | null; submitting: boolean; onSave: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ backgroundColor: 'white', borderRadius: '12px' }}>
        <DialogHeader>
          <DialogTitle className="font-serif" style={{ fontSize: '22px', fontWeight: 700, color: '#2A3740' }}>{editing ? 'Modifier la matière' : 'Nouvelle matière'}</DialogTitle>
          <DialogDescription className="sr-only">Formulaire matière</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label style={{ fontSize: '13px', fontWeight: 500 }}>Nom *</Label>
              <Input value={form.name} onChange={e => onNameChange(e.target.value)} style={{ borderColor: '#D1CECC' }} />
            </div>
            <div className="space-y-1">
              <Label style={{ fontSize: '13px', fontWeight: 500 }}>Code</Label>
              <Input value={form.code} readOnly={!editing} onChange={e => editing && onChange({ ...form, code: e.target.value.toUpperCase() })}
                style={{ borderColor: '#D1CECC', backgroundColor: !editing ? '#F5F4F2' : 'white' }} />
              {!editing && <p style={{ fontSize: '11px', color: '#78756F' }}>Généré automatiquement depuis le nom</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label style={{ fontSize: '13px', fontWeight: 500 }}>Coefficient</Label>
              <Input type="number" step="0.5" value={form.coefficient} onChange={e => onChange({ ...form, coefficient: e.target.value })} style={{ borderColor: '#D1CECC' }} />
            </div>
            <div className="space-y-1">
              <Label style={{ fontSize: '13px', fontWeight: 500 }}>Note max</Label>
              <Input type="number" value={form.maxScore} onChange={e => onChange({ ...form, maxScore: e.target.value })} style={{ borderColor: '#D1CECC' }} />
            </div>
          </div>
          <div className="space-y-1">
            <Label style={{ fontSize: '13px', fontWeight: 500 }}>Rubrique *</Label>
            <Select value={form.rubricId} onValueChange={v => onChange({ ...form, rubricId: v })}>
              <SelectTrigger style={{ borderColor: '#D1CECC' }}><SelectValue placeholder="Sélectionner une rubrique" /></SelectTrigger>
              <SelectContent>{rubrics.map(r => <SelectItem key={r.id} value={r.id}>{r.code} — {r.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="hasSections" checked={form.hasSections} onChange={e => onChange({ ...form, hasSections: e.target.checked })} />
            <Label htmlFor="hasSections" style={{ fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Cette matière a des sous-matières (sections)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} style={{ borderColor: '#D1CECC' }}>Annuler</Button>
          <Button onClick={onSave} disabled={submitting || !form.name || !form.code} style={{ backgroundColor: '#2C4A6E', color: 'white' }}>
            {submitting ? 'En cours...' : editing ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SectionModal({ open, onOpenChange, form, onChange, onNameChange, onToggleCycle, submitting, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; form: SectionForm; onChange: (f: SectionForm) => void
  onNameChange: (name: string) => void; onToggleCycle: (key: string, checked: boolean) => void
  submitting: boolean; onSave: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ backgroundColor: 'white', borderRadius: '12px' }}>
        <DialogHeader>
          <DialogTitle className="font-serif" style={{ fontSize: '22px', fontWeight: 700, color: '#2A3740' }}>Nouvelle sous-matière</DialogTitle>
          <DialogDescription className="sr-only">Formulaire sous-matière</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label style={{ fontSize: '13px', fontWeight: 500 }}>Nom *</Label>
              <Input value={form.name} onChange={e => onNameChange(e.target.value)} style={{ borderColor: '#D1CECC' }} />
            </div>
            <div className="space-y-1">
              <Label style={{ fontSize: '13px', fontWeight: 500 }}>Code</Label>
              <Input value={form.code} readOnly style={{ borderColor: '#D1CECC', backgroundColor: '#F5F4F2' }} />
              <p style={{ fontSize: '11px', color: '#78756F' }}>Généré automatiquement depuis le nom</p>
            </div>
          </div>
          <div className="space-y-1">
            <Label style={{ fontSize: '13px', fontWeight: 500 }}>Note max</Label>
            <Input type="number" value={form.maxScore} onChange={e => onChange({ ...form, maxScore: e.target.value })} style={{ borderColor: '#D1CECC' }} />
          </div>
          <div className="space-y-2">
            <Label style={{ fontSize: '13px', fontWeight: 500 }}>
              Cycles applicables *
              <span style={{ color: '#78756F', fontWeight: 400, marginLeft: '6px', fontSize: '12px' }}>Dans quels cycles cette sous-matière est enseignée ?</span>
            </Label>
            <div style={{ border: '1px solid #E8E6E3', borderRadius: '8px', overflow: 'hidden' }}>
              {CYCLES_MENFP.map((cycle, i) => (
                <label key={cycle.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', cursor: 'pointer', borderTop: i > 0 ? '1px solid #F0EDE8' : 'none', backgroundColor: form.cycles.includes(cycle.key) ? '#F0F4F7' : 'white' }}>
                  <input type="checkbox" checked={form.cycles.includes(cycle.key)} onChange={e => onToggleCycle(cycle.key, e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#2C4A6E', cursor: 'pointer' }} />
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#1E1A17' }}>{cycle.label}</span>
                    <span style={{ fontSize: '12px', color: '#78756F', marginLeft: '8px' }}>{cycle.description}</span>
                  </div>
                </label>
              ))}
            </div>
            {form.cycles.length === 0 && <p style={{ fontSize: '11px', color: '#C48B1A' }}>⚠ Aucun cycle — la sous-matière s&apos;appliquera à toutes les classes</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} style={{ borderColor: '#D1CECC' }}>Annuler</Button>
          <Button onClick={onSave} disabled={submitting || !form.name || !form.code} style={{ backgroundColor: '#2C4A6E', color: 'white' }}>
            {submitting ? 'En cours...' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AttitudeModal({ open, onOpenChange, label, onLabelChange, editing, submitting, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; label: string; onLabelChange: (v: string) => void
  editing: Attitude | null; submitting: boolean; onSave: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ backgroundColor: 'white', borderRadius: '12px' }}>
        <DialogHeader>
          <DialogTitle className="font-serif" style={{ fontSize: '22px', fontWeight: 700, color: '#2A3740' }}>{editing ? "Modifier l'attitude" : 'Nouvelle attitude'}</DialogTitle>
          <DialogDescription style={{ fontSize: '13px', color: '#78756F' }}>L&apos;attitude sera évaluée Oui / Non pour chaque élève.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label style={{ fontSize: '13px', fontWeight: 500 }}>Libellé *</Label>
            <Input value={label} onChange={e => onLabelChange(e.target.value)} placeholder="Ex: Respectueux(se), Ponctuel(le)..."
              style={{ borderColor: '#D1CECC' }} onKeyDown={e => e.key === 'Enter' && onSave()} autoFocus />
          </div>
          <div style={{ backgroundColor: '#F0F4F7', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#5A7085' }}>
            Exemples : Respectueux(se) · Ponctuel(le) · Attentif(ve) · Travailleur(se) · Perturbateur(trice)
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} style={{ borderColor: '#D1CECC' }}>Annuler</Button>
          <Button onClick={onSave} disabled={submitting || !label.trim()} style={{ backgroundColor: '#2C4A6E', color: 'white' }}>
            {submitting ? 'En cours...' : editing ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ClassModal({ open, onOpenChange, form, onChange, editing, submitting, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; form: ClassForm; onChange: (f: ClassForm) => void
  editing: Class | null; submitting: boolean; onSave: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ backgroundColor: 'white', borderRadius: '12px' }}>
        <DialogHeader>
          <DialogTitle className="font-serif" style={{ fontSize: '22px', fontWeight: 700, color: '#2A3740' }}>Modifier la classe</DialogTitle>
          <DialogDescription className="sr-only">Modifier le nombre max d&apos;élèves</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div style={{ backgroundColor: '#F0F4F7', borderRadius: '8px', padding: '12px 16px' }}>
            <p style={{ fontSize: '12px', color: '#78756F', marginBottom: '4px' }}>Classe</p>
            <p style={{ fontSize: '16px', fontWeight: 700, color: '#2A3740' }}>{editing?.classType?.name} — Salle A</p>
          </div>
          <div className="space-y-1">
            <Label style={{ fontSize: '13px', fontWeight: 500 }}>Max élèves</Label>
            <Input type="number" value={form.maxStudents} onChange={e => onChange({ ...form, maxStudents: e.target.value })} style={{ borderColor: '#D1CECC' }} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} style={{ borderColor: '#D1CECC' }}>Annuler</Button>
          <Button onClick={onSave} disabled={submitting} style={{ backgroundColor: '#2C4A6E', color: 'white' }}>
            {submitting ? 'En cours...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE  —  cognitive complexity: 0
// Zero branches. Zero conditions. Only: call hook → wire props → render.
// ═══════════════════════════════════════════════════════════════════════════════

export default function SchoolSettingsPage() {
  const s = useSchoolSettings()

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', lineHeight: 1.15, letterSpacing: '-0.03em', fontWeight: 700, color: "#2A3740" }}>Établissement</h1>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'hsl(var(--muted-foreground))', marginTop: "4px" }}>Paramètres et référentiel de votre établissement</p>
      </div>

      <Tabs defaultValue="general" className="w-full" onValueChange={s.setActiveTab}>
        <TabsList style={{ backgroundColor: "#F0F4F7", borderRadius: "8px", padding: "4px" }}>
          {Object.entries(TAB_LABELS).map(([value, label]) => (
            <TabsTrigger key={value} value={value} className="data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>{label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general" className="space-y-6 mt-6">
          <CPMSLSchoolInfoForm schoolInfo={s.schoolInfo} onSave={s.handleSaveSchoolInfo} loading={s.loadingSchoolInfo} />
        </TabsContent>

        <TabsContent value="calendar" className="space-y-8 mt-6">
          <CPMSLCalendarManagement
            holidays={s.holidays} events={s.events}
            onAddHoliday={s.handleAddHoliday} onEditHoliday={s.handleEditHoliday} onDeleteHoliday={s.handleDeleteHoliday}
            onAddEvent={s.handleAddEvent}     onEditEvent={s.handleEditEvent}     onDeleteEvent={s.handleDeleteEvent}
          />
        </TabsContent>

        <TabsContent value="referentiel" className="space-y-6 mt-6">
          <ReferentielTab
            loading={s.loadingRef} rubrics={s.rubrics} subjects={s.subjects} expandedSubjects={s.expandedSubjects}
            onCreateRubric={s.openCreateRubric} onEditRubric={s.openEditRubric}
            onCreateSubject={s.openCreateSubject} onEditSubject={s.openEditSubject}
            onCreateSection={s.openCreateSection} onToggleExpand={s.toggleExpand}
          />
        </TabsContent>

        <TabsContent value="classes" className="space-y-6 mt-6">
          <ClassesTab
            loading={s.loadingClasses} classTypes={s.classTypes} classes={s.classes}
            initializing={s.initializing} onInitialize={s.handleInitializeClasses} onEditClass={s.openEditClass}
          />
        </TabsContent>

        <TabsContent value="attitudes" className="space-y-6 mt-6">
          <AttitudesTab
            loading={s.loadingAttitudes} attitudes={s.attitudes} currentYearId={s.currentYearId}
            onCreateAttitude={s.openCreateAttitude} onEditAttitude={s.openEditAttitude} onDeleteAttitude={s.handleDeleteAttitude}
          />
        </TabsContent>
      </Tabs>

      <RubricModal  open={s.rubricModal}  onOpenChange={s.setRubricModal}  form={s.rubricForm}  onChange={s.setRubricForm}
        editing={s.editingRubric}  submitting={s.submitting} onSave={s.handleSaveRubric} />
      <SubjectModal open={s.subjectModal} onOpenChange={s.setSubjectModal} form={s.subjectForm} onChange={s.setSubjectForm}
        onNameChange={s.handleSubjectNameChange} rubrics={s.rubrics}
        editing={s.editingSubject} submitting={s.submitting} onSave={s.handleSaveSubject} />
      <SectionModal open={s.sectionModal} onOpenChange={s.setSectionModal} form={s.sectionForm} onChange={s.setSectionForm}
        onNameChange={s.handleSectionNameChange} onToggleCycle={s.toggleSectionCycle}
        submitting={s.submitting} onSave={s.handleSaveSection} />
      <AttitudeModal open={s.attitudeModal} onOpenChange={s.setAttitudeModal}
        label={s.attitudeLabel} onLabelChange={s.setAttitudeLabel}
        editing={s.editingAttitude} submitting={s.submitting} onSave={s.handleSaveAttitude} />
      <ClassModal open={s.classModal} onOpenChange={s.setClassModal} form={s.classForm} onChange={s.setClassForm}
        editing={s.editingClass} submitting={s.submitting} onSave={s.handleSaveClass} />
    </div>
  )
}