"use client"

import { clientFetch as apiFetch } from '@/lib/client-fetch'
import { useEffect, useState, useMemo, useCallback } from "react"
import { useParams } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  PlusIcon,
  SearchIcon,
  UserIcon,
  UsersIcon,
  UserXIcon,
  ImageOffIcon,
  BadgeAlertIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  MoreHorizontalIcon,
  PencilIcon,
  UserRoundXIcon,
  UserRoundCheckIcon,
  GraduationCapIcon,
  WrenchIcon,
} from "lucide-react"
import { ArchivedYearBanner } from "@/components/school/archived-year-banner"
import { StudentEnrollForm } from "@/components/school/students/student-enroll-form"
import { EditStudentModal, type EditStudentData } from "@/components/school/edit-student-modal"
import { StepExemptionModal } from "@/components/school/step-exemption-modal"
import { StudentTrackModal } from "@/components/school/student-track-modal"
import { CorrectAssignmentModal } from "@/components/school/correct-assignment-modal"
import { CorrectAssignmentBatchModal } from "@/components/school/correct-assignment-batch-modal"
import { Checkbox } from "@/components/ui/checkbox"
import { StatCard } from "@/components/school/stat-card"
import { fetchClassSessions, type AcademicYear, type ClassSession } from "@/lib/api/dashboard"
import { cn } from "@/lib/utils"
import { isNisuValid, NISU_RULE_LABEL } from "@/lib/nisu"

// ── Types locaux ──────────────────────────────────────────────────────────────

interface StudentRow {
  enrollmentId:  string
  studentId:     string
  studentCode:   string
  nisu:          string
  firstname:     string
  lastname:      string
  birthDate?:    string
  email?:        string
  profilePhoto?: string
  classSessionId: string
  className:     string
  status:        'ACTIVE' | 'TRANSFERRED' | 'DROPPED' | 'GRADUATED'
  // Filière (portée par l'inscription) — obligatoire en classe terminale
  trackId?:      string | null
  trackCode?:    string | null
  isTerminal?:   boolean
  address?:      string
  motherName?:   string
  fatherName?:   string
  phone1?:       string
  phone2?:       string
  parentsEmail?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveYearStatus(year: AcademicYear): 'active' | 'preparation' | 'archived' {
  if (year.isCurrent) return 'active'
  if (new Date(year.endDate) < new Date()) return 'archived'
  return 'preparation'
}


function StatusBadge({ status }: { status: StudentRow['status'] }) {
  switch (status) {
    case 'ACTIVE':
      return (
        <Badge className="border-success-border bg-success-soft text-success-ink hover:bg-success-soft">
          Actif
        </Badge>
      )
    case 'DROPPED':
      return <Badge variant="secondary">Désactivé</Badge>
    case 'TRANSFERRED':
      return (
        <Badge className="border-info-border bg-info-soft text-info-ink hover:bg-info-soft">
          Transféré
        </Badge>
      )
    case 'GRADUATED':
      return (
        <Badge className="border-success-border bg-success-soft text-success-ink hover:bg-success-soft">
          Diplômé
        </Badge>
      )
  }
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
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const PAGE_SIZE_OPTIONS = [15, 25, 50, 100]

  // Départ / annulation du départ. Un seul état pour les deux sens : ils
  // appellent le même endpoint, exigent le même motif, et ne diffèrent que
  // par le statut visé et les libellés.
  const [movement, setMovement] = useState<{ enrollmentId: string; to: 'DROPPED' | 'ACTIVE' } | null>(null)
  const [movementReason, setMovementReason] = useState("")
  const [movementSubmitting, setMovementSubmitting] = useState(false)

  // Modification profil
  const [editingStudent, setEditingStudent]     = useState<StudentRow | null>(null)
  const [editSubmitting, setEditSubmitting]     = useState(false)

  // Transfert

  // Dispense d'étape
  const [exemptingStudent, setExemptingStudent] = useState<StudentRow | null>(null)

  // Filière (classes terminales)
  const [trackStudent, setTrackStudent] = useState<StudentRow | null>(null)

  // Correction d affectation (erreur de saisie a l inscription, pas un transfert)
  const [correctingStudent, setCorrectingStudent] = useState<StudentRow | null>(null)

  // Sélection multiple
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<Set<string>>(new Set())
  const [bulkCorrectOpen, setBulkCorrectOpen] = useState(false)

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
            trackId?: string | null
            track?: { id: string; code: string; name: string } | null
            student?: {
              id: string
              studentCode?: string
              nisu?: string
              address?: string
              motherName?: string
              fatherName?: string
              phone1?: string
              phone2?: string
              parentsEmail?: string
              user?: { firstname?: string; lastname?: string; profilePhoto?: string; birthDate?: string; email?: string }
            }
            // includeTransferred : cet ecran est un affichage d'historique, pas
            // un calcul. Il compte les eleves « inactifs » d'une annee et les
            // liste quand on ouvre la bascule, donc il veut toutes les
            // situations. /api/enrollments retire desormais les inscriptions
            // TRANSFERRED par defaut ; on les redemande ici explicitement pour
            // que ce compteur ne change pas de valeur.
          }>>(`/api/enrollments?classSessionId=${session.id}&includeTransferred=true`)

