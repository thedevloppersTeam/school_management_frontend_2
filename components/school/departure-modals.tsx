"use client"

// Départ en cours d'année (SPEC-RESULTATS v0.3 RS-08, D-19).
//
// « Déclarer un départ » : date, dernière étape suivie (préremplie d'après la
// date, modifiable), motif, commentaire, puis un écran de CONFIRMATION avant
// l'envoi. Statut posé par le serveur : DROPPED. La dernière étape suivie
// borne la moyenne générale de l'élève (RS-09) et sa présence dans les
// moyennes de classe (RS-10) : elle est rappelée sur la confirmation.
//
// « Compléter le départ » (D-20) : même formulaire, pour une inscription
// DROPPED sans dernière étape (RS-12) → POST …/departure/complete.
// L'élève n'entrait dans aucune moyenne de classe ; complété, il y entre pour
// les étapes suivies : la confirmation le dit, avec le nombre de ses notes.
//
// « Annuler le départ » : retour ACTIVE, champs de départ remis à vide.
// Les deux gestes sont journalisés côté serveur (STUDENT_LEFT, STUDENT_LEFT_CANCELLED).
//
// Les deux modals sont montés à la demande par l'écran (un élève à la fois) :
// leur état part vide à chaque ouverture, sans effet de remise à zéro.

import { useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { ApiError, clientFetch } from "@/lib/client-fetch"
import { toMessage } from "@/lib/errors"
import { formatFrenchLongDate } from "@/lib/date-format"
import {
  DEPARTURE_REASONS,
  departureReasonLabel,
  inferLastAttendedStep,
  isWithinYear,
  orderSteps,
  type DepartureReason,
  type StepForDeparture,
} from "@/lib/departures/departures"

const JSON_HEADERS = { "Content-Type": "application/json" }

/** Refus du serveur (4xx) : message rédigé pour l'écran, rendu tel quel ; sinon message générique. */
function describe(err: unknown, context: string): string {
  if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 401 && err.message) return err.message
  return toMessage(err, context)
}

// ── Déclarer un départ ───────────────────────────────────────────────────────

interface DeclareDepartureModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  enrollmentId: string
  studentName: string
  steps: StepForDeparture[]
  year: { startDate?: string | null; endDate?: string | null } | null
  onDone: () => void
  /** declare (défaut) : inscription ACTIVE ; complete : départ ancien sans dernière étape (D-20). */
  mode?: "declare" | "complete"
  /** complete : notes portées par l'inscription (0 = elle comptera 0 aux étapes suivies). */
  gradeCount?: number
}

