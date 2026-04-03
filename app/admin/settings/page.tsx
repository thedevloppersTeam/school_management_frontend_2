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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlusIcon, ChevronRightIcon, ChevronDownIcon } from "lucide-react"
import React from "react"
// ── Types ─────────────────────────────────────────────────────────────────────

interface SchoolInfo {
  name: string
  motto?: string
  foundedYear?: number
  logo?: string
  address?: string
  phone?: string
  email?: string
}

interface Holiday {
  id: string
  name: string
  date: string
}

interface SchoolEvent {
  id: string
  title: string
  date: string
  type: 'exam' | 'holiday' | 'meeting' | 'other'
  academicYearId: string
}

interface Rubric {
  id: string
  name: string
  code: string
  description?: string
}

interface Subject {
  id: string
  name: string
  code: string
  maxScore: number
  coefficient: number
  hasSections: boolean
  rubricId?: string
  rubric?: Rubric
  sections?: Section[]
}

interface Section {
  id: string
  name: string
  code: string
  maxScore: number
  displayOrder: number
}

// ── Valeurs par défaut ────────────────────────────────────────────────────────

const DEFAULT_SCHOOL_INFO: SchoolInfo = {
  name: "Cours Privé Mixte Saint Léonard",
  motto: "",
  foundedYear: undefined,
  logo: "",
  address: "",
  phone: "",
  email: "",
}

