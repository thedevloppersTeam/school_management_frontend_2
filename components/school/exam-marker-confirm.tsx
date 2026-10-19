"use client"

// Changement d'un marqueur d'examen (SPEC-RESULTATS RS-06, D3, lot M1) :
//  1. décompte des notes touchées AVANT le geste (GET /api/exam-markers/impact) ;
//  2. aucune note → changement direct ; sinon confirmation qui le dit (et, pour
//     une sous-matière du référentiel, nomme les années touchées) ;
//  3. mise à jour sur l'endpoint existant ; le serveur journalise avant/après.

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/components/ui/use-toast"
import { ApiError, clientFetch } from "@/lib/client-fetch"
import { toMessage } from "@/lib/errors"
import {
  confirmationText,
  impactUrl,
  updateRequest,
  type MarkerChange,
  type MarkerImpact,
} from "@/lib/exam-markers/markers"

type Pending = { change: MarkerChange; text: NonNullable<ReturnType<typeof confirmationText>>; onDone?: () => void }

/** Refus du serveur (4xx) : message rédigé pour l'écran ; sinon message générique. */
function describe(err: unknown): string {
  if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 401 && err.message) return err.message
  return toMessage(err, "lors du changement du marqueur d'examen")
}

export function useExamMarkerChange() {
  const { toast } = useToast()
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)

  const apply = async (change: MarkerChange, onDone?: () => void) => {
    setBusy(true)
    try {
      const { url, body } = updateRequest(change)
      await clientFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      toast({ title: "Marqueur d'examen enregistré", description: change.label })
      onDone?.()
    } catch (err) {
      toast({ title: "Erreur", description: describe(err), variant: "destructive" })
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  /** Demande un changement : confirmation si des notes sont touchées. */
  const request = async (change: MarkerChange, onDone?: () => void) => {
    setBusy(true)
    let impact: MarkerImpact
    try {
      impact = await clientFetch<MarkerImpact>(impactUrl(change.kind, change.id))
    } catch (err) {
      setBusy(false)
      toast({ title: "Erreur", description: describe(err), variant: "destructive" })
      return
    }
    setBusy(false)
    const text = confirmationText(change, impact)
    if (!text) return apply(change, onDone)
    setPending({ change, text, onDone })
  }

  const dialog = (
    <AlertDialog open={!!pending} onOpenChange={(open) => !open && !busy && setPending(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pending?.text.title}</AlertDialogTitle>
          <AlertDialogDescription>{pending?.text.body}</AlertDialogDescription>
        </AlertDialogHeader>
        {pending && pending.text.years.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-foreground">
            {pending.text.years.map((y) => <li key={y}>{y}</li>)}
          </ul>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              e.preventDefault()
              if (pending) void apply(pending.change, pending.onDone)
            }}
          >
            {busy ? "Enregistrement…" : "Confirmer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { request, dialog, busy }
}