                  const className = `${session.class.classType.name} ${session.class.letter}`

          enrollments.forEach(enr => {
            allEnrollments.push({
              enrollmentId:  enr.id,
              studentId:     enr.studentId,
              studentCode:   enr.student?.studentCode || '—',
              nisu:          enr.student?.nisu || '',
              firstname:     enr.student?.user?.firstname || '',
              lastname:      enr.student?.user?.lastname || '',
              birthDate:     enr.student?.user?.birthDate ? String(enr.student.user.birthDate).slice(0, 10) : '',
              email:         enr.student?.user?.email || '',
              profilePhoto:  enr.student?.user?.profilePhoto,
              trackId:       enr.trackId ?? null,
              trackCode:     enr.track?.code ?? null,
              isTerminal:    session.class.classType.isTerminal === true,
              classSessionId: session.id,
              className,
              status:        enr.status,
              address:       enr.student?.address || '',
              motherName:    enr.student?.motherName || '',
              fatherName:    enr.student?.fatherName || '',
              phone1:        enr.student?.phone1 || '',
              phone2:        enr.student?.phone2 || '',
              parentsEmail:  enr.student?.parentsEmail || '',
            })
          })
        } catch { /* ignorer les erreurs par session */ }
      }))

      setStudents(allEnrollments)
      setSelectedEnrollmentIds(new Set())
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
        const val = (s: StudentRow) => {
          if (sortCol === 'nisu') return s.nisu
          if (sortCol === 'name') return `${s.lastname} ${s.firstname}`.toLowerCase()
          return s.className.toLowerCase()
        }
        const av = val(a), bv = val(b)
        const comparison = av.localeCompare(bv)
        return sortDir === 'asc' ? comparison : -comparison
      })
    }
    return result
  }, [students, showInactive, searchQuery, selectedClass, sortCol, sortDir, activeStudents])

  const totalPages        = Math.ceil(displayed.length / itemsPerPage)
  const paginated         = displayed.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  // Liste des classes dérivée des sessions (pas des élèves) : une salle
  // nouvellement créée et encore vide doit apparaître dans le filtre.
  const uniqueClasses     = [...new Set(
    sessions.map(s => `${s.class.classType.name} ${s.class.letter}`)
  )].sort((a, b) => a.localeCompare(b))

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

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortCol !== col) {
      return null
    }
    return sortDir === 'asc'
      ? <ArrowUpIcon className="h-3 w-3 inline ml-1" />
      : <ArrowDownIcon className="h-3 w-3 inline ml-1" />
  }

  // ── Départ et annulation du départ ───────────────────────────────────────────
  // Les deux sens passent par le même modal : le backend journalise le geste
  // et refuse un motif vide (400), donc l'annulation ne peut plus être un
  // simple clic dans le menu.
  const handleMovement = async () => {
    if (!movement) return
    const reason = movementReason.trim()
    if (!reason) return
    setMovementSubmitting(true)
    try {
      const res = await fetch(`/api/enrollments/status-update/${movement.enrollmentId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: movement.to, reason })
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.message || undefined)
      toast({ title: movement.to === 'DROPPED' ? "Départ enregistré" : "Départ annulé" })
      setMovement(null)
      loadStudents()
    } catch (err) {
      toast({
        title: "Erreur",
        description:
          err instanceof Error && err.message
            ? err.message
            : movement.to === 'DROPPED'
              ? "Impossible d'enregistrer le départ"
              : "Impossible d'annuler le départ",
        variant: "destructive",
      })
    } finally {
      setMovementSubmitting(false)
    }
  }

  // ── Modification profil ────────────────────────────────────────────────────
  const handleEditStudent = async (data: EditStudentData) => {
    if (!editingStudent) return
    setEditSubmitting(true)
    try {
      // N'envoyer le NISU que s'il a changé : un NISU hérité (format < 20 car.)
      // laissé tel quel serait rejeté par la validation stricte du backend.
      const nisuChanged =
        (data.nisu ?? '').trim().toUpperCase() !== (editingStudent.nisu ?? '').trim().toUpperCase()
      const requestBody = nisuChanged ? data : { ...data, nisu: undefined }
      const res = await fetch(`/api/students/update/${editingStudent.studentId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.message || undefined)
      toast({ title: "Profil mis à jour" })
      setEditingStudent(null)
      loadStudents()
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error && err.message ? err.message : "Impossible de modifier le profil",
        variant: "destructive",
      })
    } finally {
      setEditSubmitting(false)
    }
  }

  // ── Sélection multiple ───────────────────────────────────────────────────────
  const toggleSelected = (enrollmentId: string) => {
    setSelectedEnrollmentIds(prev => {
      const next = new Set(prev)
      if (next.has(enrollmentId)) next.delete(enrollmentId)
      else next.add(enrollmentId)
      return next
    })
  }

  const selectableOnPage = paginated.filter(s => s.status === 'ACTIVE')
  const allPageSelected =
    selectableOnPage.length > 0 &&
    selectableOnPage.every(s => selectedEnrollmentIds.has(s.enrollmentId))
  const togglePageSelection = () => {
    setSelectedEnrollmentIds(prev => {
      const next = new Set(prev)
      if (allPageSelected) selectableOnPage.forEach(s => next.delete(s.enrollmentId))
      else selectableOnPage.forEach(s => next.add(s.enrollmentId))
      return next
    })
  }

  const selectedStudents = students.filter(s => selectedEnrollmentIds.has(s.enrollmentId))

  // ── Rendu ─────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-8">
        <div className="space-y-1">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-[104px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  const isArchived = year ? deriveYearStatus(year) === 'archived' : false

  // Pagination window (up to 5 numbered pages with ellipsis)
  const paginationWindow = (() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1)
    if (currentPage <= 3) return [1, 2, 3, 4, 'ellipsis-right', totalPages]
    if (currentPage >= totalPages - 2) {
      return [1, 'ellipsis-left', totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    }
    return [1, 'ellipsis-left', currentPage - 1, currentPage, currentPage + 1, 'ellipsis-right', totalPages]
  })()

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div>
        <h1 className="heading-1 text-foreground">Élèves</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Gérez les inscriptions
          {year && (
            <>
              {" "}&middot;{" "}
              <Badge variant="secondary" className="ml-1 align-middle">
                {year.name}
              </Badge>
            </>
          )}
        </p>
      </div>

      {isArchived && year && <ArchivedYearBanner yearName={year.name} />}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total actifs"
          value={activeStudents.length}
          icon={UsersIcon}
          iconClassName="text-success"
          iconBgClassName="bg-success-soft"
        />
        <StatCard
          label="Désactivés"
          value={inactiveStudents.length}
          icon={UserXIcon}
          iconClassName="text-primary"
          iconBgClassName="bg-primary/10"
        />
        <StatCard
          label="Sans photo"
          value={withoutPhoto.length}
          icon={ImageOffIcon}
          iconClassName="text-warning-ink"
          iconBgClassName="bg-warning-soft"
        />
        <StatCard
          label="NISU invalide"
          value={withInvalidNisu.length}
          icon={BadgeAlertIcon}
          iconClassName="text-error"
          iconBgClassName="bg-error-soft"
        />
      </div>

      {/* ── Table Card ── */}
      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Liste des élèves</CardTitle>
              <CardDescription>
                {displayed.length} élève{displayed.length > 1 ? 's' : ''}
                {selectedClass !== 'all' && ` — ${selectedClass}`}
                {searchQuery && ` — recherche : "${searchQuery}"`}
              </CardDescription>
            </div>
            {!isArchived && (
              <StudentEnrollForm
                open={enrollOpen}
                onOpenChange={setEnrollOpen}
                academicYearId={yearId}
                onSuccess={() => { setEnrollOpen(false); loadStudents() }}
                trigger={
                  <Button size="sm" onClick={() => setEnrollOpen(true)}>
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Inscrire un élève
                  </Button>
                }
              />
            )}
          </div>
        </CardHeader>

        <Separator />

        {/* Toolbar */}
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou NISU..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1) }}
              className="pl-9"
            />
          </div>

          <Select value={selectedClass} onValueChange={v => { setSelectedClass(v); setCurrentPage(1) }}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Toutes les classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les classes</SelectItem>
              {uniqueClasses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 sm:py-1.5">
            <Switch
              id="show-inactive"
              checked={showInactive}
              onCheckedChange={setShowInactive}
              disabled={isArchived}
            />
            <Label htmlFor="show-inactive" className="cursor-pointer text-sm text-muted-foreground">
              Désactivés ({inactiveStudents.length})
            </Label>
          </div>
        </div>

        {/* Barre d'action — correction d'affectation en lot */}
        {!isArchived && selectedEnrollmentIds.size > 0 && (
          <div className="flex flex-col gap-2 border-t bg-primary/5 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium text-foreground">
              {selectedEnrollmentIds.size} élève{selectedEnrollmentIds.size > 1 ? 's' : ''} sélectionné{selectedEnrollmentIds.size > 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedEnrollmentIds(new Set())}
              >
                Tout désélectionner
              </Button>
              <Button size="sm" onClick={() => setBulkCorrectOpen(true)}>
                <PencilIcon className="mr-2 h-4 w-4" />
                Corriger l&apos;affectation
              </Button>
            </div>
          </div>
        )}

        <Separator />

        <CardContent className="p-0">
          {displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <UserIcon className="h-7 w-7 text-muted-foreground" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-foreground">
                {searchQuery || selectedClass !== 'all' ? "Aucun élève trouvé" : "Aucun élève inscrit"}
              </h2>
              <p className="mt-1 max-w-[320px] text-center text-sm text-muted-foreground">
                {searchQuery || selectedClass !== 'all'
                  ? "Modifiez vos critères de recherche."
                  : "Commencez par inscrire le premier élève pour cette année."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {!isArchived && (
                    <TableHead className="w-[44px] pl-6">
                      <Checkbox
                        checked={allPageSelected}
                        onCheckedChange={togglePageSelection}
                        aria-label="Sélectionner tous les élèves de la page"
                      />
                    </TableHead>
                  )}
                  <TableHead className={cn("w-[60px] font-semibold", isArchived && "pl-6")}>Élève</TableHead>
                  <TableHead className="hidden font-semibold md:table-cell">Code</TableHead>
                  <TableHead
                    className="cursor-pointer select-none font-semibold"
                    onClick={() => handleSort('nisu')}
                  >
                    NISU <SortIcon col="nisu" />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none font-semibold"
                    onClick={() => handleSort('name')}
                  >
                    Nom complet <SortIcon col="name" />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none font-semibold"
                    onClick={() => handleSort('class')}
                  >
                    Classe <SortIcon col="class" />
                  </TableHead>
                  <TableHead className="font-semibold">Statut</TableHead>
                  <TableHead className="pr-6 text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map(student => {
                  const nisuInvalid = !isNisuValid(student.nisu)
                  const isInactive = student.status !== 'ACTIVE'

                  return (
                    <TableRow
                      key={student.enrollmentId}
                      className={cn(isInactive && "opacity-60")}
                    >
                      {!isArchived && (
                        <TableCell className="pl-6">
                          {!isInactive && (
                            <Checkbox
                              checked={selectedEnrollmentIds.has(student.enrollmentId)}
                              onCheckedChange={() => toggleSelected(student.enrollmentId)}
                              aria-label={`Sélectionner ${student.firstname} ${student.lastname}`}
                            />
                          )}
                        </TableCell>
                      )}
                      <TableCell className={cn(isArchived && "pl-6")}>
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={student.profilePhoto} />
                          <AvatarFallback className="bg-muted text-muted-foreground">
                            <UserIcon className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                          {student.studentCode}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span
                            className={cn(
                              "tabular-nums",
                              nisuInvalid ? "font-medium text-destructive" : "text-foreground"
                            )}
                          >
                            {student.nisu || '—'}
                          </span>
                          {nisuInvalid && (
                            <span className="text-2xs text-destructive">
                              {NISU_RULE_LABEL}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{student.lastname}</span>
                          <span className="text-xs text-muted-foreground">{student.firstname}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex flex-col">
                          <span>{student.className}</span>
                          {student.isTerminal && (
                            student.trackCode ? (
                              <span className="text-2xs font-medium text-info-ink">
                                Filière {student.trackCode}
                              </span>
                            ) : (
                              <span className="text-2xs font-medium text-warning-ink">
                                Filière manquante
                              </span>
                            )
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={student.status} />
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        {!isArchived && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontalIcon className="h-4 w-4" />
                                <span className="sr-only">Ouvrir le menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {isInactive ? (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setMovement({ enrollmentId: student.enrollmentId, to: 'ACTIVE' })
                                    setMovementReason('')
                                  }}
                                  className="text-success-ink focus:text-success-ink"
                                >
                                  <UserRoundCheckIcon className="mr-2 h-4 w-4" />
                                  Annuler le départ
                                </DropdownMenuItem>
                              ) : (
                                <>
                                  <DropdownMenuItem onClick={() => setEditingStudent(student)}>
                                    <PencilIcon className="mr-2 h-4 w-4" />
                                    Modifier le profil
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setCorrectingStudent(student)}>
                                    <WrenchIcon className="mr-2 h-4 w-4" />
                                    Corriger l&apos;affectation
                                  </DropdownMenuItem>
                                  {student.isTerminal && (
                                    <DropdownMenuItem onClick={() => setTrackStudent(student)}>
                                      <GraduationCapIcon className="mr-2 h-4 w-4" />
                                      {student.trackId ? 'Changer la filière' : 'Définir la filière'}
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => setExemptingStudent(student)}>
                                    <BadgeAlertIcon className="mr-2 h-4 w-4" />
                                    Dispenser d&apos;une étape
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setMovement({ enrollmentId: student.enrollmentId, to: 'DROPPED' })
                                      setMovementReason('')
                                    }}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <UserRoundXIcon className="mr-2 h-4 w-4" />
                                    Enregistrer un départ
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* Pagination footer — affiché uniquement si > 15 résultats */}
        {displayed.length > 15 && (
          <>
            <Separator />
            <div className="flex flex-col items-center justify-between gap-3 px-4 py-3 sm:flex-row">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Afficher</span>
                  <Select
                    value={String(itemsPerPage)}
                    onValueChange={v => { setItemsPerPage(Number(v)); setCurrentPage(1) }}
                  >
                    <SelectTrigger className="h-8 w-[72px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map(size => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Page <span className="font-medium text-foreground tabular-nums">{currentPage}</span>{" "}
                  sur <span className="font-medium text-foreground tabular-nums">{totalPages}</span>
                  {" "}&middot; {displayed.length} résultat(s)
                </p>
              </div>

              {totalPages > 1 && (
                <Pagination className="mx-0 w-auto justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={e => {
                          e.preventDefault()
                          if (currentPage > 1) setCurrentPage(p => p - 1)
                        }}
                        className={cn(currentPage === 1 && "pointer-events-none opacity-50")}
                      />
                    </PaginationItem>
                    {paginationWindow.map((p, idx) => {
                      if (typeof p === 'string') {
                        return (
                          <PaginationItem key={`${p}-${idx}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )
                      }
                      return (
                        <PaginationItem key={p}>
                          <PaginationLink
                            href="#"
                            isActive={currentPage === p}
                            onClick={e => {
                              e.preventDefault()
                              setCurrentPage(p)
                            }}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    })}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={e => {
                          e.preventDefault()
                          if (currentPage < totalPages) setCurrentPage(p => p + 1)
                        }}
                        className={cn(currentPage === totalPages && "pointer-events-none opacity-50")}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          </>
        )}
      </Card>

      {/* ── Modal départ / annulation du départ ── */}
      <Dialog open={!!movement} onOpenChange={open => !open && setMovement(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {movement?.to === 'ACTIVE'
                ? "Annuler le départ de cet élève"
                : "Enregistrer le départ de cet élève"}
            </DialogTitle>
            <DialogDescription>
              {movement?.to === 'ACTIVE' ? (
                <>
                  L&apos;élève redevient actif : il réapparaît dans les listes et compte de
                  nouveau dans les effectifs. Le motif porte la seule distinction que le
                  bouton ne peut pas dire — un départ saisi par erreur, ou un élève
                  réellement revenu.
                </>
              ) : (
                <>
                  L&apos;élève ne sera plus visible dans les listes actives, et ne comptera
                  plus dans les effectifs. Son inscription et ses notes sont conservées.
                  L&apos;action se défait par &laquo;&nbsp;Annuler le départ&nbsp;&raquo;.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="movement-reason" className="text-sm font-medium">
              Motif <span className="text-destructive">*</span>
            </Label>
            <Input
              id="movement-reason"
              placeholder={
                movement?.to === 'ACTIVE'
                  ? "Ex : départ saisi par erreur — ou élève de retour depuis le 12 janvier"
                  : "Ex : déménagement, transfert vers une autre école"
              }
              value={movementReason}
              onChange={e => setMovementReason(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Consigné au journal d&apos;audit, avec votre nom et la date.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovement(null)}>
              Annuler
            </Button>
            <Button
              variant={movement?.to === 'ACTIVE' ? 'default' : 'destructive'}
              onClick={handleMovement}
              disabled={movementSubmitting || movementReason.trim().length === 0}
            >
              {movementSubmitting
                ? 'Enregistrement…'
                : movement?.to === 'ACTIVE'
                  ? 'Annuler le départ'
                  : 'Enregistrer le départ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal modification profil */}
      {editingStudent && (
        <EditStudentModal
          open={!!editingStudent}
          onOpenChange={open => !open && setEditingStudent(null)}
          studentName={`${editingStudent.firstname} ${editingStudent.lastname}`}
          studentCode={editingStudent.studentCode}
          initialData={{
            lastname:     editingStudent.lastname,
            firstname:    editingStudent.firstname,
            birthDate:    editingStudent.birthDate,
            email:        editingStudent.email,
            nisu:         editingStudent.nisu,
            address:      editingStudent.address,
            motherName:   editingStudent.motherName,
            fatherName:   editingStudent.fatherName,
            phone1:       editingStudent.phone1,
            phone2:       editingStudent.phone2,
            parentsEmail: editingStudent.parentsEmail,
          }}
          submitting={editSubmitting}
          onSubmit={handleEditStudent}
        />
      )}

      {/* Modal filière (classes terminales) */}
      {trackStudent && (
        <StudentTrackModal
          open={!!trackStudent}
          onOpenChange={open => !open && setTrackStudent(null)}
          enrollmentId={trackStudent.enrollmentId}
          studentName={`${trackStudent.firstname} ${trackStudent.lastname}`}
          className={trackStudent.className}
          currentTrackId={trackStudent.trackId}
          onSaved={loadStudents}
        />
      )}

      {/* Modal correction d'affectation */}
      {correctingStudent && (
        <CorrectAssignmentModal
          open={!!correctingStudent}
          onOpenChange={open => !open && setCorrectingStudent(null)}
          enrollmentId={correctingStudent.enrollmentId}
          studentName={`${correctingStudent.firstname} ${correctingStudent.lastname}`}
          currentClassSessionId={correctingStudent.classSessionId}
          currentClassName={correctingStudent.className}
          currentTrackId={correctingStudent.trackId}
          currentClassTypeId={sessions.find(s => s.id === correctingStudent.classSessionId)?.class.classType.id}
          sessions={sessions.map(s => ({
            id: s.id,
            label: `${s.class.classType.name} ${s.class.letter}`,
            classTypeId: s.class.classType.id,
          }))}
          onCorrected={loadStudents}
        />
      )}

      {/* Modal correction d'affectation en lot */}
      {bulkCorrectOpen && (
        <CorrectAssignmentBatchModal
          open={bulkCorrectOpen}
          onOpenChange={setBulkCorrectOpen}
          students={selectedStudents.map(s => ({
            enrollmentId:   s.enrollmentId,
            studentName:    `${s.firstname} ${s.lastname}`,
            classSessionId: s.classSessionId,
            className:      s.className,
            classTypeId:    sessions.find(cs => cs.id === s.classSessionId)?.class.classType.id,
          }))}
          sessions={sessions.map(s => ({
            id: s.id,
            label: `${s.class.classType.name} ${s.class.letter}`,
            classTypeId: s.class.classType.id,
          }))}
          onCorrected={() => {
            setSelectedEnrollmentIds(new Set())
            void loadStudents()
          }}
        />
      )}

      {/* Modal dispense d'étape */}
      {exemptingStudent && (
        <StepExemptionModal
          open={!!exemptingStudent}
          onOpenChange={open => !open && setExemptingStudent(null)}
          enrollmentId={exemptingStudent.enrollmentId}
          studentName={`${exemptingStudent.firstname} ${exemptingStudent.lastname}`}
          steps={year?.steps ?? []}
        />
      )}

    </div>
  )
}
