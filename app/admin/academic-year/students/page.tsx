"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  PlusIcon, SearchIcon, UserIcon,
  ArrowUpIcon, ArrowDownIcon, LoaderIcon, AlertTriangleIcon
} from "lucide-react"
import {
  fetchStudentsByYear,
  fetchAllStudentsByYear,
  fetchClassSessionsForYear,
  dropEnrollment,
  reactivateEnrollment,
  type StudentRow,
} from "@/lib/api/students"
import { cn } from "@/lib/utils"
import { StudentEnrollForm } from "@/components/school/students/student-enroll-form"
import { fetchActiveAcademicYear } from "@/lib/api/dashboard"

// ── Palette CPMSL ─────────────────────────────────────────────────────────────
const C = {
  primary800: "#2A3740", primary700: "#3A4A57", primary600: "#4A5D6E",
  primary500: "#5A7085", primary100: "#D9E3EA", primary50: "#F0F4F7",
  neutral900: "#1E1A17", neutral600: "#5C5955", neutral500: "#78756F",
  neutral400: "#A8A5A2", neutral200: "#E8E6E3", neutral100: "#F5F4F2",
  neutral50: "#FAFAF8", success: "#2D7D46", successBg: "#E8F5EC",
  warning: "#C48B1A", warningBg: "#FEF6E0", error: "#C43C3C", errorBg: "#FDE8E8",
}

type SortCol = "fullName" | "className" | "studentCode"
type SortDir = "asc" | "desc" | null

