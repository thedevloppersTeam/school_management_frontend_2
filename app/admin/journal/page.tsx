"use client"

// Journal d'audit élève — chronologie des mouvements, du plus récent au plus
// ancien. LECTURE SEULE SANS EXCEPTION : le journal est en ajout seul, aucune
// action d'édition ni de suppression n'est proposée ici, et le backend n'expose
// aucune adresse d'écriture.

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination"
import { HistoryIcon, LockIcon } from "lucide-react"
import { StudentAuditTimeline } from "@/components/school/student-audit-timeline"
import {
  AUDIT_ACTION_LABELS,
  fetchStudentAuditLogs,
  type StudentAuditAction,
} from "@/lib/api/enrollment-corrections"
import {
  fetchAllAcademicYears,
  type AcademicYear,
} from "@/lib/api/dashboard"

const ALL = "__all__"
const PAGE_SIZE = 50

interface StudentOption {
  id:        string
  label:     string
}

export default function JournalPage() {
  const [years, setYears] = useState<AcademicYear[]>([])
  const [students, setStudents] = useState<StudentOption[]>([])

  const [filterYear, setFilterYear] = useState(ALL)
  const [filterStudent, setFilterStudent] = useState(ALL)
  const [filterAction, setFilterAction] = useState(ALL)
  const [page, setPage] = useState(1)

  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // ── Référentiels des filtres ─────────────────────────────────────────────
  useEffect(() => {
    fetchAllAcademicYears()
      .then((list) => setYears(Array.isArray(list) ? list : []))
      .catch(() => setYears([]))
  }, [])

  // La liste des élèves du filtre est dérivée du journal lui-même : seuls les
  // élèves qui ont au moins un mouvement ont un sens ici, et cela évite de
  // charger tout l'annuaire.
  useEffect(() => {
    fetchStudentAuditLogs({ pageSize: 200 })
      .then((data) => {
        const byId = new Map<string, StudentOption>()
        for (const log of data.logs ?? []) {
          byId.set(log.studentId, {
            id: log.studentId,
            label: `${log.student.user.lastname} ${log.student.user.firstname}`,
          })
        }
        setStudents(
          [...byId.values()].sort((a, b) => a.label.localeCompare(b.label, "fr")),
        )
      })
      .catch(() => setStudents([]))
  }, [])

  // ── Compteurs de pagination ──────────────────────────────────────────────
  const query = useMemo(
    () => ({
      academicYearId: filterYear === ALL ? undefined : filterYear,
      studentId: filterStudent === ALL ? undefined : filterStudent,
      action:
        filterAction === ALL ? undefined : (filterAction as StudentAuditAction),
      page,
      pageSize: PAGE_SIZE,
    }),
    [filterYear, filterStudent, filterAction, page],
  )

  useEffect(() => {
    fetchStudentAuditLogs(query)
      .then((data) => {
        setTotal(data.total ?? 0)
        setTotalPages(Math.max(1, data.totalPages ?? 1))
      })
      .catch(() => {
        setTotal(0)
        setTotalPages(1)
      })
  }, [query])

  // Tout changement de filtre ramène à la première page.
  const onFilterChange = (setter: (v: string) => void) => (value: string) => {
    setter(value)
    setPage(1)
  }

  const resetFilters = () => {
    setFilterYear(ALL)
    setFilterStudent(ALL)
    setFilterAction(ALL)
    setPage(1)
  }

  const hasFilters =
    filterYear !== ALL || filterStudent !== ALL || filterAction !== ALL

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 font-serif text-2xl font-bold tracking-tight text-neutral-900">
            <HistoryIcon className="h-6 w-6 text-neutral-500" />
            Journal
          </h1>
          <p className="text-sm text-muted-foreground">
            Mouvements enregistrés sur les inscriptions, toutes années confondues.
          </p>
        </div>

        <span className="flex items-center gap-1.5 rounded-md bg-neutral-100 px-2.5 py-1.5 text-xs text-neutral-600">
          <LockIcon className="h-3.5 w-3.5" />
          Lecture seule — le journal ne peut être ni modifié ni effacé
        </span>
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Élève</Label>
              <Select value={filterStudent} onValueChange={onFilterChange(setFilterStudent)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tous les élèves</SelectItem>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Année scolaire
              </Label>
              <Select value={filterYear} onValueChange={onFilterChange(setFilterYear)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Toutes les années</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y.id} value={y.id}>
                      {y.yearString || y.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Type de geste
              </Label>
              <Select value={filterAction} onValueChange={onFilterChange(setFilterAction)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tous les gestes</SelectItem>
                  {(
                    Object.entries(AUDIT_ACTION_LABELS) as Array<
                      [StudentAuditAction, string]
                    >
                  ).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={resetFilters}
                disabled={!hasFilters}
                className="w-full"
              >
                Réinitialiser
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chronologie */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            Chronologie
            {total > 0 && (
              <span className="ml-2 font-normal text-muted-foreground">
                {total} mouvement{total > 1 ? "s" : ""}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StudentAuditTimeline
            query={query}
            compact
            emptyLabel={
              hasFilters
                ? "Aucun mouvement ne correspond à ces filtres."
                : "Aucun mouvement enregistré à ce jour."
            }
          />

          {totalPages > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Précédent
                  </Button>
                </PaginationItem>
                <PaginationItem>
                  <span className="px-3 text-sm text-muted-foreground">
                    Page {page} sur {totalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Suivant
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