export function DeclareDepartureModal({
  open,
  onOpenChange,
  enrollmentId,
  studentName,
  steps,
  year,
  onDone,
  mode = "declare",
  gradeCount,
}: DeclareDepartureModalProps) {
  const completing = mode === "complete"
  const { toast } = useToast()
  const [leftAt, setLeftAt] = useState("")
  const [stepId, setStepId] = useState<string>("")
  // Vrai dès que l'utilisateur choisit l'étape lui-même : la date ne la
  // repréremplit plus (la saisie manuelle prime).
  const [stepTouched, setStepTouched] = useState(false)
  const [reason, setReason] = useState<DepartureReason | "">("")
  const [note, setNote] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const ordered = useMemo(() => orderSteps(steps), [steps])

  const onDateChange = (value: string) => {
    setLeftAt(value)
    if (!stepTouched) setStepId(inferLastAttendedStep(steps, value) ?? "")
  }

  const dateOk = leftAt !== "" && (year ? isWithinYear(leftAt, year) : true)
  const canContinue = dateOk && stepId !== "" && reason !== ""
  const stepName = ordered.find((s) => s.id === stepId)?.name ?? "—"
  const laterSteps = ordered.slice(ordered.findIndex((s) => s.id === stepId) + 1)

  const submit = async () => {
    setSubmitting(true)
    try {
      await clientFetch(`/api/enrollments/${enrollmentId}/departure${completing ? "/complete" : ""}`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ leftAt, lastAttendedStepId: stepId, reason, note: note.trim() || undefined }),
      })
      toast({
        title: completing ? "Départ complété" : "Départ enregistré",
        description: `${studentName} — dernière étape suivie : ${stepName}`,
      })
      onOpenChange(false)
      onDone()
    } catch (err) {
      toast({
        title: "Erreur",
        description: describe(err, completing ? "lors du complément du départ" : "lors de l'enregistrement du départ"),
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {completing
              ? confirming ? "Confirmer le complément" : "Compléter le départ"
              : confirming ? "Confirmer le départ" : "Déclarer un départ"}
          </DialogTitle>
          <DialogDescription>{studentName}</DialogDescription>
        </DialogHeader>

        {!confirming ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="departure-date" className="text-sm font-medium">
                Date du départ <span className="text-destructive">*</span>
              </Label>
              <Input
                id="departure-date"
                type="date"
                value={leftAt}
                min={year?.startDate?.slice(0, 10)}
                max={year?.endDate?.slice(0, 10)}
                onChange={(e) => onDateChange(e.target.value)}
              />
              {leftAt !== "" && !dateOk && (
                <p className="text-xs text-destructive">La date doit être comprise dans l&apos;année scolaire.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="departure-step" className="text-sm font-medium">
                Dernière étape suivie <span className="text-destructive">*</span>
              </Label>
              <Select
                value={stepId}
                onValueChange={(v) => {
                  setStepId(v)
                  setStepTouched(true)
                }}
              >
                <SelectTrigger id="departure-step">
                  <SelectValue placeholder="Choisir l'étape" />
                </SelectTrigger>
                <SelectContent>
                  {ordered.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Préremplie d&apos;après la date : l&apos;étape en cours à cette date. Modifiable.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="departure-reason" className="text-sm font-medium">
                Motif <span className="text-destructive">*</span>
              </Label>
              <Select value={reason} onValueChange={(v) => setReason(v as DepartureReason)}>
                <SelectTrigger id="departure-reason">
                  <SelectValue placeholder="Choisir le motif" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTURE_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="departure-note" className="text-sm font-medium">
                Commentaire
              </Label>
              <Textarea
                id="departure-note"
                value={note}
                maxLength={2000}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex : établissement d'accueil, circonstances"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              <dt className="text-muted-foreground">Date du départ</dt>
              <dd className="font-medium text-foreground">{formatFrenchLongDate(leftAt)}</dd>
              <dt className="text-muted-foreground">Dernière étape suivie</dt>
              <dd className="font-medium text-foreground">{stepName}</dd>
              <dt className="text-muted-foreground">Motif</dt>
              <dd className="font-medium text-foreground">{departureReasonLabel(reason)}</dd>
              {note.trim() && (
                <>
                  <dt className="text-muted-foreground">Commentaire</dt>
                  <dd className="whitespace-pre-wrap text-foreground">{note.trim()}</dd>
                </>
              )}
            </dl>
            <div className="rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-xs text-warning-ink">
              Sa moyenne générale sera calculée sur les étapes suivies jusqu&apos;à « {stepName} » incluse.
              {laterSteps.length > 0 && (
                <> Aucun bulletin ne sera produit pour {laterSteps.map((s) => `« ${s.name} »`).join(", ")}, et
                  l&apos;élève ne comptera plus dans les moyennes de classe de ces étapes.</>
              )}{" "}
              {completing ? (
                <>
                  Jusqu&apos;ici hors de toute moyenne de classe, l&apos;élève y entre pour les étapes suivies
                  (jusqu&apos;à « {stepName} ») : les moyennes de classe de ces étapes changent, y compris sur des
                  bulletins déjà imprimés.
                  {gradeCount === 0 && (
                    <> <strong>Cette inscription ne porte aucune note</strong> : elle comptera 0 à ces étapes.</>
                  )}{" "}
                  Le statut devient « Désactivé ». Le geste est journalisé.
                </>
              ) : (
                <>
                  Les moyennes de classe des étapes suivies ne changent pas. Le geste est journalisé et se défait
                  par « Annuler le départ ».
                </>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {!confirming ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={() => setConfirming(true)} disabled={!canContinue}>
                Continuer
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={submitting}>
                Retour
              </Button>
              <Button variant="destructive" onClick={submit} disabled={submitting}>
                {submitting ? "Enregistrement…" : completing ? "Confirmer le complément" : "Confirmer le départ"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Annuler un départ ────────────────────────────────────────────────────────

interface CancelDepartureModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  enrollmentId: string
  studentName: string
  onDone: () => void
}

export function CancelDepartureModal({ open, onOpenChange, enrollmentId, studentName, onDone }: CancelDepartureModalProps) {
  const { toast } = useToast()
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    setSubmitting(true)
    try {
      await clientFetch(`/api/enrollments/${enrollmentId}/departure/cancel`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      })
      toast({ title: "Départ annulé", description: `${studentName} redevient actif.` })
      onOpenChange(false)
      onDone()
    } catch (err) {
      toast({ title: "Erreur", description: describe(err, "lors de l'annulation du départ"), variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Annuler le départ</DialogTitle>
          <DialogDescription>
            {studentName} redevient actif : il réapparaît dans les listes et compte de nouveau dans les
            effectifs et les moyennes de classe. La date, la dernière étape suivie, le motif et le
            commentaire du départ sont effacés ; le journal garde la trace des deux gestes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="departure-cancel-reason" className="text-sm font-medium">
            Motif de l&apos;annulation
          </Label>
          <Input
            id="departure-cancel-reason"
            placeholder="Ex : départ saisi par erreur — ou élève de retour depuis le 12 janvier"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Consigné au journal d&apos;audit, avec votre nom et la date.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Fermer
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Enregistrement…" : "Annuler le départ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
