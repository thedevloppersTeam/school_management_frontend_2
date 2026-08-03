"use client"

/**
 * Fin d'année — Reprendre la configuration d'une année précédente.
 *
 * Recrée dans l'année cible les salles de l'année source (même niveau, même
 * lettre) et y recopie les matières avec leur professeur, leurs coefficients,
 * leurs notes max et leurs filières. L'opération est idempotente : relancer ne
 * duplique jamais rien, ce qui permet de la rejouer après avoir ajouté une
 * salle.
 */

import { useState, useEffect, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { CopyIcon, AlertCircleIcon, CheckCircle2Icon, InfoIcon } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { fetchAllAcademicYears, type AcademicYear } from "@/lib/api/dashboard"
import {
  fetchConfigurationPreview, copyYearConfiguration,
  type ConfigurationPreviewRow, type CopyConfigurationResult,
} from "@/lib/api/promotions"

export default function ConfigurationPage() {
  const { toast } = useToast()

  const [years, setYears] = useState<AcademicYear[]>([])
  const [sourceYearId, setSourceYearId] = useState<string>("")
  const [targetYearId, setTargetYearId] = useState<string>("")
  const [rows, setRows] = useState<ConfigurationPreviewRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [loadingYears, setLoadingYears] = useState(true)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [result, setResult] = useState<CopyConfigurationResult | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const all = await fetchAllAcademicYears()
        if (cancelled) return
        const sorted = [...all].sort((a, b) => a.yearString.localeCompare(b.yearString))
        setYears(sorted)
        const currentIdx = sorted.findIndex((y) => y.isCurrent)
        if (currentIdx > 0) {
          setSourceYearId(sorted[currentIdx - 1].id)
          setTargetYearId(sorted[currentIdx].id)
        }
      } catch {
        toast({ title: "Erreur", description: "Impossible de charger les années scolaires", variant: "destructive" })
      } finally {
        if (!cancelled) setLoadingYears(false)
      }
    })()
    return () => { cancelled = true }
  }, [toast])

  const loadPreview = useCallback(async (src: string, tgt: string) => {
    if (!src || !tgt || src === tgt) { setRows([]); setSelected(new Set()); return }
    setLoadingPreview(true)
    setResult(null)
    try {
      const data = await fetchConfigurationPreview(src, tgt)
      setRows(data.sessions)
      // Pré-cocher ce qui apporte réellement quelque chose : une salle absente
      // de la cible, ou présente mais encore sans matières.
      setSelected(new Set(
        data.sessions
          .filter((r) => r.subjectCount > 0 && (!r.alreadyExistsInTarget || r.targetSubjectCount === 0))
          .map((r) => r.classId),
      ))
    } catch (err) {
      setRows([])
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
    void (async () => { await loadPreview(sourceYearId, targetYearId) })()
  }, [sourceYearId, targetYearId, loadPreview])

  const sameYear = sourceYearId !== "" && sourceYearId === targetYearId
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.classId))
  const yearLabel = (id: string) => years.find((y) => y.id === id)?.yearString ?? "—"

  const toggle = (classId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(classId)) next.delete(classId)
      else next.add(classId)
      return next
    })
  }
  const toggleAll = () => {
    setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.classId)))
  }

  const submit = async () => {
    setConfirmOpen(false)
    setSubmitting(true)
    try {
      const res = await copyYearConfiguration({
        sourceAcademicYearId: sourceYearId,
        targetAcademicYearId: targetYearId,
        classIds: [...selected],
      })
      setResult(res)
      toast({ title: "Copie terminée", description: res.message })
      await loadPreview(sourceYearId, targetYearId)
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Copie impossible",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const totalSubjects = rows
    .filter((r) => selected.has(r.classId))
    .reduce((sum, r) => sum + r.subjectCount, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary-600 flex items-center gap-2">
          <CopyIcon className="h-6 w-6" />
          Reprendre une année
        </h1>
        <p className="text-sm text-neutral-600 mt-1">
          Recopiez les salles et les matières d&apos;une année précédente vers une nouvelle
          année, sans tout ressaisir.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">1. Année à copier</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {loadingYears ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-neutral-500">Copier depuis</Label>
                <Select value={sourceYearId} onValueChange={setSourceYearId}>
                  <SelectTrigger><SelectValue placeholder="Année source" /></SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y.id} value={y.id}>
                        {y.yearString}{y.isCurrent ? " (en cours)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-neutral-500">Vers</Label>
                <Select value={targetYearId} onValueChange={setTargetYearId}>
                  <SelectTrigger><SelectValue placeholder="Année cible" /></SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y.id} value={y.id}>
                        {y.yearString}{y.isCurrent ? " (en cours)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {sameYear && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertCircleIcon className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Choisissez deux années différentes.</span>
            </div>
          )}

          {!sameYear && sourceYearId && targetYearId && (
            <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
              <InfoIcon className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Les professeurs, coefficients, notes max et filières sont conservés. Aucune note
                n&apos;est copiée. Relancer l&apos;opération ne crée jamais de doublon.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {!sameYear && sourceYearId && targetYearId && (
        <Card>
          <CardHeader><CardTitle className="text-base">2. Salles à reprendre</CardTitle></CardHeader>
          <CardContent>
            {loadingPreview ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-neutral-500 py-6 text-center">
                Aucune salle dans {yearLabel(sourceYearId)}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Tout sélectionner" />
                      </TableHead>
                      <TableHead>Salle</TableHead>
                      <TableHead className="text-right">Matières ({yearLabel(sourceYearId)})</TableHead>
                      <TableHead>Dans {yearLabel(targetYearId)}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.classId}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(r.classId)}
                            onCheckedChange={() => toggle(r.classId)}
                            aria-label={`Sélectionner ${r.className}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{r.className}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.subjectCount}</TableCell>
                        <TableCell>
                          {!r.alreadyExistsInTarget ? (
                            <Badge variant="outline" className="border-sky-300 text-sky-700">
                              salle à créer
                            </Badge>
                          ) : r.targetSubjectCount === 0 ? (
                            <Badge variant="outline" className="border-amber-300 text-amber-700">
                              existe, aucune matière
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                              {r.targetSubjectCount} matière(s) déjà là
                            </Badge>
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

      {rows.length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
            <p className="text-sm text-neutral-600">
              <strong>{selected.size}</strong> salle(s) sélectionnée(s), jusqu&apos;à{" "}
              <strong>{totalSubjects}</strong> matière(s) à copier
            </p>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={selected.size === 0 || submitting || loadingPreview}
            >
              {submitting ? "Copie en cours…" : "Copier la configuration"}
            </Button>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2Icon className="h-5 w-5 text-emerald-600" />
              Rapport de copie
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{result.message}</p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Salle</TableHead>
                    <TableHead>Salle créée</TableHead>
                    <TableHead className="text-right">Matières copiées</TableHead>
                    <TableHead className="text-right">Déjà présentes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.details.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{d.className}</TableCell>
                      <TableCell>{d.sessionCreated ? "oui" : "non"}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.subjectsCopied}</TableCell>
                      <TableCell className="text-right tabular-nums text-neutral-500">{d.subjectsSkipped}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la copie</AlertDialogTitle>
            <AlertDialogDescription>
              {selected.size} salle(s) de <strong>{yearLabel(sourceYearId)}</strong> vont être
              reprises dans <strong>{yearLabel(targetYearId)}</strong>, avec leurs matières,
              professeurs et notes max. Les matières déjà présentes ne seront pas dupliquées.
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
