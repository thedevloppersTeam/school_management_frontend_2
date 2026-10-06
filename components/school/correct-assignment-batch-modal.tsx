"use client"

// Correction d'affectation EN LOT — même geste que la correction unitaire,
// appliqué à une sélection d'élèves.
//
// Le geste unitaire ne traitait qu'un élève, alors que le cas réel à l'origine
// de ce travail était un GROUPE d'élèves mis dans la mauvaise salle.
//
// Trois propriétés que cet écran doit rendre lisibles avant toute confirmation :
//
//   TOUT OU RIEN     un seul élève bloqué, et rien n'est écrit. Le détail par
//                    élève est donc la seule information qui compte : qui
//                    passe, qui bloque, et pour quelle matière nommément.
//   UN LOT = UN MODE la filière vit sur l'inscription, pas sur la salle. Une
//                    même salle héberge des élèves de filières différentes,
//                    donc une sélection peut mélanger MODE A et MODE B. Le lot
//                    mixte est refusé : un seul acquittement ne peut pas
//                    couvrir la destruction des notes d'une partie des élèves.
//   R7, CAPACITÉ     le total après correction doit tenir dans la capacité de
//                    la salle cible.

import { useCallback, useEffect, useMemo, useState } from "react"
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
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  InfoIcon,
  XCircleIcon,
} from "lucide-react"
import {
  BATCH_MAX_ENROLLMENTS,
  correctAssignmentBatch,
  fetchBatchCorrectionPreview,
  type BatchCorrectionPreview,
  type BatchPreviewStudent,
} from "@/lib/api/enrollment-corrections"
import type { CorrectionSessionOption } from "@/components/school/correct-assignment-modal"

/** Un élève de la sélection, tel que la liste le connaît déjà. */
export interface BatchCorrectionStudent {
  enrollmentId:   string
  studentName:    string
  classSessionId: string
  className:      string
  classTypeId?:   string
}

interface TrackOption {
  id:   string
  code: string
  name: string
}

interface ApiClassSubjectLite {
  trackId: string | null
  track:   TrackOption | null
}

interface Props {
  open:         boolean
  onOpenChange: (open: boolean) => void
  students:     BatchCorrectionStudent[]
  sessions:     CorrectionSessionOption[]
  onCorrected?: () => void
}

const NO_TRACK = "__none__"

