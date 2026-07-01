"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeftIcon, PrinterIcon, Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { clientFetch as apiFetch } from "@/lib/client-fetch"
import { buildBulletinData } from "@/lib/api/bulletin"
import { fetchSteps } from "@/lib/api/dashboard"
import { toMessage } from "@/lib/errors"
import { BulletinPrintable } from "@/components/school/bulletin-printable"
import type { BulletinData } from "@/components/BulletinScolaire"

interface EnrollmentResponse {
  id: string
  studentId: string
  classSessionId: string
  classSession?: {
    id: string
    class?: {
      letter?: string
      classType?: { name?: string }
      track?: { code?: string }
    }
    academicYear?: {
      id?: string
      name?: string
      yearString?: string
      steps?: Array<{ id: string; name: string; stepNumber: number }>
    }
  }
}

export default function BulletinPrintPage() {
  const params = useParams()
  const enrollmentId = params.enrollmentId as string
  const stepId = params.stepId as string
  const { toast } = useToast()

  const [bulletin, setBulletin] = useState<BulletinData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reportsHref, setReportsHref] = useState("/admin/dashboard")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const enrollment = await apiFetch<EnrollmentResponse>(`/api/enrollments/${enrollmentId}`)
      const cls = enrollment.classSession?.class
      const trackSuffix = cls?.track?.code ? ` — ${cls.track.code}` : ""
      const className = `${cls?.classType?.name ?? ""} ${cls?.letter ?? ""}${trackSuffix}`.trim()
      const yearId = enrollment.classSession?.academicYear?.id
      let stepName = enrollment.classSession?.academicYear?.steps?.find((s) => s.id === stepId)?.name

      if (!yearId) {
        throw new Error("Année scolaire introuvable pour cet enrôlement")
      }

      setReportsHref(`/admin/academic-year/${yearId}/reports`)

      if (!stepName) {
        try {
          const steps = await fetchSteps(yearId)
          stepName = steps.find((s) => s.id === stepId)?.name
        } catch {
          /* best-effort */
        }
      }

      const data = await buildBulletinData({
        enrollmentId,
        studentId: enrollment.studentId,
        classSessionId: enrollment.classSessionId,
        stepId,
        stepName: stepName ?? "Étape",
        className,
        yearId,
      })
      setBulletin(data)
    } catch (err) {
      const message = toMessage(err, "lors de la génération du bulletin")
      setError(message)
      toast({ title: "Erreur", description: message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [enrollmentId, stepId, toast])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  const handlePrint = () => window.print()

  return (
    <>
      {/* Print rules — strip everything except the bulletin and reset margins */}
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
          }
          /* Avoid breaking key sections across pages */
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
            {bulletin && (
              <div className="hidden text-sm text-muted-foreground sm:flex sm:items-center sm:gap-2">
                <span className="font-medium text-foreground">
                  {bulletin.prenoms} {bulletin.nom}
                </span>
                <span>·</span>
                <span>{bulletin.niveau}</span>
                <span>·</span>
                <span>{bulletin.periode}</span>
              </div>
            )}
          </div>

          <Button
            onClick={handlePrint}
            disabled={!bulletin || loading}
            className="bg-[#2C4A6E] text-white hover:bg-[#1F3856]"
          >
            <PrinterIcon className="mr-2 h-4 w-4" />
            Imprimer / Télécharger PDF
          </Button>
        </div>

        {/* Document area */}
        <div className="px-4 py-6 print:p-0">
          {loading ? (
            <div className="mx-auto max-w-[8.5in] space-y-4 rounded-md bg-white p-6 shadow-md">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-72 w-full" />
              <Skeleton className="h-40 w-full" />
              <div className="flex items-center justify-center pt-4 text-sm text-muted-foreground">
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                Construction du bulletin...
              </div>
            </div>
          ) : error ? (
            <div className="mx-auto max-w-md rounded-xl border border-destructive/30 bg-white p-6 text-center shadow-sm">
              <p className="text-sm text-destructive">{error}</p>
              <Button onClick={load} variant="outline" size="sm" className="mt-4">
                Réessayer
              </Button>
            </div>
          ) : bulletin ? (
            <div className="mx-auto shadow-lg print:shadow-none">
              <BulletinPrintable data={bulletin} />
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
