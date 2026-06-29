"use client"

import { useCallback, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { UploadCloudIcon, DownloadIcon, FileSpreadsheetIcon, AlertTriangleIcon, CheckCircle2Icon, LoaderIcon, XIcon } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { clientFetch as apiFetch } from "@/lib/client-fetch"
import { toMessage } from "@/lib/errors"

// ── CSV parsing helpers (same as the student importer) ──────────────────────
function decodeBytes(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buf)
  if (!utf8.includes("�")) return utf8
  try { return new TextDecoder("windows-1252").decode(buf) } catch { return utf8 }
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const clean = text.replace(/^﻿/, "")
  const firstLineEnd = clean.indexOf("\n")
  const firstLine = firstLineEnd < 0 ? clean : clean.slice(0, firstLineEnd)
  const delim = firstLine.split(";").length > firstLine.split(",").length ? ";" : ","
  const rows: string[][] = []
  let cur: string[] = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === delim) {
      cur.push(field); field = ""
    } else if (c === "\r") {
      /* ignore */
    } else if (c === "\n") {
      cur.push(field); rows.push(cur); cur = []; field = ""
    } else {
      field += c
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur) }
  const headers = (rows.shift() ?? []).map((h) => h.trim())
  const dataRows = rows.filter((r) => r.some((c) => c.trim() !== ""))
  return { headers, rows: dataRows }
}

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim()

// Map flexible header names to canonical keys.
type ColKey = "rubricName" | "rubricCode" | "classTypeName" | "subjectName" | "subjectCode" | "coefficient" | "maxScore" | "sectionName" | "sectionCode" | "sectionMaxScore"
const HEADER_ALIASES: Record<ColKey, string[]> = {
  rubricName:      ["rubrique", "nom rubrique"],
  rubricCode:      ["code rubrique"],
  classTypeName:   ["niveau", "classe", "class type", "type de classe"],
  subjectName:     ["matiere", "matière"],
  subjectCode:     ["code matiere", "code matière"],
  coefficient:     ["coefficient", "coef"],
  maxScore:        ["max score", "max", "score max", "maxscore"],
  sectionName:     ["sous matiere", "sous-matière", "sous matière", "sous-matiere"],
  sectionCode:     ["code sous matiere", "code sous-matière", "code sous matière", "code sous-matiere"],
  sectionMaxScore: ["max score sous matiere", "max score sous-matière", "max sous matière", "max sous-matière"],
}

function buildColumnMap(headers: string[]): Record<ColKey, number> {
  const m: Record<string, number> = {}
  const norm = headers.map((h) => normalize(h))
  for (const key of Object.keys(HEADER_ALIASES) as ColKey[]) {
    let found = -1
    for (const alias of HEADER_ALIASES[key]) {
      const idx = norm.indexOf(normalize(alias))
      if (idx >= 0) { found = idx; break }
    }
    if (found < 0) {
      // partial-match fallback
      for (let i = 0; i < norm.length; i++) {
        for (const alias of HEADER_ALIASES[key]) {
          if (norm[i].includes(normalize(alias))) { found = i; break }
        }
        if (found >= 0) break
      }
    }
    m[key] = found
  }
  return m as Record<ColKey, number>
}

interface CatalogRow {
  rubricName?: string
  rubricCode?: string
  classTypeName?: string
  subjectName: string
  subjectCode: string
  coefficient?: number
  maxScore: number
  sectionName?: string
  sectionCode?: string
  sectionMaxScore?: number
}

interface PreparedRow {
  line: number
  row: CatalogRow | null
  error: string | null
  subjectName: string
  subjectCode: string
  sectionName: string
  rubricName: string
}

interface ImportSummary {
  total: number
  rubrics: { created: number; updated: number; unchanged: number }
  subjects: { created: number; updated: number; unchanged: number }
  sections: { created: number; updated: number; unchanged: number }
  failed: number
}
interface ImportResult {
  index: number
  status: "created" | "updated" | "unchanged" | "error"
  message?: string
  subjectCode?: string
  sectionCode?: string
}

