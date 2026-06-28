"use client"

import { useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import {
  UploadIcon, FileTextIcon, CheckCircle2Icon, AlertCircleIcon, UsersIcon,
  BookOpenIcon, LayersIcon, XIcon, DownloadIcon,
} from "lucide-react"
import type { ApiClassSession } from "@/lib/api/students"
import type { AcademicYearStep } from "@/lib/api/dashboard"
import { toMessage } from "@/lib/errors"

interface NotImportedRow {
  rowNumber: number
  reason: string
  lastname: string
  firstname: string
  matiere: string
  sousMatiere: string
  note: string
}

interface ImportResult {
  totals: { rowsInCsv: number; created: number; updated: number; unchanged: number; skipped: number }
  studentsNotFound: Array<{ name: string; count: number }>
  subjectsNotFound: Array<{ name: string; count: number }>
  sectionsNotFound: Array<{ name: string; count: number }>
  notImported: NotImportedRow[]
}

interface Props {
  sessions: ApiClassSession[]
  steps:    AcademicYearStep[]
}

export function CPMSLGradesCsvImport({ sessions, steps }: Props) {
  const { toast } = useToast()
  const [sessionId, setSessionId] = useState("")
  const [stepId,    setStepId]    = useState("")
  const [csvText,   setCsvText]   = useState<string | null>(null)
  const [csvName,   setCsvName]   = useState<string | null>(null)
  const [previewRows, setPreviewRows] = useState<string[][]>([])
  const [submitting, setSubmitting] = useState(false)
  const [result,     setResult]     = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const classOptions = useMemo(() => {
    return [...sessions]
      .sort((a, b) => `${a.class.classType?.name} ${a.class.letter}`.localeCompare(`${b.class.classType?.name} ${b.class.letter}`))
  }, [sessions])

  const stepOptions = useMemo(() => [...steps].sort((a, b) => a.stepNumber - b.stepNumber), [steps])

  function clearFile() {
    setCsvText(null); setCsvName(null); setPreviewRows([])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.toLowerCase().endsWith(".csv")) {
      toast({ title: "Format invalide", description: "Seuls les fichiers .csv sont acceptés.", variant: "destructive" })
      return
    }
    const text = await f.text()
    setCsvText(text)
    setCsvName(f.name)
    // Preview : 5 premières lignes
    const lines = text.split(/\r?\n/).filter(Boolean).slice(0, 6)
    setPreviewRows(lines.map((l) => l.split(",")))
    setResult(null)
  }

  function downloadNotImported() {
    if (!result?.notImported?.length) return
    const cols = ["ligne", "raison", "lastname", "firstname", "matiere", "sousMatiere", "note"]
    const esc = (v: string) =>
      /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
    const lines = [cols.join(",")]
    for (const r of result.notImported) {
      lines.push([
        String(r.rowNumber), r.reason, r.lastname, r.firstname, r.matiere, r.sousMatiere, r.note,
      ].map(esc).join(","))
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const base = (csvName ?? "import").replace(/\.csv$/i, "")
    a.download = `${base}_non-importes.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function handleSubmit() {
    if (!sessionId || !stepId || !csvText) {
      toast({ title: "Champ manquant", description: "Sélectionne une classe, une étape, et un fichier CSV.", variant: "destructive" })
      return
    }
    setSubmitting(true)
    setResult(null)
    try {
      const res = await fetch("/api/grades/import-csv", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classSessionId: sessionId,
          stepId,
          csvText,
          gradeType: "EXAM",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message ?? `Échec (HTTP ${res.status})`)
      setResult(data as ImportResult)
      toast({
        title: "Import terminé",
        description: `${data.totals.created} créée(s), ${data.totals.updated} modifiée(s), ${data.totals.skipped} sautée(s)`,
      })
    } catch (e) {
      toast({ title: "Échec de l'import", description: toMessage(e, "lors de l'import CSV"), variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Sélecteurs ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Import CSV</CardTitle>
          <CardDescription>
            Sélectionne une classe et une étape, puis charge un CSV au format long
            (lastname, firstname, matiere, sousMatiere, note, max).
            <br />
            L'élève doit être inscrit dans la classe choisie pour être matché.
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Classe</label>
              <Select value={sessionId} onValueChange={setSessionId}>
                <SelectTrigger><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
                <SelectContent>
                  {classOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.class.classType?.name} {s.class.letter}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Étape</label>
              <Select value={stepId} onValueChange={setStepId}>
                <SelectTrigger><SelectValue placeholder="Choisir une étape" /></SelectTrigger>
                <SelectContent>
                  {stepOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.isCurrent && <Badge variant="secondary" className="ml-1">courante</Badge>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Drop zone */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Fichier CSV</label>
            {csvText ? (
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-3">
                  <FileTextIcon className="h-5 w-5 text-emerald-600" />
                  <div>
                    <div className="text-sm font-medium">{csvName}</div>
                    <div className="text-xs text-muted-foreground">{csvText.split("\n").length - 1} ligne(s) détectée(s)</div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={clearFile}><XIcon className="h-4 w-4" /></Button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 p-8 transition-colors hover:bg-muted/30">
                <UploadIcon className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm font-medium">Cliquer pour choisir un fichier CSV</span>
                <span className="text-xs text-muted-foreground">généré par <code className="rounded bg-muted px-1">json_to_csv.ts</code> ou export Excel</span>
                <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
              </label>
            )}
          </div>

          {/* Preview */}
          {previewRows.length > 0 && (
            <div className="rounded-lg border bg-card">
              <div className="border-b bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wider">
                Aperçu (5 premières lignes)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <tbody>
                    {previewRows.map((cols, i) => (
                      <tr key={i} className={i === 0 ? "bg-muted/50 font-semibold" : "border-t"}>
                        {cols.map((c, j) => (
                          <td key={j} className="whitespace-nowrap border-r border-border/40 px-2 py-1 last:border-r-0">{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              onClick={handleSubmit}
              disabled={!sessionId || !stepId || !csvText || submitting}
            >
              {submitting ? "Import en cours…" : "Importer"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Résultat ── */}
      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <CheckCircle2Icon className="h-5 w-5 text-emerald-600" />
              Résultat de l'import
            </CardTitle>
            <CardDescription>
              {result.totals.rowsInCsv} ligne(s) dans le CSV
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="space-y-4 pt-4">
            {/* KPI */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Créées" value={result.totals.created} color="emerald" />
              <Stat label="Modifiées" value={result.totals.updated} color="blue" />
              <Stat label="Inchangées" value={result.totals.unchanged} color="muted" />
              <Stat label="Sautées" value={result.totals.skipped} color="amber" />
            </div>

            {/* Élèves non inscrits */}
            {result.studentsNotFound.length > 0 && (
              <ResultList
                icon={<UsersIcon className="h-4 w-4 text-amber-600" />}
                title="Élèves non inscrits dans la classe choisie"
                description="L'élève doit avoir un enrollment dans cette classe. Vérifie l'inscription puis relance."
                items={result.studentsNotFound}
              />
            )}

            {/* Matières manquantes */}
            {result.subjectsNotFound.length > 0 && (
              <ResultList
                icon={<BookOpenIcon className="h-4 w-4 text-amber-600" />}
                title="Matières absentes du catalogue"
                description="Le nom de la matière n'existe pas dans le classType de cette classe."
                items={result.subjectsNotFound}
              />
            )}

            {/* Sections manquantes */}
            {result.sectionsNotFound.length > 0 && (
              <ResultList
                icon={<LayersIcon className="h-4 w-4 text-amber-600" />}
                title="Sous-matières absentes"
                description="La section n'est pas définie pour cette matière."
                items={result.sectionsNotFound}
              />
            )}

            {/* Log détaillé des lignes non importées */}
            {result.notImported.length > 0 && (
              <div className="rounded-lg border bg-card">
                <div className="flex items-center gap-2 border-b bg-amber-50/40 px-3 py-2">
                  <AlertCircleIcon className="h-4 w-4 text-amber-600" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">Lignes non importées</div>
                    <div className="text-xs text-muted-foreground">
                      Détail complet ligne par ligne — télécharge le CSV pour les corriger.
                    </div>
                  </div>
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                    {result.notImported.length}
                  </Badge>
                  <Button size="sm" variant="outline" onClick={downloadNotImported}>
                    <DownloadIcon className="mr-1.5 h-3.5 w-3.5" />
                    Télécharger
                  </Button>
                </div>
                <div className="max-h-80 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/60">
                      <tr className="text-left">
                        <th className="px-2 py-1.5 font-semibold">Ligne</th>
                        <th className="px-2 py-1.5 font-semibold">Raison</th>
                        <th className="px-2 py-1.5 font-semibold">Élève</th>
                        <th className="px-2 py-1.5 font-semibold">Matière</th>
                        <th className="px-2 py-1.5 font-semibold">Sous-matière</th>
                        <th className="px-2 py-1.5 text-right font-semibold">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.notImported.map((r, i) => (
                        <tr key={i} className={i % 2 === 1 ? "bg-muted/20" : undefined}>
                          <td className="px-2 py-1 tabular-nums text-muted-foreground">{r.rowNumber}</td>
                          <td className="px-2 py-1">
                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[10px] text-amber-700">
                              {r.reason}
                            </Badge>
                          </td>
                          <td className="px-2 py-1 whitespace-nowrap">{r.firstname} {r.lastname}</td>
                          <td className="px-2 py-1">{r.matiere}</td>
                          <td className="px-2 py-1">{r.sousMatiere}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{r.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: "emerald" | "blue" | "amber" | "muted" }) {
  const cls = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue:    "border-blue-200 bg-blue-50 text-blue-700",
    amber:   "border-amber-200 bg-amber-50 text-amber-700",
    muted:   "border-border bg-muted/30 text-muted-foreground",
  }[color]
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="text-xs font-medium uppercase tracking-wider">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  )
}

function ResultList({
  icon, title, description, items,
}: {
  icon: React.ReactNode; title: string; description: string
  items: Array<{ name: string; count: number }>
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b bg-amber-50/40 px-3 py-2">
        {icon}
        <div className="flex-1">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
          {items.length}
        </Badge>
      </div>
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-sm">
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className={i % 2 === 1 ? "bg-muted/20" : undefined}>
                <td className="px-3 py-1.5">{it.name}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                  {it.count} ligne{it.count > 1 ? "s" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
