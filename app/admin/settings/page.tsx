"use client"

import { useState, useEffect, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { CPMSLSchoolInfoForm } from "@/components/school/cpmsl-school-info-form"
import { CPMSLCalendarManagement } from "@/components/school/cpmsl-calendar-management"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlusIcon, ChevronRightIcon, ChevronDownIcon, CheckCircle2Icon, ZapIcon } from "lucide-react"
import React from "react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface SchoolInfo {
  name: string; motto?: string; foundedYear?: number
  logo?: string; address?: string; phone?: string; email?: string
}
interface Holiday { id: string; name: string; date: string }
interface SchoolEvent { id: string; title: string; date: string; type: 'exam' | 'holiday' | 'meeting' | 'other'; academicYearId: string }
interface Rubric { id: string; name: string; code: string; description?: string }
interface Subject { id: string; name: string; code: string; maxScore: number; coefficient: number; hasSections: boolean; rubricId?: string; rubric?: Rubric; sections?: Section[] }
interface Section { id: string; name: string; code: string; maxScore: number; displayOrder: number }
interface ClassType { id: string; name: string; code?: string; isTerminal: boolean }
interface Class { id: string; classTypeId: string; classType?: ClassType; letter: string; maxStudents?: number }

// ── Seed ──────────────────────────────────────────────────────────────────────

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

// ── Cycles MENFP ──────────────────────────────────────────────────────────────

export const CYCLES_MENFP = [
  { key: '1er Cycle',  label: '1er Cycle',  description: '1ère → 4ème AF' },
  { key: '2ème Cycle', label: '2ème Cycle', description: '5ème → 6ème AF' },
  { key: '3ème Cycle', label: '3ème Cycle', description: '7ème → 9ème AF' },
  { key: 'Secondaire', label: 'Secondaire', description: 'NS1 → NS4'      },
]

export const CYCLE_LEVELS: Record<string, string[]> = {
  '1er Cycle':  ['1ère AF', '2ème AF', '3ème AF', '4ème AF'],
  '2ème Cycle': ['5ème AF', '6ème AF'],
  '3ème Cycle': ['7ème AF', '8ème AF', '9ème AF'],
  'Secondaire': ['NS1', 'NS2', 'NS3', 'NS4'],
}

// ── Helpers localStorage cycles ───────────────────────────────────────────────

