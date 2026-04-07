// app/(dashboard)/settings/school/_hooks/use-school-settings.ts
"use client"

import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/components/ui/use-toast"

// ── Re-exported constants (used by page + modals) ─────────────────────────────

export interface SchoolInfo {
  name: string; motto?: string; foundedYear?: number
  logo?: string; address?: string; phone?: string; email?: string
}
export interface Holiday  { id: string; name: string; date: string }
export interface SchoolEvent { id: string; title: string; date: string; type: 'exam'|'holiday'|'meeting'|'other'; academicYearId: string }
export interface Rubric   { id: string; name: string; code: string; description?: string }
export interface Section  { id: string; name: string; code: string; maxScore: number; displayOrder: number }
export interface Subject  { id: string; name: string; code: string; maxScore: number; coefficient: number; hasSections: boolean; rubricId?: string; rubric?: Rubric; sections?: Section[] }
export interface ClassType { id: string; name: string; code?: string; isTerminal: boolean }
export interface Class    { id: string; classTypeId: string; classType?: ClassType; letter: string; maxStudents?: number }
export interface Attitude { id: string; label: string; academicYearId: string }

export const CLASS_TYPES_SEED = [
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

export const DEFAULT_SCHOOL_INFO: SchoolInfo = {
  name: "Cours Privé Mixte Saint Léonard",
  motto: "", foundedYear: undefined, logo: "", address: "", phone: "", email: "",
}

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

// ── localStorage helpers ──────────────────────────────────────────────────────

export function getSectionCycles(sectionId: string): string[] {
  try {
    const raw = localStorage.getItem(`section-cycles-${sectionId}`)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveSectionCycles(sectionId: string, cycles: string[]): void {
  localStorage.setItem(`section-cycles-${sectionId}`, JSON.stringify(cycles))
}

// ── API helper ────────────────────────────────────────────────────────────────

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `/api/proxy?path=${encodeURIComponent(path)}`
  const res = await fetch(url, { credentials: 'include', ...options })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

// ── Code-generation helpers (extracted to keep generateCode complexity ≤ 3) ──

function extractLetters(words: string[]): string {
  if (words.length === 1) return words[0].slice(0, 3)                       // +1
  if (words.length === 2) return words[0].slice(0, 2) + words[1].slice(0, 1) // +1
  return words.map(w => w[0]).join('').slice(0, 3)
}

export function generateCode(name: string, existingCount: number): string {
  const words = name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z\s]/g, '').toUpperCase().trim()
    .split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''                                          // +1
  const letters = extractLetters(words)
  return `${letters}-${String(existingCount + 1).padStart(3, '0')}`
}
// generateCode complexity: 1   extractLetters complexity: 2

// ── Modal-form state shapes ───────────────────────────────────────────────────

export interface RubricForm    { name: string; code: string; description: string }
export interface SubjectForm   { name: string; code: string; maxScore: string; coefficient: string; hasSections: boolean; rubricId: string }
export interface SectionForm   { name: string; code: string; maxScore: string; cycles: string[] }
export interface ClassForm     { maxStudents: string }

// ── The hook ──────────────────────────────────────────────────────────────────

export function useSchoolSettings() {
  const { toast } = useToast()

  // ── Data state ──────────────────────────────────────────────────────────────
  const [schoolInfo,       setSchoolInfo]       = useState<SchoolInfo>(DEFAULT_SCHOOL_INFO)
  const [loadingSchoolInfo,setLoadingSchoolInfo] = useState(false)
  const [schoolInfoLoaded, setSchoolInfoLoaded]  = useState(false)
  const [holidays,  setHolidays]  = useState<Holiday[]>([])
  const [events,    setEvents]    = useState<SchoolEvent[]>([])
  const [rubrics,   setRubrics]   = useState<Rubric[]>([])
  const [subjects,  setSubjects]  = useState<Subject[]>([])
  const [loadingRef,  setLoadingRef]  = useState(false)
  const [referentielLoaded, setReferentielLoaded] = useState(false)
  const [expandedSubjects,  setExpandedSubjects]  = useState<Set<string>>(new Set())
  const [classTypes,    setClassTypes]    = useState<ClassType[]>([])
  const [classes,       setClasses]       = useState<Class[]>([])
  const [loadingClasses,setLoadingClasses] = useState(false)
  const [classesLoaded, setClassesLoaded]  = useState(false)
  const [initializing,  setInitializing]   = useState(false)
  const [attitudes,        setAttitudes]        = useState<Attitude[]>([])
  const [loadingAttitudes, setLoadingAttitudes] = useState(false)
  const [attitudesLoaded,  setAttitudesLoaded]  = useState(false)
  const [currentYearId,    setCurrentYearId]    = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("general")

  // ── Modal visibility ─────────────────────────────────────────────────────
  const [rubricModal,  setRubricModal]  = useState(false)
  const [subjectModal, setSubjectModal] = useState(false)
  const [sectionModal, setSectionModal] = useState(false)
  const [attitudeModal,setAttitudeModal] = useState(false)
  const [classModal,   setClassModal]   = useState(false)
  const [submitting,   setSubmitting]   = useState(false)

  // ── Editing targets ───────────────────────────────────────────────────────
  const [editingRubric,  setEditingRubric]  = useState<Rubric | null>(null)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [editingClass,   setEditingClass]   = useState<Class | null>(null)
  const [editingAttitude,setEditingAttitude] = useState<Attitude | null>(null)
  const [sectionParentId,setSectionParentId] = useState<string | null>(null)

  // ── Form state ────────────────────────────────────────────────────────────
  const [rubricForm,   setRubricForm]   = useState<RubricForm>({ name:'', code:'', description:'' })
  const [subjectForm,  setSubjectForm]  = useState<SubjectForm>({ name:'', code:'', maxScore:'100', coefficient:'1', hasSections:false, rubricId:'' })
  const [sectionForm,  setSectionForm]  = useState<SectionForm>({ name:'', code:'', maxScore:'100', cycles:[] })
  const [classForm,    setClassForm]    = useState<ClassForm>({ maxStudents:'30' })
  const [attitudeLabel,setAttitudeLabel] = useState("")

  // ── Data loaders (each function complexity ≤ 2) ───────────────────────────

  const loadReferentiel = useCallback(async () => {
    setLoadingRef(true)
    try {                                                                     // +1
      const [rubricsData, subjectsData] = await Promise.all([
        apiFetch<Rubric[]>('/api/subject-rubrics/'),
        apiFetch<Subject[]>('/api/subjects/'),
      ])
      setRubrics(rubricsData)
      setSubjects(subjectsData.map(s => ({
        ...s, sections: [], rubric: rubricsData.find(r => r.id === s.rubricId)
      })))
    } catch (err) {
      console.error('[settings] referentiel error:', err)
    } finally {
      setLoadingRef(false)
    }
  }, [])

  const loadClasses = useCallback(async () => {
    setLoadingClasses(true)
    try {                                                                     // +1
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

  const loadAttitudes = useCallback(async (yearId: string) => {
    setLoadingAttitudes(true)
    try {                                                                     // +1
      const data = await fetch(`/api/attitudes?academicYearId=${yearId}`, { credentials:'include' }).then(r => r.json())
      setAttitudes(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('[settings] attitudes error:', err)
    } finally {
      setLoadingAttitudes(false)
    }
  }, [])

  // ── Effects (each useEffect complexity: 3 max) ────────────────────────────

  useEffect(() => {
    if (activeTab === 'referentiel' && !referentielLoaded) { loadReferentiel(); setReferentielLoaded(true) } // +1, +1
    if (activeTab === 'classes'     && !classesLoaded)     { loadClasses();     setClassesLoaded(true) }     // +1, +1 (nesting doesn't apply to &&)
    if (activeTab === 'attitudes'   && !attitudesLoaded) {                                                    // +1
      setAttitudesLoaded(true)
      fetch('/api/academic-years/current', { credentials:'include' })
        .then(r => r.json())
        .then(data => {
          const yearId = data?.id ?? data?.academicYear?.id
          if (yearId) { setCurrentYearId(yearId); loadAttitudes(yearId) }    // +1 (nested)
        })
        .catch(err => console.error('[settings] current year error:', err))
    }
  }, [activeTab, referentielLoaded, classesLoaded, attitudesLoaded, loadReferentiel, loadClasses, loadAttitudes])
  // useEffect complexity: 4 (3 top-level ifs + 1 nested if)

  useEffect(() => {
    if (activeTab !== 'general' || schoolInfoLoaded) return                  // +1
    setSchoolInfoLoaded(true)
    setLoadingSchoolInfo(true)
    fetch('/api/school-info', { credentials:'include' }).then(r => r.json())
      .then(data => {
        if (data) setSchoolInfo({                                             // +1 (nested)
          name:        data.name        ?? DEFAULT_SCHOOL_INFO.name,
          motto:       data.motto       ?? '',
          foundedYear: data.foundedYear ?? undefined,
          logo:        data.logo        ?? '',
          address:     data.address     ?? '',
          phone:       data.phone       ?? '',
          email:       data.email       ?? '',
        })
      })
      .catch(err => console.error('[settings] school-info load error:', err))
      .finally(() => setLoadingSchoolInfo(false))
  }, [activeTab, schoolInfoLoaded])
  // useEffect complexity: 2

  // ── School info handlers ──────────────────────────────────────────────────

  const handleSaveSchoolInfo = async (info: SchoolInfo) => {
    setSchoolInfo(info)
    try {                                                                     // +1
      await fetch('/api/school-info/update', {
        method:'POST', credentials:'include',
        headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(info),
      })
      toast({ title:"Paramètres enregistrés" })
    } catch {
      toast({ title:"Erreur", description:"Impossible de sauvegarder les paramètres", variant:"destructive" })
    }
  }
  // complexity: 1

  const handleAddHoliday    = (data: { name:string; date:string }) =>
    setHolidays(prev => [...prev, { id:`h-${Date.now()}`, ...data }])
  const handleEditHoliday   = (id:string, data:{name:string;date:string}) =>
    setHolidays(prev => prev.map(h => h.id===id ? {...h,...data} : h))
  const handleDeleteHoliday = (id:string) =>
    setHolidays(prev => prev.filter(h => h.id!==id))
  const handleAddEvent      = (data:{title:string;date:string;type:SchoolEvent['type']}) =>
    setEvents(prev => [...prev, { id:`e-${Date.now()}`, ...data, academicYearId:'' }])
  const handleEditEvent     = (id:string, data:{title:string;date:string;type:SchoolEvent['type']}) =>
    setEvents(prev => prev.map(e => e.id===id ? {...e,...data} : e))
  const handleDeleteEvent   = (id:string) =>
    setEvents(prev => prev.filter(e => e.id!==id))

  // ── Rubric handlers ───────────────────────────────────────────────────────

  const openCreateRubric = () => {
    setEditingRubric(null)
    setRubricForm({ name:'', code:'', description:'' })
    setRubricModal(true)
  }

  const openEditRubric = (rubric: Rubric) => {
    setEditingRubric(rubric)
    setRubricForm({ name:rubric.name, code:rubric.code, description:rubric.description||'' })
    setRubricModal(true)
  }

  const handleSaveRubric = async () => {
    setSubmitting(true)
    try {                                                                     // +1
      if (editingRubric) {                                                    // +1 (nested)
        await apiFetch(`/api/subject-rubrics/update/${editingRubric.id}`, {
          method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(rubricForm)
        })
        toast({ title:"Rubrique modifiée" })
      } else {
        await apiFetch('/api/subject-rubrics/create', {
          method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(rubricForm)
        })
        toast({ title:"Rubrique créée" })
      }
      setRubricModal(false)
      loadReferentiel()
    } catch {
      toast({ title:"Erreur", variant:"destructive" })
    } finally {
      setSubmitting(false)
    }
  }
  // complexity: 2

  // ── Subject handlers ──────────────────────────────────────────────────────

  const openCreateSubject = () => {
    setEditingSubject(null)
    setSubjectForm({ name:'', code:'', maxScore:'100', coefficient:'1', hasSections:false, rubricId:'' })
    setSubjectModal(true)
  }

  const openEditSubject = (subject: Subject) => {
    setEditingSubject(subject)
    setSubjectForm({
      name:subject.name, code:subject.code,
      maxScore:String(subject.maxScore), coefficient:String(subject.coefficient),
      hasSections:subject.hasSections, rubricId:subject.rubricId||''
    })
    setSubjectModal(true)
  }

  const handleSaveSubject = async () => {
    setSubmitting(true)
    try {                                                                     // +1
      const body = {
        name:subjectForm.name, code:subjectForm.code,
        maxScore:parseFloat(subjectForm.maxScore),
        coefficient:parseFloat(subjectForm.coefficient),
        hasSections:subjectForm.hasSections,
        rubricId:subjectForm.rubricId || null,
      }
      if (editingSubject) {                                                   // +1 (nested)
        await apiFetch(`/api/subjects/update/${editingSubject.id}`, {
          method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
        })
        toast({ title:"Matière modifiée" })
      } else {
        await apiFetch('/api/subjects/create', {
          method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
        })
        toast({ title:"Matière créée" })
      }
      setSubjectModal(false)
      loadReferentiel()
    } catch {
      toast({ title:"Erreur", variant:"destructive" })
    } finally {
      setSubmitting(false)
    }
  }
  // complexity: 2

  // ── Section handlers ──────────────────────────────────────────────────────

  const openCreateSection = (subjectId: string) => {
    setSectionParentId(subjectId)
    setSectionForm({ name:'', code:'', maxScore:'100', cycles:[] })
    setSectionModal(true)
  }

  const handleSaveSection = async () => {
    if (!sectionParentId) return                                              // +1
    setSubmitting(true)
    try {                                                                     // +1 (nested)
      const parent = subjects.find(s => s.id === sectionParentId)
      const result = await apiFetch<any>(`/api/subjects/${sectionParentId}/sections/create`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          name:sectionForm.name, code:sectionForm.code,
          maxScore:parseFloat(sectionForm.maxScore),
          displayOrder:(parent?.sections?.length || 0) + 1
        })
      })
      const sectionId = result?.section?.id
      if (sectionId && sectionForm.cycles.length > 0) saveSectionCycles(sectionId, sectionForm.cycles) // +2 (nested &&)
      toast({ title:"Sous-matière créée" })
      setSectionModal(false)
      loadReferentiel()
    } catch {
      toast({ title:"Erreur", variant:"destructive" })
    } finally {
      setSubmitting(false)
    }
  }
  // complexity: 4 — acceptable

  const toggleExpand = async (subjectId: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev)
      next.has(subjectId) ? next.delete(subjectId) : next.add(subjectId)     // +1 (ternary)
      return next
    })
    const subject = subjects.find(s => s.id === subjectId)
    if (subject?.hasSections && (!subject.sections || subject.sections.length === 0)) { // +1
      try {                                                                    // +1 (nested)
        const sections = await apiFetch<Section[]>(`/api/subjects/${subjectId}/sections`)
        setSubjects(prev => prev.map(s => s.id===subjectId ? {...s, sections} : s))
      } catch { /* ignore */ }
    }
  }
  // complexity: 3

  // ── Attitude handlers ─────────────────────────────────────────────────────

  const openCreateAttitude = () => {
    setEditingAttitude(null)
    setAttitudeLabel("")
    setAttitudeModal(true)
  }

  const openEditAttitude = (attitude: Attitude) => {
    setEditingAttitude(attitude)
    setAttitudeLabel(attitude.label)
    setAttitudeModal(true)
  }

  const handleSaveAttitude = async () => {
    if (!attitudeLabel.trim() || !currentYearId) return                      // +1
    setSubmitting(true)
    try {                                                                     // +1 (nested)
      if (editingAttitude) {                                                  // +2 (nested)
        await fetch(`/api/attitudes/update/${editingAttitude.id}`, {
          method:'POST', credentials:'include',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ label:attitudeLabel.trim() })
        })
        toast({ title:"Attitude modifiée" })
      } else {
        await fetch('/api/attitudes/create', {
          method:'POST', credentials:'include',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ label:attitudeLabel.trim(), academicYearId:currentYearId })
        })
        toast({ title:"Attitude créée" })
      }
      setAttitudeModal(false)
      loadAttitudes(currentYearId)
    } catch {
      toast({ title:"Erreur", variant:"destructive" })
    } finally {
      setSubmitting(false)
    }
  }
  // complexity: 3

  const handleDeleteAttitude = async (attitude: Attitude) => {
    if (!currentYearId) return                                               // +1
    try {                                                                     // +1 (nested)
      await fetch(`/api/attitudes/delete/${attitude.id}`, { method:'POST', credentials:'include' })
      toast({ title:"Attitude supprimée" })
      loadAttitudes(currentYearId)
    } catch {
      toast({ title:"Erreur", variant:"destructive" })
    }
  }
  // complexity: 2

  // ── Class handlers ────────────────────────────────────────────────────────

  const handleInitializeClasses = async () => {
    setInitializing(true)
    try {                                                                     // +1
      const createdTypes: any[] = []
      for (const ct of CLASS_TYPES_SEED) {                                   // +1 (nested)
        const res = await apiFetch<any>('/api/class-types/create', {
          method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(ct)
        })
        createdTypes.push(res)
      }
      await Promise.all(createdTypes.map((res: any) => {
        const id = res?.classType?.id ?? res?.data?.id ?? res?.id
        if (!id) return Promise.resolve()                                     // +2 (nested)
        return apiFetch('/api/classes/create', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ classTypeId:id, letter:'A', maxStudents:30 })
        })
      }))
      toast({ title:"Initialisation réussie", description:"13 niveaux et 13 classes créés." })
      await loadClasses()
    } catch {
      toast({ title:"Erreur", description:"Impossible d'initialiser", variant:"destructive" })
    } finally {
      setInitializing(false)
    }
  }
  // complexity: 4

  const openEditClass = (c: Class) => {
    setEditingClass(c)
    setClassForm({ maxStudents:String(c.maxStudents||30) })
    setClassModal(true)
  }

  const handleSaveClass = async () => {
    if (!editingClass) return                                                 // +1
    setSubmitting(true)
    try {                                                                     // +1 (nested)
      await apiFetch(`/api/classes/update/${editingClass.id}`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ maxStudents:parseInt(classForm.maxStudents)||undefined })
      })
      toast({ title:"Classe modifiée" })
      setClassModal(false)
      setClassesLoaded(false)
      loadClasses()
    } catch {
      toast({ title:"Erreur", variant:"destructive" })
    } finally {
      setSubmitting(false)
    }
  }
  // complexity: 2

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    // data
    schoolInfo, loadingSchoolInfo,
    holidays, events,
    rubrics, subjects, loadingRef, expandedSubjects,
    classTypes, classes, loadingClasses, initializing,
    attitudes, loadingAttitudes, currentYearId,
    // tab
    activeTab, setActiveTab,
    // modal open/close
    rubricModal,  setRubricModal,
    subjectModal, setSubjectModal,
    sectionModal, setSectionModal,
    attitudeModal,setAttitudeModal,
    classModal,   setClassModal,
    submitting,
    // editing targets
    editingRubric, editingSubject, editingClass, editingAttitude, sectionParentId,
    // form state + setters
    rubricForm,    setRubricForm,
    subjectForm,   setSubjectForm,
    sectionForm,   setSectionForm,
    classForm,     setClassForm,
    attitudeLabel, setAttitudeLabel,
    // handlers
    handleSaveSchoolInfo,
    handleAddHoliday, handleEditHoliday, handleDeleteHoliday,
    handleAddEvent,   handleEditEvent,   handleDeleteEvent,
    openCreateRubric, openEditRubric, handleSaveRubric,
    openCreateSubject,openEditSubject,handleSaveSubject,
    openCreateSection,handleSaveSection, toggleExpand,
    openCreateAttitude,openEditAttitude,handleSaveAttitude,handleDeleteAttitude,
    handleInitializeClasses,
    openEditClass,handleSaveClass,
    loadReferentiel, loadAttitudes,
  }
}