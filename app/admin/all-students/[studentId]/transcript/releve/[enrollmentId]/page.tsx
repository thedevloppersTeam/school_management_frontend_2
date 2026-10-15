"use client"

/**
 * Prévisualisation du RELEVÉ DE NOTES d'une inscription (une année scolaire).
 *
 * La feuille est montrée telle qu'imprimée, réduite pour tenir dans la largeur
 * (jamais de défilement horizontal) ; le PDF capture la même feuille à
 * l'échelle 1. Si le contenu dépasse la zone utile de la feuille à en-tête, le
 * PDF est bloqué : pas de réduction silencieuse, pas de seconde page.
 */
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeftIcon, DownloadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ReleveNotesPrintable } from "@/components/releve/ReleveNotesPrintable"
import { PAPER_PX } from "@/components/releve/releve-layout"
import { clientFetch } from "@/lib/client-fetch"
import { buildReleveData } from "@/lib/releve/build"
import { downloadRelevePdf } from "@/lib/releve/pdf"
import { overflowsUsableArea, previewScale, releveFileName } from "@/lib/releve/present"
import { ReleveUnavailableError, type ReleveData } from "@/lib/releve/types"

const GENERIC_ERROR = "Relevé de notes indisponible."

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ReleveData; studentCode: string }

/** Résultat d'un chargement, attaché à l'inscription qui l'a demandé. */
type Loaded = Exclude<State, { status: "loading" }> & { key: string }

export default function RelevePreviewPage() {
  const params = useParams()
  const studentId = params.studentId as string
  const enrollmentId = params.enrollmentId as string

  // Un résultat ne vaut que pour l'inscription qui l'a produit : en changeant
  // d'inscription, l'ancien résultat n'est plus affiché (chargement), sans
  // remise à zéro synchrone dans l'effet.
  const requestKey = `${studentId}/${enrollmentId}`
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const state: State = loaded && loaded.key === requestKey ? loaded : { status: "loading" }
  const [scale, setScale] = useState(1)
  const [overflow, setOverflow] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const frameRef = useRef<HTMLDivElement>(null)
  const sheetHostRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Données : tout ou rien. Jamais de feuille partielle.
  useEffect(() => {
    let cancelled = false
    Promise.all([
      buildReleveData(studentId, enrollmentId),
      // Code élève pour le nom du fichier : ReleveData ne le porte pas (§8).
      clientFetch<{ studentCode?: unknown }>(`/api/students/${encodeURIComponent(studentId)}`),
    ])
      .then(([data, student]) => {
        if (cancelled) return
        const code = typeof student?.studentCode === "string" ? student.studentCode : ""
        if (!code.trim()) throw new Error("code élève absent")
        setLoaded({ key: requestKey, status: "ready", data, studentCode: code })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoaded({
          key: requestKey,
          status: "error",
          message: err instanceof ReleveUnavailableError ? err.message : GENERIC_ERROR,
        })
      })
    return () => {
      cancelled = true
    }
  }, [studentId, enrollmentId, requestKey])

  // Échelle d'aperçu : la largeur disponible du cadre.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const update = () => setScale(previewScale(frame.clientWidth))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [state.status])

  // Dépassement : hauteur du contenu (non transformée) contre la zone utile.
  // Remesuré à chaque changement de taille, dont l'arrivée tardive des polices.
  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    const measure = () => setOverflow(overflowsUsableArea(content.scrollHeight))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(content)
    void document.fonts?.ready.then(measure)
    return () => observer.disconnect()
  }, [state.status])

  const onDownload = async () => {
    if (state.status !== "ready") return
    const sheet = sheetHostRef.current?.querySelector<HTMLElement>('[data-releve-sheet="true"]')
    if (!sheet) return
    setDownloading(true)
    setDownloadError(null)
    try {
      await downloadRelevePdf(sheet, releveFileName(state.data.identity.anneeScolaire, state.studentCode))
    } catch {
      setDownloadError("Le PDF n’a pas pu être généré. Réessayez dans un instant.")
    } finally {
      setDownloading(false)
    }
  }

  const backHref = `/admin/all-students/${studentId}/transcript`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href={backHref}>
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            Retour
          </Link>
        </Button>
        <Button
          size="sm"
          onClick={onDownload}
          disabled={state.status !== "ready" || overflow || downloading}
        >
          <DownloadIcon className="mr-2 h-4 w-4" />
          {downloading ? "Génération du PDF…" : "Télécharger le PDF"}
        </Button>
      </div>

      {state.status === "ready" && overflow && (
        <p role="alert" className="rounded-md border border-warning-border bg-warning-soft px-3 py-2 text-sm text-warning-ink">
          Le contenu dépasse la zone imprimable de la feuille à en-tête. Le PDF est bloqué pour
          ne pas imprimer une feuille coupée : signalez-le, la mise en page doit être ajustée.
        </p>
      )}
      {downloadError && (
        <p role="alert" className="text-sm text-destructive">{downloadError}</p>
      )}

      {state.status === "loading" && <Skeleton className="h-[60vh] w-full" />}

      {state.status === "error" && (
        <Card className="border-destructive/40">
          <CardContent role="alert" className="py-12 text-center text-sm text-destructive">
            {state.message}
          </CardContent>
        </Card>
      )}

      {state.status === "ready" && (
        <div ref={frameRef} className="w-full overflow-hidden">
          <div
            className="mx-auto shadow-md ring-1 ring-border"
            style={{ width: PAPER_PX.width * scale, height: PAPER_PX.height * scale }}
          >
            <div
              ref={sheetHostRef}
              style={{ width: PAPER_PX.width, transform: `scale(${scale})`, transformOrigin: "top left" }}
            >
              <ReleveNotesPrintable ref={contentRef} data={state.data} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
