"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeftIcon, PrinterIcon, Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { Progress } from "@/components/ui/progress"
import { clientFetch as apiFetch } from "@/lib/client-fetch"
import { buildBulletinData } from "@/lib/api/bulletin"
import { fetchSteps } from "@/lib/api/dashboard"
import { toMessage } from "@/lib/errors"
import { BulletinPrintable } from "@/components/school/bulletin-printable"
import type { BulletinData } from "@/components/BulletinScolaire"
import { isNisuValid } from "@/lib/nisu"

interface ApiEnrollmentRow {
  id: string
  studentId: string
  classSessionId: string
  status: "ACTIVE" | "TRANSFERRED" | "DROPPED" | "GRADUATED"
  student?: {
    id: string
    nisu?: string
    studentCode?: string
    user?: { firstname?: string; lastname?: string }
  }
  classSession?: {
    class?: {
      letter?: string
      classType?: { name?: string }
      track?: { code?: string }
    }
    academicYear?: { id?: string }
  }
}

interface BulletinSlot {
  enrollmentId: string
  studentLabel: string
  data: BulletinData | null
  error: string | null
}

// Run an async producer over a list with a small concurrency cap so the
// backend isn't hammered with N parallel buildBulletinData() chains.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onTick?: (done: number, total: number) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  let done = 0
  const total = items.length
  const runners = Array(Math.min(limit, total))
    .fill(0)
    .map(async () => {
      while (true) {
        const i = cursor++
        if (i >= total) return
        results[i] = await worker(items[i], i)
        done++
        onTick?.(done, total)
      }
    })
  await Promise.all(runners)
  return results
}

