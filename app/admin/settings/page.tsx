"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useToast } from "@/components/ui/use-toast"
import { clientFetch as apiFetch } from "@/lib/client-fetch"
import { parseDecimal } from "@/lib/decimal"
import { toMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { CPMSLSchoolInfoForm } from "@/components/school/cpmsl-school-info-form"
import { CPMSLCalendarManagement } from "@/components/school/cpmsl-calendar-management"

import {
  PlusIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CheckCircle2Icon,
  ZapIcon,
  Trash2Icon,
  PencilIcon,
  BookOpenIcon,
  LayersIcon,
  SmileIcon,
  SchoolIcon as SchoolBuildingIcon,
  UploadCloudIcon,
} from "lucide-react"

import { CatalogImportModal } from "@/components/school/catalog-import-modal"

interface SchoolInfo  { name: string; motto?: string; foundedYear?: number; logo?: string; address?: string; phone?: string; email?: string }
interface Holiday     { id: string; name: string; date: string }
interface SchoolEvent { id: string; title: string; date: string; type: 'exam'|'holiday'|'meeting'|'other'|'ceremony'|'trip'; academicYearId: string }
interface Rubric      { id: string; name: string; code: string; description?: string }
interface Section     { id: string; name: string; code: string; maxScore: unknown; displayOrder: number }
interface ApiSubject  {
  id: string; name: string; code: string
  maxScore: unknown; coefficient: unknown
  hasSections: boolean
  rubricId?: string
  classTypeId?: string | null
  classType?: { id: string; name: string } | null
}
interface Subject {
  id: string; name: string; code: string
  maxScore: number; coefficient: number
  hasSections: boolean
  rubricId?: string; rubric?: Rubric
  classTypeId?: string | null
  classTypeName?: string | null
  sections?: Section[]
}
interface ClassType   { id: string; name: string; code?: string; isTerminal: boolean }
interface ApiClass    { id: string; classTypeId: string; letter: string; maxStudents?: number }
interface Class       { id: string; classTypeId: string; classType?: ClassType; letter: string; maxStudents?: number }
interface Attitude    { id: string; label: string; academicYearId: string }
interface RubricForm  { name: string; code: string; description: string }
interface SubjectForm { name: string; code: string; maxScore: string; coefficient: string; hasSections: boolean; rubricId: string; classTypeId: string }
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

const NONE_RUBRIC = "__none__"
const NONE_CLASSTYPE = "__no_classtype__"

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getSectionCycles(sectionId: string): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(`section-cycles-${sectionId}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveSectionCycles(sectionId: string, cycles: string[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(`section-cycles-${sectionId}`, JSON.stringify(cycles))
}

function rubricBadgeClasses(code?: string): string {
  if (code === "R1") return "border-blue-200 bg-blue-50 text-blue-700"
  if (code === "R2") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (code === "R3") return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-slate-200 bg-slate-50 text-slate-700"
}

function rubricWeight(code: string): string {
  if (code === "R1") return "70%"
  if (code === "R2") return "25%"
  if (code === "R3") return "5%"
  return "—"
}

function extractLetters(words: string[]): string {
  if (words.length === 1) return words[0].slice(0, 3)
  if (words.length === 2) return words[0].slice(0, 2) + words[1].slice(0, 1)
  return words.map((w) => w[0]).join("").slice(0, 3)
}

function generateCode(name: string, existingCount: number): string {
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z\s]/g, "")
    .toUpperCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return ""
  return `${extractLetters(words)}-${String(existingCount + 1).padStart(3, "0")}`
}

function normalizeSubject(s: ApiSubject, rubric?: Rubric): Subject {
  return {
    id: s.id,
    name: s.name,
    code: s.code,
    maxScore: parseDecimal(s.maxScore) ?? 0,
    coefficient: parseDecimal(s.coefficient) ?? 1,
    hasSections: s.hasSections,
    rubricId: s.rubricId,
    rubric,
    classTypeId: s.classTypeId ?? null,
    classTypeName: s.classType?.name ?? null,
    sections: [],
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

function useSchoolSettings() {
  const { toast } = useToast()

  // data
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>(DEFAULT_SCHOOL_INFO)
  const [loadingSchoolInfo, setLoadingSchoolInfo] = useState(false)
  const [schoolInfoLoaded, setSchoolInfoLoaded] = useState(false)
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [events, setEvents] = useState<SchoolEvent[]>([])
  const [rubrics, setRubrics] = useState<Rubric[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loadingRef, setLoadingRef] = useState(false)
  const [referentielLoaded, setReferentielLoaded] = useState(false)
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set())
  const [classTypes, setClassTypes] = useState<ClassType[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [classesLoaded, setClassesLoaded] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [attitudes, setAttitudes] = useState<Attitude[]>([])
  const [loadingAttitudes, setLoadingAttitudes] = useState(false)
  const [attitudesLoaded, setAttitudesLoaded] = useState(false)
  const [currentYearId, setCurrentYearId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("general")

  // modals
  const [rubricModal, setRubricModal] = useState(false)
  const [subjectModal, setSubjectModal] = useState(false)
  const [sectionModal, setSectionModal] = useState(false)
  const [attitudeModal, setAttitudeModal] = useState(false)
  const [classModal, setClassModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingRubric, setEditingRubric] = useState<Rubric | null>(null)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [editingClass, setEditingClass] = useState<Class | null>(null)
  const [editingAttitude, setEditingAttitude] = useState<Attitude | null>(null)
  const [sectionParentId, setSectionParentId] = useState<string | null>(null)
  const [editingSection, setEditingSection] = useState<Section | null>(null)
  const [deletingSection, setDeletingSection] = useState<Section | null>(null)
  const [deleteAttitudeTarget, setDeleteAttitudeTarget] = useState<Attitude | null>(null)
  const [rubricForm, setRubricForm] = useState<RubricForm>({ name: "", code: "", description: "" })
  const [subjectForm, setSubjectForm] = useState<SubjectForm>({ name: "", code: "", maxScore: "100", coefficient: "1", hasSections: false, rubricId: NONE_RUBRIC, classTypeId: NONE_CLASSTYPE })
  const [sectionForm, setSectionForm] = useState<SectionForm>({ name: "", code: "", maxScore: "100", cycles: [] })
  const [classForm, setClassForm] = useState<ClassForm>({ maxStudents: "30" })
  const [attitudeLabel, setAttitudeLabel] = useState("")

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadReferentiel = useCallback(async () => {
    setLoadingRef(true)
    try {
      const [rubricsData, subjectsData, classTypesData] = await Promise.all([
        apiFetch<Rubric[]>("/api/subject-rubrics"),
        apiFetch<ApiSubject[]>("/api/subjects"),
        // Niveau picker in the Subject modal needs the list; reuse the
        // existing classTypes state so we don't fetch twice when the user
        // visits the Classes tab.
        apiFetch<ClassType[]>("/api/class-types").catch(() => [] as ClassType[]),
      ])
      setRubrics(rubricsData)
      setClassTypes((prev) => (prev.length > 0 ? prev : classTypesData))
      setSubjects(
        subjectsData.map((s) =>
          normalizeSubject(s, rubricsData.find((r) => r.id === s.rubricId))
        )
      )
    } catch (err) {
      toast({
        title: "Erreur",
        description: toMessage(err, "lors du chargement du référentiel"),
        variant: "destructive",
      })
    } finally {
      setLoadingRef(false)
    }
  }, [toast])

  const loadClasses = useCallback(async () => {
    setLoadingClasses(true)
    try {
      const [ctData, clData] = await Promise.all([
        apiFetch<ClassType[]>("/api/class-types"),
        apiFetch<ApiClass[]>("/api/classes"),
      ])
      setClassTypes(ctData)
      setClasses(clData.map((c) => ({ ...c, classType: ctData.find((ct) => ct.id === c.classTypeId) })))
    } catch (err) {
      toast({
        title: "Erreur",
        description: toMessage(err, "lors du chargement des classes"),
        variant: "destructive",
      })
    } finally {
      setLoadingClasses(false)
    }
  }, [toast])

  const loadAttitudes = useCallback(async (yearId: string) => {
    setLoadingAttitudes(true)
    try {
      const data = await apiFetch<Attitude[]>(`/api/attitudes?academicYearId=${yearId}`)
      setAttitudes(Array.isArray(data) ? data : [])
    } catch (err) {
      toast({
        title: "Erreur",
        description: toMessage(err, "lors du chargement des attitudes"),
        variant: "destructive",
      })
    } finally {
      setLoadingAttitudes(false)
    }
  }, [toast])

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (activeTab === "referentiel" && !referentielLoaded) { loadReferentiel(); setReferentielLoaded(true) }
    if (activeTab === "classes" && !classesLoaded) { loadClasses(); setClassesLoaded(true) }
    if (activeTab === "attitudes" && !attitudesLoaded) {
      setAttitudesLoaded(true)
      apiFetch<{ id?: string }>("/api/academic-years/current")
        .then((data) => {
          if (data?.id) {
            setCurrentYearId(data.id)
            loadAttitudes(data.id)
          }
        })
        .catch(() => {
          // no current year set — handled in UI
        })
    }
  }, [activeTab, referentielLoaded, classesLoaded, attitudesLoaded, loadReferentiel, loadClasses, loadAttitudes])

  useEffect(() => {
    if (activeTab !== "general" || schoolInfoLoaded) return
    setSchoolInfoLoaded(true)
    setLoadingSchoolInfo(true)
    apiFetch<SchoolInfo & { logoUrl?: string }>("/api/school-info")
      .then((data) => {
        if (data) {
          setSchoolInfo({
            name: data.name ?? DEFAULT_SCHOOL_INFO.name,
            motto: data.motto ?? "",
            foundedYear: data.foundedYear,
            logo: data.logo ?? data.logoUrl ?? "",
            address: data.address ?? "",
            phone: data.phone ?? "",
            email: data.email ?? "",
          })
        }
      })
      .catch(() => {
        // singleton — empty on first run is fine
      })
      .finally(() => setLoadingSchoolInfo(false))
  }, [activeTab, schoolInfoLoaded])

  // ── School info ────────────────────────────────────────────────────────────

  const handleSaveSchoolInfo = async (info: SchoolInfo) => {
    setSchoolInfo(info)
    try {
      // Backend field is `logoUrl` (the form uses `logo` internally).
      const { logo, ...rest } = info
      const payload = { ...rest, logoUrl: logo || null }
      await apiFetch("/api/school-info/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      toast({ title: "Paramètres enregistrés" })
    } catch (err) {
      toast({
        title: "Erreur",
        description: toMessage(err, "lors de la sauvegarde"),
        variant: "destructive",
      })
    }
  }

  // ── Calendar (local-state only — persisted by the component itself if needed) ──

  const handleAddHoliday    = (d: { name: string; date: string }) => setHolidays((p) => [...p, { id: `h-${Date.now()}`, ...d }])
  const handleEditHoliday   = (id: string, d: { name: string; date: string }) => setHolidays((p) => p.map((h) => (h.id === id ? { ...h, ...d } : h)))
  const handleDeleteHoliday = (id: string) => setHolidays((p) => p.filter((h) => h.id !== id))
  const handleAddEvent      = (d: { title: string; date: string; type: SchoolEvent["type"] }) => setEvents((p) => [...p, { id: `e-${Date.now()}`, ...d, academicYearId: "" }])
  const handleEditEvent     = (id: string, d: { title: string; date: string; type: SchoolEvent["type"] }) => setEvents((p) => p.map((e) => (e.id === id ? { ...e, ...d } : e)))
  const handleDeleteEvent   = (id: string) => setEvents((p) => p.filter((e) => e.id !== id))

  // ── Rubric handlers ────────────────────────────────────────────────────────

  const openCreateRubric = () => { setEditingRubric(null); setRubricForm({ name: "", code: "", description: "" }); setRubricModal(true) }
  const openEditRubric   = (r: Rubric) => { setEditingRubric(r); setRubricForm({ name: r.name, code: r.code, description: r.description || "" }); setRubricModal(true) }

  const handleSaveRubric = async () => {
    setSubmitting(true)
    try {
      const url = editingRubric ? `/api/subject-rubrics/update/${editingRubric.id}` : "/api/subject-rubrics/create"
      await apiFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rubricForm),
      })
      toast({ title: editingRubric ? "Rubrique modifiée" : "Rubrique créée" })
      setRubricModal(false)
      await loadReferentiel()
    } catch (err) {
      toast({
        title: "Erreur",
        description: toMessage(err, editingRubric ? "lors de la modification" : "lors de la création"),
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Subject handlers ───────────────────────────────────────────────────────

  const openCreateSubject = () => {
    setEditingSubject(null)
    setSubjectForm({ name: "", code: "", maxScore: "100", coefficient: "1", hasSections: false, rubricId: NONE_RUBRIC, classTypeId: NONE_CLASSTYPE })
    setSubjectModal(true)
  }
  const openEditSubject = (s: Subject) => {
    setEditingSubject(s)
    setSubjectForm({
      name: s.name,
      code: s.code,
      maxScore: String(s.maxScore),
      coefficient: String(s.coefficient),
      hasSections: s.hasSections,
      rubricId: s.rubricId || NONE_RUBRIC,
      classTypeId: s.classTypeId || NONE_CLASSTYPE,
    })
    setSubjectModal(true)
  }

  const handleSubjectNameChange = (name: string) => {
    setSubjectForm((f) => ({ ...f, name, ...(!editingSubject && { code: generateCode(name, subjects.length) }) }))
  }

  const handleSaveSubject = async () => {
    setSubmitting(true)
    try {
      const body = {
        name: subjectForm.name,
        code: subjectForm.code,
        maxScore: Number.parseFloat(subjectForm.maxScore),
        coefficient: Number.parseFloat(subjectForm.coefficient),
        hasSections: subjectForm.hasSections,
        rubricId: subjectForm.rubricId === NONE_RUBRIC ? null : subjectForm.rubricId,
        classTypeId: subjectForm.classTypeId === NONE_CLASSTYPE ? null : subjectForm.classTypeId,
      }
      const url = editingSubject ? `/api/subjects/update/${editingSubject.id}` : "/api/subjects/create"
      await apiFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      toast({ title: editingSubject ? "Matière modifiée" : "Matière créée" })
      setSubjectModal(false)
      await loadReferentiel()
    } catch (err) {
      toast({
        title: "Erreur",
        description: toMessage(err, editingSubject ? "lors de la modification" : "lors de la création"),
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Section handlers ───────────────────────────────────────────────────────

  const openCreateSection = (subjectId: string) => {
    setSectionParentId(subjectId)
    setEditingSection(null)
    setSectionForm({ name: "", code: "", maxScore: "100", cycles: [] })
    setSectionModal(true)
  }

  const openEditSection = (parentId: string, section: Section) => {
    setSectionParentId(parentId)
    setEditingSection(section)
    setSectionForm({
      name: section.name,
      code: section.code,
      maxScore: String(parseDecimal(section.maxScore) ?? 0),
      cycles: getSectionCycles(section.id),
    })
    setSectionModal(true)
  }

  const handleSectionNameChange = (name: string) => {
    const parent = subjects.find((s) => s.id === sectionParentId)
    setSectionForm((f) => ({ ...f, name, code: generateCode(name, parent?.sections?.length || 0) }))
  }

  const toggleSectionCycle = (key: string, checked: boolean) => {
    setSectionForm((f) => ({ ...f, cycles: checked ? [...f.cycles, key] : f.cycles.filter((c) => c !== key) }))
  }

  const handleSaveSection = async () => {
    if (!sectionParentId) return
    setSubmitting(true)
    try {
      if (editingSection) {
        // ── UPDATE path ── code and subjectId are immutable on the backend.
        await apiFetch(`/api/subjects/sections/update/${editingSection.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: sectionForm.name,
            maxScore: parseFloat(sectionForm.maxScore),
          }),
        })
        // Cycles are stored client-side (localStorage). Persist the new list.
        saveSectionCycles(editingSection.id, sectionForm.cycles)
        toast({ title: "Sous-matière modifiée" })
      } else {
        // ── CREATE path ──
        const parent = subjects.find((s) => s.id === sectionParentId)
        const result = await apiFetch<{ section?: { id: string } }>(`/api/subjects/${sectionParentId}/sections/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: sectionForm.name,
            code: sectionForm.code,
            maxScore: parseFloat(sectionForm.maxScore),
            displayOrder: (parent?.sections?.length || 0) + 1,
          }),
        })
        const sectionId = result?.section?.id
        if (sectionId && sectionForm.cycles.length > 0) saveSectionCycles(sectionId, sectionForm.cycles)
        toast({ title: "Sous-matière créée" })
      }
      setSectionModal(false)
      setEditingSection(null)
      await loadReferentiel()
    } catch (err) {
      toast({
        title: "Erreur",
        description: toMessage(err, editingSection ? "lors de la modification de la sous-matière" : "lors de la création de la sous-matière"),
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteSection = async () => {
    if (!deletingSection) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/subjects/sections/delete/${deletingSection.id}`, {
        method: "POST",
        credentials: "include",
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.message || "Échec de la suppression")
      toast({ title: "Sous-matière supprimée" })
      setDeletingSection(null)
      await loadReferentiel()
    } catch (err) {
      toast({
        title: "Suppression impossible",
        description: err instanceof Error ? err.message : "Échec",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Expand ─────────────────────────────────────────────────────────────────

  const toggleExpand = async (subjectId: string) => {
    setExpandedSubjects((prev) => {
      const n = new Set(prev)
      if (n.has(subjectId)) n.delete(subjectId)
      else n.add(subjectId)
      return n
    })
    const subject = subjects.find((s) => s.id === subjectId)
    if (subject?.hasSections && (!subject.sections || subject.sections.length === 0)) {
      try {
        const sections = await apiFetch<Section[]>(`/api/subjects/${subjectId}/sections`)
        setSubjects((prev) => prev.map((s) => (s.id === subjectId ? { ...s, sections } : s)))
      } catch {
        /* ignore */
      }
    }
  }

  // ── Attitude handlers ──────────────────────────────────────────────────────

  const openCreateAttitude = () => { setEditingAttitude(null); setAttitudeLabel(""); setAttitudeModal(true) }
  const openEditAttitude   = (a: Attitude) => { setEditingAttitude(a); setAttitudeLabel(a.label); setAttitudeModal(true) }

  const handleSaveAttitude = async () => {
    if (!attitudeLabel.trim() || !currentYearId) return
    setSubmitting(true)
    try {
      if (editingAttitude) {
        await apiFetch(`/api/attitudes/update/${editingAttitude.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: attitudeLabel.trim() }),
        })
        toast({ title: "Attitude modifiée" })
      } else {
        await apiFetch("/api/attitudes/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: attitudeLabel.trim(), academicYearId: currentYearId }),
        })
        toast({ title: "Attitude créée" })
      }
      setAttitudeModal(false)
      await loadAttitudes(currentYearId)
    } catch (err) {
      toast({
        title: "Erreur",
        description: toMessage(err, editingAttitude ? "lors de la modification" : "lors de la création"),
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDeleteAttitude = async () => {
    if (!deleteAttitudeTarget || !currentYearId) return
    try {
      await apiFetch(`/api/attitudes/delete/${deleteAttitudeTarget.id}`, { method: "POST" })
      toast({ title: "Attitude supprimée" })
      setDeleteAttitudeTarget(null)
      await loadAttitudes(currentYearId)
    } catch (err) {
      toast({
        title: "Erreur",
        description: toMessage(err, "lors de la suppression"),
        variant: "destructive",
      })
    }
  }

  // ── Class handlers ─────────────────────────────────────────────────────────

  const handleInitializeClasses = async () => {
    setInitializing(true)
    try {
      const createdTypes: Array<{ classType?: { id: string }; id?: string }> = []
      for (const ct of CLASS_TYPES_SEED) {
        const res = await apiFetch<{ classType?: { id: string }; id?: string }>("/api/class-types/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ct),
        })
        createdTypes.push(res)
      }
      await Promise.all(
        createdTypes.map((res) => {
          const id = res?.classType?.id ?? res?.id
          if (!id) return Promise.resolve()
          return apiFetch("/api/classes/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ classTypeId: id, letter: "A", maxStudents: 30 }),
          })
        })
      )
      toast({ title: "Initialisation réussie", description: "13 niveaux et 13 classes créés." })
      setClassesLoaded(false)
      await loadClasses()
    } catch (err) {
      toast({
        title: "Erreur",
        description: toMessage(err, "lors de l'initialisation"),
        variant: "destructive",
      })
    } finally {
      setInitializing(false)
    }
  }

  const openEditClass = (c: Class) => { setEditingClass(c); setClassForm({ maxStudents: String(c.maxStudents || 30) }); setClassModal(true) }

  const handleSaveClass = async () => {
    if (!editingClass) return
    setSubmitting(true)
    try {
      await apiFetch(`/api/classes/update/${editingClass.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxStudents: parseInt(classForm.maxStudents) || undefined }),
      })
      toast({ title: "Classe modifiée" })
      setClassModal(false)
      setClassesLoaded(false)
      await loadClasses()
    } catch (err) {
      toast({
        title: "Erreur",
        description: toMessage(err, "lors de la modification"),
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return {
    activeTab, setActiveTab,
    schoolInfo, loadingSchoolInfo, handleSaveSchoolInfo,
    holidays, events, handleAddHoliday, handleEditHoliday, handleDeleteHoliday, handleAddEvent, handleEditEvent, handleDeleteEvent,
    loadingRef, rubrics, subjects, expandedSubjects, toggleExpand, loadReferentiel,
    openCreateRubric, openEditRubric, openCreateSubject, openEditSubject, openCreateSection, openEditSection,
    editingSection, deletingSection, setDeletingSection, handleDeleteSection,
    loadingClasses, classTypes, classes, initializing, handleInitializeClasses, openEditClass,
    loadingAttitudes, attitudes, currentYearId, openCreateAttitude, openEditAttitude,
    deleteAttitudeTarget, setDeleteAttitudeTarget, confirmDeleteAttitude,
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
// SECTION HEADER (reusable card head with title/desc/action)
// ═══════════════════════════════════════════════════════════════════════════════

function SectionCard({
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  icon?: React.ElementType
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card className="border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              {Icon && <Icon className="h-4 w-4 text-[#2C4A6E]" />}
              {title}
            </CardTitle>
            {description && <CardDescription className="mt-0.5">{description}</CardDescription>}
          </div>
          {action}
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

interface ReferentielTabProps {
  loading: boolean
  rubrics: Rubric[]
  subjects: Subject[]
  expandedSubjects: Set<string>
  onCreateRubric: () => void
  onEditRubric: (r: Rubric) => void
  onCreateSubject: () => void
  onEditSubject: (s: Subject) => void
  onCreateSection: (id: string) => void
  onEditSection: (parentId: string, section: Section) => void
  onDeleteSection: (section: Section) => void
  onToggleExpand: (id: string) => void
  onOpenImport: () => void
}

function ReferentielTab({
  loading, rubrics, subjects, expandedSubjects,
  onCreateRubric, onEditRubric, onCreateSubject, onEditSubject,
  onCreateSection, onEditSection, onDeleteSection,
  onToggleExpand, onOpenImport,
}: ReferentielTabProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
        <div className="flex items-start gap-2">
          <UploadCloudIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#2C4A6E]" />
          <div>
            <p className="text-sm font-medium text-foreground">Import en masse (CSV)</p>
            <p className="text-xs text-muted-foreground">
              Rubriques, matières et sous-matières en un seul fichier. Idempotent — les entrées existantes ne sont pas dupliquées.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={onOpenImport} className="bg-[#2C4A6E] text-white hover:bg-[#1F3856]">
          <UploadCloudIcon className="mr-2 h-4 w-4" />
          Importer CSV
        </Button>
      </div>

      <SectionCard
        icon={LayersIcon}
        title={`Rubriques (${rubrics.length})`}
        description="Formule BR-001 : R1 × 70% + R2 × 25% + R3 × 5%"
        action={
          <Button
            size="sm"
            onClick={onCreateRubric}
            disabled={rubrics.length >= 3}
            title={rubrics.length >= 3 ? "Maximum 3 rubriques" : undefined}
            className="bg-[#2C4A6E] text-white hover:bg-[#1F3856]"
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            Nouvelle rubrique
          </Button>
        }
      >
        {rubrics.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            Aucune rubrique — créez R1, R2 et R3 pour commencer.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6 font-semibold">Code</TableHead>
                <TableHead className="font-semibold">Nom</TableHead>
                <TableHead className="font-semibold">Description</TableHead>
                <TableHead className="font-semibold">Poids BR-001</TableHead>
                <TableHead className="pr-6 text-right font-semibold">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rubrics.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-6">
                    <Badge variant="outline" className={cn("font-bold", rubricBadgeClasses(r.code))}>{r.code}</Badge>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{r.name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.description || "—"}</TableCell>
                  <TableCell className="font-semibold tabular-nums">{rubricWeight(r.code)}</TableCell>
                  <TableCell className="pr-6 text-right">
                    <Button variant="ghost" size="sm" onClick={() => onEditRubric(r)}>
                      <PencilIcon className="mr-1 h-3.5 w-3.5" />
                      Modifier
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <SectionCard
        icon={BookOpenIcon}
        title={`Matières (${subjects.length})`}
        description="Référentiel global — assignées aux classes dans la configuration de l'année"
        action={
          <Button
            size="sm"
            onClick={onCreateSubject}
            disabled={rubrics.length === 0}
            title={rubrics.length === 0 ? "Créez d'abord les rubriques" : undefined}
            className="bg-[#2C4A6E] text-white hover:bg-[#1F3856]"
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            Nouvelle matière
          </Button>
        }
      >
        {subjects.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            {rubrics.length === 0 ? "Créez d'abord les rubriques (R1, R2, R3)." : "Aucune matière — créez la première."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[40px] pl-6"></TableHead>
                <TableHead className="font-semibold">Code</TableHead>
                <TableHead className="font-semibold">Nom</TableHead>
                <TableHead className="font-semibold">Niveau</TableHead>
                <TableHead className="font-semibold">Rubrique</TableHead>
                <TableHead className="text-right font-semibold">Coef.</TableHead>
                <TableHead className="text-right font-semibold">Note max</TableHead>
                <TableHead className="pr-6 text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((subject) => {
                const isExpanded = expandedSubjects.has(subject.id)
                return (
                  <React.Fragment key={subject.id}>
                    <TableRow>
                      <TableCell className="pl-6">
                        {subject.hasSections && (
                          <button
                            type="button"
                            onClick={() => onToggleExpand(subject.id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {isExpanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                          </button>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                          {subject.code}
                        </code>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{subject.name}</TableCell>
                      <TableCell>
                        {subject.classTypeName ? (
                          <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700 font-medium">
                            {subject.classTypeName}
                          </Badge>
                        ) : (
                          <span className="text-xs italic text-muted-foreground">tous niveaux</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {subject.rubric ? (
                          <Badge variant="outline" className={cn("font-bold", rubricBadgeClasses(subject.rubric.code))}>
                            {subject.rubric.code}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{subject.coefficient}</TableCell>
                      <TableCell className="text-right tabular-nums">{subject.maxScore}</TableCell>
                      <TableCell className="pr-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => onCreateSection(subject.id)}>
                            <PlusIcon className="mr-1 h-3.5 w-3.5" />
                            Section
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => onEditSubject(subject)}>
                            <PencilIcon className="mr-1 h-3.5 w-3.5" />
                            Modifier
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded &&
                      subject.sections?.map((section) => {
                        const cycles = getSectionCycles(section.id)
                        const secMax = parseDecimal(section.maxScore) ?? 0
                        return (
                          <TableRow key={section.id} className="bg-muted/30">
                            <TableCell></TableCell>
                            <TableCell className="pl-6">
                              <code className="font-mono text-[11px] text-muted-foreground">
                                <span className="text-muted-foreground/60">└ </span>
                                {section.code}
                              </code>
                            </TableCell>
                            <TableCell className="text-sm">{section.name}</TableCell>
                            <TableCell></TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {cycles.length > 0 ? (
                                  cycles.map((cyc) => (
                                    <Badge
                                      key={cyc}
                                      variant="outline"
                                      className="border-blue-200 bg-blue-50 text-[10px] text-blue-700"
                                    >
                                      {cyc}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-xs text-muted-foreground">Tous les cycles</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                              {secMax}
                            </TableCell>
                            <TableCell className="pr-6 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onEditSection(subject.id, section)}
                                  title="Modifier la sous-matière"
                                >
                                  <PencilIcon className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onDeleteSection(section)}
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  title="Supprimer la sous-matière"
                                >
                                  <Trash2Icon className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                  </React.Fragment>
                )
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  )
}

function ClassesTab({
  loading, classTypes, classes, initializing, onInitialize, onEditClass,
}: {
  loading: boolean
  classTypes: ClassType[]
  classes: Class[]
  initializing: boolean
  onInitialize: () => void
  onEditClass: (c: Class) => void
}) {
  if (loading) return <Skeleton className="h-64 w-full rounded-xl" />

  const configuredLevelCount = classTypes.filter((ct) =>
    classes.some((c) => c.classTypeId === ct.id)
  ).length
  const totalLevelCount = classTypes.length || 13

  return (
    <SectionCard
      icon={SchoolBuildingIcon}
      title={`Niveaux configurés (${configuredLevelCount} / ${totalLevelCount})`}
      description={`Référentiel permanent — ${classes.length} classe(s) configurée(s)`}
      action={
        classTypes.length === 0 ? (
          <Button
            size="sm"
            onClick={onInitialize}
            disabled={initializing}
            className="bg-[#2C4A6E] text-white hover:bg-[#1F3856]"
          >
            <ZapIcon className="mr-2 h-4 w-4" />
            {initializing ? "Initialisation..." : "Initialiser niveaux & classes"}
          </Button>
        ) : (
          <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
            <CheckCircle2Icon className="h-4 w-4" />
            Classes initialisées
          </div>
        )
      }
    >
      {classTypes.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <p className="text-sm font-semibold text-foreground">Aucun niveau configuré</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cliquez sur &quot;Initialiser niveaux &amp; classes&quot; pour créer les 13 niveaux MENFP.
          </p>
          <Button
            onClick={onInitialize}
            disabled={initializing}
            className="mt-4 bg-[#2C4A6E] text-white hover:bg-[#1F3856]"
          >
            <ZapIcon className="mr-2 h-4 w-4" />
            {initializing ? "Initialisation en cours..." : "Initialiser niveaux & classes"}
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6 font-semibold">Niveau</TableHead>
              <TableHead className="font-semibold">Type</TableHead>
              <TableHead className="text-right font-semibold">Max élèves</TableHead>
              <TableHead className="text-center font-semibold">Statut</TableHead>
              <TableHead className="pr-6 text-right font-semibold">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classTypes.map((ct) => {
              const cls = classes.find((c) => c.classTypeId === ct.id)
              return (
                <TableRow key={ct.id}>
                  <TableCell className="pl-6 font-medium text-foreground">{ct.name}</TableCell>
                  <TableCell>
                    {ct.isTerminal ? (
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                        Examen
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                        Standard
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                    {cls?.maxStudents ?? "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {cls ? (
                      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                        Créée
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                        En attente
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    {cls ? (
                      <Button variant="ghost" size="sm" onClick={() => onEditClass(cls)}>
                        <PencilIcon className="mr-1 h-3.5 w-3.5" />
                        Modifier
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  )
}

function AttitudesTab({
  loading, attitudes, currentYearId,
  onCreateAttitude, onEditAttitude, onDeleteAttitude,
}: {
  loading: boolean
  attitudes: Attitude[]
  currentYearId: string | null
  onCreateAttitude: () => void
  onEditAttitude: (a: Attitude) => void
  onDeleteAttitude: (a: Attitude) => void
}) {
  if (loading) return <Skeleton className="h-64 w-full rounded-xl" />

  return (
    <SectionCard
      icon={SmileIcon}
      title={`Attitudes (${attitudes.length})`}
      description="Caractéristiques de comportement — Oui / Non par élève"
      action={
        <Button
          size="sm"
          onClick={onCreateAttitude}
          disabled={!currentYearId}
          title={!currentYearId ? "Aucune année active" : undefined}
          className="bg-[#2C4A6E] text-white hover:bg-[#1F3856]"
        >
          <PlusIcon className="mr-2 h-4 w-4" />
          Nouvelle attitude
        </Button>
      }
    >
      {!currentYearId ? (
        <div className="px-6 py-10 text-center text-sm text-amber-700">
          Aucune année scolaire active. Activez une année dans la configuration.
        </div>
      ) : attitudes.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <p className="text-sm font-semibold text-foreground">Aucune attitude configurée</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Exemples : Respectueux(se), Ponctuel(le), Attentif(ve)
          </p>
          <Button
            onClick={onCreateAttitude}
            className="mt-4 bg-[#2C4A6E] text-white hover:bg-[#1F3856]"
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            Créer la première attitude
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[60px] pl-6 font-semibold">#</TableHead>
              <TableHead className="font-semibold">Libellé</TableHead>
              <TableHead className="pr-6 text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attitudes.map((att, i) => (
              <TableRow key={att.id}>
                <TableCell className="pl-6 text-sm tabular-nums text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-medium text-foreground">{att.label}</TableCell>
                <TableCell className="pr-6 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onEditAttitude(att)}>
                      <PencilIcon className="mr-1 h-3.5 w-3.5" />
                      Modifier
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteAttitude(att)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2Icon className="mr-1 h-3.5 w-3.5" />
                      Supprimer
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════════════════════

function RubricModal({ open, onOpenChange, form, onChange, editing, submitting, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void
  form: RubricForm; onChange: (f: RubricForm) => void
  editing: Rubric | null; submitting: boolean; onSave: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier la rubrique" : "Nouvelle rubrique"}</DialogTitle>
          <DialogDescription>
            Les rubriques permettent de pondérer les matières (BR-001 : R1 × 70% + R2 × 25% + R3 × 5%).
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="rubric-code">
              Code <span className="text-destructive">*</span>{" "}
              <span className="text-muted-foreground">(ex: R1)</span>
            </Label>
            <Input
              id="rubric-code"
              value={form.code}
              onChange={(e) => onChange({ ...form, code: e.target.value.toUpperCase() })}
              disabled={!!editing}
              placeholder="R1"
              maxLength={10}
            />
            {editing && <p className="text-[11px] text-muted-foreground">Le code ne peut pas être modifié</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="rubric-name">
              Nom <span className="text-destructive">*</span>
            </Label>
            <Input
              id="rubric-name"
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              placeholder="Ex: Évaluation continue"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rubric-description">Description</Label>
            <Input
              id="rubric-description"
              value={form.description}
              onChange={(e) => onChange({ ...form, description: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button
            onClick={onSave}
            disabled={submitting || !form.name || !form.code}
            className="bg-[#2C4A6E] text-white hover:bg-[#1F3856]"
          >
            {submitting ? "En cours..." : editing ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SubjectModal({ open, onOpenChange, form, onChange, onNameChange, rubrics, classTypes, editing, submitting, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void
  form: SubjectForm; onChange: (f: SubjectForm) => void
  onNameChange: (name: string) => void
  rubrics: Rubric[]; classTypes: ClassType[]
  editing: Subject | null; submitting: boolean; onSave: () => void
}) {
  const sortedClassTypes = [...classTypes].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier la matière" : "Nouvelle matière"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Le code est immuable après création."
              : "Le code est généré automatiquement depuis le nom et ne pourra plus être modifié."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="subj-name">
              Nom <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subj-name"
              value={form.name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Ex: Mathématiques"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subj-code">Code</Label>
            <Input
              id="subj-code"
              value={form.code}
              readOnly={!editing}
              disabled={!editing}
              onChange={(e) => editing && onChange({ ...form, code: e.target.value.toUpperCase() })}
            />
            {!editing && <p className="text-[11px] text-muted-foreground">Généré automatiquement</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="subj-rubric">
              Rubrique <span className="text-destructive">*</span>
            </Label>
            <Select value={form.rubricId} onValueChange={(v) => onChange({ ...form, rubricId: v })}>
              <SelectTrigger id="subj-rubric">
                <SelectValue placeholder="Sélectionner une rubrique" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_RUBRIC}>Aucune</SelectItem>
                {rubrics.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.code} — {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subj-classtype">
              Niveau <span className="text-destructive">*</span>
            </Label>
            <Select value={form.classTypeId} onValueChange={(v) => onChange({ ...form, classTypeId: v })}>
              <SelectTrigger id="subj-classtype">
                <SelectValue placeholder="Sélectionner un niveau" />
              </SelectTrigger>
              <SelectContent>
                {sortedClassTypes.map((ct) => (
                  <SelectItem key={ct.id} value={ct.id}>
                    {ct.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              La matière n&apos;apparaîtra que pour les classes de ce niveau dans la configuration de l&apos;année.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subj-coef">Coefficient</Label>
            <Input
              id="subj-coef"
              type="number"
              step="0.5"
              min="0"
              value={form.coefficient}
              onChange={(e) => onChange({ ...form, coefficient: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subj-max">Note max</Label>
            <Input
              id="subj-max"
              type="number"
              min="0"
              step="0.01"
              value={form.maxScore}
              onChange={(e) => onChange({ ...form, maxScore: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 sm:col-span-2">
            <Switch
              id="subj-sections"
              checked={form.hasSections}
              onCheckedChange={(v) => onChange({ ...form, hasSections: v })}
            />
            <Label htmlFor="subj-sections" className="cursor-pointer text-sm">
              Cette matière a des sous-matières (sections)
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button
            onClick={onSave}
            disabled={submitting || !form.name || !form.code || !form.classTypeId || form.classTypeId === NONE_CLASSTYPE}
            className="bg-[#2C4A6E] text-white hover:bg-[#1F3856]"
          >
            {submitting ? "En cours..." : editing ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SectionModal({ open, onOpenChange, form, onChange, onNameChange, onToggleCycle, submitting, onSave, editing }: {
  open: boolean; onOpenChange: (v: boolean) => void
  form: SectionForm; onChange: (f: SectionForm) => void
  onNameChange: (name: string) => void; onToggleCycle: (key: string, checked: boolean) => void
  submitting: boolean; onSave: () => void
  editing: Section | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier la sous-matière" : "Nouvelle sous-matière"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Le code est immuable. Le nom, la note max et les cycles peuvent être modifiés."
              : "Une sous-matière permet de découper une matière (ex: Algèbre / Géométrie / Analyse)."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sec-name">
                Nom <span className="text-destructive">*</span>
              </Label>
              <Input
                id="sec-name"
                value={form.name}
                onChange={(e) => editing ? onChange({ ...form, name: e.target.value }) : onNameChange(e.target.value)}
                placeholder="Ex: Algèbre"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sec-code">Code</Label>
              <Input id="sec-code" value={form.code} readOnly disabled />
              <p className="text-[11px] text-muted-foreground">{editing ? "Immuable" : "Généré automatiquement"}</p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="sec-max">Note max</Label>
              <Input
                id="sec-max"
                type="number"
                min="0"
                step="0.01"
                value={form.maxScore}
                onChange={(e) => onChange({ ...form, maxScore: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Cycles applicables{" "}
              <span className="text-xs font-normal text-muted-foreground">
                — Dans quels cycles cette sous-matière est enseignée ?
              </span>
            </Label>
            <div className="overflow-hidden rounded-md border">
              {CYCLES_MENFP.map((cycle, i) => {
                const isChecked = form.cycles.includes(cycle.key)
                return (
                  <label
                    key={cycle.key}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors",
                      i > 0 && "border-t",
                      isChecked ? "bg-[#F0F4F7]" : "hover:bg-muted/30"
                    )}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(v) => onToggleCycle(cycle.key, v === true)}
                    />
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-foreground">{cycle.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{cycle.description}</span>
                    </div>
                  </label>
                )
              })}
            </div>
            {form.cycles.length === 0 && (
              <p className="text-[11px] text-amber-700">
                Aucun cycle sélectionné — la sous-matière s&apos;appliquera à toutes les classes.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button
            onClick={onSave}
            disabled={submitting || !form.name || !form.code}
            className="bg-[#2C4A6E] text-white hover:bg-[#1F3856]"
          >
            {submitting ? "En cours..." : editing ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AttitudeModal({ open, onOpenChange, label, onLabelChange, editing, submitting, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void
  label: string; onLabelChange: (v: string) => void
  editing: Attitude | null; submitting: boolean; onSave: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier l'attitude" : "Nouvelle attitude"}</DialogTitle>
          <DialogDescription>
            L&apos;attitude sera évaluée Oui / Non pour chaque élève dans le bulletin.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="att-label">
              Libellé <span className="text-destructive">*</span>
            </Label>
            <Input
              id="att-label"
              value={label}
              onChange={(e) => onLabelChange(e.target.value)}
              placeholder="Ex: Respectueux(se), Ponctuel(le)..."
              onKeyDown={(e) => e.key === "Enter" && onSave()}
              autoFocus
            />
          </div>
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Exemples :</span>{" "}
            Respectueux(se) · Ponctuel(le) · Attentif(ve) · Travailleur(se) · Perturbateur(trice)
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button
            onClick={onSave}
            disabled={submitting || !label.trim()}
            className="bg-[#2C4A6E] text-white hover:bg-[#1F3856]"
          >
            {submitting ? "En cours..." : editing ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ClassModal({ open, onOpenChange, form, onChange, editing, submitting, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void
  form: ClassForm; onChange: (f: ClassForm) => void
  editing: Class | null; submitting: boolean; onSave: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Modifier la classe</DialogTitle>
          <DialogDescription>Ajustez la capacité d&apos;accueil de la classe.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Classe</p>
            <p className="text-base font-semibold text-foreground">{editing?.classType?.name} — Salle A</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="class-max">Max élèves</Label>
            <Input
              id="class-max"
              type="number"
              min="1"
              value={form.maxStudents}
              onChange={(e) => onChange({ ...form, maxStudents: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button
            onClick={onSave}
            disabled={submitting}
            className="bg-[#2C4A6E] text-white hover:bg-[#1F3856]"
          >
            {submitting ? "En cours..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function SchoolSettingsPage() {
  const s = useSchoolSettings()
  const [catalogImportOpen, setCatalogImportOpen] = useState(false)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Établissement</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paramètres et référentiel de votre établissement
        </p>
      </div>

      <Tabs value={s.activeTab} onValueChange={s.setActiveTab} className="space-y-6">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-muted/40 p-1">
          {Object.entries(TAB_LABELS).map(([value, label]) => (
            <TabsTrigger key={value} value={value}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <CPMSLSchoolInfoForm
            schoolInfo={s.schoolInfo}
            onSave={s.handleSaveSchoolInfo}
            loading={s.loadingSchoolInfo}
          />
        </TabsContent>

        <TabsContent value="calendar" className="space-y-6">
          <CPMSLCalendarManagement
            holidays={s.holidays}
            events={s.events}
            onAddHoliday={s.handleAddHoliday}
            onEditHoliday={s.handleEditHoliday}
            onDeleteHoliday={s.handleDeleteHoliday}
            onAddEvent={s.handleAddEvent}
            onEditEvent={s.handleEditEvent}
            onDeleteEvent={s.handleDeleteEvent}
          />
        </TabsContent>

        <TabsContent value="referentiel" className="space-y-6">
          <ReferentielTab
            loading={s.loadingRef}
            rubrics={s.rubrics}
            subjects={s.subjects}
            expandedSubjects={s.expandedSubjects}
            onCreateRubric={s.openCreateRubric}
            onEditRubric={s.openEditRubric}
            onCreateSubject={s.openCreateSubject}
            onEditSubject={s.openEditSubject}
            onCreateSection={s.openCreateSection}
            onEditSection={s.openEditSection}
            onDeleteSection={s.setDeletingSection}
            onToggleExpand={s.toggleExpand}
            onOpenImport={() => setCatalogImportOpen(true)}
          />
        </TabsContent>

        <TabsContent value="classes" className="space-y-6">
          <ClassesTab
            loading={s.loadingClasses}
            classTypes={s.classTypes}
            classes={s.classes}
            initializing={s.initializing}
            onInitialize={s.handleInitializeClasses}
            onEditClass={s.openEditClass}
          />
        </TabsContent>

        <TabsContent value="attitudes" className="space-y-6">
          <AttitudesTab
            loading={s.loadingAttitudes}
            attitudes={s.attitudes}
            currentYearId={s.currentYearId}
            onCreateAttitude={s.openCreateAttitude}
            onEditAttitude={s.openEditAttitude}
            onDeleteAttitude={s.setDeleteAttitudeTarget}
          />
        </TabsContent>
      </Tabs>

      <CatalogImportModal
        open={catalogImportOpen}
        onOpenChange={setCatalogImportOpen}
        onSuccess={() => { s.loadReferentiel() }}
      />

      <RubricModal
        open={s.rubricModal}
        onOpenChange={s.setRubricModal}
        form={s.rubricForm}
        onChange={s.setRubricForm}
        editing={s.editingRubric}
        submitting={s.submitting}
        onSave={s.handleSaveRubric}
      />
      <SubjectModal
        open={s.subjectModal}
        onOpenChange={s.setSubjectModal}
        form={s.subjectForm}
        onChange={s.setSubjectForm}
        onNameChange={s.handleSubjectNameChange}
        rubrics={s.rubrics}
        classTypes={s.classTypes}
        editing={s.editingSubject}
        submitting={s.submitting}
        onSave={s.handleSaveSubject}
      />
      <SectionModal
        open={s.sectionModal}
        onOpenChange={s.setSectionModal}
        form={s.sectionForm}
        onChange={s.setSectionForm}
        onNameChange={s.handleSectionNameChange}
        onToggleCycle={s.toggleSectionCycle}
        submitting={s.submitting}
        onSave={s.handleSaveSection}
        editing={s.editingSection}
      />

      {/* Delete confirmation for sub-subjects */}
      <AlertDialog open={!!s.deletingSection} onOpenChange={(o) => !o && s.setDeletingSection(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {s.deletingSection?.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette sous-matière sera retirée définitivement. Si des notes y sont déjà
              rattachées, la suppression sera refusée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={s.submitting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={s.handleDeleteSection}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AttitudeModal
        open={s.attitudeModal}
        onOpenChange={s.setAttitudeModal}
        label={s.attitudeLabel}
        onLabelChange={s.setAttitudeLabel}
        editing={s.editingAttitude}
        submitting={s.submitting}
        onSave={s.handleSaveAttitude}
      />
      <ClassModal
        open={s.classModal}
        onOpenChange={s.setClassModal}
        form={s.classForm}
        onChange={s.setClassForm}
        editing={s.editingClass}
        submitting={s.submitting}
        onSave={s.handleSaveClass}
      />

      <AlertDialog
        open={!!s.deleteAttitudeTarget}
        onOpenChange={(o) => !o && s.setDeleteAttitudeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette attitude ?</AlertDialogTitle>
            <AlertDialogDescription>
              L&apos;attitude <span className="font-medium text-foreground">{s.deleteAttitudeTarget?.label}</span>{" "}
              sera retirée des évaluations à venir. Les évaluations déjà saisies ne seront pas affectées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={s.confirmDeleteAttitude}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
