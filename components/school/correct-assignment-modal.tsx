"use client"

// Correction d'affectation — erreur de saisie à l'inscription : l'élève n'a
// jamais appartenu à la salle ou à la filière enregistrée. À ne pas confondre
// avec le transfert (l'élève y était, il n'y est plus), qui a son propre geste.
//
// L'id de l'inscription ne change pas. Deux modes, déterminés par la filière :
//   MODE A — même filière : les notes suivent dans la salle cible.
//   MODE B — filière différente : toutes les notes de l'année sont effacées.
//            Elles sont alors listées nominativement avant confirmation, et le
//            journal d'audit en conserve la copie intégrale.

import { useCallback, useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { AlertTriangleIcon, ArrowRightIcon, InfoIcon, XCircleIcon } from "lucide-react"
import {
  correctAssignment,
  fetchCorrectionPreview,
  type CorrectionPreview,
} from "@/lib/api/enrollment-corrections"

// Une salle candidate. Le niveau sert à n'offrir que des cibles recevables :
// la règle R1 impose la même année et le même niveau que la salle actuelle.
export interface CorrectionSessionOption {
  id:          string
  label:       string
  classTypeId: string
}

interface TrackOption {
  id:   string
  code: string
  name: string
}

interface Props {
  open:                  boolean
  onOpenChange:          (open: boolean) => void
  enrollmentId:          string
  studentName:           string
  currentClassSessionId: string
  currentClassName:      string
  currentTrackId?:       string | null
  /** Niveau de la salle actuelle ; restreint la liste des cibles proposées. */
  currentClassTypeId?:   string
  sessions:              CorrectionSessionOption[]
  onCorrected?:          () => void
}

const NO_TRACK = "__none__"

// Les filières réellement enseignées dans une salle : les affectations de
// matières qui en portent une. Une salle sans aucune filière (le primaire, par
// exemple) masque complètement le choix.
interface ApiClassSubjectLite {
  trackId: string | null
  track?:  TrackOption | null
}

export function CorrectAssignmentModal({
  open,
  onOpenChange,
  enrollmentId,
  studentName,
  currentClassSessionId,
  currentClassName,
  currentTrackId,
  currentClassTypeId,
  sessions,
  onCorrected,
}: Props) {
  const { toast } = useToast()

  const [targetSessionId, setTargetSessionId] = useState("")
  const [targetTrackId, setTargetTrackId] = useState<string>(NO_TRACK)

  const [tracks, setTracks] = useState<TrackOption[]>([])
  const [tracksLoading, setTracksLoading] = useState(false)

  const [preview, setPreview] = useState<CorrectionPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [reason, setReason] = useState("")
  const [acknowledge, setAcknowledge] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // R1 : même niveau. La salle actuelle reste proposée — n'en changer que la
  // filière est une correction valide.
  const candidates = currentClassTypeId
    ? sessions.filter((s) => s.classTypeId === currentClassTypeId)
    : sessions

  // ── Filières de la salle cible ───────────────────────────────────────────
  useEffect(() => {
    if (!open || !targetSessionId) {
      setTracks([])
      return
    }

    let cancelled = false
    setTracksLoading(true)

    fetch(`/api/class-subjects?classSessionId=${targetSessionId}`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ApiClassSubjectLite[]) => {
        if (cancelled) return
        const list = Array.isArray(data) ? data : []
        const byId = new Map<string, TrackOption>()
        for (const cs of list) {
          if (cs.trackId && cs.track) byId.set(cs.trackId, cs.track)
        }
        setTracks([...byId.values()].sort((a, b) => a.code.localeCompare(b.code, "fr")))
      })
      .catch(() => {
        if (!cancelled) setTracks([])
      })
      .finally(() => {
        if (!cancelled) setTracksLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, targetSessionId])

  // ── Preview, à chaque changement de sélection ────────────────────────────
  const loadPreview = useCallback(
    async (sessionId: string, trackId: string) => {
      if (!sessionId) {
        setPreview(null)
        setPreviewError(null)
        return
      }

      setPreviewLoading(true)
      setPreviewError(null)
      try {
        const data = await fetchCorrectionPreview(
          enrollmentId,
          sessionId,
          trackId === NO_TRACK ? null : trackId,
        )
        setPreview(data)
      } catch (err) {
        setPreview(null)
        setPreviewError(
          err instanceof Error ? err.message : "Impossible de calculer l'impact",
        )
      } finally {
        setPreviewLoading(false)
      }
    },
    [enrollmentId],
  )

  useEffect(() => {
    if (!open) return
    void loadPreview(targetSessionId, targetTrackId)
    // L'acquittement porte sur un impact précis : toute nouvelle sélection le
    // remet à zéro.
    setAcknowledge(false)
  }, [open, targetSessionId, targetTrackId, loadPreview])

  // Changer de salle invalide la filière retenue : elle n'y est pas forcément
  // enseignée.
  const handleSessionChange = (value: string) => {
    setTargetSessionId(value)
    setTargetTrackId(NO_TRACK)
  }

  const mode = preview?.mode ?? null
  const isModeB = mode === "B"
  const reasonFilled = reason.trim().length > 0

  const canSubmit =
    !!preview &&
    preview.canCorrect &&
    reasonFilled &&
    (!isModeB || acknowledge) &&
    !previewLoading &&
    !submitting

  const handleSubmit = async () => {
    if (!canSubmit || !preview) return

    setSubmitting(true)
    try {
      const result = await correctAssignment(enrollmentId, {
        targetClassSessionId: preview.target.classSessionId,
        targetTrackId: preview.target.trackId,
        reason: reason.trim(),
        acknowledgeDataLoss: isModeB ? acknowledge : undefined,
      })

      toast({
        title: "Affectation corrigée",
        description:
          result.applied.gradesDeleted > 0
            ? `${studentName} → ${preview.target.className}. ${result.applied.gradesDeleted} note(s) supprimée(s).`
            : `${studentName} → ${preview.target.className}. ${result.applied.gradesMoved} note(s) déplacée(s).`,
      })

      onOpenChange(false)
      onCorrected?.()
    } catch (err) {
      toast({
        title: "Correction refusée",
        description:
          err instanceof Error ? err.message : "La correction n'a pas pu être appliquée",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const currentTrackLabel =
    preview?.enrollment.current.trackName ??
    (currentTrackId ? "filière actuelle" : "sans filière")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-xl bg-white">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-bold tracking-tight text-neutral-900">
            Corriger l&apos;affectation
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {studentName} · {currentClassName}
            {currentTrackId ? ` · ${currentTrackLabel}` : ""}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Rappel du geste : ce n'est pas un transfert. */}
          <div className="flex gap-2 rounded-lg bg-slate-100 px-3.5 py-2.5 text-xs text-slate-600">
            <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              À utiliser quand l&apos;élève n&apos;a <strong>jamais</strong> appartenu à
              cette salle : une erreur de saisie à l&apos;inscription. S&apos;il y était
              réellement et quitte l&apos;établissement, enregistrez son départ.
            </span>
          </div>

          {/* ── Sélection de la cible ─────────────────────────────────────── */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Salle cible <span className="text-destructive">*</span>
            </Label>
            <Select value={targetSessionId} onValueChange={handleSessionChange}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner la salle réelle" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                    {s.id === currentClassSessionId ? " (salle actuelle)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {candidates.length === 0 && (
              <p className="text-xs text-destructive">
                Aucune autre salle de ce niveau dans l&apos;année.
              </p>
            )}
          </div>

          {/* Filière : masquée si la salle cible n'en enseigne aucune. */}
          {targetSessionId && !tracksLoading && tracks.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Filière cible</Label>
              <Select value={targetTrackId} onValueChange={setTargetTrackId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TRACK}>Aucune filière</SelectItem>
                  {tracks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.code} — {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {previewLoading && (
            <p className="text-sm text-muted-foreground">Calcul de l&apos;impact…</p>
          )}

          {previewError && !previewLoading && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive">
              {previewError}
            </div>
          )}

          {preview && !previewLoading && (
            <>
              <Separator />

              {/* ── Ce qui change ──────────────────────────────────────────── */}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-md bg-neutral-100 px-2 py-1 font-medium text-neutral-700">
                  {preview.enrollment.current.className}
                  {preview.enrollment.current.trackName
                    ? ` · ${preview.enrollment.current.trackName}`
                    : ""}
                </span>
                <ArrowRightIcon className="h-4 w-4 text-muted-foreground" />
                <span className="rounded-md bg-neutral-100 px-2 py-1 font-medium text-neutral-700">
                  {preview.target.className}
                  {preview.target.trackName ? ` · ${preview.target.trackName}` : ""}
                </span>
              </div>

              {/* ── Blocages : matières nommées, confirmation impossible ───── */}
              {preview.blockers.length > 0 && (
                <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                    <XCircleIcon className="h-4 w-4" />
                    Correction impossible en l&apos;état
                  </div>
                  <ul className="space-y-1 text-sm text-destructive/90">
                    {preview.blockers.map((b, i) => (
                      <li key={`${b.rule}-${b.subjectName ?? i}`}>
                        {b.subjectName ? (
                          <>
                            <strong>{b.subjectName}</strong> — {b.detail}
                          </>
                        ) : (
                          b.detail
                        )}
                        <span className="ml-1 text-xs opacity-60">({b.rule})</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-destructive/80">
                    Deux salles de même niveau et même filière doivent porter le même
                    programme. Corrigez la configuration de l&apos;année avant de
                    recommencer.
                  </p>
                </div>
              )}

              {/* ── Avertissements non bloquants ───────────────────────────── */}
              {preview.warnings.length > 0 && (
                <div className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                    <AlertTriangleIcon className="h-4 w-4" />
                    À savoir
                  </div>
                  <ul className="space-y-1 text-sm text-amber-900">
                    {preview.warnings.map((w, i) => (
                      <li key={`${w.code}-${i}`}>
                        {w.code === "BULLETIN_NOT_REPRODUCIBLE"
                          ? `Bulletin déjà remis (${w.detail}) : il ne sera plus régénérable automatiquement. Le journal conserve les notes supprimées.`
                          : `Étape clôturée concernée : ${w.detail}.`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ── MODE A : résumé d'impact ───────────────────────────────── */}
              {mode === "A" && preview.canCorrect && (
                <div className="space-y-1 rounded-lg bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900">
                  <p className="font-medium">
                    Même filière : les notes suivent l&apos;élève.
                  </p>
                  <ul className="space-y-0.5 text-[13px]">
                    <li>{preview.impact.gradesMoved} note(s) déplacée(s), aucune perdue</li>
                    <li>
                      {preview.impact.exclusionsMoved} exclusion(s) de rubrique re-rattachée(s)
                    </li>
                    <li>
                      {preview.impact.stepExemptionsPreserved} dispense(s) d&apos;étape et{" "}
                      {preview.impact.behaviorsPreserved} appréciation(s) de comportement
                      conservées
                    </li>
                  </ul>
                </div>
              )}

              {/* ── MODE B : perte de notes, liste nominative ──────────────── */}
              {isModeB && (
                <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                    <AlertTriangleIcon className="h-4 w-4" />
                    Changement de filière — les notes de l&apos;année seront supprimées
                  </div>
                  <p className="text-[13px] text-destructive/90">
                    Les programmes diffèrent d&apos;une filière à l&apos;autre : aucune
                    note ne peut être reportée. Comportement et dispenses d&apos;étape sont
                    conservés. Le journal d&apos;audit garde une copie intégrale de chaque
                    note ci-dessous.
                  </p>

                  {preview.gradesToDelete.length > 0 ? (
                    <div className="max-h-56 overflow-y-auto rounded-md border border-destructive/20 bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-8 text-xs">Matière</TableHead>
                            <TableHead className="h-8 text-xs">Étape</TableHead>
                            <TableHead className="h-8 text-right text-xs">Note</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preview.gradesToDelete.map((g, i) => (
                            <TableRow key={`${g.subjectName}-${g.stepName}-${i}`}>
                              <TableCell className="py-1.5 text-[13px]">
                                {g.subjectName}
                              </TableCell>
                              <TableCell className="py-1.5 text-[13px] text-muted-foreground">
                                {g.stepName}
                              </TableCell>
                              <TableCell className="py-1.5 text-right text-[13px] font-medium tabular-nums">
                                {g.studentScore}
                                {g.maxScore ? ` / ${g.maxScore}` : ""}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-[13px] text-destructive/80">
                      Aucune note saisie pour cette inscription : rien ne sera perdu.
                    </p>
                  )}

                  <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-destructive">
                    <Checkbox
                      checked={acknowledge}
                      onCheckedChange={(v) => setAcknowledge(v === true)}
                      className="mt-0.5"
                    />
                    <span>
                      Je comprends que ces {preview.impact.gradesDeleted} note(s) seront
                      définitivement supprimées de l&apos;inscription.
                    </span>
                  </label>
                </div>
              )}

              {/* ── Motif, obligatoire dans les deux modes ─────────────────── */}
              <div className="space-y-2">
                <Label htmlFor="correction-reason" className="text-sm font-medium">
                  Motif de la correction <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="correction-reason"
                  rows={2}
                  placeholder="Ex : erreur de saisie à l'inscription"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Consigné au journal d&apos;audit, avec votre nom et la date.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Correction…" : "Corriger l'affectation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