export default function StudentsManagementPage() {
  const params = useParams()
  //const yearId = params.yearId as string

  const [yearId, setYearId] = useState<string | null>(null)
  const { toast } = useToast()

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState<string | null>(null)
  const [activeStudents, setActiveStudents] = useState<StudentRow[]>([])
  const [allStudents, setAllStudents]     = useState<StudentRow[]>([])
  const [classSessions, setClassSessions] = useState<{ id: string; name: string }[]>([])

  const [searchQuery, setSearchQuery]     = useState("")
  const [selectedClass, setSelectedClass] = useState("all")
  const [showInactive, setShowInactive]   = useState(false)
  const [currentPage, setCurrentPage]     = useState(1)
  const ITEMS = 25

  const [sortCol, setSortCol] = useState<SortCol | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [deactivating, setDeactivating]   = useState<StudentRow | null>(null)
  const [enrollOpen, setEnrollOpen]       = useState(false)

  // ── Load ───────────────────────────────────────────────────────────────────
  async function loadData() {
    setLoading(true); setError(null)
     const activeYear = await fetchActiveAcademicYear()
    

     if (activeYear) {
       
      setYearId(activeYear.id)
     }

     const ay =  activeYear?.id as string
     
    try {
      const [active, all, sessions] = await Promise.all([
        fetchStudentsByYear(ay!),
        fetchAllStudentsByYear(ay!),
        fetchClassSessionsForYear(ay!),
      ])
      setActiveStudents(active)
      setAllStudents(all)
      setClassSessions(sessions)
    } catch {
      setError("Impossible de charger les élèves.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])
  useEffect(() => setCurrentPage(1), [searchQuery, selectedClass, showInactive])

  // ── Derived ────────────────────────────────────────────────────────────────
  const displayed = showInactive ? allStudents : activeStudents
  const totalActive   = activeStudents.length
  const inactiveCount = allStudents.filter(s => s.enrollmentStatus !== "ACTIVE").length
  const noPhotoCount  = activeStudents.filter(s => !s.avatar).length

  const filtered = useMemo(() => {
    let r = displayed
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      r = r.filter(s =>
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        s.studentCode.toLowerCase().includes(q)
      )
    }
    if (selectedClass !== "all") r = r.filter(s => s.classSessionId === selectedClass)
    if (sortCol && sortDir) {
      r = [...r].sort((a, b) => {
        const cmp = String(a[sortCol] ?? "").localeCompare(String(b[sortCol] ?? ""))
        return sortDir === "asc" ? cmp : -cmp
      })
    }
    return r
  }, [displayed, searchQuery, selectedClass, sortCol, sortDir])

  const totalPages = Math.ceil(filtered.length / ITEMS)
  const paginated  = filtered.slice((currentPage - 1) * ITEMS, currentPage * ITEMS)

  // ── Sort ───────────────────────────────────────────────────────────────────
  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      if (sortDir === "asc") setSortDir("desc")
      else { setSortCol(null); setSortDir(null) }
    } else { setSortCol(col); setSortDir("asc") }
  }

  const SortIcon = ({ col }: { col: SortCol }) =>
    sortCol !== col ? null : sortDir === "asc"
      ? <ArrowUpIcon style={{ width: 14, height: 14, color: C.primary500 }} />
      : <ArrowDownIcon style={{ width: 14, height: 14, color: C.primary500 }} />

  // ── Actions ────────────────────────────────────────────────────────────────
  const confirmDeactivate = async () => {
    if (!deactivating) return
    try {
      await dropEnrollment(deactivating.enrollmentId)
      toast({ title: "Élève désactivé", description: `${deactivating.fullName} a été désactivé.` })
      setDeactivating(null)
      await loadData()
    } catch {
      toast({ title: "Erreur", description: "Impossible de désactiver.", variant: "destructive" })
    }
  }

  const handleReactivate = async (s: StudentRow) => {
    try {
      await reactivateEnrollment(s.enrollmentId)
      toast({ title: "Élève réactivé", description: `${s.fullName} a été réactivé.` })
      await loadData()
    } catch {
      toast({ title: "Erreur", description: "Impossible de réactiver.", variant: "destructive" })
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="space-y-6">
      <h1 className="font-serif" style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em", color: C.primary800 }}>Élèves</h1>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <div style={{ textAlign: "center" }}>
          <LoaderIcon className="h-8 w-8" style={{ color: C.primary500, animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
          <p className="font-sans" style={{ fontSize: 14, color: C.neutral500 }}>Chargement des élèves...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) return (
    <div className="space-y-6">
      <h1 className="font-serif" style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em", color: C.primary800 }}>Élèves</h1>
      <Card style={{ backgroundColor: "white", border: `1px solid ${C.neutral200}`, borderRadius: 10 }}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertTriangleIcon className="h-10 w-10 mb-4" style={{ color: C.error }} />
          <p className="font-sans mb-6" style={{ fontSize: 14, color: C.error }}>{error}</p>
          <Button onClick={loadData} style={{ backgroundColor: C.primary500, color: "white" }}>Réessayer</Button>
        </CardContent>
      </Card>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      <h1 className="font-serif" style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.03em", color: C.primary800 }}>
        Élèves
      </h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total élèves", value: totalActive },
          { label: "Sans photo",   value: noPhotoCount },
          { label: "Désactivés",   value: inactiveCount },
          { label: "Classes",      value: classSessions.length },
        ].map(kpi => (
          <Card key={kpi.label} style={{ backgroundColor: "white", border: `1px solid ${C.neutral200}`, borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <CardHeader className="pb-3">
              <p className="font-sans" style={{ fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: C.neutral500, marginBottom: 4 }}>{kpi.label}</p>
              <p className="font-serif" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.025em", color: C.primary800 }}>{kpi.value}</p>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
          <Label htmlFor="show-inactive" className="font-sans" style={{ fontSize: 14, color: C.neutral600, cursor: "pointer" }}>
            Afficher les élèves désactivés ({inactiveCount})
          </Label>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: C.neutral400 }} />
            <Input placeholder="Rechercher par nom ou code..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" style={{ borderColor: C.neutral200, backgroundColor: "white" }} />
          </div>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-full sm:w-[220px]" style={{ borderColor: C.neutral200 }}>
              <SelectValue placeholder="Toutes les classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les classes</SelectItem>
              {classSessions.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => setEnrollOpen(true)} style={{ backgroundColor: C.primary500, color: "white" }}>
            <PlusIcon className="mr-2 h-4 w-4" /> Inscrire un élève
          </Button>
          <StudentEnrollForm
            open={enrollOpen}
            onOpenChange={setEnrollOpen}
            academicYearId={yearId || ""}
            onSuccess={() => { setEnrollOpen(false); loadData() }}
          />
        </div>
      </div>

      {/* Table / Empty */}
      {filtered.length === 0 ? (
        <Card style={{ backgroundColor: "white", border: `1px solid ${C.neutral200}`, borderRadius: 10 }}>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div style={{ width: 64, height: 64, borderRadius: "50%", backgroundColor: C.primary50, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <UserIcon style={{ width: 32, height: 32, color: C.primary100 }} />
            </div>
            <h3 className="font-serif" style={{ fontSize: 20, fontWeight: 600, color: C.primary700, marginBottom: 8 }}>
              {searchQuery || selectedClass !== "all" ? "Aucun élève trouvé" : "Aucun élève inscrit"}
            </h3>
            <p className="font-sans" style={{ fontSize: 14, color: C.neutral500, textAlign: "center" }}>
              {searchQuery || selectedClass !== "all" ? "Modifiez vos critères de recherche" : "Commencez par inscrire le premier élève"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card style={{ backgroundColor: "white", border: `1px solid ${C.neutral200}`, borderRadius: 10 }}>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: C.primary50, borderBottom: `1px solid ${C.neutral200}` }}>
                    <TableHead style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: C.primary600, width: 56 }}>Photo</TableHead>
                    <TableHead>
                      <button onClick={() => handleSort("studentCode")} className="flex items-center gap-1 font-sans" style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: C.primary600 }}>
                        Code <SortIcon col="studentCode" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button onClick={() => handleSort("fullName")} className="flex items-center gap-1 font-sans" style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: C.primary600 }}>
                        Nom complet <SortIcon col="fullName" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button onClick={() => handleSort("className")} className="flex items-center gap-1 font-sans" style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: C.primary600 }}>
                        Classe <SortIcon col="className" />
                      </button>
                    </TableHead>
                    <TableHead style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: C.primary600 }}>Contact</TableHead>
                    <TableHead style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: C.primary600 }}>Statut</TableHead>
                    <TableHead className="text-center" style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: C.primary600 }}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map(student => {
                    const inactive = student.enrollmentStatus !== "ACTIVE"
                    return (
                      <TableRow
                        key={student.enrollmentId}
                        className={cn(inactive && "opacity-60")}
                        style={{ borderBottom: `1px solid ${C.neutral200}`, backgroundColor: "white" }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = C.neutral50 }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = "white" }}
                      >
                        <TableCell>
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={student.avatar ?? undefined} />
                            <AvatarFallback style={{ backgroundColor: C.neutral200, fontSize: 12, color: C.neutral500 }}>
                              {student.firstName[0]}{student.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono" style={{ fontSize: 12, color: C.neutral600 }}>{student.studentCode}</span>
                        </TableCell>
                        <TableCell>
                          <p className="font-sans" style={{ fontSize: 14, fontWeight: 600, color: C.neutral900 }}>{student.lastName}</p>
                          <p className="font-sans" style={{ fontSize: 13, color: C.neutral500 }}>{student.firstName}</p>
                        </TableCell>
                        <TableCell className="font-sans" style={{ fontSize: 14, color: C.neutral600 }}>{student.className}</TableCell>
                        <TableCell>
                          {student.phone1 && <p className="font-sans" style={{ fontSize: 13, color: C.neutral600 }}>{student.phone1}</p>}
                          {student.fatherName && <p className="font-sans" style={{ fontSize: 12, color: C.neutral400 }}>Père: {student.fatherName}</p>}
                        </TableCell>
                        <TableCell>
                          {!inactive
                            ? <Badge style={{ backgroundColor: C.successBg, color: C.success, border: "none" }}>Actif</Badge>
                            : <Badge style={{ backgroundColor: C.neutral100, color: C.neutral500, border: "none" }}>
                                {student.enrollmentStatus === "DROPPED" ? "Désactivé" : student.enrollmentStatus}
                              </Badge>
                          }
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-3">
                            <button className="font-sans" style={{ fontSize: 13, fontWeight: 500, color: C.neutral600, background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}>
                              Modifier
                            </button>
                            {!inactive
                              ? <button onClick={() => setDeactivating(student)} className="font-sans" style={{ fontSize: 13, fontWeight: 500, color: "#B91C1C", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}>Désactiver</button>
                              : <button onClick={() => handleReactivate(student)} className="font-sans" style={{ fontSize: 13, fontWeight: 500, color: C.success, background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}>Réactiver</button>
                            }
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={{ borderColor: C.neutral200, color: C.neutral600 }}>← Précédent</Button>
              <span className="font-sans" style={{ fontSize: 14, color: C.neutral500 }}>Page {currentPage} sur {totalPages}</span>
              <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} style={{ borderColor: C.neutral200, color: C.neutral600 }}>Suivant →</Button>
            </div>
          )}
        </div>
      )}

      {/* Modal désactivation */}
      <Dialog open={!!deactivating} onOpenChange={open => !open && setDeactivating(null)}>
        <DialogContent style={{ backgroundColor: "white", borderRadius: 12 }}>
          <DialogHeader>
            <DialogTitle className="font-serif" style={{ fontSize: 24, fontWeight: 700, color: C.primary800 }}>Désactiver cet élève</DialogTitle>
          </DialogHeader>
          <div className="font-sans" style={{ fontSize: 13, backgroundColor: C.warningBg, border: "1px solid #F59E0B", borderRadius: 8, padding: "12px 16px", color: "#92400E" }}>
            L'élève sera retiré des listes actives. Cette action est réversible.
          </div>
          {deactivating && (
            <div className="py-2">
              <span className="font-sans" style={{ fontSize: 14, color: C.neutral500 }}>Élève : </span>
              <span className="font-sans" style={{ fontSize: 15, fontWeight: 600, color: C.primary800 }}>{deactivating.fullName}</span>
              <span className="font-sans ml-2" style={{ fontSize: 13, color: C.neutral400 }}>— {deactivating.className}</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivating(null)} style={{ borderColor: C.neutral200, color: C.neutral600 }}>Annuler</Button>
            <Button onClick={confirmDeactivate} style={{ backgroundColor: "#B91C1C", color: "white" }}>Confirmer la désactivation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}