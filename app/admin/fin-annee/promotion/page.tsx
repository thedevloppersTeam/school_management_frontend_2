"use client"

/**
 * Fin d'année — Promotion des élèves (SPEC-PROMOTION v0.3, § 5 et § 7).
 *
 * Structure reprise de l'écran `fin-annee/promotion` de la branche `Transfer`
 * (sélection, liste, action, rapport), REBRANCHÉE sur l'API § 5 :
 *
 *   1. Délibération (année N) — GET  /api/promotions/preview
 *                               PUT  /api/promotions/decisions
 *   2. Exécution (année N+1)  — POST /api/promotions/execute
 *   3. Annulation             — POST /api/promotions/:decisionId/cancel
 *
 * AUCUN calcul dans le navigateur : la moyenne affichée est celle du serveur,
 * déjà arrondie comme sur le bulletin (RP-18), le seuil n'est pas modifiable
 * (RP-01). Le serveur recontrôle tout ; quand il refuse, l'écran affiche SA
 * raison, mot pour mot.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AlertCircleIcon, CheckCircle2Icon, GraduationCapIcon, InfoIcon } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { clientFetch } from "@/lib/client-fetch"
import { toMessage } from "@/lib/errors"
import {
  fetchAllAcademicYears, fetchClassSessions, getClassSessionName,
  type AcademicYear, type ClassSession,
} from "@/lib/api/dashboard"
import {
  OUTCOMES, OUTCOME_LABEL,
  cancelPromotion, executePromotions, fetchPromotionPreview, savePromotionDecisions,
  type DecisionInput, type ExecuteResult, type Outcome, type PreviewStudent, type PromotionPreview,
} from "@/lib/api/promotions"
import {
  destinationFor, needsTrackChoice, nextYearOf, requiredFields,
  type LevelInfo, type SessionInfo,
} from "@/lib/promotion/screen"

interface Draft {
  finalOutcome: Outcome | ""
  overrideReason: string
  conditionText: string
  unblockReason: string
}
interface ExecDraft {
  selected: boolean
  targetClassSessionId: string
  trackId: string
}
interface Track { id: string; code: string; name: string }

const toSessionInfo = (s: ClassSession): SessionInfo => ({
  id: s.id,
  label: getClassSessionName(s),
  classType: s.class.classType,
})

function draftFrom(s: PreviewStudent): Draft {
  const d = s.decision
  return {
    finalOutcome: d?.finalOutcome ?? s.proposedOutcome ?? "",
    overrideReason: d?.overrideReason ?? "",
    conditionText: d?.conditionText ?? "",
    unblockReason: d?.unblockReason ?? "",
  }
}

/** La ligne diffère-t-elle de la décision enregistrée ? (pas de ré-enregistrement à vide) */
function isDirty(s: PreviewStudent, d: Draft): boolean {
  if (!d.finalOutcome) return false
  const saved = s.decision
  if (!saved) return true // décision à créer
  if (saved.state === "executed") return false // figée : annuler d'abord
  return (
    saved.finalOutcome !== d.finalOutcome ||
    (saved.overrideReason ?? "") !== d.overrideReason ||
    (saved.conditionText ?? "") !== d.conditionText ||
    (saved.unblockReason ?? "") !== d.unblockReason
  )
}

const fullName = (s: PreviewStudent) => `${s.lastname.toLocaleUpperCase("fr")} ${s.firstname}`

