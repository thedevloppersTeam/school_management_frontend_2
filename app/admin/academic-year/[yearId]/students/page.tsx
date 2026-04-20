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
  ArrowRightLeftIcon,
  UserRoundXIcon,
  UserRoundCheckIcon,
} from "lucide-react"
import { ArchivedYearBanner } from "@/components/school/archived-year-banner"
import { StudentEnrollForm } from "@/components/school/students/student-enroll-form"
import { EditStudentModal } from "@/components/school/edit-student-modal"
import { TransferEnrollmentModal } from "@/components/school/transfer-enrollment-modal"
import { StatCard } from "@/components/school/stat-card"
import { fetchClassSessions, type AcademicYear, type ClassSession } from "@/lib/api/dashboard"
import { cn } from "@/lib/utils"

// ── Types locaux ──────────────────────────────────────────────────────────────

interface StudentRow {
  enrollmentId:  string
  studentId:     string
  studentCode:   string
  nisu:          string
  firstname:     string
  lastname:      string
  profilePhoto?: string
  classSessionId: string
  className:     string
  status:        'ACTIVE' | 'TRANSFERRED' | 'DROPPED' | 'GRADUATED'
  address?:      string
  motherName?:   string
  fatherName?:   string
  phone1?:       string
  phone2?:       string
  parentsEmail?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isNisuValid(nisu: string): boolean {
  return !!nisu && /^[A-Z0-9]{14}$/.test(nisu.trim())
}

function deriveYearStatus(year: AcademicYear): 'active' | 'preparation' | 'archived' {
  if (year.isCurrent) return 'active'
  if (new Date(year.endDate) < new Date()) return 'archived'
  return 'preparation'
}


function StatusBadge({ status }: { status: StudentRow['status'] }) {
  switch (status) {
    case 'ACTIVE':
      return (
        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
          Actif
        </Badge>
      )
    case 'DROPPED':
      return <Badge variant="secondary">Désactivé</Badge>
    case 'TRANSFERRED':
      return (
        <Badge className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">
          Transféré
        </Badge>
      )
    case 'GRADUATED':
      return (
        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
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

  // Désactivation
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)
  const [deactivationReason, setDeactivationReason] = useState("")
  const [deactivating, setDeactivating] = useState(false)

  // Modification profil
  const [editingStudent, setEditingStudent]     = useState<StudentRow | null>(null)
  const [editSubmitting, setEditSubmitting]     = useState(false)

  // Transfert
  const [transferringStudent, setTransferringStudent] = useState<StudentRow | null>(null)
  const [transferSubmitting, setTransferSubmitting]   = useState(false)

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
              address?: string
              motherName?: string
              fatherName?: string
              phone1?: string
              phone2?: string
              parentsEmail?: string
              user?: { firstname?: string; lastname?: string; profilePhoto?: string }
            }
          }>>(`/api/enrollments?classSessionId=${session.id}`)

                    const trackSuffix = session.class.track ? ` — ${session.class.track.code}` : ''
          const className = `${session.class.classType.name} ${session.class.letter}${trackSuffix}`

