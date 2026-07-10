"use client"

import { clientFetch as apiFetch } from '@/lib/client-fetch'
import { useEffect, useState, useMemo, useCallback } from "react"
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
import Link from "next/link"
import {
  PlusIcon,
  SearchIcon,
  UserIcon,
  UsersIcon,
  BadgeAlertIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  MoreHorizontalIcon,
  PencilIcon,
  ArrowRightLeftIcon,
  UserRoundXIcon,
  UserRoundCheckIcon,
  FileTextIcon,
  CameraIcon,
  SettingsIcon,
  UploadCloudIcon,
  Trash2Icon,
  KeyRoundIcon,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { ArchivedYearBanner } from "@/components/school/archived-year-banner"
import { StudentEnrollForm } from "@/components/school/students/student-enroll-form"
import { EditStudentModal } from "@/components/school/edit-student-modal"
import { TransferEnrollmentModal } from "@/components/school/transfer-enrollment-modal"
import { PromotionPhotoModal } from "@/components/school/promotion-photo-modal"
import { normalizeUploadUrl } from "@/lib/upload-url"
import { StatCard } from "@/components/school/stat-card"
import { fetchActiveAcademicYear, fetchClassSessions, type AcademicYear, type ClassSession } from "@/lib/api/dashboard"
import { cn } from "@/lib/utils"
import { isNisuValid, NISU_RULE_LABEL } from "@/lib/nisu"

// ── Types locaux ──────────────────────────────────────────────────────────────

type EnrollmentStatus = 'ACTIVE' | 'TRANSFERRED' | 'DROPPED' | 'GRADUATED'

interface StudentRow {
  studentId:     string
  userId?:       string
  studentCode:   string
  nisu:          string
  firstname:     string
  lastname:      string
  profilePhoto?: string
  promotionPhotoUrl?: string | null
  // Latest enrollment (any year) — may be absent if the student was never enrolled
  enrollmentId?:   string
  classSessionId?: string
  className?:      string         // combined (e.g. "2ème AF A") — used for filtering/sorting
  classTypeName?:  string         // e.g. "2ème AF"
  salleLabel?:     string         // e.g. "A" or track code "LLA"
  yearString?:     string
  yearId?:         string
  status?:         EnrollmentStatus
  enrollmentDate?: string
  registrationDate?: string       // student creation date (Student.registrationDate)
  address?:      string
  motherName?:   string
  fatherName?:   string
  phone1?:       string
  phone2?:       string
  parentsEmail?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type PromotionPhotoListItem = {
  studentId?: string
  academicYearId?: string
  photoUrl?: string
}

function normalizePromotionPhotos(value: unknown): PromotionPhotoListItem[] {
  const rawItems = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? ["photos", "promotionPhotos", "data", "items"]
          .map((key) => (value as Record<string, unknown>)[key])
          .find(Array.isArray) ?? []
      : []

  return rawItems.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const record = item as Record<string, unknown>
    const studentId = typeof record.studentId === "string" ? record.studentId : undefined
    const academicYearId = typeof record.academicYearId === "string" ? record.academicYearId : undefined
    const photoUrl = typeof record.photoUrl === "string" ? record.photoUrl.trim() : undefined
    return photoUrl ? [{ studentId, academicYearId, photoUrl }] : []
  })
}

function deriveYearStatus(year: AcademicYear): 'active' | 'preparation' | 'archived' {
  if (year.isCurrent) return 'active'
  if (new Date(year.endDate) < new Date()) return 'archived'
  return 'preparation'
}


