"use client"

// Changement d'un marqueur d'examen (SPEC-RESULTATS RS-06, D3, lot M1) :
//  1. décompte des notes touchées AVANT le geste (GET /api/exam-markers/impact) ;
//  2. aucune note → changement direct ; sinon confirmation qui le dit (et, pour
//     une sous-matière du référentiel, nomme les années touchées) ;
//  3. mise à jour sur l'endpoint existant ; le serveur journalise avant/après.
// Case « Matière d'examen » par matière (`requestSubject`) : les mêmes étapes
// sur chaque affectation de la matière dans la salle, toutes filières
// confondues ; total des notes touchées ; échec partiel nommé, puis rechargement.

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
import {
  applyToGroup,
  failureText,
  nextValue,
  targets,
  totalImpact,
  type ExamGroup,
  type ExamRow,
  type GroupCalls,
} from "@/lib/exam-markers/subject-group"

type Pending = {
  change: MarkerChange
  text: NonNullable<ReturnType<typeof confirmationText>>
  onDone?: () => void
  /** Case par matière : affectations à modifier. */
  members?: ExamRow[]
}

const SUBJECT_CALLS: GroupCalls = {
  impact: (id) => clientFetch<MarkerImpact>(impactUrl("classSubject", id)),
  update: async (id, next) => {
    const { url, body } = updateRequest({ kind: "classSubject", id, next })
    await clientFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  },
}

/** Refus du serveur (4xx) : message rédigé pour l'écran ; sinon message générique. */
function describe(err: unknown): string {
  if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 401 && err.message) return err.message
  return toMessage(err, "lors du changement du marqueur d'examen")
}

export function useExamMarkerChange() {
  const { toast } = useToast()
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)

  /** Une requête par affectation ; l'état est rechargé dans tous les cas (la case reflète la base). */
  const applySubject = async (change: MarkerChange, members: ExamRow[], onDone?: () => void) => {
    setBusy(true)
    try {
      const { failed } = await applyToGroup(members, change.next, SUBJECT_CALLS)
      if (failed.length === 0) {
        toast({ title: "Marqueur d'examen enregistré", description: change.label })
      } else {
        const tracks = failureText(change.label, failed.map((f) => f.row))
        const cause = [...new Set(failed.map((f) => describe(f.error)))].join(" ")
        toast({ title: "Erreur", description: tracks ? `${tracks} ${cause}` : cause, variant: "destructive" })
      }
    } finally {
      setBusy(false)
      setPending(null)
      onDone?.()
    }
  }

  const apply = async (change: MarkerChange, onDone?: () => void, members?: ExamRow[]) => {
    if (members) return applySubject(change, members, onDone)
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

  /**
   * Case « Matière d'examen » d'une matière : toutes ses affectations de la salle
   * (une seule dans une salle sans filière). Case cochée → démarque tout ; vide ou
   * indéterminée → marque tout. Confirmation sur le total des notes touchées.
   */
  const requestSubject = async (group: ExamGroup, onDone?: () => void) => {
    const next = nextValue(group)
    const members = targets(group, next)
    const change: MarkerChange = { kind: "classSubject", id: members[0].id, label: group.label, next }
    setBusy(true)
    let gradeCount: number
    try {
      gradeCount = await totalImpact(members, SUBJECT_CALLS)
    } catch (err) {
      setBusy(false)
      toast({ title: "Erreur", description: describe(err), variant: "destructive" })
      return
    }
    setBusy(false)
    const text = confirmationText(change, { gradeCount })
    if (!text) return applySubject(change, members, onDone)
    setPending({ change, text, onDone, members })
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
              if (pending) void apply(pending.change, pending.onDone, pending.members)
            }}
          >
            {busy ? "Enregistrement…" : "Confirmer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { request, requestSubject, dialog, busy }
}