export default function BulletinLotPrintPage() {
  const params = useParams()
  const classSessionId = params.classSessionId as string
  const stepId = params.stepId as string
  const { toast } = useToast()

  const [slots, setSlots] = useState<BulletinSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [className, setClassName] = useState<string>("")
  const [stepName, setStepName] = useState<string>("Étape")
  const [reportsHref, setReportsHref] = useState("/admin/dashboard")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setProgress({ current: 0, total: 0 })
    try {
      // 1. Récupérer les inscriptions ACTIVES de la classe
      const enrollments = await apiFetch<ApiEnrollmentRow[]>(
        `/api/enrollments?classSessionId=${classSessionId}&status=ACTIVE`
      )

      const eligible = enrollments.filter((e) => isNisuValid(e.student?.nisu))
      if (eligible.length === 0) {
        setSlots([])
        setLoading(false)
        return
      }

      // 2. Dériver le contexte (classe, année, étape)
      const first = eligible[0]
      const cls = first.classSession?.class
      const trackSuffix = cls?.track?.code ? ` — ${cls.track.code}` : ""
      const computedClassName = `${cls?.classType?.name ?? ""} ${cls?.letter ?? ""}${trackSuffix}`.trim()
      const yearId = first.classSession?.academicYear?.id ?? ""
      let resolvedStepName = "Étape"

      setClassName(computedClassName)
      if (yearId) setReportsHref(`/admin/academic-year/${yearId}/reports`)

      if (yearId) {
        try {
          const steps = await fetchSteps(yearId)
          const step = steps.find((s) => s.id === stepId)
          if (step) resolvedStepName = step.name
        } catch {
          /* best-effort */
        }
      }
      setStepName(resolvedStepName)

      // 3. Construire chaque bulletin (concurrence limitée à 4)
      setProgress({ current: 0, total: eligible.length })
      const built = await mapWithConcurrency<ApiEnrollmentRow, BulletinSlot>(
        eligible,
        4,
        async (e) => {
          const label = `${e.student?.user?.lastname ?? ""} ${e.student?.user?.firstname ?? ""}`.trim() || e.student?.studentCode || e.id
          try {
            const data = await buildBulletinData({
              enrollmentId: e.id,
              studentId: e.studentId,
              classSessionId: e.classSessionId,
              stepId,
              stepName: resolvedStepName,
              className: computedClassName,
              yearId,
            })
            return { enrollmentId: e.id, studentLabel: label, data, error: null }
          } catch (err) {
            return {
              enrollmentId: e.id,
              studentLabel: label,
              data: null,
              error: toMessage(err, "lors de la construction du bulletin"),
            }
          }
        },
        (done, total) => setProgress({ current: done, total })
      )

      setSlots(built)
    } catch (err) {
      const m = toMessage(err, "lors du chargement des bulletins")
      setError(m)
      toast({ title: "Erreur", description: m, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [classSessionId, stepId, toast])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  const handlePrint = () => window.print()

  const successCount = slots.filter((s) => s.data).length
  const failedCount  = slots.filter((s) => !s.data).length

  return (
    <>
      <style jsx global>{`
        @page {
          size: 8.5in 11in;
          margin: 0;
        }
        @media print {
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .bulletin-print {
            box-shadow: none !important;
            border: none !important;
            page-break-after: always;
            break-after: page;
          }
          .bulletin-print:last-of-type {
            page-break-after: auto;
            break-after: auto;
          }
          .break-inside-avoid {
            break-inside: avoid;
          }
        }
      `}</style>

      <div className="min-h-screen bg-slate-100">
        {/* Top toolbar (screen only) */}
        <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href={reportsHref}>
                <ArrowLeftIcon className="mr-2 h-4 w-4" />
                Retour aux bulletins
              </Link>
            </Button>
            <div className="hidden text-sm text-muted-foreground sm:flex sm:items-center sm:gap-2">
              <span className="font-medium text-foreground">
                Lot — {className || "…"}
              </span>
              {stepName && (
                <>
                  <span>·</span>
                  <span>{stepName}</span>
                </>
              )}
              {!loading && (
                <>
                  <span>·</span>
                  <span>
                    {successCount} bulletin{successCount > 1 ? "s" : ""} prêt{successCount > 1 ? "s" : ""}
                    {failedCount > 0 && <span className="ml-1 text-rose-600">({failedCount} échec{failedCount > 1 ? "s" : ""})</span>}
                  </span>
                </>
              )}
            </div>
          </div>

          <Button
            onClick={handlePrint}
            disabled={loading || successCount === 0}
            className="bg-[#2C4A6E] text-white hover:bg-[#1F3856]"
          >
            <PrinterIcon className="mr-2 h-4 w-4" />
            Imprimer / Télécharger PDF
          </Button>
        </div>

        {/* Loading state with progress */}
        {loading && (
          <div className="no-print mx-auto max-w-[8.5in] space-y-4 px-4 py-6">
            <div className="rounded-md bg-white p-6 shadow-md">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2Icon className="h-4 w-4 animate-spin" />
                {progress.total > 0
                  ? `Construction des bulletins (${progress.current} / ${progress.total})...`
                  : "Récupération des inscriptions..."}
              </div>
              {progress.total > 0 && (
                <Progress
                  value={(progress.current / progress.total) * 100}
                  className="mt-3 h-2 [&>div]:bg-[#2C4A6E]"
                />
              )}
              <div className="mt-4 space-y-2">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="no-print mx-auto mt-6 max-w-md rounded-xl border border-destructive/30 bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={load} variant="outline" size="sm" className="mt-4">
              Réessayer
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && slots.length === 0 && (
          <div className="no-print mx-auto mt-6 max-w-md rounded-xl border bg-white p-6 text-center shadow-sm">
            <p className="text-sm font-medium text-foreground">Aucun bulletin éligible</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Aucun élève imprimable n&apos;a été trouvé pour cette classe.
            </p>
          </div>
        )}

        {/* Document area — one BulletinPrintable per student, separated by page breaks in print */}
        {!loading && !error && slots.length > 0 && (
          <div className="space-y-6 px-4 py-6 print:space-y-0 print:p-0">
            {slots.map((slot) =>
              slot.data ? (
                <div key={slot.enrollmentId} className="mx-auto shadow-lg print:shadow-none">
                  <BulletinPrintable data={slot.data} />
                </div>
              ) : (
                <div
                  key={slot.enrollmentId}
                  className="no-print mx-auto max-w-md rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                >
                  <p className="font-semibold">{slot.studentLabel}</p>
                  <p className="mt-0.5 text-xs">{slot.error}</p>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </>
  )
}