function StatusBadge({ status }: { status?: EnrollmentStatus }) {
  if (!status) return <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">Non inscrit</Badge>
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
  const { toast } = useToast()

  // ── État ────────────────────────────────────────────────────────────────────
  const [year, setYear]               = useState<AcademicYear | null>(null)
  const [noCurrentYear, setNoCurrentYear] = useState(false)
  const [sessions, setSessions]       = useState<ClassSession[]>([])
  const [students, setStudents]       = useState<StudentRow[]>([])
  const [loading, setLoading]         = useState(true)
  const [enrollOpen, setEnrollOpen]   = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  // Filtres
  const [searchQuery, setSearchQuery]   = useState("")
  const [selectedClass, setSelectedClass] = useState("all")        // classe (classType name)
  const [selectedSalle, setSelectedSalle] = useState("all")        // salle (letter or track code)
  const [currentPage, setCurrentPage]   = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const PAGE_SIZE_OPTIONS = [15, 25, 50, 100]

  // Désactivation
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)
  const [deactivationReason, setDeactivationReason] = useState("")
  const [deactivating, setDeactivating] = useState(false)

  // Photo de promotion
  const [photoTarget, setPhotoTarget] = useState<StudentRow | null>(null)

  // Modification profil
  const [editingStudent, setEditingStudent]     = useState<StudentRow | null>(null)
  const [editSubmitting, setEditSubmitting]     = useState(false)

  // Transfert
  const [transferringStudent, setTransferringStudent] = useState<StudentRow | null>(null)
  const [transferSubmitting, setTransferSubmitting]   = useState(false)

  // Suppression (sélection multiple + confirmation par mot de passe)
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [deleteOpen, setDeleteOpen]     = useState(false)
  const [deletePassword, setDeletePassword] = useState("")
  const [deleting, setDeleting]         = useState(false)
  const [deleteError, setDeleteError]   = useState<string | null>(null)

  // Tri
  type SortCol = 'nisu' | 'name' | 'class' | 'date'
  const [sortCol, setSortCol]   = useState<SortCol | null>(null)
  const [sortDir, setSortDir]   = useState<'asc' | 'desc' | null>(null)

  // ── Chargement ───────────────────────────────────────────────────────────────
  const loadStudents = useCallback(async () => {
    setLoading(true)
    setNoCurrentYear(false)
    try {
      // 1. Année courante (utilisée pour l'inscription, le transfert, la photo de promotion)
      const yearData = await fetchActiveAcademicYear()
      setYear(yearData)
      setNoCurrentYear(!yearData)

      // 2. Sessions de classe de l'année courante (pour les modaux Transférer / Inscrire)
      let sessionsData: ClassSession[] = []
      if (yearData) {
        sessionsData = await fetchClassSessions(yearData.id)
        setSessions(sessionsData)
      } else {
        setSessions([])
      }

      // 3. Liste de tous les élèves du système (un seul appel)
      const studentsData = await apiFetch<Array<{
        id: string
        studentCode?: string
        nisu?: string
        address?: string
        motherName?: string
        fatherName?: string
        phone1?: string
        phone2?: string
        parentsEmail?: string
        registrationDate?: string
        user?: { id?: string; firstname?: string; lastname?: string; profilePhoto?: string }
      }>>("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      // 4. Toutes les inscriptions, toutes années confondues (pour résoudre la situation actuelle de chaque élève)
      const allEnrollments = await apiFetch<Array<{
        id: string
        studentId: string
        classSessionId: string
        enrollmentDate?: string
        status: EnrollmentStatus
        classSession?: {
          id: string
          class?: {
            letter?: string
            classType?: { name?: string }
            track?: { code?: string }
          }
          academicYear?: { id?: string; yearString?: string; name?: string; isCurrent?: boolean }
        }
      }>>("/api/enrollments")

      // 5. Photos de promotion pour l'année courante uniquement
      const photoByStudent = new Map<string, string>()
      if (yearData) {
        try {
          const photoPayload = await apiFetch<unknown>(
            `/api/promotion-photos?academicYearId=${yearData.id}&_t=${Date.now()}`,
            { cache: "no-store" }
          )
          const photos = normalizePromotionPhotos(photoPayload)
          photos.forEach((p) => {
            if (p.studentId && p.photoUrl) photoByStudent.set(p.studentId, p.photoUrl)
          })
        } catch (error) {
          console.error("[all-students] promotion photos load failed:", error)
        }
      }

      // 6. Pour chaque élève, on retient l'inscription la plus récente
      const latestByStudent = new Map<string, typeof allEnrollments[number]>()
      for (const enr of allEnrollments) {
        const prev = latestByStudent.get(enr.studentId)
        const enrDate = enr.enrollmentDate ?? ""
        const prevDate = prev?.enrollmentDate ?? ""
        if (!prev || enrDate > prevDate) {
          latestByStudent.set(enr.studentId, enr)
        }
      }

      const rows: StudentRow[] = studentsData.map((s) => {
        const latest = latestByStudent.get(s.id)
        const cls = latest?.classSession?.class
        const classTypeName = cls?.classType?.name
        // For tracked classes (NS3/NS4) the track code is treated as the "salle"
        // (per the school convention from the config tabs). Otherwise the letter is used.
        const salleLabel = cls?.track?.code ?? cls?.letter
        const className = classTypeName
          ? `${classTypeName}${salleLabel ? ` ${salleLabel}` : ""}`
          : undefined
        return {
          studentId: s.id,
          userId: s.user?.id,
          studentCode: s.studentCode || "—",
          nisu: s.nisu || "",
          firstname: s.user?.firstname || "",
          lastname: s.user?.lastname || "",
          profilePhoto: s.user?.profilePhoto,
          promotionPhotoUrl: photoByStudent.get(s.id) ?? null,
          enrollmentId: latest?.id,
          classSessionId: latest?.classSessionId,
          className,
          classTypeName,
          salleLabel,
          yearString: latest?.classSession?.academicYear?.yearString,
          yearId: latest?.classSession?.academicYear?.id,
          status: latest?.status,
          enrollmentDate: latest?.enrollmentDate,
          registrationDate: s.registrationDate,
          address: s.address || "",
          motherName: s.motherName || "",
          fatherName: s.fatherName || "",
          phone1: s.phone1 || "",
          phone2: s.phone2 || "",
          parentsEmail: s.parentsEmail || "",
        }
      })

      setStudents(rows)
    } catch (err) {
      console.error("[all-students] load failed:", err)
      toast({ title: "Erreur", description: "Impossible de charger les élèves", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadStudents() }, [loadStudents])

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const totalStudents       = students.length
  const currentYearId       = year?.id
  const withPromotionPhoto  = students.filter(s => !!s.promotionPhotoUrl)
  // NISU is optional now — only flag a NISU that is present AND malformed.
  const withInvalidNisu     = students.filter(s => !!s.nisu && !isNisuValid(s.nisu))
  // "Inclure désactivés" toggle compte les DROPPED de l'année courante (uniquement informatif)
  const droppedCurrentYear  = students.filter(s => s.status === 'DROPPED' && s.yearId === currentYearId && !!currentYearId)

  // ── Données filtrées ─────────────────────────────────────────────────────────
  const displayed = useMemo(() => {
    // Default: show every student. The "Désactivés" switch hides DROPPED enrollments.
    let result = students
    if (!showInactive) {
      result = result.filter(s => s.status !== 'DROPPED')
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(s =>
        s.firstname.toLowerCase().includes(q) ||
        s.lastname.toLowerCase().includes(q) ||
        s.nisu.includes(q) ||
        s.studentCode.toLowerCase().includes(q)
      )
    }

    if (selectedClass !== 'all') {
      result = result.filter(s => (s.classTypeName ?? '—') === selectedClass)
    }
    if (selectedSalle !== 'all') {
      result = result.filter(s => (s.salleLabel ?? '—') === selectedSalle)
    }

    if (sortCol && sortDir) {
      result = [...result].sort((a, b) => {
        const val = (s: StudentRow) => {
          if (sortCol === 'nisu') return s.nisu
          if (sortCol === 'name') return `${s.lastname} ${s.firstname}`.toLowerCase()
          if (sortCol === 'date') return s.registrationDate ?? ''   // ISO date sorts chronologically
          return (s.className ?? '').toLowerCase()
        }
        const av = val(a), bv = val(b)
        const comparison = av.localeCompare(bv)
        return sortDir === 'asc' ? comparison : -comparison
      })
    }
    return result
  }, [students, showInactive, searchQuery, selectedClass, selectedSalle, sortCol, sortDir])

  const totalPages        = Math.ceil(displayed.length / itemsPerPage)
  const paginated         = displayed.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const classTypeOptions = useMemo(
    () => [...new Set(students.map(s => s.classTypeName).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)),
    [students]
  )
  const salleOptions = useMemo(() => {
    const filtered = selectedClass === 'all'
      ? students
      : students.filter(s => s.classTypeName === selectedClass)
    return [...new Set(filtered.map(s => s.salleLabel).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b))
  }, [students, selectedClass])

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
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.message || "")
      }
      toast({ title: "Profil mis à jour" })
      setEditingStudent(null)
      loadStudents()
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : "Impossible de modifier le profil"
      // Surface the backend's reason (e.g. "NISU already exists") to the user.
      toast({ title: "Erreur", description: msg === "NISU already exists" ? "Ce NISU est déjà utilisé par un autre élève." : msg, variant: "destructive" })
    } finally {
      setEditSubmitting(false)
    }
  }

  // ── Suppression ──────────────────────────────────────────────────────────────
  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function openDeleteDialog() {
    setDeletePassword("")
    setDeleteError(null)
    setDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (selectedIds.size === 0 || !deletePassword) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/students/delete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentIds: Array.from(selectedIds), password: deletePassword }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        // 403 = wrong password — keep the dialog open so they can retry.
        const msg = data?.message || "Échec de la suppression"
        setDeleteError(msg === "Mot de passe incorrect" ? "Mot de passe incorrect." : msg)
        return
      }
      const deleted = data?.summary?.deleted ?? 0
      const failed = data?.summary?.failed ?? 0
      toast({
        title: `${deleted} élève(s) supprimé(s)`,
        description: failed > 0 ? `${failed} suppression(s) en échec.` : undefined,
        variant: failed > 0 ? "destructive" : undefined,
      })
      setDeleteOpen(false)
      setSelectedIds(new Set())
      setDeletePassword("")
      loadStudents()
    } catch {
      setDeleteError("Impossible de contacter le serveur.")
    } finally {
      setDeleting(false)
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
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Tous les élèves enregistrés dans le système — toutes années confondues</span>
          {year && (
            <>
              <span>&middot;</span>
              <Badge variant="secondary" className="align-middle">
                Année courante : {year.name}
              </Badge>
            </>
          )}
        </div>
      </div>

      {noCurrentYear && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Aucune année scolaire courante n&apos;est définie. Les actions d&apos;inscription, de transfert et de photo de promotion sont désactivées.
          {" "}<a href="/admin/academic-years" className="font-semibold underline">Configurer une année</a>.
        </div>
      )}

      {isArchived && year && <ArchivedYearBanner yearName={year.name} />}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total élèves"
          value={totalStudents}
          icon={UsersIcon}
          iconClassName="text-[#2C4A6E]"
          iconBgClassName="bg-blue-50"
        />
        <StatCard
          label={year ? `Avec photo (${year.yearString})` : "Avec photo de promotion"}
          value={withPromotionPhoto.length}
          icon={UserIcon}
          iconClassName="text-emerald-600"
          iconBgClassName="bg-emerald-50"
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
                {selectedSalle !== 'all' && ` ${selectedSalle}`}
                {searchQuery && ` — recherche : "${searchQuery}"`}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/inscription-form">
                  <SettingsIcon className="mr-2 h-4 w-4" />
                  Configurer le formulaire
                </Link>
              </Button>
              {!isArchived && year && (
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/inscription-import">
                    <UploadCloudIcon className="mr-2 h-4 w-4" />
                    Importer (CSV)
                  </Link>
                </Button>
              )}
              {!isArchived && year && (
                <StudentEnrollForm
                  open={enrollOpen}
                  onOpenChange={setEnrollOpen}
                  academicYearId={year.id}
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
          </div>
        </CardHeader>

        <Separator />

        {/* Toolbar */}
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, NISU ou code..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1) }}
              className="pl-9"
            />
          </div>

          <Select
            value={selectedClass}
            onValueChange={v => {
              setSelectedClass(v)
              setSelectedSalle('all')
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Toutes les classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les classes</SelectItem>
              {classTypeOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select
            value={selectedSalle}
            onValueChange={v => { setSelectedSalle(v); setCurrentPage(1) }}
            disabled={selectedClass === 'all' && salleOptions.length === 0}
          >
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Toutes les salles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les salles</SelectItem>
              {salleOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 sm:py-1.5">
            <Switch
              id="show-inactive"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
            <Label htmlFor="show-inactive" className="cursor-pointer text-sm text-muted-foreground">
              Inclure désactivés ({droppedCurrentYear.length})
            </Label>
          </div>
        </div>

        <Separator />

        <CardContent className="p-0">
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between gap-3 border-b bg-rose-50/60 px-4 py-2.5">
              <span className="text-sm font-medium text-rose-900">
                {selectedIds.size} élève(s) sélectionné(s)
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Annuler
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={openDeleteDialog}
                >
                  <Trash2Icon className="mr-2 h-4 w-4" />
                  Supprimer la sélection
                </Button>
              </div>
            </div>
          )}
          {displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <UserIcon className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">
                {searchQuery || selectedClass !== 'all' || selectedSalle !== 'all' ? "Aucun élève trouvé" : "Aucun élève inscrit"}
              </h3>
              <p className="mt-1 max-w-[320px] text-center text-sm text-muted-foreground">
                {searchQuery || selectedClass !== 'all' || selectedSalle !== 'all'
                  ? "Modifiez vos critères de recherche."
                  : "Commencez par inscrire le premier élève pour cette année."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[44px] pl-6">
                    <Checkbox
                      aria-label="Tout sélectionner sur la page"
                      checked={paginated.length > 0 && paginated.every(s => selectedIds.has(s.studentId))}
                      onCheckedChange={(v) => {
                        setSelectedIds(prev => {
                          const next = new Set(prev)
                          if (v === true) paginated.forEach(s => next.add(s.studentId))
                          else paginated.forEach(s => next.delete(s.studentId))
                          return next
                        })
                      }}
                    />
                  </TableHead>
                  <TableHead className="w-[60px] font-semibold">Élève</TableHead>
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
                  <TableHead className="font-semibold">Salle</TableHead>
                  <TableHead className="font-semibold">Statut</TableHead>
                  <TableHead
                    className="cursor-pointer select-none font-semibold"
                    onClick={() => handleSort('date')}
                  >
                    Inscrit le <SortIcon col="date" />
                  </TableHead>
                  <TableHead className="pr-6 text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map(student => {
                  const nisuInvalid = !!student.nisu && !isNisuValid(student.nisu)
                  const isActive = student.status === 'ACTIVE'
                  const isDropped = student.status === 'DROPPED'
                  const isCurrentYear = !!year && student.yearId === year.id
                  const avatarSrc = normalizeUploadUrl(student.promotionPhotoUrl ?? student.profilePhoto)

                  return (
                    <TableRow
                      key={student.studentId}
                      data-state={selectedIds.has(student.studentId) ? "selected" : undefined}
                      className={cn((!isActive && student.status) && "opacity-60")}
                    >
                      <TableCell className="pl-6">
                        <Checkbox
                          aria-label={`Sélectionner ${student.firstname} ${student.lastname}`}
                          checked={selectedIds.has(student.studentId)}
                          onCheckedChange={() => toggleSelected(student.studentId)}
                        />
                      </TableCell>
                      <TableCell>
                        <Avatar
                          className={cn(
                            "h-9 w-9",
                            student.promotionPhotoUrl &&
                              "ring-2 ring-emerald-200 ring-offset-1 ring-offset-background"
                          )}
                          title={student.promotionPhotoUrl ? "Photo de promotion" : undefined}
                        >
                          <AvatarImage src={avatarSrc ?? undefined} />
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
                      <TableCell>
                        <div className="flex flex-col">
                          <span className={cn(student.classTypeName ? "text-foreground" : "text-muted-foreground italic")}>
                            {student.classTypeName ?? "Aucune classe"}
                          </span>
                          {student.yearString && (
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                              {student.yearString}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {student.salleLabel ? (
                          <span className="inline-flex items-center justify-center rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
                            {student.salleLabel}
                          </span>
                        ) : (
                          <span className="text-xs italic text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={student.status} />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {student.registrationDate
                            ? new Date(student.registrationDate).toLocaleDateString('fr-FR')
                            : '—'}
                        </span>
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontalIcon className="h-4 w-4" />
                              <span className="sr-only">Ouvrir le menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/all-students/${student.studentId}/transcript`}>
                                <FileTextIcon className="mr-2 h-4 w-4" />
                                Voir le relevé de notes
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {year && (
                              <DropdownMenuItem onClick={() => setPhotoTarget(student)}>
                                <CameraIcon className="mr-2 h-4 w-4" />
                                {student.promotionPhotoUrl ? "Modifier la photo" : "Ajouter une photo"}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setEditingStudent(student)}>
                              <PencilIcon className="mr-2 h-4 w-4" />
                              Modifier le profil
                            </DropdownMenuItem>
                            {isActive && isCurrentYear && !isArchived && (
                              <>
                                <DropdownMenuItem onClick={() => setTransferringStudent(student)}>
                                  <ArrowRightLeftIcon className="mr-2 h-4 w-4" />
                                  Transférer de classe
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => { if (student.enrollmentId) { setDeactivatingId(student.enrollmentId); setDeactivationReason('') } }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <UserRoundXIcon className="mr-2 h-4 w-4" />
                                  Désactiver
                                </DropdownMenuItem>
                              </>
                            )}
                            {isDropped && isCurrentYear && !isArchived && (
                              <DropdownMenuItem
                                onClick={() => student.enrollmentId && handleReactivate(student.enrollmentId)}
                                className="text-emerald-600 focus:text-emerald-600"
                              >
                                <UserRoundCheckIcon className="mr-2 h-4 w-4" />
                                Réactiver
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => { setSelectedIds(new Set([student.studentId])); openDeleteDialog() }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2Icon className="mr-2 h-4 w-4" />
                              Supprimer définitivement
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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

      {/* Modal suppression définitive (confirmation par mot de passe admin) */}
      <Dialog open={deleteOpen} onOpenChange={(o) => { if (!o) { setDeleteOpen(false); setDeletePassword(""); setDeleteError(null) } }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-destructive">Supprimer définitivement</DialogTitle>
            <DialogDescription>
              Cette action est <strong>irréversible</strong>. Elle supprime le compte, le profil élève,
              toutes ses inscriptions, notes et bulletins archivés.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
              {selectedIds.size} élève(s) seront supprimé(s) :
              <ul className="mt-1 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs">
                {students.filter(s => selectedIds.has(s.studentId)).slice(0, 50).map(s => (
                  <li key={s.studentId}>{s.lastname} {s.firstname}{s.nisu ? ` — ${s.nisu}` : ""}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="delete-password" className="flex items-center gap-1.5 text-sm font-medium">
                <KeyRoundIcon className="h-3.5 w-3.5" />
                Confirmez avec votre mot de passe
              </Label>
              <Input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(null) }}
                onKeyDown={(e) => { if (e.key === "Enter" && deletePassword && !deleting) handleDelete() }}
                placeholder="Votre mot de passe administrateur"
              />
              {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || !deletePassword || selectedIds.size === 0}
            >
              {deleting ? "Suppression..." : `Supprimer ${selectedIds.size} élève(s)`}
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
          currentClassName={transferringStudent.className ?? ""}
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

      {/* Modal photo de promotion */}
      {year && photoTarget && (
        <PromotionPhotoModal
          open={!!photoTarget}
          onOpenChange={(o) => !o && setPhotoTarget(null)}
          studentId={photoTarget.studentId}
          userId={photoTarget.userId}
          studentName={`${photoTarget.firstname} ${photoTarget.lastname}`.trim()}
          studentCode={photoTarget.studentCode}
          academicYearId={year.id}
          academicYearName={year.name}
          currentPhotoUrl={photoTarget.promotionPhotoUrl ?? null}
          onUploaded={(url) => {
            setStudents((prev) =>
              prev.map((s) =>
                s.studentId === photoTarget.studentId
                  ? { ...s, promotionPhotoUrl: url, profilePhoto: url }
                  : s
              )
            )
          }}
        />
      )}
    </div>
  )
}