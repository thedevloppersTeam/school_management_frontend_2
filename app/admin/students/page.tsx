"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
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
  SearchIcon,
  UserIcon,
  UsersIcon,
  ExternalLinkIcon,
  GraduationCapIcon,
  MoreHorizontalIcon,
  CameraIcon,
  PencilIcon,
  ArrowRightLeftIcon,
  UserRoundXIcon,
  FileTextIcon,
} from "lucide-react"
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
import { clientFetch as apiFetch } from "@/lib/client-fetch"
import { fetchActiveAcademicYear, fetchClassSessions, type AcademicYear, type ClassSession } from "@/lib/api/dashboard"
import { PromoteStudentsModal } from "@/components/school/promote-students-modal"
import { PromotionPhotoModal } from "@/components/school/promotion-photo-modal"
import { EditStudentModal } from "@/components/school/edit-student-modal"
import { TransferEnrollmentModal } from "@/components/school/transfer-enrollment-modal"
import { toMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"

interface StudentRow {
  enrollmentId: string
  studentId: string
  studentCode: string
  nisu: string
  firstname: string
  lastname: string
  profilePhoto?: string
  promotionPhotoUrl?: string | null
  classSessionId: string
  className: string           // combined (e.g. "2ème AF A") — kept for filtering
  classTypeName: string       // e.g. "2ème AF"
  salleLabel: string          // e.g. "A" or track code "LLA"
  status: "ACTIVE" | "TRANSFERRED" | "DROPPED" | "GRADUATED"
  address?: string
  motherName?: string
  fatherName?: string
  phone1?: string
  phone2?: string
  parentsEmail?: string
}

function StatusBadge({ status }: { status: StudentRow["status"] }) {
  switch (status) {
    case "ACTIVE":
      return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Actif</Badge>
    case "DROPPED":
      return <Badge variant="secondary">Désactivé</Badge>
    case "TRANSFERRED":
      return <Badge className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">Transféré</Badge>
    case "GRADUATED":
      return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Diplômé</Badge>
  }
}

export default function CurrentYearStudentsPage() {
  const { toast } = useToast()

  const [year, setYear] = useState<AcademicYear | null>(null)
  const [yearSessions, setYearSessions] = useState<ClassSession[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [promoteOpen, setPromoteOpen] = useState(false)

  // Row actions
  const [photoTarget, setPhotoTarget] = useState<StudentRow | null>(null)
  const [editTarget, setEditTarget] = useState<StudentRow | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [transferTarget, setTransferTarget] = useState<StudentRow | null>(null)
  const [transferSubmitting, setTransferSubmitting] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<StudentRow | null>(null)
  const [deactivateReason, setDeactivateReason] = useState("")
  const [deactivating, setDeactivating] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedClass, setSelectedClass] = useState("all")        // classe (classType name)
  const [selectedSalle, setSelectedSalle] = useState("all")        // salle (letter or track code)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const PAGE_SIZE_OPTIONS = [15, 25, 50, 100]

  const loadStudents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const current = await fetchActiveAcademicYear()
      if (!current) {
        setError("Aucune année scolaire courante n'est définie.")
        setYear(null)
        setStudents([])
        return
      }
      setYear(current)

      const sessions = await fetchClassSessions(current.id)
      setYearSessions(sessions)

      const allEnrollments: StudentRow[] = []
      await Promise.all(
        sessions.map(async (session: ClassSession) => {
          try {
            const enrollments = await apiFetch<
              Array<{
                id: string
                studentId: string
                classSessionId: string
                status: StudentRow["status"]
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
              }>
            >(`/api/enrollments?classSessionId=${session.id}`)

            const classTypeName = session.class.classType.name
            // For tracked classes (NS3/NS4) the track code is the "salle"; otherwise the letter.
            const salleLabel = session.class.track?.code ?? session.class.letter
            const className = `${classTypeName} ${salleLabel}`

            enrollments.forEach((enr) => {
              allEnrollments.push({
                enrollmentId: enr.id,
                studentId: enr.studentId,
                studentCode: enr.student?.studentCode || "—",
                nisu: enr.student?.nisu || "",
                firstname: enr.student?.user?.firstname || "",
                lastname: enr.student?.user?.lastname || "",
                profilePhoto: enr.student?.user?.profilePhoto,
                classSessionId: session.id,
                className,
                classTypeName,
                salleLabel,
                status: enr.status,
                address: enr.student?.address || "",
                motherName: enr.student?.motherName || "",
                fatherName: enr.student?.fatherName || "",
                phone1: enr.student?.phone1 || "",
                phone2: enr.student?.phone2 || "",
                parentsEmail: enr.student?.parentsEmail || "",
              })
            })
          } catch {
            // skip session
          }
        })
      )

      // Fetch promotion photos for this academic year and merge in.
      try {
        const photos = await apiFetch<Array<{ studentId: string; photoUrl: string }>>(
          `/api/promotion-photos?academicYearId=${current.id}`
        )
        const photoByStudent = new Map(photos.map(p => [p.studentId, p.photoUrl]))
        allEnrollments.forEach(r => {
          r.promotionPhotoUrl = photoByStudent.get(r.studentId) ?? null
        })
      } catch {
        // photos are best-effort; failing here shouldn't block the list
      }

      setStudents(allEnrollments)
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les élèves", variant: "destructive" })
      setError("Erreur lors du chargement")
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadStudents()
  }, [loadStudents])

  // ── Row actions ───────────────────────────────────────────────────────────
  function handlePhotoUploaded(studentId: string, newUrl: string) {
    setStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, promotionPhotoUrl: newUrl } : s))
    )
  }

  async function handleEditSubmit(data: {
    address: string
    motherName: string
    fatherName: string
    phone1: string
    phone2: string
    parentsEmail: string
  }) {
    if (!editTarget) return
    setEditSubmitting(true)
    try {
      await apiFetch(`/api/students/update/${editTarget.studentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      toast({ title: "Profil mis à jour" })
      setEditTarget(null)
      loadStudents()
    } catch (err) {
      toast({
        title: "Erreur",
        description: toMessage(err, "lors de la mise à jour du profil"),
        variant: "destructive",
      })
    } finally {
      setEditSubmitting(false)
    }
  }

  async function handleTransferSubmit(data: { newClassSessionId: string; notes?: string }) {
    if (!transferTarget) return
    setTransferSubmitting(true)
    try {
      await apiFetch(`/api/enrollments/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId: transferTarget.enrollmentId,
          newClassSessionId: data.newClassSessionId,
          notes: data.notes,
        }),
      })
      toast({ title: "Élève transféré" })
      setTransferTarget(null)
      loadStudents()
    } catch (err) {
      toast({
        title: "Erreur",
        description: toMessage(err, "lors du transfert"),
        variant: "destructive",
      })
    } finally {
      setTransferSubmitting(false)
    }
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return
    setDeactivating(true)
    try {
      await apiFetch(`/api/enrollments/status-update/${deactivateTarget.enrollmentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DROPPED", notes: deactivateReason || undefined }),
      })
      toast({ title: "Élève désactivé" })
      setDeactivateTarget(null)
      setDeactivateReason("")
      loadStudents()
    } catch (err) {
      toast({
        title: "Erreur",
        description: toMessage(err, "lors de la désactivation"),
        variant: "destructive",
      })
    } finally {
      setDeactivating(false)
    }
  }

  const activeStudents = students.filter((s) => s.status === "ACTIVE")

  const displayed = useMemo(() => {
    let result = activeStudents
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (s) =>
          s.firstname.toLowerCase().includes(q) ||
          s.lastname.toLowerCase().includes(q) ||
          s.nisu.toLowerCase().includes(q) ||
          s.studentCode.toLowerCase().includes(q)
      )
    }
    if (selectedClass !== "all") {
      result = result.filter((s) => s.classTypeName === selectedClass)
    }
    if (selectedSalle !== "all") {
      result = result.filter((s) => s.salleLabel === selectedSalle)
    }
    return [...result].sort((a, b) =>
      `${a.lastname} ${a.firstname}`.localeCompare(`${b.lastname} ${b.firstname}`)
    )
  }, [activeStudents, searchQuery, selectedClass, selectedSalle])

  const totalPages = Math.max(1, Math.ceil(displayed.length / itemsPerPage))
  const paginated = displayed.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const classTypeOptions = useMemo(
    () => [...new Set(students.map((s) => s.classTypeName).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [students]
  )
  const salleOptions = useMemo(() => {
    const filtered = selectedClass === "all"
      ? students
      : students.filter((s) => s.classTypeName === selectedClass)
    return [...new Set(filtered.map((s) => s.salleLabel).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  }, [students, selectedClass])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedClass, selectedSalle, itemsPerPage])

  const paginationWindow = (() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1)
    if (currentPage <= 3) return [1, 2, 3, 4, "ellipsis-right", totalPages]
    if (currentPage >= totalPages - 2) {
      return [1, "ellipsis-left", totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    }
    return [1, "ellipsis-left", currentPage - 1, currentPage, currentPage + 1, "ellipsis-right", totalPages]
  })()

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-5 w-96" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Élèves inscrits</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Liste de tous les élèves inscrits dans l&apos;année scolaire courante</span>
          {year && (
            <>
              <span>&middot;</span>
              <Badge variant="secondary" className="align-middle">
                {year.name}
              </Badge>
            </>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-center gap-3 py-8">
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={loadStudents} size="sm" variant="outline">
              Réessayer
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && (
        <Card className="border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Inscriptions actives</CardTitle>
                <CardDescription>
                  {displayed.length} élève{displayed.length > 1 ? "s" : ""}
                  {selectedClass !== "all" && ` — ${selectedClass}`}
                  {selectedSalle !== "all" && ` ${selectedSalle}`}
                  {searchQuery && ` — recherche : "${searchQuery}"`}
                </CardDescription>
              </div>
              {year && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => setPromoteOpen(true)}
                    className="bg-[#2C4A6E] text-white hover:bg-[#1F3856]"
                  >
                    <GraduationCapIcon className="mr-2 h-4 w-4" />
                    Promouvoir des élèves
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/admin/all-students">
                      <ExternalLinkIcon className="mr-2 h-4 w-4" />
                      Gestion complète
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>

          <Separator />

          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, NISU ou code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={selectedClass}
              onValueChange={(v) => {
                setSelectedClass(v)
                setSelectedSalle("all")
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Toutes les classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les classes</SelectItem>
                {classTypeOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedSalle} onValueChange={setSelectedSalle}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Toutes les salles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les salles</SelectItem>
                {salleOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <CardContent className="p-0">
            {displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <UsersIcon className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">
                  {searchQuery || selectedClass !== "all" || selectedSalle !== "all"
                    ? "Aucun élève trouvé"
                    : "Aucun élève inscrit"}
                </h3>
                <p className="mt-1 max-w-[320px] text-center text-sm text-muted-foreground">
                  {searchQuery || selectedClass !== "all" || selectedSalle !== "all"
                    ? "Modifiez vos critères de recherche."
                    : "Aucun élève n'est inscrit dans cette année scolaire."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[60px] pl-6 font-semibold">Élève</TableHead>
                    <TableHead className="hidden font-semibold md:table-cell">Code</TableHead>
                    <TableHead className="font-semibold">NISU</TableHead>
                    <TableHead className="font-semibold">Nom complet</TableHead>
                    <TableHead className="font-semibold">Classe</TableHead>
                    <TableHead className="font-semibold">Salle</TableHead>
                    <TableHead className="font-semibold">Statut</TableHead>
                    <TableHead className="pr-6 text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((student) => {
                    const avatarSrc = student.promotionPhotoUrl ?? student.profilePhoto
                    return (
                      <TableRow key={student.enrollmentId}>
                        <TableCell className="pl-6">
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
                        <TableCell className="tabular-nums text-foreground">
                          {student.nisu || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">{student.lastname}</span>
                            <span className="text-xs text-muted-foreground">{student.firstname}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-foreground">{student.classTypeName}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center justify-center rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
                            {student.salleLabel}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={student.status} />
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
                                <Link href={`/admin/students/${student.studentId}/transcript`}>
                                  <FileTextIcon className="mr-2 h-4 w-4" />
                                  Voir le relevé de notes
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setPhotoTarget(student)}>
                                <CameraIcon className="mr-2 h-4 w-4" />
                                {student.promotionPhotoUrl ? "Modifier la photo" : "Ajouter une photo"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditTarget(student)}>
                                <PencilIcon className="mr-2 h-4 w-4" />
                                Modifier le profil
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setTransferTarget(student)}>
                                <ArrowRightLeftIcon className="mr-2 h-4 w-4" />
                                Transférer de classe
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setDeactivateReason("")
                                  setDeactivateTarget(student)
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                <UserRoundXIcon className="mr-2 h-4 w-4" />
                                Désactiver
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

          {displayed.length > 15 && (
            <>
              <Separator />
              <div className="flex flex-col items-center justify-between gap-3 px-4 py-3 sm:flex-row">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Afficher</span>
                    <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
                      <SelectTrigger className="h-8 w-[72px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <SelectItem key={size} value={String(size)}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Page <span className="font-medium text-foreground tabular-nums">{currentPage}</span> sur{" "}
                    <span className="font-medium text-foreground tabular-nums">{totalPages}</span> &middot;{" "}
                    {displayed.length} résultat(s)
                  </p>
                </div>

                {totalPages > 1 && (
                  <Pagination className="mx-0 w-auto justify-end">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            if (currentPage > 1) setCurrentPage((p) => p - 1)
                          }}
                          className={cn(currentPage === 1 && "pointer-events-none opacity-50")}
                        />
                      </PaginationItem>
                      {paginationWindow.map((p, idx) => {
                        if (typeof p === "string") {
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
                              onClick={(e) => {
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
                          onClick={(e) => {
                            e.preventDefault()
                            if (currentPage < totalPages) setCurrentPage((p) => p + 1)
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
      )}

      {year && (
        <PromoteStudentsModal
          open={promoteOpen}
          onOpenChange={setPromoteOpen}
          currentYear={year}
          currentYearSessions={yearSessions}
          onSuccess={loadStudents}
        />
      )}

      {year && photoTarget && (
        <PromotionPhotoModal
          open={!!photoTarget}
          onOpenChange={(o) => !o && setPhotoTarget(null)}
          studentId={photoTarget.studentId}
          studentName={`${photoTarget.firstname} ${photoTarget.lastname}`.trim()}
          studentCode={photoTarget.studentCode}
          academicYearId={year.id}
          academicYearName={year.name}
          currentPhotoUrl={photoTarget.promotionPhotoUrl ?? null}
          onUploaded={(url) => handlePhotoUploaded(photoTarget.studentId, url)}
        />
      )}

      {editTarget && (
        <EditStudentModal
          open={!!editTarget}
          onOpenChange={(o) => !o && setEditTarget(null)}
          studentName={`${editTarget.firstname} ${editTarget.lastname}`.trim()}
          studentCode={editTarget.studentCode}
          initialData={{
            address: editTarget.address,
            motherName: editTarget.motherName,
            fatherName: editTarget.fatherName,
            phone1: editTarget.phone1,
            phone2: editTarget.phone2,
            parentsEmail: editTarget.parentsEmail,
          }}
          submitting={editSubmitting}
          onSubmit={handleEditSubmit}
        />
      )}

      {transferTarget && (
        <TransferEnrollmentModal
          open={!!transferTarget}
          onOpenChange={(o) => !o && setTransferTarget(null)}
          studentName={`${transferTarget.firstname} ${transferTarget.lastname}`.trim()}
          currentClassName={transferTarget.className}
          sessions={yearSessions
            .filter((s) => s.id !== transferTarget.classSessionId)
            .map((s) => {
              const trackSuffix = s.class.track ? ` — ${s.class.track.code}` : ""
              return {
                id: s.id,
                label: `${s.class.classType.name} ${s.class.letter}${trackSuffix}`,
              }
            })}
          submitting={transferSubmitting}
          onSubmit={handleTransferSubmit}
        />
      )}

      <Dialog
        open={!!deactivateTarget}
        onOpenChange={(o) => {
          if (!o) {
            setDeactivateTarget(null)
            setDeactivateReason("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Désactiver cet élève</DialogTitle>
            <DialogDescription>
              L&apos;inscription sera marquée comme désactivée. L&apos;élève ne sera plus visible dans les listes actives — l&apos;action est réversible depuis la gestion complète.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="deactivation-reason" className="text-sm font-medium">
              Raison (optionnelle)
            </Label>
            <Input
              id="deactivation-reason"
              placeholder="Ex: Déménagement, transfert externe..."
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateTarget(null)} disabled={deactivating}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDeactivate} disabled={deactivating}>
              {deactivating ? "En cours..." : "Confirmer la désactivation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