export default function PromotionPage() {
  const { toast } = useToast()

  const [years, setYears] = useState<AcademicYear[]>([])
  const [yearNId, setYearNId] = useState("")
  const [sessionsN, setSessionsN] = useState<ClassSession[]>([])
  const [sessionsN1, setSessionsN1] = useState<ClassSession[]>([])
  const [sourceSessionId, setSourceSessionId] = useState("")
  const [tracks, setTracks] = useState<Track[]>([])

  const [preview, setPreview] = useState<PromotionPreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [execDrafts, setExecDrafts] = useState<Record<string, ExecDraft>>({})
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({})
  const [execResult, setExecResult] = useState<ExecuteResult | null>(null)
  const [cancelTarget, setCancelTarget] = useState<PreviewStudent | null>(null)
  const [cancelReason, setCancelReason] = useState("")

  const [loadingYears, setLoadingYears] = useState(true)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [busy, setBusy] = useState(false)

  // ── Chargements ────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [all, tr] = await Promise.all([
          fetchAllAcademicYears(),
          clientFetch<Track[]>("/api/class-tracks").catch(() => [] as Track[]),
        ])
        if (cancelled) return
        const sorted = [...all].sort((a, b) => a.startDate.localeCompare(b.startDate))
        setYears(sorted)
        setTracks(tr)
        // Par défaut : l'année en cours est l'année N que l'on délibère.
        setYearNId(sorted.find((y) => y.isCurrent)?.id ?? sorted[0]?.id ?? "")
      } catch (err) {
        toast({ title: "Erreur", description: toMessage(err, "lors du chargement des années"), variant: "destructive" })
      } finally {
        if (!cancelled) setLoadingYears(false)
      }
    })()
    return () => { cancelled = true }
  }, [toast])

  const yearN = years.find((y) => y.id === yearNId)
  const yearN1 = nextYearOf(years, yearN)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [n, n1] = await Promise.all([
        yearNId ? fetchClassSessions(yearNId).catch(() => [] as ClassSession[]) : Promise.resolve([] as ClassSession[]),
        yearN1 ? fetchClassSessions(yearN1.id).catch(() => [] as ClassSession[]) : Promise.resolve([] as ClassSession[]),
      ])
      if (cancelled) return
      setSessionsN([...n].sort((a, b) => getClassSessionName(a).localeCompare(getClassSessionName(b), "fr", { numeric: true })))
      setSessionsN1(n1)
    })()
    return () => { cancelled = true }
  }, [yearNId, yearN1])

  const loadPreview = useCallback(async (sessionId: string) => {
    setExecResult(null)
    setSaveErrors({})
    if (!sessionId) { setPreview(null); setPreviewError(null); return }
    setLoadingPreview(true)
    try {
      const data = await fetchPromotionPreview(sessionId)
      setPreview(data)
      setPreviewError(null)
      setDrafts(Object.fromEntries(data.students.map((s) => [s.enrollmentId, draftFrom(s)])))
      setExecDrafts(Object.fromEntries(data.students.map((s) => [s.enrollmentId, { selected: false, targetClassSessionId: "", trackId: "" }])))
    } catch (err) {
      // RP-08 (étapes non closes) arrive ici en 409 : message du serveur tel quel.
      setPreview(null)
      setPreviewError(toMessage(err, "lors du chargement de la délibération"))
    } finally {
      setLoadingPreview(false)
    }
  }, [])

  // Chargé sur le GESTE (choix de salle), pas dans un effet.
  const chooseSession = (id: string) => { setSourceSessionId(id); void loadPreview(id) }
  const chooseYear = (id: string) => { setYearNId(id); chooseSession("") }

  // ── Dérivés ────────────────────────────────────────────────────────────────

  const sourceSession = sessionsN.find((s) => s.id === sourceSessionId)
  const sourceLevel: LevelInfo | undefined = sourceSession?.class.classType
  const n1Infos = useMemo(() => sessionsN1.map(toSessionInfo), [sessionsN1])
  const students = useMemo(() => preview?.students ?? [], [preview])
  const dirty = students.filter((s) => drafts[s.enrollmentId] && isDirty(s, drafts[s.enrollmentId]))
  const executable = students.filter((s) => s.decision && s.decision.state !== "executed")
  const selectedExec = executable.filter((s) => execDrafts[s.enrollmentId]?.selected)
  const nameOfDecision = (decisionId: string) => {
    const s = students.find((x) => x.decision?.id === decisionId)
    return s ? fullName(s) : decisionId
  }

  const setDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  const setExec = (id: string, patch: Partial<ExecDraft>) =>
    setExecDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))

  // ── Actions ────────────────────────────────────────────────────────────────

  const saveDecisions = async () => {
    if (!preview || dirty.length === 0) return
    setBusy(true)
    setSaveErrors({})
    try {
      const payload: DecisionInput[] = dirty.map((s) => {
        const d = drafts[s.enrollmentId]
        return {
          enrollmentId: s.enrollmentId,
          finalOutcome: d.finalOutcome as Outcome,
          ...(d.overrideReason.trim() && { overrideReason: d.overrideReason.trim() }),
          ...(d.conditionText.trim() && { conditionText: d.conditionText.trim() }),
          ...(d.unblockReason.trim() && { unblockReason: d.unblockReason.trim() }),
        }
      })
      const res = await savePromotionDecisions(preview.classSessionId, payload)
      if (!res.ok) {
        setSaveErrors(Object.fromEntries(res.errors.map((e) => [e.enrollmentId, e.message])))
        toast({ title: "Décisions refusées", description: res.message, variant: "destructive" })
        return
      }
      toast({ title: "Décisions enregistrées", description: `${res.decisions.length} décision(s).` })
      await loadPreview(preview.classSessionId)
    } catch (err) {
      toast({ title: "Erreur", description: toMessage(err, "lors de l'enregistrement"), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const execute = async () => {
    if (!preview || selectedExec.length === 0) return
    setBusy(true)
    try {
      const items = selectedExec.map((s) => {
        const e = execDrafts[s.enrollmentId]
        return {
          decisionId: s.decision!.id,
          ...(e.targetClassSessionId && { targetClassSessionId: e.targetClassSessionId }),
          ...(e.trackId && { trackId: e.trackId }),
        }
      })
      const res = await executePromotions(items)
      setExecResult(res)
      toast({
        title: res.excluded.length === 0 ? "Exécution terminée" : "Exécution partielle",
        description: `${res.executed.length} exécuté(s), ${res.excluded.length} exclu(s).`,
        variant: res.executed.length === 0 ? "destructive" : undefined,
      })
      await loadPreview(preview.classSessionId)
      setExecResult(res) // posé APRÈS le rechargement, qui l'efface
    } catch (err) {
      toast({ title: "Erreur", description: toMessage(err, "lors de l'exécution"), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const confirmCancel = async () => {
    const target = cancelTarget
    setCancelTarget(null)
    if (!target?.decision || !preview) return
    setBusy(true)
    try {
      await cancelPromotion(target.decision.id, cancelReason.trim() || undefined)
      toast({ title: "Promotion annulée", description: fullName(target) })
      await loadPreview(preview.classSessionId)
    } catch (err) {
      // RP-14 / RP-21 / RP-22 : refus 409 avec la raison du serveur.
      toast({ title: "Annulation refusée", description: toMessage(err, "lors de l'annulation"), variant: "destructive" })
    } finally {
      setBusy(false)
      setCancelReason("")
    }
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 font-serif text-2xl font-bold tracking-tight text-neutral-900">
          <GraduationCapIcon className="h-6 w-6 text-neutral-500" />
          Promotion des élèves
        </h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Délibérez salle par salle sur la moyenne annuelle calculée par le serveur, puis exécutez le passage vers
          l&apos;année suivante. Seuil de réussite : {preview?.threshold ?? "7.00"} / 10.
        </p>
      </div>

      {/* ── 1. Salle ── */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">1. Salle de l&apos;année délibérée</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {loadingYears ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Année N</Label>
                <Select value={yearNId} onValueChange={chooseYear}>
                  <SelectTrigger><SelectValue placeholder="Année" /></SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y.id} value={y.id}>{y.yearString}{y.isCurrent ? " (en cours)" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Salle</Label>
                <Select value={sourceSessionId} onValueChange={chooseSession} disabled={!yearNId}>
                  <SelectTrigger><SelectValue placeholder="Choisir une salle" /></SelectTrigger>
                  <SelectContent>
                    {sessionsN.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{getClassSessionName(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {yearN && (
            <div className="flex items-start gap-2 rounded-md border border-info-border bg-info-soft p-3 text-sm text-info-ink">
              <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {yearN1
                  ? <>Année N+1 : <strong>{yearN1.yearString}</strong>. Les élèves promus y démarrent sans notes ; leur inscription et leurs bulletins de {yearN.yearString} sont conservés.</>
                  : <>Aucune année ne suit {yearN.yearString} : la délibération est possible, l&apos;exécution sera refusée par le serveur tant que l&apos;année N+1 n&apos;existe pas.</>}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {sourceSessionId && previewError && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-error-border bg-error-soft p-3 text-sm text-error-ink">
          <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{previewError}</span>
        </div>
      )}

      {/* ── 2. Délibération ── */}
      {sourceSessionId && !previewError && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              2. Délibération {preview ? `— ${preview.className}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {preview && preview.unmappedSubjects.length > 0 && (
              <div className="rounded-md border border-warning-border bg-warning-soft p-3 text-sm text-warning-ink">
                Matières hors calcul (rubrique non rattachée à R1/R2/R3) :{" "}
                {preview.unmappedSubjects.map((u) => u.name).join(", ")}.
              </div>
            )}
            {loadingPreview ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : students.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Aucun élève actif dans cette salle.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Élève</TableHead>
                      <TableHead className="text-right">Moyenne</TableHead>
                      <TableHead>Proposée</TableHead>
                      <TableHead>Issue retenue</TableHead>
                      <TableHead>Motif</TableHead>
                      <TableHead>Décision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s) => {
                      const d = drafts[s.enrollmentId] ?? draftFrom(s)
                      const locked = s.decision?.state === "executed"
                      const req = d.finalOutcome ? requiredFields(s, d.finalOutcome) : null
                      const error = saveErrors[s.enrollmentId]
                      return (
                        <TableRow key={s.enrollmentId} className="align-top">
                          <TableCell className="font-medium">
                            {fullName(s)}
                            {s.state === "blocked" && (
                              <div className="mt-1 space-y-0.5 text-xs font-normal text-warning-ink">
                                <p>Bloqué : {s.blockReason}</p>
                                {s.missing.slice(0, 4).map((m, i) => (
                                  <p key={i}>— {m.stepName} · {m.subjectName}{m.sectionName ? ` · ${m.sectionName}` : ""}</p>
                                ))}
                                {s.missing.length > 4 && <p>… et {s.missing.length - 4} autre(s)</p>}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {s.annualAverage ?? <span className="font-normal text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            {s.proposedOutcome ? <Badge variant="outline">{OUTCOME_LABEL[s.proposedOutcome]}</Badge> : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="min-w-44">
                            <Select
                              value={d.finalOutcome}
                              onValueChange={(v) => setDraft(s.enrollmentId, { finalOutcome: v as Outcome })}
                              disabled={locked || busy}
                            >
                              <SelectTrigger aria-label={`Issue retenue pour ${fullName(s)}`}><SelectValue placeholder="Choisir" /></SelectTrigger>
                              <SelectContent>
                                {OUTCOMES.map((o) => <SelectItem key={o} value={o}>{OUTCOME_LABEL[o]}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="min-w-60 space-y-1.5">
                            {req?.unblockReason && (
                              <Input
                                placeholder="Motif de déblocage (obligatoire)"
                                value={d.unblockReason}
                                onChange={(e) => setDraft(s.enrollmentId, { unblockReason: e.target.value })}
                                disabled={locked || busy}
                              />
                            )}
                            {req?.overrideReason && (
                              <Input
                                placeholder="Motif de l'écart avec l'issue proposée (obligatoire)"
                                value={d.overrideReason}
                                onChange={(e) => setDraft(s.enrollmentId, { overrideReason: e.target.value })}
                                disabled={locked || busy}
                              />
                            )}
                            {req?.conditionText && (
                              <Input
                                placeholder="Condition (obligatoire)"
                                value={d.conditionText}
                                onChange={(e) => setDraft(s.enrollmentId, { conditionText: e.target.value })}
                                disabled={locked || busy}
                              />
                            )}
                            {error && <p role="alert" className="text-xs text-error-ink">{error}</p>}
                          </TableCell>
                          <TableCell>
                            {!s.decision ? (
                              <span className="text-xs text-muted-foreground">Non enregistrée</span>
                            ) : s.decision.state === "executed" ? (
                              <Badge className="border-success-border bg-success-soft text-success-ink hover:bg-success-soft">Exécutée</Badge>
                            ) : s.decision.state === "cancelled" ? (
                              <Badge variant="outline" className="border-warning-border bg-warning-soft text-warning-ink">Annulée</Badge>
                            ) : (
                              <Badge variant="outline">Enregistrée</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            {students.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{dirty.length} décision(s) à enregistrer.</p>
                <Button onClick={saveDecisions} disabled={busy || dirty.length === 0}>
                  {busy ? "En cours…" : "Enregistrer les décisions"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── 3. Exécution ── */}
      {preview && students.some((s) => s.decision) && sourceLevel && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">3. Exécution vers {yearN1?.yearString ?? "l'année N+1"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"><span className="sr-only">Sélection</span></TableHead>
                    <TableHead>Élève</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Filière</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.filter((s) => s.decision).map((s) => {
                    const dec = s.decision!
                    const e = execDrafts[s.enrollmentId] ?? { selected: false, targetClassSessionId: "", trackId: "" }
                    const dest = destinationFor(dec.finalOutcome, sourceLevel, n1Infos)
                    const target = n1Infos.find((t) => t.id === e.targetClassSessionId)
                    const trackChoice = needsTrackChoice(dec.finalOutcome, sourceLevel, target)
                    const executed = dec.state === "executed"
                    return (
                      <TableRow key={s.enrollmentId}>
                        <TableCell>
                          {!executed && (
                            <Checkbox
                              checked={e.selected}
                              onCheckedChange={(v) => setExec(s.enrollmentId, { selected: v === true })}
                              aria-label={`Exécuter ${fullName(s)}`}
                              disabled={busy}
                            />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{fullName(s)}</TableCell>
                        <TableCell><Badge variant="outline">{OUTCOME_LABEL[dec.finalOutcome]}</Badge></TableCell>
                        <TableCell className="min-w-48">
                          {executed ? (
                            <span className="text-sm text-muted-foreground">
                              {dec.nextEnrollmentId ? "Inscrit en N+1" : dest.kind === "graduate" ? "Sorti diplômé" : "Aucune inscription N+1"}
                            </span>
                          ) : dest.kind === "none" ? (
                            <span className="text-sm text-muted-foreground">Aucune inscription N+1 (admis ailleurs)</span>
                          ) : dest.kind === "graduate" ? (
                            <span className="text-sm text-muted-foreground">Sortie : inscription passée « diplômé »</span>
                          ) : dest.sessions.length === 0 ? (
                            <span className="text-sm text-warning-ink">Aucune salle du niveau attendu en N+1</span>
                          ) : (
                            <Select
                              value={e.targetClassSessionId}
                              onValueChange={(v) => setExec(s.enrollmentId, { targetClassSessionId: v, trackId: "" })}
                              disabled={busy}
                            >
                              <SelectTrigger aria-label={`Salle cible pour ${fullName(s)}`}><SelectValue placeholder="Salle cible" /></SelectTrigger>
                              <SelectContent>
                                {dest.sessions.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="min-w-40">
                          {!executed && trackChoice ? (
                            <Select value={e.trackId} onValueChange={(v) => setExec(s.enrollmentId, { trackId: v })} disabled={busy}>
                              <SelectTrigger aria-label={`Filière pour ${fullName(s)}`}><SelectValue placeholder="Filière (obligatoire)" /></SelectTrigger>
                              <SelectContent>
                                {tracks.map((t) => <SelectItem key={t.id} value={t.id}>{t.code} — {t.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {sourceLevel.hasTrack && s.trackId ? "Reprise de N" : "—"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {executed && (
                            <Button variant="outline" size="sm" onClick={() => setCancelTarget(s)} disabled={busy}>
                              Annuler
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {selectedExec.length} élève(s) sélectionné(s) sur {executable.length} exécutable(s). Les élèves non
                exécutables sont exclus par le serveur et listés avec leur raison ; les autres passent en une seule transaction.
              </p>
              <Button onClick={execute} disabled={busy || selectedExec.length === 0}>
                {busy ? "En cours…" : `Exécuter ${selectedExec.length} décision(s)`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Rapport d'exécution ── */}
      {execResult && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2Icon className="h-4 w-4 text-success-ink" />
              Rapport d&apos;exécution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{execResult.executed.length} décision(s) exécutée(s).</p>
            {execResult.excluded.length > 0 && (
              <div className="rounded-md border border-warning-border bg-warning-soft p-3 text-warning-ink">
                <p className="mb-2 font-medium">{execResult.excluded.length} élève(s) exclu(s) :</p>
                <ul className="space-y-1">
                  {execResult.excluded.map((x) => (
                    <li key={x.decisionId}>• <strong>{nameOfDecision(x.decisionId)}</strong> — {x.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) { setCancelTarget(null); setCancelReason("") } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler la promotion</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  L&apos;exécution pour <strong>{cancelTarget ? fullName(cancelTarget) : ""}</strong> sera annulée :
                  l&apos;inscription N+1 est supprimée, l&apos;inscription N reste intacte. Le serveur refuse si
                  l&apos;inscription N+1 porte déjà une note, une note de comportement ou un bulletin archivé.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="cancel-reason" className="text-xs font-medium text-muted-foreground">Motif (facultatif)</Label>
                  <Input id="cancel-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel}>Annuler la promotion</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