// ── Helper ────────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...options })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SchoolSettingsPage() {
  const { toast } = useToast()

  // ── Établissement ─────────────────────────────────────────────────────────
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>(DEFAULT_SCHOOL_INFO)
  const [holidays, setHolidays]     = useState<Holiday[]>([])
  const [events, setEvents]         = useState<SchoolEvent[]>([])

  // ── Référentiel matières ──────────────────────────────────────────────────
  const [rubrics, setRubrics]       = useState<Rubric[]>([])
  const [subjects, setSubjects]     = useState<Subject[]>([])
  const [loadingRef, setLoadingRef] = useState(false)
  const [referentielLoaded, setReferentielLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState("general")
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set())

  // ── Modaux ────────────────────────────────────────────────────────────────
  const [rubricModal, setRubricModal]         = useState(false)
  const [editingRubric, setEditingRubric]     = useState<Rubric | null>(null)
  const [rubricForm, setRubricForm]           = useState({ name: '', code: '', description: '' })

  const [subjectModal, setSubjectModal]       = useState(false)
  const [editingSubject, setEditingSubject]   = useState<Subject | null>(null)
  const [subjectForm, setSubjectForm]         = useState({
    name: '', code: '', maxScore: '100', coefficient: '1',
    hasSections: false, rubricId: ''
  })

  const [sectionModal, setSectionModal]       = useState(false)
  const [sectionParentId, setSectionParentId] = useState<string | null>(null)
  const [sectionForm, setSectionForm]         = useState({ name: '', code: '', maxScore: '100' })

  const [submitting, setSubmitting] = useState(false)

  // ── Chargement référentiel ────────────────────────────────────────────────
  const loadReferentiel = useCallback(async () => {
    setLoadingRef(true)
    try {
      const [rubricsData, subjectsData] = await Promise.all([
        apiFetch<Rubric[]>('/api/subject-rubrics'),
        apiFetch<Subject[]>('/api/subjects'),
      ])
      setRubrics(rubricsData)

      // Sections chargées à la demande (au clic d'expansion)
      const subjectsWithSections = subjectsData.map(s => ({ ...s, sections: [] }))

      const enriched = subjectsWithSections.map(s => ({
        ...s,
        rubric: rubricsData.find(r => r.id === s.rubricId)
      }))
      setSubjects(enriched)
    } catch (err) {
      console.error('[settings] referentiel error:', err)
    } finally {
      setLoadingRef(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'referentiel' && !referentielLoaded) {
      loadReferentiel()
      setReferentielLoaded(true)
    }
  }, [activeTab, referentielLoaded, loadReferentiel])

  // ── Handlers établissement ────────────────────────────────────────────────
  const handleSaveSchoolInfo = (info: SchoolInfo) => {
    setSchoolInfo(info)
    toast({ title: "Paramètres enregistrés", description: "Les informations ont été mises à jour." })
  }

  const handleAddHoliday = (data: { name: string; date: string }) =>
    setHolidays(prev => [...prev, { id: `holiday-${Date.now()}`, ...data }])

  const handleEditHoliday = (id: string, data: { name: string; date: string }) =>
    setHolidays(prev => prev.map(h => h.id === id ? { ...h, ...data } : h))

  const handleDeleteHoliday = (id: string) =>
    setHolidays(prev => prev.filter(h => h.id !== id))

  const handleAddEvent = (data: { title: string; date: string; type: SchoolEvent['type'] }) =>
    setEvents(prev => [...prev, { id: `event-${Date.now()}`, ...data, academicYearId: '' }])

  const handleEditEvent = (id: string, data: { title: string; date: string; type: SchoolEvent['type'] }) =>
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...data } : e))

  const handleDeleteEvent = (id: string) =>
    setEvents(prev => prev.filter(e => e.id !== id))

  // ── Handlers rubriques ────────────────────────────────────────────────────
  const openEditRubric = (rubric: Rubric) => {
    setEditingRubric(rubric)
    setRubricForm({ name: rubric.name, code: rubric.code, description: rubric.description || '' })
    setRubricModal(true)
  }

  const handleSaveRubric = async () => {
    if (!editingRubric) return
    setSubmitting(true)
    try {
      await apiFetch(`/api/subject-rubrics/update/${editingRubric.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rubricForm)
      })
      toast({ title: "Rubrique modifiée" })
      setRubricModal(false)
      loadReferentiel()
    } catch {
      toast({ title: "Erreur", description: "Impossible de modifier la rubrique", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Handlers matières ─────────────────────────────────────────────────────
  const openCreateSubject = () => {
    setEditingSubject(null)
    setSubjectForm({ name: '', code: '', maxScore: '100', coefficient: '1', hasSections: false, rubricId: '' })
    setSubjectModal(true)
  }

  const openEditSubject = (subject: Subject) => {
    setEditingSubject(subject)
    setSubjectForm({
      name: subject.name,
      code: subject.code,
      maxScore: String(subject.maxScore),
      coefficient: String(subject.coefficient),
      hasSections: subject.hasSections,
      rubricId: subject.rubricId || ''
    })
    setSubjectModal(true)
  }

  const handleSaveSubject = async () => {
    setSubmitting(true)
    try {
      const body = {
        name: subjectForm.name,
        code: subjectForm.code,
        maxScore: parseFloat(subjectForm.maxScore),
        coefficient: parseFloat(subjectForm.coefficient),
        hasSections: subjectForm.hasSections,
        rubricId: subjectForm.rubricId || null,
      }

      if (editingSubject) {
        await apiFetch(`/api/subjects/update/${editingSubject.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
        toast({ title: "Matière modifiée" })
      } else {
        await apiFetch('/api/subjects/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
        toast({ title: "Matière créée" })
      }

      setSubjectModal(false)
      loadReferentiel()
    } catch {
      toast({ title: "Erreur", description: "Impossible de sauvegarder la matière", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Handlers sections ─────────────────────────────────────────────────────
  const openCreateSection = (subjectId: string) => {
    setSectionParentId(subjectId)
    setSectionForm({ name: '', code: '', maxScore: '100' })
    setSectionModal(true)
  }

  const handleSaveSection = async () => {
    if (!sectionParentId) return
    setSubmitting(true)
    try {
      const parent = subjects.find(s => s.id === sectionParentId)
      const displayOrder = (parent?.sections?.length || 0) + 1

      await apiFetch(`/api/subjects/${sectionParentId}/sections/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sectionForm.name,
          code: sectionForm.code,
          maxScore: parseFloat(sectionForm.maxScore),
          displayOrder,
        })
      })
      toast({ title: "Sous-matière créée" })
      setSectionModal(false)
      loadReferentiel()
    } catch {
      toast({ title: "Erreur", description: "Impossible de créer la sous-matière", variant: "destructive" })
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

    // Charger les sections seulement si pas encore chargées
    const subject = subjects.find(s => s.id === subjectId)
    if (subject && subject.hasSections && (!subject.sections || subject.sections.length === 0)) {
      try {
        const sections = await apiFetch<Section[]>(`/api/subjects/${subjectId}/sections`)
        setSubjects(prev => prev.map(s => s.id === subjectId ? { ...s, sections } : s))
      } catch { /* ignorer */ }
    }
  }

  // ── Couleur rubrique ──────────────────────────────────────────────────────
  const rubricColor = (code?: string) => {
    if (code === 'R1') return { bg: '#E3EFF9', color: '#2B6CB0' }
    if (code === 'R2') return { bg: '#E8F5EC', color: '#2D7D46' }
    if (code === 'R3') return { bg: '#FAF8F3', color: '#B0A07A' }
    return { bg: '#F0F4F7', color: '#5A7085' }
  }

  const TH = {
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    color: '#2C4A6E'
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', lineHeight: 1.15, letterSpacing: '-0.03em', fontWeight: 700, color: "#2A3740" }}>
          Établissement
        </h1>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 400, color: 'hsl(var(--muted-foreground))', marginTop: "4px" }}>
          Paramètres et référentiel de votre établissement
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full" onValueChange={setActiveTab}>
        <TabsList style={{ backgroundColor: "#F0F4F7", borderRadius: "8px", padding: "4px" }}>
          <TabsTrigger value="general" className="data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>
            Informations générales
          </TabsTrigger>
          <TabsTrigger value="calendar" className="data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>
            Calendrier scolaire
          </TabsTrigger>
          <TabsTrigger value="referentiel" className="data-[state=active]:bg-white data-[state=active]:shadow-sm" style={{ borderRadius: "6px" }}>
            Matières & Rubriques
          </TabsTrigger>
        </TabsList>

        {/* Onglet 1 — Informations générales */}
        <TabsContent value="general" className="space-y-6 mt-6">
          <CPMSLSchoolInfoForm schoolInfo={schoolInfo} onSave={handleSaveSchoolInfo} />
        </TabsContent>

        {/* Onglet 2 — Calendrier */}
        <TabsContent value="calendar" className="space-y-8 mt-6">
          <CPMSLCalendarManagement
            holidays={holidays}
            events={events}
            onAddHoliday={handleAddHoliday}
            onEditHoliday={handleEditHoliday}
            onDeleteHoliday={handleDeleteHoliday}
            onAddEvent={handleAddEvent}
            onEditEvent={handleEditEvent}
            onDeleteEvent={handleDeleteEvent}
          />
        </TabsContent>

        {/* Onglet 3 — Matières & Rubriques */}
        <TabsContent value="referentiel" className="space-y-6 mt-6">
          {loadingRef ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <>
              {/* ── Rubriques ── */}
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E8E6E3', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8E6E3' }}>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: '#2A3740' }}>
                    Rubriques
                  </h3>
                  <p style={{ fontSize: '13px', color: '#78756F', marginTop: '2px' }}>
                    Formule BR-001 : R1 × 70% + R2 × 25% + R3 × 5%
                  </p>
                </div>
                <div style={{ padding: '24px' }}>
                  <div style={{ borderRadius: '8px', border: '1px solid #E8E6E3', overflow: 'hidden' }}>
                    <Table>
                      <TableHeader>
                        <TableRow style={{ backgroundColor: '#F1F5F9', borderBottom: '2px solid #D1D5DB' }}>
                          <TableHead style={TH}>Code</TableHead>
                          <TableHead style={TH}>Nom</TableHead>
                          <TableHead style={TH}>Description</TableHead>
                          <TableHead style={TH}>Poids</TableHead>
                          <TableHead style={{ ...TH, textAlign: 'center' }}>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rubrics.map((rubric, i) => {
                          const colors = rubricColor(rubric.code)
                          const poids = rubric.code === 'R1' ? '70%' : rubric.code === 'R2' ? '25%' : rubric.code === 'R3' ? '5%' : '—'
                          return (
                            <TableRow key={rubric.id} style={{ borderTop: i > 0 ? '1px solid #E8E6E3' : 'none' }}>
                              <TableCell>
                                <Badge style={{ backgroundColor: colors.bg, color: colors.color, border: 'none', fontWeight: 700 }}>
                                  {rubric.code}
                                </Badge>
                              </TableCell>
                              <TableCell style={{ fontWeight: 600, color: '#1E1A17', fontSize: '14px' }}>
                                {rubric.name}
                              </TableCell>
                              <TableCell style={{ color: '#78756F', fontSize: '13px' }}>
                                {rubric.description || '—'}
                              </TableCell>
                              <TableCell style={{ fontWeight: 700, color: colors.color, fontSize: '14px' }}>
                                {poids}
                              </TableCell>
                              <TableCell style={{ textAlign: 'center' }}>
                                <button
                                  onClick={() => openEditRubric(rubric)}
                                  style={{ fontSize: '13px', fontWeight: 500, color: '#5A7085', background: 'none', border: 'none', cursor: 'pointer' }}
                                >
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
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: '#2A3740' }}>
                      Matières ({subjects.length})
                    </h3>
                    <p style={{ fontSize: '13px', color: '#78756F', marginTop: '2px' }}>
                      Référentiel global — assignez les matières aux classes via la page de configuration
                    </p>
                  </div>
                  <Button
                    onClick={openCreateSubject}
                    style={{ backgroundColor: '#2C4A6E', color: 'white', borderRadius: '8px' }}
                  >
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Nouvelle matière
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
                              Aucune matière — créez la première
                            </TableCell>
                          </TableRow>
                        ) : subjects.map((subject, i) => {
                          const isExpanded = expandedSubjects.has(subject.id)
                          const colors = rubricColor(subject.rubric?.code)
                          return (
                            <React.Fragment key={subject.id}>
                              <TableRow
                                key={subject.id}
                                style={{ borderTop: i > 0 ? '1px solid #E8E6E3' : 'none', backgroundColor: 'white' }}
                                className="hover:bg-[#FAF8F3]"
                              >
                                <TableCell style={{ padding: '12px 8px' }}>
                                  {subject.hasSections && (
                                    <button
                                      onClick={() => toggleExpand(subject.id)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5A7085', display: 'flex' }}
                                    >
                                      {isExpanded
                                        ? <ChevronDownIcon className="h-4 w-4" />
                                        : <ChevronRightIcon className="h-4 w-4" />
                                      }
                                    </button>
                                  )}
                                </TableCell>
                                <TableCell style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 600, color: '#1E1A17', textTransform: 'uppercase' }}>
                                  {subject.code}
                                </TableCell>
                                <TableCell style={{ fontWeight: 600, color: '#1E1A17', fontSize: '14px' }}>
                                  {subject.name}
                                </TableCell>
                                <TableCell>
                                  {subject.rubric
                                    ? <Badge style={{ backgroundColor: colors.bg, color: colors.color, border: 'none' }}>{subject.rubric.code}</Badge>
                                    : <span style={{ color: '#A8A5A2' }}>—</span>
                                  }
                                </TableCell>
                                <TableCell style={{ color: '#1E1A17', fontSize: '14px' }}>{subject.coefficient}</TableCell>
                                <TableCell style={{ color: '#1E1A17', fontSize: '14px' }}>{subject.maxScore}</TableCell>
                                <TableCell>
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => openCreateSection(subject.id)}
                                      style={{ fontSize: '12px', fontWeight: 500, color: '#2C4A6E', background: 'none', border: 'none', cursor: 'pointer' }}
                                    >
                                      + Section
                                    </button>
                                    <span style={{ color: '#D1CECC' }}>|</span>
                                    <button
                                      onClick={() => openEditSubject(subject)}
                                      style={{ fontSize: '13px', fontWeight: 500, color: '#5A7085', background: 'none', border: 'none', cursor: 'pointer' }}
                                    >
                                      Modifier
                                    </button>
                                  </div>
                                </TableCell>
                              </TableRow>

                              {/* Sections */}
                              {isExpanded && subject.sections?.map(section => (
                                <TableRow key={section.id} style={{ borderTop: '1px solid #E8E6E3', backgroundColor: '#FAFAF8' }}>
                                  <TableCell></TableCell>
                                  <TableCell style={{ paddingLeft: '24px', fontFamily: 'monospace', fontSize: '11px', color: '#78756F', textTransform: 'uppercase' }}>
                                    <span style={{ color: '#A8A5A2' }}>└ </span>{section.code}
                                  </TableCell>
                                  <TableCell style={{ fontSize: '13px', color: '#1E1A17' }}>{section.name}</TableCell>
                                  <TableCell></TableCell>
                                  <TableCell></TableCell>
                                  <TableCell style={{ fontSize: '13px', color: '#78756F' }}>{section.maxScore}</TableCell>
                                  <TableCell></TableCell>
                                </TableRow>
                              ))}
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
      </Tabs>

      {/* ── Modal Rubrique ── */}
      <Dialog open={rubricModal} onOpenChange={setRubricModal}>
        <DialogContent style={{ backgroundColor: 'white', borderRadius: '12px' }}>
          <DialogHeader>
            <DialogTitle className="font-serif" style={{ fontSize: '22px', fontWeight: 700, color: '#2A3740' }}>
              Modifier la rubrique
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label style={{ fontSize: '13px', fontWeight: 500 }}>Code</Label>
              <Input value={rubricForm.code} disabled style={{ borderColor: '#D1CECC', backgroundColor: '#F5F4F2' }} />
            </div>
            <div className="space-y-1">
              <Label style={{ fontSize: '13px', fontWeight: 500 }}>Nom *</Label>
              <Input
                value={rubricForm.name}
                onChange={e => setRubricForm(f => ({ ...f, name: e.target.value }))}
                style={{ borderColor: '#D1CECC' }}
              />
            </div>
            <div className="space-y-1">
              <Label style={{ fontSize: '13px', fontWeight: 500 }}>Description</Label>
              <Input
                value={rubricForm.description}
                onChange={e => setRubricForm(f => ({ ...f, description: e.target.value }))}
                style={{ borderColor: '#D1CECC' }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRubricModal(false)} style={{ borderColor: '#D1CECC' }}>
              Annuler
            </Button>
            <Button
              onClick={handleSaveRubric}
              disabled={submitting || !rubricForm.name}
              style={{ backgroundColor: '#2C4A6E', color: 'white' }}
            >
              {submitting ? 'En cours...' : 'Enregistrer'}
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
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label style={{ fontSize: '13px', fontWeight: 500 }}>Nom *</Label>
                <Input
                  value={subjectForm.name}
                  onChange={e => setSubjectForm(f => ({ ...f, name: e.target.value }))}
                  style={{ borderColor: '#D1CECC' }}
                />
              </div>
              <div className="space-y-1">
                <Label style={{ fontSize: '13px', fontWeight: 500 }}>Code *</Label>
                <Input
                  value={subjectForm.code}
                  onChange={e => setSubjectForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  style={{ borderColor: '#D1CECC' }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label style={{ fontSize: '13px', fontWeight: 500 }}>Coefficient</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={subjectForm.coefficient}
                  onChange={e => setSubjectForm(f => ({ ...f, coefficient: e.target.value }))}
                  style={{ borderColor: '#D1CECC' }}
                />
              </div>
              <div className="space-y-1">
                <Label style={{ fontSize: '13px', fontWeight: 500 }}>Note max</Label>
                <Input
                  type="number"
                  value={subjectForm.maxScore}
                  onChange={e => setSubjectForm(f => ({ ...f, maxScore: e.target.value }))}
                  style={{ borderColor: '#D1CECC' }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label style={{ fontSize: '13px', fontWeight: 500 }}>Rubrique</Label>
              <Select
                value={subjectForm.rubricId}
                onValueChange={v => setSubjectForm(f => ({ ...f, rubricId: v }))}
              >
                <SelectTrigger style={{ borderColor: '#D1CECC' }}>
                  <SelectValue placeholder="Sélectionner une rubrique" />
                </SelectTrigger>
                <SelectContent>
                  {rubrics.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.code} — {r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="hasSections"
                checked={subjectForm.hasSections}
                onChange={e => setSubjectForm(f => ({ ...f, hasSections: e.target.checked }))}
              />
              <Label htmlFor="hasSections" style={{ fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                Cette matière a des sous-matières (sections)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubjectModal(false)} style={{ borderColor: '#D1CECC' }}>
              Annuler
            </Button>
            <Button
              onClick={handleSaveSubject}
              disabled={submitting || !subjectForm.name || !subjectForm.code}
              style={{ backgroundColor: '#2C4A6E', color: 'white' }}
            >
              {submitting ? 'En cours...' : editingSubject ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Section ── */}
      <Dialog open={sectionModal} onOpenChange={setSectionModal}>
        <DialogContent style={{ backgroundColor: 'white', borderRadius: '12px' }}>
          <DialogHeader>
            <DialogTitle className="font-serif" style={{ fontSize: '22px', fontWeight: 700, color: '#2A3740' }}>
              Nouvelle sous-matière
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label style={{ fontSize: '13px', fontWeight: 500 }}>Nom *</Label>
                <Input
                  value={sectionForm.name}
                  onChange={e => setSectionForm(f => ({ ...f, name: e.target.value }))}
                  style={{ borderColor: '#D1CECC' }}
                />
              </div>
              <div className="space-y-1">
                <Label style={{ fontSize: '13px', fontWeight: 500 }}>Code *</Label>
                <Input
                  value={sectionForm.code}
                  onChange={e => setSectionForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  style={{ borderColor: '#D1CECC' }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label style={{ fontSize: '13px', fontWeight: 500 }}>Note max</Label>
              <Input
                type="number"
                value={sectionForm.maxScore}
                onChange={e => setSectionForm(f => ({ ...f, maxScore: e.target.value }))}
                style={{ borderColor: '#D1CECC' }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionModal(false)} style={{ borderColor: '#D1CECC' }}>
              Annuler
            </Button>
            <Button
              onClick={handleSaveSection}
              disabled={submitting || !sectionForm.name || !sectionForm.code}
              style={{ backgroundColor: '#2C4A6E', color: 'white' }}
            >
              {submitting ? 'En cours...' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}