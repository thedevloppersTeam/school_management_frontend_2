"use client"

/**
 * Fin d'année — Promotion des élèves.
 *
 * On choisit une salle de l'année écoulée : chaque élève apparaît avec sa
 * moyenne générale annuelle (calculée côté serveur) et son statut face au
 * seuil. Le seuil ne fait que PRÉ-COCHER les admis : la directrice reste
 * libre de promouvoir un élève sous le seuil (passage forcé) ou de le laisser
 * de côté, et de choisir la salle d'arrivée — même niveau (redoublement) ou
 * niveau supérieur.
 */

import { useState, useEffect, useCallback } from "react"
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
import { GraduationCapIcon, AlertCircleIcon, CheckCircle2Icon, InfoIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import {
  fetchAllAcademicYears, fetchClassSessions, getClassSessionName,
  type AcademicYear, type ClassSession,
} from "@/lib/api/dashboard"
import {
  fetchPromotionPreview, promoteStudents,
  type PromotionPreview, type PromotionResult,
} from "@/lib/api/promotions"

const DEFAULT_THRESHOLD = 7

export default function PromotionPage() {
  const { toast } = useToast()

  const [years, setYears] = useState<AcademicYear[]>([])
  const [sourceYearId, setSourceYearId] = useState<string>("")
  const [targetYearId, setTargetYearId] = useState<string>("")
  const [sourceSessions, setSourceSessions] = useState<ClassSession[]>([])
  const [targetSessions, setTargetSessions] = useState<ClassSession[]>([])
  const [sourceSessionId, setSourceSessionId] = useState<string>("")
  const [targetSessionId, setTargetSessionId] = useState<string>("")

  // `threshold` suit la saisie ; `appliedThreshold` ne change qu'au clic sur
  // « Appliquer » — sinon chaque frappe relancerait un calcul serveur.
  const [threshold, setThreshold] = useState<number>(DEFAULT_THRESHOLD)
  const [appliedThreshold, setAppliedThreshold] = useState<number>(DEFAULT_THRESHOLD)
  const [preview, setPreview] = useState<PromotionPreview | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [loadingYears, setLoadingYears] = useState(true)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [result, setResult] = useState<PromotionResult | null>(null)

  // ── Chargements ────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const all = await fetchAllAcademicYears()
        if (cancelled) return
        const sorted = [...all].sort((a, b) => a.yearString.localeCompare(b.yearString))
        setYears(sorted)
        // Par défaut : source = année précédant l'année courante, cible = courante.
        const currentIdx = sorted.findIndex((y) => y.isCurrent)
        if (currentIdx > 0) {
          setSourceYearId(sorted[currentIdx - 1].id)
          setTargetYearId(sorted[currentIdx].id)
        } else if (sorted.length >= 2) {
          setSourceYearId(sorted[sorted.length - 2].id)
          setTargetYearId(sorted[sorted.length - 1].id)
        }
      } catch {
        toast({ title: "Erreur", description: "Impossible de charger les années scolaires", variant: "destructive" })
      } finally {
        if (!cancelled) setLoadingYears(false)
      }
    })()
    return () => { cancelled = true }
  }, [toast])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!sourceYearId) { if (!cancelled) setSourceSessions([]); return }
      try {
        const s = await fetchClassSessions(sourceYearId)
        if (!cancelled) setSourceSessions(s)
      } catch { if (!cancelled) setSourceSessions([]) }
    })()
    return () => { cancelled = true }
  }, [sourceYearId])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!targetYearId) { if (!cancelled) setTargetSessions([]); return }
      try {
        const s = await fetchClassSessions(targetYearId)
        if (!cancelled) setTargetSessions(s)
      } catch { if (!cancelled) setTargetSessions([]) }
    })()
    return () => { cancelled = true }
  }, [targetYearId])

  // Changer de salle source réinitialise la sélection : garder des cases
  // cochées d'une autre salle mènerait à promouvoir des élèves invisibles.
  const loadPreview = useCallback(async (sessionId: string, thr: number) => {
    if (!sessionId) { setPreview(null); setSelected(new Set()); return }
    setLoadingPreview(true)
    setResult(null)
    try {
      const data = await fetchPromotionPreview(sessionId, thr)
      setPreview(data)
      setSelected(new Set(data.students.filter((s) => s.eligible).map((s) => s.enrollmentId)))
    } catch (err) {
      setPreview(null)
      setSelected(new Set())
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Chargement impossible",
        variant: "destructive",
      })
    } finally {
      setLoadingPreview(false)
    }
  }, [toast])

  useEffect(() => {
    void (async () => { await loadPreview(sourceSessionId, appliedThreshold) })()
  }, [sourceSessionId, appliedThreshold, loadPreview])

  // ── Dérivés ────────────────────────────────────────────────────────────────

  const students = preview?.students ?? []
  const allChecked = students.length > 0 && students.every((s) => selected.has(s.enrollmentId))
  const targetSession = targetSessions.find((s) => s.id === targetSessionId)
  const sameYear = sourceYearId !== "" && sourceYearId === targetYearId

  const canSubmit =
    selected.size > 0 && !!targetSessionId && !sameYear && !submitting && !loadingPreview

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected(allChecked ? new Set() : new Set(students.map((s) => s.enrollmentId)))
  }

  const selectEligible = () => {
    setSelected(new Set(students.filter((s) => s.eligible).map((s) => s.enrollmentId)))
  }

  const applyThreshold = () => { setAppliedThreshold(threshold) }

  const submit = async () => {
    setConfirmOpen(false)
    setSubmitting(true)
    try {
      const items = [...selected].map((enrollmentId) => ({
        enrollmentId,
        targetClassSessionId: targetSessionId,
      }))
      const res = await promoteStudents(items)
      setResult(res)
      toast({
        title: res.skippedCount === 0 ? "Promotion terminée" : "Promotion partielle",
        description: res.message,
        variant: res.promotedCount === 0 ? "destructive" : undefined,
      })
      // Recharger : les élèves déjà promus seront refusés au prochain essai.
      await loadPreview(sourceSessionId, appliedThreshold)
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Promotion impossible",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const yearLabel = (id: string) => years.find((y) => y.id === id)?.yearString ?? "—"

  // ── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary-600 flex items-center gap-2">
          <GraduationCapIcon className="h-6 w-6" />
          Promotion des élèves
        </h1>
        <p className="text-sm text-neutral-600 mt-1">
          Transférez une promotion entière vers l&apos;année suivante. Le seuil pré-coche les
          élèves admis — vous restez libre de modifier la sélection.
        </p>
      </div>

      {/* ── Sélection source / cible ── */}
      <Card>
        <CardHeader><CardTitle className="text-base">1. Choisir la salle de départ et la salle d&apos;arrivée</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {loadingYears ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-wide text-neutral-500">Année de départ</Label>
                <Select value={sourceYearId} onValueChange={(v) => { setSourceYearId(v); setSourceSessionId("") }}>
                  <SelectTrigger><SelectValue placeholder="Année écoulée" /></SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y.id} value={y.id}>
                        {y.yearString}{y.isCurrent ? " (en cours)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sourceSessionId} onValueChange={setSourceSessionId} disabled={!sourceYearId}>
                  <SelectTrigger><SelectValue placeholder="Salle de départ" /></SelectTrigger>
                  <SelectContent>
                    {sourceSessions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{getClassSessionName(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-wide text-neutral-500">Année d&apos;arrivée</Label>
                <Select value={targetYearId} onValueChange={(v) => { setTargetYearId(v); setTargetSessionId("") }}>
                  <SelectTrigger><SelectValue placeholder="Nouvelle année" /></SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y.id} value={y.id}>
                        {y.yearString}{y.isCurrent ? " (en cours)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={targetSessionId} onValueChange={setTargetSessionId} disabled={!targetYearId}>
                  <SelectTrigger><SelectValue placeholder="Salle d'arrivée" /></SelectTrigger>
                  <SelectContent>
                    {targetSessions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{getClassSessionName(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {sameYear && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertCircleIcon className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Les deux années sont identiques. Pour déplacer un élève entre deux salles de la
                <strong> même</strong> année (avec ses notes), utilisez le transfert depuis la page
                « Élèves inscrits ».
              </span>
            </div>
          )}

          {targetSession && !sameYear && (
            <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
              <InfoIcon className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Destination : <strong>{getClassSessionName(targetSession)}</strong> — {yearLabel(targetYearId)}.
                Les élèves promus démarrent <strong>sans notes</strong> ; leurs bulletins de{" "}
                {yearLabel(sourceYearId)} restent intacts.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Seuil ── */}
      {sourceSessionId && (
        <Card>
          <CardHeader><CardTitle className="text-base">2. Seuil de réussite</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="threshold" className="text-xs uppercase tracking-wide text-neutral-500">
                  Moyenne minimale (sur 10)
                </Label>
                <Input
                  id="threshold" type="number" min={0} max={10} step={0.5}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-28"
                />
              </div>
              <Button variant="outline" onClick={applyThreshold} disabled={loadingPreview}>
                Appliquer
              </Button>
              <Button variant="ghost" onClick={selectEligible} disabled={loadingPreview || students.length === 0}>
                Cocher les admis
              </Button>
              {preview && (
                <div className="ml-auto flex gap-2 text-sm">
                  <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                    {preview.counts.eligible} admis
                  </Badge>
                  <Badge variant="outline" className="border-red-300 text-red-700">
                    {preview.counts.notEligible} non admis
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Liste des élèves ── */}
      {sourceSessionId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              3. Élèves {preview ? `— ${preview.classSession.className} (${preview.classSession.academicYear})` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPreview ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : students.length === 0 ? (
              <p className="text-sm text-neutral-500 py-6 text-center">
                Aucun élève actif dans cette salle.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Tout sélectionner" />
                      </TableHead>
                      <TableHead>Élève</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Filière</TableHead>
                      <TableHead className="text-right">Moyenne générale</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s) => (
                      <TableRow
                        key={s.enrollmentId}
                        className={cn(selected.has(s.enrollmentId) && "bg-primary-50/50")}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selected.has(s.enrollmentId)}
                            onCheckedChange={() => toggle(s.enrollmentId)}
                            aria-label={`Sélectionner ${s.lastname}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {s.lastname.toLocaleUpperCase("fr")} {s.firstname}
                        </TableCell>
                        <TableCell className="text-neutral-500 text-sm">{s.studentCode}</TableCell>
                        <TableCell>
                          {s.track ? <Badge variant="outline">{s.track.code}</Badge> : <span className="text-neutral-400">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {s.average === null ? (
                            <span className="text-neutral-400 font-normal">aucune note</span>
                          ) : (
                            <span className={s.eligible ? "text-emerald-700" : "text-red-600"}>
                              {s.average.toFixed(2)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {s.average === null ? (
                            <Badge variant="outline" className="border-neutral-300 text-neutral-500">
                              non évalué
                            </Badge>
                          ) : s.eligible ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Admis</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Sous le seuil</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Action ── */}
      {sourceSessionId && students.length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
            <p className="text-sm text-neutral-600">
              <strong>{selected.size}</strong> élève(s) sélectionné(s)
              {targetSession && !sameYear && <> vers <strong>{getClassSessionName(targetSession)}</strong> ({yearLabel(targetYearId)})</>}
            </p>
            <Button onClick={() => setConfirmOpen(true)} disabled={!canSubmit}>
              {submitting ? "Promotion en cours…" : `Promouvoir ${selected.size} élève(s)`}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Rapport ── */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2Icon className="h-5 w-5 text-emerald-600" />
              Rapport de promotion
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{result.message}</p>
            {result.skipped.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
                <p className="text-sm font-medium text-amber-900 mb-2">
                  {result.skipped.length} élève(s) non promu(s) :
                </p>
                <ul className="space-y-1 text-sm text-amber-900">
                  {result.skipped.map((s, i) => (
                    <li key={i}>• <strong>{s.studentName || s.enrollmentId}</strong> — {s.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la promotion</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  <strong>{selected.size}</strong> élève(s) vont être inscrits dans{" "}
                  <strong>{targetSession ? getClassSessionName(targetSession) : "—"}</strong> pour{" "}
                  <strong>{yearLabel(targetYearId)}</strong>.
                </p>
                <p className="text-neutral-600">
                  Leurs inscriptions de {yearLabel(sourceYearId)} et tous leurs bulletins sont
                  conservés. Les nouvelles inscriptions démarrent sans notes.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={submit}>Confirmer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