          enrollments.forEach(enr => {
            allEnrollments.push({
              enrollmentId:  enr.id,
              studentId:     enr.studentId,
              studentCode:   enr.student?.studentCode || '—',
              nisu:          enr.student?.nisu || '',
              firstname:     enr.student?.user?.firstname || '',
              lastname:      enr.student?.user?.lastname || '',
              profilePhoto:  enr.student?.user?.profilePhoto,
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
    const uniqueClasses     = [...new Set(students.map(s => s.className))].sort((a, b) => a.localeCompare(b))

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

  // ── Modification profil ────────────────────────────────────────────────────
  const handleEditStudent = async (data: {
    address: string; motherName: string; fatherName: string
    phone1: string; phone2: string; parentsEmail: string
  }) => {
    if (!editingStudent) return
    setEditSubmitting(true)
    try {
      const res = await fetch(`/api/students/update/${editingStudent.studentId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      toast({ title: "Profil mis à jour" })
      setEditingStudent(null)
      loadStudents()
    } catch {
      toast({ title: "Erreur", description: "Impossible de modifier le profil", variant: "destructive" })
    } finally {
      setEditSubmitting(false)
    }
  }

  // ── Transfert ──────────────────────────────────────────────────────────────
  const handleTransfer = async (data: { newClassSessionId: string; notes?: string }) => {
    if (!transferringStudent) return
    setTransferSubmitting(true)
    try {
      const res = await fetch('/api/enrollments/transfer', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentId: transferringStudent.enrollmentId,
          newClassSessionId: data.newClassSessionId,
          notes: data.notes,
        }),
      })
      if (!res.ok) throw new Error()
      toast({ title: "Élève transféré avec succès" })
      setTransferringStudent(null)
      loadStudents()
    } catch {
      toast({ title: "Erreur", description: "Impossible de transférer l'élève", variant: "destructive" })
    } finally {
      setTransferSubmitting(false)
    }
  }

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
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Élèves</h1>
        <p className="mt-1 text-sm text-muted-foreground">
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
          iconClassName="text-emerald-600"
          iconBgClassName="bg-emerald-50"
        />
        <StatCard
          label="Désactivés"
          value={inactiveStudents.length}
          icon={UserXIcon}
          iconClassName="text-slate-600"
          iconBgClassName="bg-slate-100"
        />
        <StatCard
          label="Sans photo"
          value={withoutPhoto.length}
          icon={ImageOffIcon}
          iconClassName="text-amber-600"
          iconBgClassName="bg-amber-50"
        />
        <StatCard
          label="NISU invalide"
          value={withInvalidNisu.length}
          icon={BadgeAlertIcon}
          iconClassName="text-rose-600"
          iconBgClassName="bg-rose-50"
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

        <Separator />

        <CardContent className="p-0">
          {displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <UserIcon className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">
                {searchQuery || selectedClass !== 'all' ? "Aucun élève trouvé" : "Aucun élève inscrit"}
              </h3>
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
                  <TableHead className="w-[60px] pl-6 font-semibold">Élève</TableHead>
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
                      <TableCell className="pl-6">
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
                            <span className="text-[11px] text-destructive">
                              12-13 caractères requis
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
                        {student.className}
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
                                  onClick={() => handleReactivate(student.enrollmentId)}
                                  className="text-emerald-600 focus:text-emerald-600"
                                >
                                  <UserRoundCheckIcon className="mr-2 h-4 w-4" />
                                  Réactiver
                                </DropdownMenuItem>
                              ) : (
                                <>
                                  <DropdownMenuItem onClick={() => setEditingStudent(student)}>
                                    <PencilIcon className="mr-2 h-4 w-4" />
                                    Modifier
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setTransferringStudent(student)}>
                                    <ArrowRightLeftIcon className="mr-2 h-4 w-4" />
                                    Transférer
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => { setDeactivatingId(student.enrollmentId); setDeactivationReason('') }}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <UserRoundXIcon className="mr-2 h-4 w-4" />
                                    Désactiver
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

      {/* ── Modal désactivation ── */}
      <Dialog open={!!deactivatingId} onOpenChange={open => !open && setDeactivatingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Désactiver cet élève</DialogTitle>
            <DialogDescription>
              L'élève ne sera plus visible dans les listes actives. Cette action est réversible —
              vous pouvez réactiver l'élève à tout moment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="deactivation-reason" className="text-sm font-medium">
              Raison (optionnelle)
            </Label>
            <Input
              id="deactivation-reason"
              placeholder="Ex: Déménagement, transfert..."
              value={deactivationReason}
              onChange={e => setDeactivationReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivatingId(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDeactivate} disabled={deactivating}>
              {deactivating ? 'En cours...' : 'Confirmer la désactivation'}
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

      {/* Modal transfert */}
      {transferringStudent && (
        <TransferEnrollmentModal
          open={!!transferringStudent}
          onOpenChange={open => !open && setTransferringStudent(null)}
          studentName={`${transferringStudent.firstname} ${transferringStudent.lastname}`}
          currentClassName={transferringStudent.className}
          sessions={sessions
            .filter(s => s.id !== transferringStudent.classSessionId)
            .map(s => {
              const trackSuffix = s.class.track ? ` — ${s.class.track.code}` : '';
              return {
                id: s.id,
                label: `${s.class.classType.name} ${s.class.letter}${trackSuffix}`,
              };
            })}
          submitting={transferSubmitting}
          onSubmit={handleTransfer}
        />
      )}
    </div>
  )
}