interface CatalogImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CatalogImportModal({ open, onOpenChange, onSuccess }: CatalogImportModalProps) {
  const { toast } = useToast()
  const [fileName, setFileName] = useState<string | null>(null)
  const [prepared, setPrepared] = useState<PreparedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ summary: ImportSummary; rows: ImportResult[] } | null>(null)

  function reset() {
    setFileName(null)
    setPrepared([])
    setResult(null)
  }

  const onFile = useCallback(async (file: File) => {
    const text = decodeBytes(await file.arrayBuffer())
    const { headers, rows } = parseCSV(text)
    if (headers.length === 0) {
      toast({ title: "Fichier vide", variant: "destructive" })
      return
    }
    const col = buildColumnMap(headers)
    const missing: string[] = []
    if (col.subjectName < 0) missing.push("Matière")
    if (col.subjectCode < 0) missing.push("Code Matière")
    if (col.maxScore < 0) missing.push("Max Score")
    if (missing.length > 0) {
      toast({
        title: "Colonnes requises manquantes",
        description: `Colonnes attendues : ${missing.join(", ")}.`,
        variant: "destructive",
      })
      return
    }

    setFileName(file.name)
    setResult(null)

    const getCell = (r: string[], idx: number) => (idx >= 0 && idx < r.length ? (r[idx] ?? "").trim() : "")
    const parsed: PreparedRow[] = rows.map((r, i) => {
      const subjectName = getCell(r, col.subjectName)
      const subjectCode = getCell(r, col.subjectCode).toUpperCase()
      const maxScoreStr = getCell(r, col.maxScore)
      const sectionName = getCell(r, col.sectionName)
      const sectionCode = getCell(r, col.sectionCode).toUpperCase()
      const rubricName = getCell(r, col.rubricName)
      const rubricCode = getCell(r, col.rubricCode).toUpperCase()
      const classTypeName = getCell(r, col.classTypeName)
      const coefStr = getCell(r, col.coefficient)
      const sectionMaxStr = getCell(r, col.sectionMaxScore)

      let error: string | null = null
      if (!subjectName) error = "Matière manquante"
      else if (!subjectCode) error = "Code Matière manquant"
      else if (subjectCode.length > 10) error = "Code Matière trop long (10 max)"
      const maxScore = Number(maxScoreStr.replace(",", "."))
      if (!error && (!isFinite(maxScore) || maxScore <= 0)) error = `Max Score invalide : « ${maxScoreStr} »`
      if (!error && sectionName && !sectionCode) error = "Code Sous-matière manquant"
      if (!error && sectionCode.length > 10) error = "Code Sous-matière trop long (10 max)"

      const row: CatalogRow | null = error
        ? null
        : {
            rubricName: rubricName || undefined,
            rubricCode: rubricCode || undefined,
            classTypeName: classTypeName || undefined,
            subjectName,
            subjectCode,
            coefficient: coefStr ? Number(coefStr.replace(",", ".")) : undefined,
            maxScore,
            sectionName: sectionName || undefined,
            sectionCode: sectionCode || undefined,
            sectionMaxScore: sectionMaxStr ? Number(sectionMaxStr.replace(",", ".")) : undefined,
          }

      return {
        line: i + 1,
        row,
        error,
        subjectName,
        subjectCode,
        sectionName,
        rubricName,
      }
    })

    setPrepared(parsed)
  }, [toast])

  const valid = useMemo(() => prepared.filter((p) => p.row), [prepared])
  const invalid = useMemo(() => prepared.filter((p) => p.error), [prepared])
  const uniqueRubrics = useMemo(
    () => new Set(valid.map((p) => (p.rubricName || p.row!.rubricCode || "").toUpperCase()).filter(Boolean)).size,
    [valid]
  )
  const uniqueSubjects = useMemo(() => new Set(valid.map((p) => p.subjectCode)).size, [valid])
  const sectionCount = useMemo(() => valid.filter((p) => p.row!.sectionName).length, [valid])

  async function runImport() {
    if (valid.length === 0) return
    setImporting(true)
    try {
      const res = await apiFetch<{ summary: ImportSummary; results: ImportResult[] }>(
        "/api/subjects/bulk-catalog",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: valid.map((p) => p.row) }),
        }
      )
      setResult({ summary: res.summary, rows: res.results })
      toast({
        title: "Catalogue importé",
        description: `${res.summary.subjects.created} créées, ${res.summary.subjects.updated} mises à jour, ${res.summary.sections.created} sous-matières créées.`,
      })
      onSuccess()
    } catch (err) {
      toast({ title: "Échec de l'import", description: toMessage(err), variant: "destructive" })
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importer le référentiel (CSV)</DialogTitle>
          <DialogDescription>
            Import en masse des rubriques, matières et sous-matières. L&apos;import est
            <strong> idempotent</strong> : les entrées existantes sont mises à jour uniquement si elles
            ont changé, sinon ignorées — vous pouvez relancer le même fichier sans créer de doublons.
          </DialogDescription>
        </DialogHeader>

        {/* ── Upload ── */}
        {!fileName ? (
          <div className="space-y-3">
            <label
              htmlFor="catalog-csv-input"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition-colors hover:border-[#2C4A6E] hover:bg-slate-100"
            >
              <UploadCloudIcon className="h-8 w-8 text-slate-400" />
              <span className="text-sm font-medium text-foreground">Choisir un fichier .csv</span>
              <span className="text-xs text-muted-foreground">
                Séparateur « , » ou « ; ». Encodage UTF-8 ou Windows-1252.
              </span>
            </label>
            <input
              id="catalog-csv-input"
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = "" }}
            />
            <div className="flex items-center justify-between">
              <Button asChild variant="outline" size="sm">
                <a href="/seed-matieres-cpmsl.csv" download>
                  <DownloadIcon className="mr-2 h-4 w-4" />
                  Télécharger le modèle pré-rempli (CPMSL)
                </a>
              </Button>
              <span className="text-xs text-muted-foreground">
                Colonnes : Rubrique · Niveau · Matière · Code Matière · Coefficient · Max Score · Sous-matière · Code Sous-matière · Max Score Sous-matière
              </span>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileSpreadsheetIcon className="h-5 w-5 flex-shrink-0 text-emerald-600" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {prepared.length} ligne(s) · {uniqueRubrics} rubrique(s) · {uniqueSubjects} matière(s) · {sectionCount} sous-matière(s)
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>
                <XIcon className="mr-1 h-4 w-4" /> Changer
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Preview ── */}
        {fileName && !result && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                {valid.length} ligne(s) valide(s)
              </span>
              {invalid.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                  {invalid.length} en erreur
                </span>
              )}
            </div>

            {invalid.length > 0 && (
              <Card className="border-rose-200">
                <CardContent className="max-h-[200px] overflow-y-auto p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Matière</TableHead>
                        <TableHead>Sous-matière</TableHead>
                        <TableHead>Erreur</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invalid.map((p) => (
                        <TableRow key={p.line}>
                          <TableCell className="text-xs text-muted-foreground">{p.line}</TableCell>
                          <TableCell className="text-sm">{p.subjectName || "—"}</TableCell>
                          <TableCell className="text-sm">{p.sectionName || "—"}</TableCell>
                          <TableCell className="text-xs text-rose-700">{p.error}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="max-h-[300px] overflow-y-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Rubrique</TableHead>
                      <TableHead>Matière</TableHead>
                      <TableHead>Sous-matière</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {valid.slice(0, 30).map((p) => (
                      <TableRow key={p.line}>
                        <TableCell className="text-xs text-muted-foreground">{p.line}</TableCell>
                        <TableCell className="text-sm">{p.rubricName || "—"}</TableCell>
                        <TableCell className="text-sm">{p.subjectName}</TableCell>
                        <TableCell className="text-sm">{p.sectionName || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {valid.length > 30 && (
                  <p className="px-4 py-2 text-xs text-muted-foreground">… et {valid.length - 30} autre(s) ligne(s).</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Results ── */}
        {result && (
          <Card className="border-2 border-[#2C4A6E]/20">
            <CardContent className="space-y-3 py-4">
              <div className="flex items-center gap-2">
                <CheckCircle2Icon className="h-5 w-5 text-emerald-600" />
                <p className="text-sm font-medium">Import terminé</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                  <p className="text-muted-foreground">Rubriques</p>
                  <p className="font-medium">
                    {result.summary.rubrics.created}c · {result.summary.rubrics.updated}u · {result.summary.rubrics.unchanged}=
                  </p>
                </div>
                <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                  <p className="text-muted-foreground">Matières</p>
                  <p className="font-medium">
                    {result.summary.subjects.created}c · {result.summary.subjects.updated}u · {result.summary.subjects.unchanged}=
                  </p>
                </div>
                <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                  <p className="text-muted-foreground">Sous-matières</p>
                  <p className="font-medium">
                    {result.summary.sections.created}c · {result.summary.sections.updated}u · {result.summary.sections.unchanged}=
                  </p>
                </div>
              </div>
              {result.summary.failed > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
                  <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5" />
                  <div>
                    {result.summary.failed} erreur(s) :{" "}
                    {result.rows.filter((r) => r.status === "error").slice(0, 5).map((r) => r.message).join(" · ")}
                    {result.summary.failed > 5 && <> … et {result.summary.failed - 5} autres.</>}
                  </div>
                </div>
              )}
              <Separator />
              <p className="text-[11px] text-muted-foreground">
                Légende : <strong>c</strong> créées · <strong>u</strong> mises à jour ·{" "}
                <strong>=</strong> inchangées.
              </p>
            </CardContent>
          </Card>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Fermer
          </Button>
          {fileName && !result && (
            <Button
              onClick={runImport}
              disabled={importing || valid.length === 0}
              className="bg-[#2C4A6E] text-white hover:bg-[#1F3856]"
            >
              {importing
                ? <><LoaderIcon className="mr-2 h-4 w-4 animate-spin" /> Import en cours…</>
                : <>Importer {valid.length} ligne(s)</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