export function getSectionCycles(sectionId: string): string[] {
  try {
    const raw = localStorage.getItem(`section-cycles-${sectionId}`)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveSectionCycles(sectionId: string, cycles: string[]): void {
  localStorage.setItem(`section-cycles-${sectionId}`, JSON.stringify(cycles))
}

/**
 * Retourne true si une section est applicable au niveau de classe donné.
 * Si aucun cycle n'est configuré → applicable partout (fallback).
 */
export function isSectionApplicable(sectionId: string, levelName: string): boolean {
  const cycles = getSectionCycles(sectionId)
  if (cycles.length === 0) return true // pas de config → toutes les classes
  return cycles.some(cycle => (CYCLE_LEVELS[cycle] || []).includes(levelName))
}

// ── Helper API ────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `/api/proxy?path=${encodeURIComponent(path)}`
  const res = await fetch(url, { credentials: 'include', ...options })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

const TH = { fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#2C4A6E' }

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SchoolSettingsPage() {
  const { toast } = useToast()

  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>(DEFAULT_SCHOOL_INFO)
  const [holidays, setHolidays]     = useState<Holiday[]>([])
  const [events, setEvents]         = useState<SchoolEvent[]>([])

  const [rubrics, setRubrics]                     = useState<Rubric[]>([])
  const [subjects, setSubjects]                   = useState<Subject[]>([])
  const [loadingRef, setLoadingRef]               = useState(false)
  const [referentielLoaded, setReferentielLoaded] = useState(false)
  const [expandedSubjects, setExpandedSubjects]   = useState<Set<string>>(new Set())

  const [classTypes, setClassTypes]         = useState<ClassType[]>([])
  const [classes, setClasses]               = useState<Class[]>([])
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [classesLoaded, setClassesLoaded]   = useState(false)
  const [initializing, setInitializing]     = useState(false)

  const [activeTab, setActiveTab] = useState("general")

  // ── Modaux rubriques ──────────────────────────────────────────────────────
  const [rubricModal, setRubricModal]     = useState(false)
  const [editingRubric, setEditingRubric] = useState<Rubric | null>(null)
  const [rubricForm, setRubricForm]       = useState({ name: '', code: '', description: '' })

  // ── Modaux matières ───────────────────────────────────────────────────────
  const [subjectModal, setSubjectModal]     = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [subjectForm, setSubjectForm]       = useState({
    name: '', code: '', maxScore: '100', coefficient: '1', hasSections: false, rubricId: ''
  })

  // ── Modal section ─────────────────────────────────────────────────────────
  const [sectionModal, setSectionModal]       = useState(false)
  const [sectionParentId, setSectionParentId] = useState<string | null>(null)
  const [sectionForm, setSectionForm]         = useState({
    name: '', code: '', maxScore: '100', cycles: [] as string[]
  })

  // ── Modal classe ──────────────────────────────────────────────────────────
  const [classModal, setClassModal]     = useState(false)
  const [editingClass, setEditingClass] = useState<Class | null>(null)
  const [classForm, setClassForm]       = useState({ maxStudents: '30' })

  const [submitting, setSubmitting] = useState(false)

  // ── Chargement ────────────────────────────────────────────────────────────

  const loadReferentiel = useCallback(async () => {
    setLoadingRef(true)
    try {
      const [rubricsData, subjectsData] = await Promise.all([
        apiFetch<Rubric[]>('/api/subject-rubrics/'),
        apiFetch<Subject[]>('/api/subjects/'),
      ])
      setRubrics(rubricsData)
      setSubjects(subjectsData.map(s => ({
        ...s, sections: [],
        rubric: rubricsData.find(r => r.id === s.rubricId)
      })))
    } catch (err) {
      console.error('[settings] referentiel error:', err)
    } finally {
      setLoadingRef(false)
    }
  }, [])

  const loadClasses = useCallback(async () => {
    setLoadingClasses(true)
    try {
      const [classTypesData, classesData] = await Promise.all([
        apiFetch<ClassType[]>('/api/class-types/'),
        apiFetch<Class[]>('/api/classes/'),
      ])
      setClassTypes(classTypesData)
      setClasses(classesData.map(c => ({
        ...c, classType: classTypesData.find(ct => ct.id === c.classTypeId)
      })))
    } catch (err) {
      console.error('[settings] classes error:', err)
    } finally {
      setLoadingClasses(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'referentiel' && !referentielLoaded) { loadReferentiel(); setReferentielLoaded(true) }
    if (activeTab === 'classes'     && !classesLoaded)     { loadClasses();     setClassesLoaded(true) }
  }, [activeTab, referentielLoaded, classesLoaded, loadReferentiel, loadClasses])

  // ── Handlers établissement ────────────────────────────────────────────────

  const handleSaveSchoolInfo = (info: SchoolInfo) => { setSchoolInfo(info); toast({ title: "Paramètres enregistrés" }) }
  const handleAddHoliday    = (data: { name: string; date: string }) => setHolidays(prev => [...prev, { id: `h-${Date.now()}`, ...data }])
  const handleEditHoliday   = (id: string, data: { name: string; date: string }) => setHolidays(prev => prev.map(h => h.id === id ? { ...h, ...data } : h))
  const handleDeleteHoliday = (id: string) => setHolidays(prev => prev.filter(h => h.id !== id))
  const handleAddEvent      = (data: { title: string; date: string; type: SchoolEvent['type'] }) => setEvents(prev => [...prev, { id: `e-${Date.now()}`, ...data, academicYearId: '' }])
  const handleEditEvent     = (id: string, data: { title: string; date: string; type: SchoolEvent['type'] }) => setEvents(prev => prev.map(e => e.id === id ? { ...e, ...data } : e))
  const handleDeleteEvent   = (id: string) => setEvents(prev => prev.filter(e => e.id !== id))

  // ── Handlers rubriques ────────────────────────────────────────────────────

  const openCreateRubric = () => {
    setEditingRubric(null)
    setRubricForm({ name: '', code: '', description: '' })
    setRubricModal(true)
  }

  const openEditRubric = (rubric: Rubric) => {
    setEditingRubric(rubric)
    setRubricForm({ name: rubric.name, code: rubric.code, description: rubric.description || '' })
    setRubricModal(true)
  }

  const handleSaveRubric = async () => {
    setSubmitting(true)
    try {
      if (editingRubric) {
        await apiFetch(`/api/subject-rubrics/update/${editingRubric.id}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rubricForm)
        })
        toast({ title: "Rubrique modifiée" })
      } else {
        await apiFetch('/api/subject-rubrics/create', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rubricForm)
        })
        toast({ title: "Rubrique créée" })
      }
      setRubricModal(false)
      loadReferentiel()
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Handlers matières ─────────────────────────────────────────────────────

  const generateCode = (name: string): string => {
    const clean = name
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z\s]/g, '').toUpperCase().trim()
    const words = clean.split(/\s+/).filter(Boolean)
    if (words.length === 0) return ''
    let letters = ''
    if (words.length === 1)      letters = words[0].slice(0, 3)
    else if (words.length === 2) letters = words[0].slice(0, 2) + words[1].slice(0, 1)
    else                         letters = words.map(w => w[0]).join('').slice(0, 3)
    const num = String(subjects.length + 1).padStart(3, '0')
    return `${letters}-${num}`
  }

  const openCreateSubject = () => {
    setEditingSubject(null)
    setSubjectForm({ name: '', code: '', maxScore: '100', coefficient: '1', hasSections: false, rubricId: '' })
    setSubjectModal(true)
  }

  const openEditSubject = (subject: Subject) => {
    setEditingSubject(subject)
    setSubjectForm({
      name: subject.name, code: subject.code,
      maxScore: String(subject.maxScore), coefficient: String(subject.coefficient),
      hasSections: subject.hasSections, rubricId: subject.rubricId || ''
    })
    setSubjectModal(true)
  }

  const handleSaveSubject = async () => {
    setSubmitting(true)
    try {
      const body = {
        name: subjectForm.name, code: subjectForm.code,
        maxScore: parseFloat(subjectForm.maxScore),
        coefficient: parseFloat(subjectForm.coefficient),
        hasSections: subjectForm.hasSections,
        rubricId: subjectForm.rubricId || null,
      }
      if (editingSubject) {
        await apiFetch(`/api/subjects/update/${editingSubject.id}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        })
        toast({ title: "Matière modifiée" })
      } else {
        await apiFetch('/api/subjects/create', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        })
        toast({ title: "Matière créée" })
      }
      setSubjectModal(false)
      loadReferentiel()
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Handlers sections ─────────────────────────────────────────────────────

  const openCreateSection = (subjectId: string) => {
    setSectionParentId(subjectId)
    setSectionForm({ name: '', code: '', maxScore: '100', cycles: [] })
    setSectionModal(true)
  }

  const handleSaveSection = async () => {
    if (!sectionParentId) return
    setSubmitting(true)
    try {
      const parent = subjects.find(s => s.id === sectionParentId)
      const result = await apiFetch<any>(`/api/subjects/${sectionParentId}/sections/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sectionForm.name, code: sectionForm.code,
          maxScore: parseFloat(sectionForm.maxScore),
          displayOrder: (parent?.sections?.length || 0) + 1
        })
      })
      // Sauvegarder les cycles dans localStorage
      const sectionId = result?.section?.id
      if (sectionId && sectionForm.cycles.length > 0) {
        saveSectionCycles(sectionId, sectionForm.cycles)
      }
      toast({ title: "Sous-matière créée" })
      setSectionModal(false)
      loadReferentiel()
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const toggleExpand = async (subjectId: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev)
      next.has(subjectId) ? next.delete(subjectId) : next.add(subjectId)
      return next
    })
    const subject = subjects.find(s => s.id === subjectId)
    if (subject?.hasSections && (!subject.sections || subject.sections.length === 0)) {
      try {
        const sections = await apiFetch<Section[]>(`/api/subjects/${subjectId}/sections`)
        setSubjects(prev => prev.map(s => s.id === subjectId ? { ...s, sections } : s))
      } catch { /* ignorer */ }
    }
  }

  // ── Initialisation classes ────────────────────────────────────────────────

  const handleInitializeClasses = async () => {
    setInitializing(true)
    try {
      const createdTypes: any[] = []
      for (const ct of CLASS_TYPES_SEED) {
        const res = await apiFetch<any>('/api/class-types/create', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ct)
        })
        createdTypes.push(res)
      }
      await Promise.all(createdTypes.map((res: any) => {
        const id = res?.classType?.id ?? res?.data?.id ?? res?.id
        if (!id) return Promise.resolve()
        return apiFetch('/api/classes/create', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ classTypeId: id, letter: 'A', maxStudents: 30 })
        })
      }))
      toast({ title: "Initialisation réussie", description: "13 niveaux et 13 classes créés." })
      await loadClasses()
    } catch {
      toast({ title: "Erreur", description: "Impossible d'initialiser", variant: "destructive" })
    } finally {
      setInitializing(false)
    }
  }

  const openEditClass = (c: Class) => {
    setEditingClass(c)
    setClassForm({ maxStudents: String(c.maxStudents || 30) })
    setClassModal(true)
  }

  const handleSaveClass = async () => {
    if (!editingClass) return
    setSubmitting(true)
    try {
      await apiFetch(`/api/classes/update/${editingClass.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxStudents: parseInt(classForm.maxStudents) || undefined })
      })
      toast({ title: "Classe modifiée" })
      setClassModal(false)
      setClassesLoaded(false)
      loadClasses()
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Helpers UI ────────────────────────────────────────────────────────────

  const rubricColor = (code?: string) => {
    if (code === 'R1') return { bg: '#E3EFF9', color: '#2B6CB0' }
    if (code === 'R2') return { bg: '#E8F5EC', color: '#2D7D46' }
    if (code === 'R3') return { bg: '#FAF8F3', color: '#B0A07A' }
    return { bg: '#F0F4F7', color: '#5A7085' }
  }

  const classesInitialized = classes.length > 0

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', lineHeight: 1.15, letterSpacing: '-0.03em', fontWeight: 700, color: "#2A3740" }}>Établissement</h1>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'hsl(var(--muted-foreground))', marginTop: "4px" }}>Paramètres et référentiel de votre établissement</p>
      </div>

      <Tabs defaultValue="general" className="w-full" onValueChange={setActiveTab}>
        <TabsList style={{ backgroundColor: "#F0F4F7", borderRadius: "8px", padding: "4px" }}>
          {['general', 'calendar', 'referentiel', 'classes'].map((v, i) => (
            <TabsTrigger key={v} value={v} className="data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>
              {['Informations générales', 'Calendrier scolaire', 'Matières & Rubriques', 'Classes'][i]}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Général ── */}
        <TabsContent value="general" className="space-y-6 mt-6">
          <CPMSLSchoolInfoForm schoolInfo={schoolInfo} onSave={handleSaveSchoolInfo} />
        </TabsContent>

        {/* ── Calendrier ── */}
        <TabsContent value="calendar" className="space-y-8 mt-6">
          <CPMSLCalendarManagement
            holidays={holidays} events={events}
            onAddHoliday={handleAddHoliday} onEditHoliday={handleEditHoliday} onDeleteHoliday={handleDeleteHoliday}
            onAddEvent={handleAddEvent} onEditEvent={handleEditEvent} onDeleteEvent={handleDeleteEvent}
          />
        </TabsContent>

        {/* ── Matières & Rubriques ── */}
        <TabsContent value="referentiel" className="space-y-6 mt-6">
          {loadingRef ? (
            <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>
          ) : (
            <>
              {/* ── Rubriques ── */}
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E8E6E3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8E6E3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: '#2A3740' }}>Rubriques ({rubrics.length})</h3>
                    <p style={{ fontSize: '13px', color: '#78756F', marginTop: '2px' }}>Formule BR-001 : R1 × 70% + R2 × 25% + R3 × 5%</p>
                  </div>
                  <Button
                    onClick={openCreateRubric}
                    disabled={rubrics.length >= 3}
                    title={rubrics.length >= 3 ? "Maximum 3 rubriques (R1, R2, R3)" : undefined}
                    style={{ backgroundColor: rubrics.length >= 3 ? '#9CA3AF' : '#2C4A6E', color: 'white', borderRadius: '8px' }}
                  >
                    <PlusIcon className="mr-2 h-4 w-4" />Nouvelle rubrique
                  </Button>
                </div>
                <div style={{ padding: '24px' }}>
                  <div style={{ borderRadius: '8px', border: '1px solid #E8E6E3', overflow: 'hidden' }}>
                    <Table>
                      <TableHeader>
                        <TableRow style={{ backgroundColor: '#F1F5F9', borderBottom: '2px solid #D1D5DB' }}>
                          <TableHead style={TH}>Code</TableHead>
                          <TableHead style={TH}>Nom</TableHead>
                          <TableHead style={TH}>Description</TableHead>
                          <TableHead style={TH}>Poids BR-001</TableHead>
                          <TableHead style={{ ...TH, textAlign: 'center' }}>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rubrics.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} style={{ textAlign: 'center', color: '#78756F', padding: '32px' }}>
                              Aucune rubrique — créez R1, R2, R3
                            </TableCell>
                          </TableRow>
                        ) : rubrics.map((rubric, i) => {
                          const colors = rubricColor(rubric.code)
                          const poids = rubric.code === 'R1' ? '70%' : rubric.code === 'R2' ? '25%' : rubric.code === 'R3' ? '5%' : '—'
                          return (
                            <TableRow key={rubric.id} style={{ borderTop: i > 0 ? '1px solid #E8E6E3' : 'none' }}>
                              <TableCell>
                                <Badge style={{ backgroundColor: colors.bg, color: colors.color, border: 'none', fontWeight: 700 }}>{rubric.code}</Badge>
                              </TableCell>
                              <TableCell style={{ fontWeight: 600, color: '#1E1A17', fontSize: '14px' }}>{rubric.name}</TableCell>
                              <TableCell style={{ color: '#78756F', fontSize: '13px' }}>{rubric.description || '—'}</TableCell>
                              <TableCell style={{ fontWeight: 700, color: colors.color, fontSize: '14px' }}>{poids}</TableCell>
                              <TableCell style={{ textAlign: 'center' }}>
                                <button onClick={() => openEditRubric(rubric)} style={{ fontSize: '13px', fontWeight: 500, color: '#5A7085', background: 'none', border: 'none', cursor: 'pointer' }}>
                                  Modifier
                                </button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              {/* ── Matières ── */}
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E8E6E3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8E6E3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: '#2A3740' }}>Matières ({subjects.length})</h3>
                    <p style={{ fontSize: '13px', color: '#78756F', marginTop: '2px' }}>
                      Référentiel global — les matières sont assignées aux classes dans la configuration de l&apos;année
                    </p>
                  </div>
                  <Button
                    onClick={openCreateSubject}
                    disabled={rubrics.length === 0}
                    title={rubrics.length === 0 ? "Créez d'abord les rubriques" : undefined}
                    style={{ backgroundColor: rubrics.length === 0 ? '#9CA3AF' : '#2C4A6E', color: 'white', borderRadius: '8px' }}
                  >
                    <PlusIcon className="mr-2 h-4 w-4" />Nouvelle matière
                  </Button>
                </div>
                <div style={{ padding: '24px' }}>
                  <div style={{ borderRadius: '8px', border: '1px solid #E8E6E3', overflow: 'hidden' }}>
                    <Table>
                      <TableHeader>
                        <TableRow style={{ backgroundColor: '#F1F5F9', borderBottom: '2px solid #D1D5DB' }}>
                          <TableHead style={{ ...TH, width: '3%' }}></TableHead>
                          <TableHead style={TH}>Code</TableHead>
                          <TableHead style={TH}>Nom</TableHead>
                          <TableHead style={TH}>Rubrique</TableHead>
                          <TableHead style={TH}>Coeff.</TableHead>
                          <TableHead style={TH}>Max</TableHead>
                          <TableHead style={{ ...TH, textAlign: 'center' }}>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subjects.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} style={{ textAlign: 'center', color: '#78756F', padding: '32px' }}>
                              {rubrics.length === 0 ? "Créez d'abord les rubriques (R1, R2, R3)" : "Aucune matière — créez la première"}
                            </TableCell>
                          </TableRow>
                        ) : subjects.map((subject, i) => {
                          const isExpanded = expandedSubjects.has(subject.id)
                          const colors = rubricColor(subject.rubric?.code)
                          return (
                            <React.Fragment key={subject.id}>
                              <TableRow style={{ borderTop: i > 0 ? '1px solid #E8E6E3' : 'none', backgroundColor: 'white' }} className="hover:bg-[#FAF8F3]">
                                <TableCell style={{ padding: '12px 8px' }}>
                                  {subject.hasSections && (
                                    <button onClick={() => toggleExpand(subject.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5A7085', display: 'flex' }}>
                                      {isExpanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                                    </button>
                                  )}
                                </TableCell>
                                <TableCell style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 600, color: '#1E1A17', textTransform: 'uppercase' }}>{subject.code}</TableCell>
                                <TableCell style={{ fontWeight: 600, color: '#1E1A17', fontSize: '14px' }}>{subject.name}</TableCell>
                                <TableCell>
                                  {subject.rubric
                                    ? <Badge style={{ backgroundColor: colors.bg, color: colors.color, border: 'none' }}>{subject.rubric.code}</Badge>
                                    : <span style={{ color: '#A8A5A2' }}>—</span>}
                                </TableCell>
                                <TableCell style={{ fontSize: '14px' }}>{subject.coefficient}</TableCell>
                                <TableCell style={{ fontSize: '14px' }}>{subject.maxScore}</TableCell>
                                <TableCell>
                                  <div className="flex items-center justify-center gap-2">
                                    <button onClick={() => openCreateSection(subject.id)} style={{ fontSize: '12px', fontWeight: 500, color: '#2C4A6E', background: 'none', border: 'none', cursor: 'pointer' }}>
                                      + Section
                                    </button>
                                    <span style={{ color: '#D1CECC' }}>|</span>
                                    <button onClick={() => openEditSubject(subject)} style={{ fontSize: '13px', fontWeight: 500, color: '#5A7085', background: 'none', border: 'none', cursor: 'pointer' }}>
                                      Modifier
                                    </button>
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
                                      {/* Cycles configurés */}
                                      <div className="flex gap-1 flex-wrap">
                                        {cycles.length > 0
                                          ? cycles.map(c => (
                                              <span key={c} style={{ backgroundColor: '#E3EFF9', color: '#2B6CB0', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>
                                                {c}
                                              </span>
                                            ))
                                          : <span style={{ color: '#A8A5A2', fontSize: '12px' }}>Tous les cycles</span>
                                        }
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
          )}
        </TabsContent>

        {/* ── Classes ── */}
        <TabsContent value="classes" className="space-y-6 mt-6">
          {loadingClasses ? (
            <div className="space-y-4"><Skeleton className="h-64 w-full" /></div>
          ) : (
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E8E6E3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8E6E3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: '#2A3740' }}>Classes ({classes.length} / {classTypes.length || 13})</h3>
                  <p style={{ fontSize: '13px', color: '#78756F', marginTop: '2px' }}>Référentiel permanent — salle A par défaut pour chaque niveau</p>
                </div>
                {classTypes.length === 0 && (
                  <Button onClick={handleInitializeClasses} disabled={initializing} style={{ backgroundColor: '#2C4A6E', color: 'white', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ZapIcon className="h-4 w-4" />
                    {initializing ? 'Initialisation...' : 'Initialiser niveaux & classes'}
                  </Button>
                )}
                {classesInitialized && (
                  <div className="flex items-center gap-2" style={{ color: '#2D7D46', fontSize: '13px', fontWeight: 500 }}>
                    <CheckCircle2Icon className="h-4 w-4" />Classes initialisées
                  </div>
                )}
              </div>
              <div style={{ padding: '24px' }}>
                {classTypes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                    <p style={{ fontSize: '16px', fontWeight: 600, color: '#3A4A57', marginBottom: '8px' }}>Aucun niveau configuré</p>
                    <p style={{ fontSize: '13px', color: '#78756F', marginBottom: '24px' }}>Cliquez sur &quot;Initialiser niveaux &amp; classes&quot; pour créer les 13 niveaux MENFP.</p>
                    <Button onClick={handleInitializeClasses} disabled={initializing} style={{ backgroundColor: '#2C4A6E', color: 'white', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <ZapIcon className="h-4 w-4" />
                      {initializing ? 'Initialisation en cours...' : 'Initialiser niveaux & classes'}
                    </Button>
                  </div>
                ) : (
                  <div style={{ borderRadius: '8px', border: '1px solid #E8E6E3', overflow: 'hidden' }}>
                    <Table>
                      <TableHeader>
                        <TableRow style={{ backgroundColor: '#F1F5F9', borderBottom: '2px solid #D1D5DB' }}>
                          <TableHead style={TH}>Niveau</TableHead>
                          <TableHead style={TH}>Type</TableHead>
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
                                  ? <button onClick={() => openEditClass(cls)} style={{ fontSize: '13px', fontWeight: 500, color: '#5A7085', background: 'none', border: 'none', cursor: 'pointer' }}>Modifier</button>
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
          )}
        </TabsContent>
      </Tabs>

      {/* ── Modal Rubrique ── */}
      <Dialog open={rubricModal} onOpenChange={setRubricModal}>
        <DialogContent style={{ backgroundColor: 'white', borderRadius: '12px' }}>
          <DialogHeader>
            <DialogTitle className="font-serif" style={{ fontSize: '22px', fontWeight: 700, color: '#2A3740' }}>
              {editingRubric ? 'Modifier la rubrique' : 'Nouvelle rubrique'}
            </DialogTitle>
            <DialogDescription className="sr-only">Formulaire rubrique</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label style={{ fontSize: '13px', fontWeight: 500 }}>Code * <span style={{ color: '#78756F', fontWeight: 400 }}>(ex: R1)</span></Label>
                <Input
                  value={rubricForm.code}
                  onChange={e => setRubricForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  disabled={!!editingRubric}
                  style={{ borderColor: '#D1CECC', backgroundColor: editingRubric ? '#F5F4F2' : 'white' }}
                  placeholder="R1"
                />
                {editingRubric && <p style={{ fontSize: '11px', color: '#78756F' }}>Le code ne peut pas être modifié</p>}
              </div>
              <div className="space-y-1">
                <Label style={{ fontSize: '13px', fontWeight: 500 }}>Nom *</Label>
                <Input value={rubricForm.name} onChange={e => setRubricForm(f => ({ ...f, name: e.target.value }))} style={{ borderColor: '#D1CECC' }} placeholder="Ex: Évaluation continue" />
              </div>
            </div>
            <div className="space-y-1">
              <Label style={{ fontSize: '13px', fontWeight: 500 }}>Description</Label>
              <Input value={rubricForm.description} onChange={e => setRubricForm(f => ({ ...f, description: e.target.value }))} style={{ borderColor: '#D1CECC' }} />
            </div>
            <div style={{ backgroundColor: '#F0F4F7', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#5A7085' }}>
              <strong>Poids BR-001 :</strong> R1 = 70% · R2 = 25% · R3 = 5%
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRubricModal(false)} style={{ borderColor: '#D1CECC' }}>Annuler</Button>
            <Button onClick={handleSaveRubric} disabled={submitting || !rubricForm.name || !rubricForm.code} style={{ backgroundColor: '#2C4A6E', color: 'white' }}>
              {submitting ? 'En cours...' : editingRubric ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Matière ── */}
      <Dialog open={subjectModal} onOpenChange={setSubjectModal}>
        <DialogContent style={{ backgroundColor: 'white', borderRadius: '12px' }}>
          <DialogHeader>
            <DialogTitle className="font-serif" style={{ fontSize: '22px', fontWeight: 700, color: '#2A3740' }}>
              {editingSubject ? 'Modifier la matière' : 'Nouvelle matière'}
            </DialogTitle>
            <DialogDescription className="sr-only">Formulaire matière</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label style={{ fontSize: '13px', fontWeight: 500 }}>Nom *</Label>
                <Input
                  value={subjectForm.name}
                  onChange={e => {
                    const name = e.target.value
                    setSubjectForm(f => ({
                      ...f, name,
                      ...(!editingSubject && { code: generateCode(name) })
                    }))
                  }}
                  style={{ borderColor: '#D1CECC' }}
                />
              </div>
              <div className="space-y-1">
                <Label style={{ fontSize: '13px', fontWeight: 500 }}>Code</Label>
                <Input
                  value={subjectForm.code}
                  readOnly={!editingSubject}
                  onChange={e => editingSubject && setSubjectForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  style={{ borderColor: '#D1CECC', backgroundColor: !editingSubject ? '#F5F4F2' : 'white' }}
                />
                {!editingSubject && <p style={{ fontSize: '11px', color: '#78756F' }}>Généré automatiquement depuis le nom</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label style={{ fontSize: '13px', fontWeight: 500 }}>Coefficient</Label>
                <Input type="number" step="0.5" value={subjectForm.coefficient} onChange={e => setSubjectForm(f => ({ ...f, coefficient: e.target.value }))} style={{ borderColor: '#D1CECC' }} />
              </div>
              <div className="space-y-1">
                <Label style={{ fontSize: '13px', fontWeight: 500 }}>Note max</Label>
                <Input type="number" value={subjectForm.maxScore} onChange={e => setSubjectForm(f => ({ ...f, maxScore: e.target.value }))} style={{ borderColor: '#D1CECC' }} />
              </div>
            </div>
            <div className="space-y-1">
              <Label style={{ fontSize: '13px', fontWeight: 500 }}>Rubrique *</Label>
              <Select value={subjectForm.rubricId} onValueChange={v => setSubjectForm(f => ({ ...f, rubricId: v }))}>
                <SelectTrigger style={{ borderColor: '#D1CECC' }}>
                  <SelectValue placeholder="Sélectionner une rubrique" />
                </SelectTrigger>
                <SelectContent>
                  {rubrics.map(r => <SelectItem key={r.id} value={r.id}>{r.code} — {r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="hasSections" checked={subjectForm.hasSections} onChange={e => setSubjectForm(f => ({ ...f, hasSections: e.target.checked }))} />
              <Label htmlFor="hasSections" style={{ fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                Cette matière a des sous-matières (sections)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubjectModal(false)} style={{ borderColor: '#D1CECC' }}>Annuler</Button>
            <Button onClick={handleSaveSubject} disabled={submitting || !subjectForm.name || !subjectForm.code} style={{ backgroundColor: '#2C4A6E', color: 'white' }}>
              {submitting ? 'En cours...' : editingSubject ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Section ── */}
      <Dialog open={sectionModal} onOpenChange={setSectionModal}>
        <DialogContent style={{ backgroundColor: 'white', borderRadius: '12px' }}>
          <DialogHeader>
            <DialogTitle className="font-serif" style={{ fontSize: '22px', fontWeight: 700, color: '#2A3740' }}>Nouvelle sous-matière</DialogTitle>
            <DialogDescription className="sr-only">Formulaire sous-matière</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label style={{ fontSize: '13px', fontWeight: 500 }}>Nom *</Label>
                <Input
                  value={sectionForm.name}
                  onChange={e => {
                    const name = e.target.value
                    const clean = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z\s]/g, '').toUpperCase().trim()
                    const words = clean.split(/\s+/).filter(Boolean)
                    let letters = ''
                    if (words.length === 1)      letters = words[0].slice(0, 3)
                    else if (words.length === 2)  letters = words[0].slice(0, 2) + words[1].slice(0, 1)
                    else                          letters = words.map((w: string) => w[0]).join('').slice(0, 3)
                    const parent = subjects.find(s => s.id === sectionParentId)
                    const num = String((parent?.sections?.length || 0) + 1).padStart(3, '0')
                    setSectionForm(f => ({ ...f, name, code: letters ? `${letters}-${num}` : '' }))
                  }}
                  style={{ borderColor: '#D1CECC' }}
                />
              </div>
              <div className="space-y-1">
                <Label style={{ fontSize: '13px', fontWeight: 500 }}>Code</Label>
                <Input value={sectionForm.code} readOnly style={{ borderColor: '#D1CECC', backgroundColor: '#F5F4F2' }} />
                <p style={{ fontSize: '11px', color: '#78756F' }}>Généré automatiquement depuis le nom</p>
              </div>
            </div>
            <div className="space-y-1">
              <Label style={{ fontSize: '13px', fontWeight: 500 }}>Note max</Label>
              <Input type="number" value={sectionForm.maxScore} onChange={e => setSectionForm(f => ({ ...f, maxScore: e.target.value }))} style={{ borderColor: '#D1CECC' }} />
            </div>

            {/* ── Cycles applicables ── */}
            <div className="space-y-2">
              <Label style={{ fontSize: '13px', fontWeight: 500 }}>
                Cycles applicables *
                <span style={{ color: '#78756F', fontWeight: 400, marginLeft: '6px', fontSize: '12px' }}>
                  Dans quels cycles cette sous-matière est enseignée ?
                </span>
              </Label>
              <div style={{ border: '1px solid #E8E6E3', borderRadius: '8px', overflow: 'hidden' }}>
                {CYCLES_MENFP.map((cycle, i) => (
                  <label
                    key={cycle.key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '10px 14px', cursor: 'pointer',
                      borderTop: i > 0 ? '1px solid #F0EDE8' : 'none',
                      backgroundColor: sectionForm.cycles.includes(cycle.key) ? '#F0F4F7' : 'white',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={sectionForm.cycles.includes(cycle.key)}
                      onChange={e => {
                        setSectionForm(f => ({
                          ...f,
                          cycles: e.target.checked
                            ? [...f.cycles, cycle.key]
                            : f.cycles.filter(c => c !== cycle.key)
                        }))
                      }}
                      style={{ width: '16px', height: '16px', accentColor: '#2C4A6E', cursor: 'pointer' }}
                    />
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#1E1A17' }}>{cycle.label}</span>
                      <span style={{ fontSize: '12px', color: '#78756F', marginLeft: '8px' }}>{cycle.description}</span>
                    </div>
                  </label>
                ))}
              </div>
              {sectionForm.cycles.length === 0 && (
                <p style={{ fontSize: '11px', color: '#C48B1A' }}>
                  ⚠ Aucun cycle sélectionné — la sous-matière s&apos;appliquera à toutes les classes
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionModal(false)} style={{ borderColor: '#D1CECC' }}>Annuler</Button>
            <Button onClick={handleSaveSection} disabled={submitting || !sectionForm.name || !sectionForm.code} style={{ backgroundColor: '#2C4A6E', color: 'white' }}>
              {submitting ? 'En cours...' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Modifier Classe ── */}
      <Dialog open={classModal} onOpenChange={setClassModal}>
        <DialogContent style={{ backgroundColor: 'white', borderRadius: '12px' }}>
          <DialogHeader>
            <DialogTitle className="font-serif" style={{ fontSize: '22px', fontWeight: 700, color: '#2A3740' }}>Modifier la classe</DialogTitle>
            <DialogDescription className="sr-only">Modifier le nombre max d&apos;élèves</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div style={{ backgroundColor: '#F0F4F7', borderRadius: '8px', padding: '12px 16px' }}>
              <p style={{ fontSize: '12px', color: '#78756F', marginBottom: '4px' }}>Classe</p>
              <p style={{ fontSize: '16px', fontWeight: 700, color: '#2A3740' }}>{editingClass?.classType?.name} — Salle A</p>
            </div>
            <div className="space-y-1">
              <Label style={{ fontSize: '13px', fontWeight: 500 }}>Max élèves</Label>
              <Input type="number" value={classForm.maxStudents} onChange={e => setClassForm(f => ({ ...f, maxStudents: e.target.value }))} style={{ borderColor: '#D1CECC' }} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClassModal(false)} style={{ borderColor: '#D1CECC' }}>Annuler</Button>
            <Button onClick={handleSaveClass} disabled={submitting} style={{ backgroundColor: '#2C4A6E', color: 'white' }}>
              {submitting ? 'En cours...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}