export function CorrectAssignmentBatchModal({
  open,
  onOpenChange,
  students,
  sessions,
  onCorrected,
}: Props) {
  const { toast } = useToast()

  const [targetSessionId, setTargetSessionId] = useState("")
  const [targetTrackId, setTargetTrackId] = useState<string>(NO_TRACK)

  const [tracks, setTracks] = useState<TrackOption[]>([])
  const [tracksLoading, setTracksLoading] = useState(false)

  const [preview, setPreview] = useState<BatchCorrectionPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // L'acquittement porte sur un impact PRECIS. Plutot que de le remettre a zero
  // dans un effet — ce qui declenche un rendu en cascade — on retient la
  // selection pour laquelle il a ete donne. Changer de salle ou de filiere
  // change la cle, et l'acquittement cesse de valoir sans qu'on ait rien a
  // reinitialiser.
  const [acknowledgedFor, setAcknowledgedFor] = useState<string | null>(null)
  const selectionKey = `${targetSessionId}|${targetTrackId}`
  const acknowledge = acknowledgedFor === selectionKey

  const enrollmentIds = useMemo(
    () => students.map(s => s.enrollmentId),
    [students],
  )

  // R1 impose le même niveau que la salle d'origine. Quand la sélection tient
  // dans un seul niveau, on ne propose que des cibles recevables ; quand elle
  // en mélange plusieurs, on ne filtre pas — l'aperçu nommera les élèves que
  // R1 refuse, ce qui est plus explicite qu'une liste de cibles amputée.
  const levels = useMemo(
    () => new Set(students.map(s => s.classTypeId).filter(Boolean) as string[]),
    [students],
  )
  const candidates = levels.size === 1
    ? sessions.filter(s => s.classTypeId === [...levels][0])
    : sessions

  const overCap = students.length > BATCH_MAX_ENROLLMENTS

  // ── Filières enseignées dans la salle cible ──────────────────────────────
  useEffect(() => {
    // Pas de setTracks sur la branche de garde : la liste affichee est derivee
    // plus bas, et ecrire ici provoquerait un rendu en cascade.
    if (!open || !targetSessionId) return

    let cancelled = false
    setTracksLoading(true)

    fetch(`/api/class-subjects?classSessionId=${targetSessionId}`, {
      credentials: "include",
    })
      .then(r => (r.ok ? r.json() : []))
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

    return () => { cancelled = true }
  }, [open, targetSessionId])

  // ── Aperçu, à chaque changement de sélection ─────────────────────────────
  const loadPreview = useCallback(
    async (sessionId: string, trackId: string) => {
      if (!sessionId || enrollmentIds.length === 0 || overCap) {
        setPreview(null)
        setPreviewError(null)
        return
      }

      setPreviewLoading(true)
      setPreviewError(null)
      try {
        const data = await fetchBatchCorrectionPreview(
          enrollmentIds,
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
    [enrollmentIds, overCap],
  )

  useEffect(() => {
    if (!open) return
    void loadPreview(targetSessionId, targetTrackId)
  }, [open, targetSessionId, targetTrackId, loadPreview])

  // Les filières chargées ne valent que pour la salle sélectionnée.
  const visibleTracks = targetSessionId ? tracks : []

  // Changer de salle invalide la filière retenue : elle n'y est pas forcément
  // enseignée.
  const handleSessionChange = (value: string) => {
    setTargetSessionId(value)
    setTargetTrackId(NO_TRACK)
  }

  const lot = preview?.lot ?? null
  const isModeB = lot?.mode === "B"
  const reasonFilled = reason.trim().length > 0

  const canSubmit =
    !!preview &&
    !!lot?.canCorrect &&
    reasonFilled &&
    (!isModeB || acknowledge) &&
    !previewLoading &&
    !submitting &&
    !overCap

  const handleSubmit = async () => {
    if (!canSubmit || !preview?.target) return

    setSubmitting(true)
    try {
      const result = await correctAssignmentBatch({
        enrollmentIds,
        targetClassSessionId: preview.target.classSessionId,
        targetTrackId: preview.target.trackId,
        reason: reason.trim(),
        acknowledgeDataLoss: isModeB ? acknowledge : undefined,
      })

      toast({
        title: "Affectations corrigées",
        description:
          result.applied.gradesDeleted > 0
            ? `${result.count} élève(s) → ${preview.target.className}. ${result.applied.gradesDeleted} note(s) supprimée(s).`
            : `${result.count} élève(s) → ${preview.target.className}. ${result.applied.gradesMoved} note(s) déplacée(s).`,
      })

      onOpenChange(false)
      onCorrected?.()
    } catch (err) {
      // Tout ou rien : un refus signifie qu'aucune écriture n'a eu lieu.
      toast({
        title: "Correction refusée — aucun élève déplacé",
        description:
          err instanceof Error ? err.message : "La correction n'a pas pu être appliquée",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const rows: BatchPreviewStudent[] = preview?.students ?? []
  const nameOf = (row: BatchPreviewStudent) =>
    row.studentName ??
    students.find(s => s.enrollmentId === row.enrollmentId)?.studentName ??
    "Élève inconnu"

  const gradesToDelete = rows.flatMap(row =>
    row.gradesToDelete.map(g => ({ ...g, studentName: nameOf(row) })),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-xl bg-white">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-bold tracking-tight text-neutral-900">
            Corriger l&apos;affectation de {students.length} élève
            {students.length > 1 ? "s" : ""}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Tout ou rien : si un seul élève est bloqué, aucun n&apos;est déplacé.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Rappel du geste : ce n'est pas un transfert. */}
          <div className="flex gap-2 rounded-lg bg-slate-100 px-3.5 py-2.5 text-xs text-slate-600">
            <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              À utiliser quand ces élèves n&apos;ont <strong>jamais</strong> appartenu
              à la salle enregistrée : une erreur de saisie à l&apos;inscription.
              S&apos;ils y étaient réellement et quittent l&apos;établissement,
              enregistrez leur départ.
            </span>
          </div>

          {overCap && (
            <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive">
              <XCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {students.length} élèves sélectionnés, le maximum est de{" "}
                {BATCH_MAX_ENROLLMENTS} par lot. Réduisez la sélection et
                recommencez en plusieurs fois.
              </span>
            </div>
          )}

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
                {candidates.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {levels.size > 1 && (
              <p className="text-xs text-muted-foreground">
                La sélection mélange {levels.size} niveaux. Les élèves d&apos;un
                autre niveau que la salle cible seront nommés ci-dessous, la
                règle R1 les refuse.
              </p>
            )}
          </div>

          {/* Filière : masquée si la salle cible n'en enseigne aucune. */}
          {targetSessionId && (tracksLoading || visibleTracks.length > 0) && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Filière cible</Label>
              <Select value={targetTrackId} onValueChange={setTargetTrackId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={tracksLoading ? "Chargement…" : "Sans filière"}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TRACK}>Sans filière</SelectItem>
                  {visibleTracks.map(t => (
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

          {previewError && (
            <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive">
              <XCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{previewError}</span>
            </div>
          )}

          {/* ── Blocages du lot : MIXED_MODE et R7 ────────────────────────── */}
          {lot && lot.blockers.length > 0 && (
            <div className="space-y-1.5 rounded-lg border border-destructive/40 bg-destructive/5 px-3.5 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
                <XCircleIcon className="h-4 w-4 shrink-0" />
                Ce lot ne peut pas être corrigé
              </p>
              <ul className="space-y-1 pl-6 text-xs text-destructive">
                {lot.blockers.map((b, i) => (
                  <li key={`${b.rule}-${i}`}>
                    <span className="font-medium">{b.rule}</span> — {b.detail}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Détail par élève ──────────────────────────────────────────── */}
          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Label className="text-sm font-medium">Détail par élève</Label>
                {lot && (
                  <span className="text-xs text-muted-foreground">
                    {lot.count - lot.blockedStudents} passe
                    {lot.count - lot.blockedStudents > 1 ? "nt" : ""} ·{" "}
                    {lot.blockedStudents} bloqué
                    {lot.blockedStudents > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Élève</TableHead>
                      <TableHead>Salle actuelle</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Verdict</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(row => (
                      <TableRow key={row.enrollmentId}>
                        <TableCell className="font-medium">{nameOf(row)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.current?.className ?? "—"}
                          {row.current?.trackName ? ` · ${row.current.trackName}` : ""}
                        </TableCell>
                        <TableCell>
                          {row.mode === "A" && (
                            <span className="text-xs">A — notes conservées</span>
                          )}
                          {row.mode === "B" && (
                            <span className="text-xs font-medium text-destructive">
                              B — notes supprimées
                            </span>
                          )}
                          {row.mode === null && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.canCorrect ? (
                            <span className="flex items-center gap-1.5 text-xs text-emerald-700">
                              <CheckCircle2Icon className="h-3.5 w-3.5 shrink-0" />
                              {row.mode === "A"
                                ? `${row.impact?.gradesMoved ?? 0} note(s) déplacée(s)`
                                : `${row.impact?.gradesDeleted ?? 0} note(s) supprimée(s)`}
                            </span>
                          ) : (
                            <ul className="space-y-0.5 text-xs text-destructive">
                              {row.blockers.map((b, i) => (
                                <li key={`${row.enrollmentId}-${b.rule}-${i}`}>
                                  <span className="font-medium">{b.rule}</span>
                                  {b.subjectName ? ` · ${b.subjectName}` : ""} — {b.detail}
                                </li>
                              ))}
                            </ul>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* ── MODE B : les notes détruites, nommément ───────────────────── */}
          {isModeB && gradesToDelete.length > 0 && (
            <div className="space-y-2">
              <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
                <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Changer de filière efface <strong>toutes</strong> les notes de
                  l&apos;année de ces élèves. Le journal en conserve la copie
                  intégrale, mais un bulletin déjà remis ne sera plus régénérable
                  automatiquement.
                </span>
              </div>

              <div className="max-h-56 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Élève</TableHead>
                      <TableHead>Matière</TableHead>
                      <TableHead>Étape</TableHead>
                      <TableHead className="text-right">Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gradesToDelete.map((g, i) => (
                      <TableRow key={`${g.studentName}-${g.subjectName}-${g.stepName}-${i}`}>
                        <TableCell className="font-medium">{g.studentName}</TableCell>
                        <TableCell>{g.subjectName}</TableCell>
                        <TableCell className="text-muted-foreground">{g.stepName}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {g.studentScore}
                          {g.maxScore ? ` / ${g.maxScore}` : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* ── Avertissements non bloquants ──────────────────────────────── */}
          {rows.some(r => r.warnings.length > 0) && (
            <ul className="space-y-1 rounded-lg bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
              {rows.flatMap(row =>
                row.warnings.map((w, i) => (
                  <li key={`${row.enrollmentId}-${w.code}-${i}`}>
                    <span className="font-medium">{nameOf(row)}</span> — {w.detail}
                  </li>
                )),
              )}
            </ul>
          )}

          <Separator />

          {/* ── Motif, commun au lot ──────────────────────────────────────── */}
          <div className="space-y-2">
            <Label htmlFor="batch-reason" className="text-sm font-medium">
              Motif <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="batch-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Erreur de saisie à l'inscription"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Recopié sur l&apos;entrée de journal de chaque élève. Le journal est
              en ajout seul.
            </p>
          </div>

          {isModeB && (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5">
              <Checkbox
                checked={acknowledge}
                onCheckedChange={v => setAcknowledgedFor(v === true ? selectionKey : null)}
                className="mt-0.5"
              />
              <span className="text-xs text-amber-900">
                Je confirme la suppression des {lot?.totals.gradesDeleted ?? 0} note(s)
                listées ci-dessus, pour les {lot?.count ?? 0} élèves du lot.
              </span>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Correction en cours…" : "Corriger l'affectation"}
            {!submitting && <ArrowRightIcon className="ml-1.5 h-4 w-4" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
