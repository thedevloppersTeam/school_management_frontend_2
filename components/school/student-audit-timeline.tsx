"use client"

// Chronologie du journal d'audit élève. Lecture seule, sans exception : le
// journal est en ajout seul côté backend, aucune adresse d'écriture n'existe.
// Utilisé tel quel par l'écran Journal et par la fiche élève.

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { HistoryIcon } from "lucide-react"
import {
  AUDIT_ACTION_LABELS,
  fetchStudentAuditLogs,
  type StudentAuditLogQuery,
  type StudentAuditLogRow,
} from "@/lib/api/enrollment-corrections"

// ── Helpers d'affichage ──────────────────────────────────────────────────────

function formatMoment(iso: string): string {
  const date = new Date(iso)
  const day = date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  const time = date
    .toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    .replace(":", "h")
  return `${day}, ${time}`
}

function assignmentLabel(part?: { className?: string; trackName?: string | null }): string {
  if (!part?.className) return "?"
  return part.trackName ? `${part.className} ${part.trackName}` : part.className
}

/**
 * Phrase de la ligne, après le nom de l'élève. Seule ASSIGNMENT_CORRECTED est
 * écrite à ce jour ; les autres gestes retombent sur leur libellé seul.
 */
function describe(log: StudentAuditLogRow): string | null {
  if (log.action !== "ASSIGNMENT_CORRECTED" || !log.details) return null

  const { from, to, gradesDeleted, gradesMoved } = log.details
  const movement = `${assignmentLabel(from)} → ${assignmentLabel(to)}`

  const deletedCount = Array.isArray(gradesDeleted) ? gradesDeleted.length : 0
  const tail =
    deletedCount > 0
      ? `${deletedCount} note${deletedCount > 1 ? "s" : ""} supprimée${deletedCount > 1 ? "s" : ""}.`
      : gradesMoved
        ? `${gradesMoved} note${gradesMoved > 1 ? "s" : ""} déplacée${gradesMoved > 1 ? "s" : ""}.`
        : null

  return tail ? `${movement}. ${tail}` : `${movement}.`
}

// ── Ligne ────────────────────────────────────────────────────────────────────

function TimelineRow({ log }: { log: StudentAuditLogRow }) {
  const studentName = `${log.student.user.firstname} ${log.student.user.lastname}`
  const sentence = describe(log)
  const deletedCount = Array.isArray(log.details?.gradesDeleted)
    ? log.details!.gradesDeleted!.length
    : 0

  return (
    <li className="relative pl-6">
      {/* Puce de la chronologie */}
      <span
        className={
          "absolute left-0 top-[7px] h-2 w-2 rounded-full " +
          (deletedCount > 0 ? "bg-destructive" : "bg-neutral-400")
        }
      />

      <div className="space-y-0.5 border-b border-neutral-100 pb-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium text-neutral-900">{formatMoment(log.createdAt)}</span>
          <span className="text-muted-foreground">—</span>
          <Badge variant="outline" className="text-xs font-normal">
            {AUDIT_ACTION_LABELS[log.action] ?? log.action}
          </Badge>
          <span className="text-muted-foreground">—</span>
          <span className="font-semibold text-neutral-900">{studentName}</span>
        </div>

        {sentence && <p className="text-sm text-neutral-700">{sentence}</p>}

        {log.reason && (
          <p className="text-sm text-neutral-600">
            Motif : «&nbsp;{log.reason}&nbsp;»
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          {log.academicYear?.yearString ? `${log.academicYear.yearString} · ` : ""}
          {log.actor?.username ? `par ${log.actor.username}` : "auteur non enregistré"}
        </p>
      </div>
    </li>
  )
}

// ── Composant ────────────────────────────────────────────────────────────────

interface Props {
  /** Filtres transmis tels quels au journal. */
  query?: StudentAuditLogQuery
  /** Rendu compact pour la fiche élève : masque le compteur de résultats. */
  compact?: boolean
  /** Rechargement déclenché par le parent quand cette valeur change. */
  refreshKey?: number
  emptyLabel?: string
}

export function StudentAuditTimeline({
  query,
  compact = false,
  refreshKey = 0,
  emptyLabel = "Aucun mouvement enregistré.",
}: Props) {
  const [logs, setLogs] = useState<StudentAuditLogRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const {
    studentId,
    academicYearId,
    action,
    from,
    to,
    page,
    pageSize,
  } = query ?? {}

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchStudentAuditLogs({ studentId, academicYearId, action, from, to, page, pageSize })
      .then((data) => {
        if (cancelled) return
        setLogs(data.logs ?? [])
        setTotal(data.total ?? 0)
      })
      .catch((err) => {
        if (cancelled) return
        setLogs([])
        setTotal(0)
        setError(err instanceof Error ? err.message : "Journal indisponible")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [studentId, academicYearId, action, from, to, page, pageSize, refreshKey])

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive">
        {error}
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <HistoryIcon className="h-8 w-8 text-neutral-300" />
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {!compact && (
        <p className="text-xs text-muted-foreground">
          {total} mouvement{total > 1 ? "s" : ""} — du plus récent au plus ancien
        </p>
      )}

      <ol className="space-y-3 border-l border-neutral-200 pl-2">
        {logs.map((log) => (
          <TimelineRow key={log.id} log={log} />
        ))}
      </ol>
    </div>
  )
}
