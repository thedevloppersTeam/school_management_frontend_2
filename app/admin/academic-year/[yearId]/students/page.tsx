"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useParams } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { PlusIcon, SearchIcon, UserIcon, ArrowUpIcon, ArrowDownIcon } from "lucide-react"
import { ArchivedYearBanner } from "@/components/school/archived-year-banner"
import { StudentEnrollForm } from "@/components/school/students/student-enroll-form"
import { fetchClassSessions, type AcademicYear, type ClassSession } from "@/lib/api/dashboard"

// ── Types locaux ──────────────────────────────────────────────────────────────

interface StudentRow {
  enrollmentId: string
  studentId: string
  studentCode: string
  nisu: string
  firstname: string
  lastname: string
  profilePhoto?: string
  classSessionId: string
  className: string
  status: 'ACTIVE' | 'TRANSFERRED' | 'DROPPED' | 'GRADUATED'
}

// ── Palette CPMSL ─────────────────────────────────────────────────────────────

const C = {
  primary:  { 50: '#F0F4F7', 200: '#B3C7D5', 500: '#5A7085', 600: '#4A5D6E', 800: '#2A3740' },
  neutral:  { 200: '#E8E6E3', 300: '#D1CECC', 400: '#A8A5A2', 500: '#78756F', 600: '#5C5955', 900: '#1E1A17' },
  success:  { main: '#2D7D46', light: '#E8F5EC' },
  warning:  { main: '#C48B1A', light: '#FEF6E0' },
  error:    { main: '#C43C3C', light: '#FDE8E8' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isNisuValid(nisu: string): boolean {
  return !!nisu && /^\d{12,13}$/.test(nisu.trim())
}

function deriveYearStatus(year: AcademicYear): 'active' | 'preparation' | 'archived' {
  if (year.isCurrent) return 'active'
  if (new Date(year.endDate) < new Date()) return 'archived'
  return 'preparation'
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...options })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StudentsManagementPage() {
  const params = useParams()
  const yearId = params.yearId as string
  const { toast } = useToast()

  // ── État ────────────────────────────────────────────────────────────────────
  const [year, setYear]               = useState<AcademicYear | null>(null)
  const [sessions, setSessions]       = useState<ClassSession[]>([])
  const [students, setStudents]       = useState<StudentRow[]>([])
  const [loading, setLoading]         = useState(true)
  const [enrollOpen, setEnrollOpen]   = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  // Filtres
  const [searchQuery, setSearchQuery]   = useState("")
  const [selectedClass, setSelectedClass] = useState("all")
  const [currentPage, setCurrentPage]   = useState(1)
  const itemsPerPage = 25

  // Désactivation
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)
  const [deactivationReason, setDeactivationReason] = useState("")
  const [deactivating, setDeactivating] = useState(false)

  // Tri
  type SortCol = 'nisu' | 'name' | 'class'
  const [sortCol, setSortCol]   = useState<SortCol | null>(null)
  const [sortDir, setSortDir]   = useState<'asc' | 'desc' | null>(null)

  // ── Chargement ───────────────────────────────────────────────────────────────
  const loadStudents = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Année
      const yearData = await apiFetch<AcademicYear>(`/api/academic-years/${yearId}`)
      setYear(yearData)

      // 2. Sessions de classe
      const sessionsData = await fetchClassSessions(yearId)
      setSessions(sessionsData)

      // 3. Inscriptions pour toutes les sessions
      const allEnrollments: StudentRow[] = []

      await Promise.all(sessionsData.map(async (session) => {
        try {
          const enrollments = await apiFetch<Array<{
            id: string
            studentId: string
            classSessionId: string
            status: 'ACTIVE' | 'TRANSFERRED' | 'DROPPED' | 'GRADUATED'
            student?: {
              id: string
              studentCode?: string
              nisu?: string
              user?: { firstname?: string; lastname?: string; profilePhoto?: string }
            }
          }>>(`/api/enrollments?classSessionId=${session.id}`)

          const className = `${session.class.classType.name} ${session.class.letter}${session.class.track ? ` — ${session.class.track.code}` : ''}`

          enrollments.forEach(enr => {
            allEnrollments.push({
              enrollmentId: enr.id,
              studentId: enr.studentId,
              studentCode: enr.student?.studentCode || '—',
              nisu: enr.student?.nisu || '',
              firstname: enr.student?.user?.firstname || '',
              lastname: enr.student?.user?.lastname || '',
              profilePhoto: enr.student?.user?.profilePhoto,
              classSessionId: session.id,
              className,
              status: enr.status,
            })
          })
        } catch { /* ignorer les erreurs par session */ }
      }))

      setStudents(allEnrollments)
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les élèves", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [yearId, toast])

  useEffect(() => { loadStudents() }, [loadStudents])

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const activeStudents      = students.filter(s => s.status === 'ACTIVE')
  const inactiveStudents    = students.filter(s => s.status !== 'ACTIVE')
  const withoutPhoto        = activeStudents.filter(s => !s.profilePhoto)
  const withInvalidNisu     = activeStudents.filter(s => !isNisuValid(s.nisu))

  // ── Données filtrées ─────────────────────────────────────────────────────────
  const displayed = useMemo(() => {
    let result = showInactive ? students : activeStudents

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(s =>
        s.firstname.toLowerCase().includes(q) ||
        s.lastname.toLowerCase().includes(q) ||
        s.nisu.includes(q)
      )
    }

    if (selectedClass !== 'all') {
      result = result.filter(s => s.className === selectedClass)
    }

    if (sortCol && sortDir) {
      result = [...result].sort((a, b) => {
        const val = (s: StudentRow) =>
          sortCol === 'nisu'  ? s.nisu :
          sortCol === 'name'  ? `${s.lastname} ${s.firstname}`.toLowerCase() :
          s.className.toLowerCase()
        const av = val(a), bv = val(b)
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      })
    }

    return result
  }, [students, showInactive, searchQuery, selectedClass, sortCol, sortDir, activeStudents])

  const totalPages        = Math.ceil(displayed.length / itemsPerPage)
  const paginated         = displayed.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  const uniqueClasses     = [...new Set(students.map(s => s.className))].sort()

  // ── Tri ──────────────────────────────────────────────────────────────────────
  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortCol(null); setSortDir(null) }
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ col }: { col: SortCol }) =>
    sortCol === col ? (
      sortDir === 'asc'
        ? <ArrowUpIcon className="h-3 w-3 inline ml-1" />
        : <ArrowDownIcon className="h-3 w-3 inline ml-1" />
    ) : null

  // ── Désactivation ─────────────────────────────────────────────────────────────
  const handleDeactivate = async () => {
    if (!deactivatingId) return
    setDeactivating(true)
    try {
      const res = await fetch(`/api/enrollments/status-update/${deactivatingId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DROPPED', notes: deactivationReason || undefined })
      })
      if (!res.ok) throw new Error()
      toast({ title: "Élève désactivé" })
      setDeactivatingId(null)
      loadStudents()
    } catch {
      toast({ title: "Erreur", description: "Impossible de désactiver l'élève", variant: "destructive" })
    } finally {
      setDeactivating(false)
    }
  }

  const handleReactivate = async (enrollmentId: string) => {
    try {
      const res = await fetch(`/api/enrollments/status-update/${enrollmentId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE' })
      })
      if (!res.ok) throw new Error()
      toast({ title: "Élève réactivé" })
      loadStudents()
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  const isArchived = year ? deriveYearStatus(year) === 'archived' : false

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="font-serif" style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.03em', color: C.primary[800] }}>
          Élèves
        </h1>
        <p className="font-sans" style={{ fontSize: '13px', color: C.neutral[500] }}>
          Année {year?.name}
        </p>
      </div>

      {isArchived && year && <ArchivedYearBanner yearName={year.name} />}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total actifs",     value: activeStudents.length },
          { label: "Désactivés",       value: inactiveStudents.length },
          { label: "Sans photo",       value: withoutPhoto.length },
          { label: "NISU invalide",    value: withInvalidNisu.length },
        ].map(kpi => (
          <Card key={kpi.label} style={{ backgroundColor: 'white', border: `1px solid ${C.neutral[200]}`, borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <CardHeader className="pb-3">
              <p className="font-sans" style={{ fontSize: '12px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.neutral[500], marginBottom: '4px' }}>
                {kpi.label}
              </p>
              <p className="font-serif" style={{ fontSize: '28px', fontWeight: 700, color: C.primary[800] }}>
                {kpi.value}
              </p>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex items-center gap-2">
          <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} disabled={isArchived} />
          <Label htmlFor="show-inactive" className="font-sans" style={{ fontSize: '13px', color: C.neutral[600] }}>
            Voir désactivés ({inactiveStudents.length})
          </Label>
        </div>

        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: C.neutral[400] }} />
          <Input
            placeholder="Rechercher par nom ou NISU..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1) }}
            className="pl-9"
            style={{ borderColor: C.neutral[300] }}
          />
        </div>

        <Select value={selectedClass} onValueChange={v => { setSelectedClass(v); setCurrentPage(1) }}>
          <SelectTrigger className="w-full sm:w-[200px]" style={{ borderColor: C.neutral[300] }}>
            <SelectValue placeholder="Toutes les classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les classes</SelectItem>
            {uniqueClasses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        {!isArchived && (
          <StudentEnrollForm
            open={enrollOpen}
            onOpenChange={setEnrollOpen}
            academicYearId={yearId}
            onSuccess={() => { setEnrollOpen(false); loadStudents() }}
            trigger={
              <Button style={{ backgroundColor: C.primary[500], color: 'white' }} onClick={() => setEnrollOpen(true)}>
                <PlusIcon className="mr-2 h-4 w-4" />
                Inscrire un élève
              </Button>
            }
          />
        )}
      </div>

      {/* Table */}
      {displayed.length === 0 ? (
        <Card style={{ backgroundColor: 'white', border: `1px solid ${C.neutral[200]}`, borderRadius: '10px' }}>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <UserIcon style={{ width: '48px', height: '48px', color: C.primary[200], marginBottom: '16px' }} />
            <h3 className="font-serif" style={{ fontSize: '20px', fontWeight: 600, color: C.primary[800], marginBottom: '8px' }}>
              {searchQuery || selectedClass !== 'all' ? "Aucun élève trouvé" : "Aucun élève inscrit"}
            </h3>
            <p className="font-sans" style={{ fontSize: '14px', color: C.neutral[500] }}>
              {searchQuery || selectedClass !== 'all' ? "Modifiez vos critères de recherche" : "Commencez par inscrire le premier élève"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card style={{ backgroundColor: 'white', border: `1px solid ${C.neutral[200]}`, borderRadius: '10px' }}>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: C.primary[50], borderBottom: `1px solid ${C.neutral[200]}` }}>
                  {[
                    { label: 'Photo', col: null },
                    { label: 'Code', col: null },
                    { label: 'NISU', col: 'nisu' as SortCol },
                    { label: 'Nom', col: 'name' as SortCol },
                    { label: 'Prénom', col: null },
                    { label: 'Classe', col: 'class' as SortCol },
                    { label: 'Statut', col: null },
                    { label: 'Actions', col: null },
                  ].map(({ label, col }) => (
                    <TableHead
                      key={label}
                      className="font-sans"
                      style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.primary[600], cursor: col ? 'pointer' : 'default' }}
                      onClick={() => col && handleSort(col)}
                    >
                      {label}{col && <SortIcon col={col} />}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map(student => {
                  const nisuInvalid = !isNisuValid(student.nisu)
                  const isInactive = student.status !== 'ACTIVE'

                  return (
                    <TableRow
                      key={student.enrollmentId}
                      style={{ borderBottom: `1px solid ${C.neutral[200]}`, opacity: isInactive ? 0.6 : 1 }}
                    >
                      <TableCell>
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={student.profilePhoto} />
                          <AvatarFallback style={{ backgroundColor: C.neutral[200] }}>
                            <UserIcon style={{ width: '18px', height: '18px', color: C.neutral[400] }} />
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px', color: C.neutral[600] }}>
                          {student.studentCode}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span style={{ color: nisuInvalid ? C.error.main : C.neutral[900], fontWeight: nisuInvalid ? 500 : 400 }}>
                            {student.nisu || '—'}
                          </span>
                          {nisuInvalid && (
                            <span style={{ fontSize: '11px', color: C.error.main }}>
                              12-13 chiffres requis
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-sans" style={{ fontSize: '14px', fontWeight: 600, color: C.neutral[900] }}>
                        {student.lastname}
                      </TableCell>
                      <TableCell className="font-sans" style={{ fontSize: '14px', color: C.neutral[900] }}>
                        {student.firstname}
                      </TableCell>
                      <TableCell className="font-sans" style={{ fontSize: '14px', color: C.neutral[600] }}>
                        {student.className}
                      </TableCell>
                      <TableCell>
                        {student.status === 'ACTIVE' && (
                          <Badge style={{ backgroundColor: C.success.light, color: C.success.main, border: 'none' }}>Actif</Badge>
                        )}
                        {student.status === 'DROPPED' && (
                          <Badge style={{ backgroundColor: C.neutral[200], color: C.neutral[500], border: 'none' }}>Désactivé</Badge>
                        )}
                        {student.status === 'TRANSFERRED' && (
                          <Badge style={{ backgroundColor: '#E3EFF9', color: '#2B6CB0', border: 'none' }}>Transféré</Badge>
                        )}
                        {student.status === 'GRADUATED' && (
                          <Badge style={{ backgroundColor: C.success.light, color: C.success.main, border: 'none' }}>Diplômé</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!isArchived && (
                          <div className="flex items-center gap-3">
                            {isInactive ? (
                              <button
                                onClick={() => handleReactivate(student.enrollmentId)}
                                style={{ fontSize: '13px', fontWeight: 500, color: C.success.main, background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                Réactiver
                              </button>
                            ) : (
                              <button
                                onClick={() => { setDeactivatingId(student.enrollmentId); setDeactivationReason('') }}
                                style={{ fontSize: '13px', fontWeight: 500, color: '#B91C1C', background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                Désactiver
                              </button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={{ borderColor: C.neutral[300] }}>
            ← Précédent
          </Button>
          <span className="font-sans" style={{ fontSize: '13px', color: C.neutral[500] }}>
            Page {currentPage} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} style={{ borderColor: C.neutral[300] }}>
            Suivant →
          </Button>
        </div>
      )}

      {/* Modal désactivation */}
      <Dialog open={!!deactivatingId} onOpenChange={open => !open && setDeactivatingId(null)}>
        <DialogContent style={{ backgroundColor: 'white', borderRadius: '12px' }}>
          <DialogHeader>
            <DialogTitle className="font-serif" style={{ fontSize: '24px', fontWeight: 700, color: C.primary[800] }}>
              Désactiver cet élève
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div style={{ backgroundColor: C.warning.light, border: `1px solid ${C.warning.main}`, borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#92400E' }}>
              L'élève ne sera plus visible dans les listes actives.
            </div>
            <div style={{ backgroundColor: C.success.light, border: `1px solid ${C.success.main}`, borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#166534' }}>
              Action réversible — vous pouvez réactiver l'élève à tout moment.
            </div>
            <div className="space-y-2">
              <Label className="font-sans" style={{ fontSize: '13px', fontWeight: 500 }}>
                Raison (optionnelle)
              </Label>
              <Input
                placeholder="Ex: Déménagement, transfert..."
                value={deactivationReason}
                onChange={e => setDeactivationReason(e.target.value)}
                style={{ borderColor: C.neutral[300] }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivatingId(null)} style={{ borderColor: C.neutral[300] }}>
              Annuler
            </Button>
            <Button onClick={handleDeactivate} disabled={deactivating} style={{ backgroundColor: '#B91C1C', color: 'white' }}>
              {deactivating ? 'En cours...' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}