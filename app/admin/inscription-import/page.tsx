"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeftIcon,
  UploadCloudIcon,
  FileSpreadsheetIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  DownloadIcon,
  LoaderIcon,
  XIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { clientFetch as apiFetch } from "@/lib/client-fetch"
import { toMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"
import {
  fetchActiveAcademicYear,
  fetchClassSessions,
  getClassSessionName,
  type AcademicYear,
  type ClassSession,
} from "@/lib/api/dashboard"
import { type ApiFieldGroup, type ApiCustomField } from "@/lib/api/student-form"

// ── Encoding-aware decode ────────────────────────────────────────────────────
// Excel / Windows exports are often Windows-1252 (Latin-1), not UTF-8. Decoding
// those as UTF-8 turns "è" into the replacement char "�" and breaks matching
// (e.g. "1ère AF"). We decode as UTF-8 first; if replacement chars appear, we
// fall back to Windows-1252.
function decodeBytes(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buf)
  if (!utf8.includes("�")) return utf8
  try {
    return new TextDecoder("windows-1252").decode(buf)
  } catch {
    return utf8
  }
}

// ── CSV parsing ────────────────────────────────────────────────────────────────
// Minimal RFC-4180-ish parser: handles quoted fields, escaped quotes ("") and
// both "," / ";" delimiters (French exports often use ";"). Good enough for
// admin-supplied files; no streaming needed at this scale.
function parseCSV(text: string): { headers: string[]; rows: string[][]; delim: string } {
  const clean = text.replace(/^﻿/, "") // strip BOM
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
      // ignore
    } else if (c === "\n") {
      cur.push(field); rows.push(cur); cur = []; field = ""
    } else {
      field += c
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur) }

  const headers = (rows.shift() ?? []).map((h) => h.trim())
  const dataRows = rows.filter((r) => r.some((c) => c.trim() !== ""))
  return { headers, rows: dataRows, delim }
}

// ── Helpers ─────────────────────────────────────────────────────────────────────
const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim()

const pad2 = (s: string) => (s.length === 1 ? `0${s}` : s)

// Accepts ISO (yyyy-mm-dd), dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy. Returns ISO or null.
function normalizeDate(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`
  m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`
  const d = new Date(t)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

const TRUTHY = new Set(["oui", "yes", "true", "vrai", "1", "x", "o"])
const isTruthy = (raw: string) => TRUTHY.has(raw.trim().toLowerCase())

// ── Target field model ───────────────────────────────────────────────────────
type SystemKey = "nisu" | "lastName" | "firstName" | "birthDate" | "classSessionId" | "salle" | "address"

interface Target {
  id: string            // "sys:nisu" | "cf:<fieldId>"
  label: string
  required: boolean
  // how to render a default-value input + how to interpret/store the value
  kind: "text" | "date" | "class" | "number" | "select" | "checkbox" | "multi"
  options?: string[]    // for select / multi
  // origin
  system?: SystemKey
  fieldId?: string      // for custom
  fieldType?: ApiCustomField["type"]
}

const SYSTEM_TARGETS: Target[] = [
  { id: "sys:nisu",          label: "NISU",              required: false, kind: "text",  system: "nisu" },
  { id: "sys:lastName",      label: "Nom",               required: true,  kind: "text",  system: "lastName" },
  { id: "sys:firstName",     label: "Prénom",            required: true,  kind: "text",  system: "firstName" },
  { id: "sys:birthDate",     label: "Date de naissance", required: true,  kind: "date",  system: "birthDate" },
  { id: "sys:classSessionId",label: "Classe",            required: true,  kind: "class", system: "classSessionId" },
  { id: "sys:salle",         label: "Salle / Section",   required: false, kind: "text",  system: "salle" },
  { id: "sys:address",       label: "Adresse",           required: false, kind: "text",  system: "address" },
]

interface BulkCustomValue {
  fieldId: string
  textValue?: string | null
  numberValue?: number | null
  dateValue?: string | null
  boolValue?: boolean | null
  jsonValue?: unknown
}
interface BulkRow {
  nisu: string
  firstName: string
  lastName: string
  birthDate: string
  classSessionId: string
  address?: string
  customValues?: BulkCustomValue[]
}

interface PreparedRow {
  csvLine: number
  nisu: string
  name: string
  className: string
  payload: BulkRow | null
  error: string | null
  match: RowMatch          // new | existing | error
  existingChanged: boolean // existing row whose visible fields differ (estimate)
}

type RowMatch = "new" | "existing" | "error"

interface BulkResult {
  index: number
  status: "created" | "updated" | "unchanged" | "error"
  nisu?: string | null
  message?: string
}

interface ExistingStudent {
  id: string
  nisu: string | null
  firstname: string
  lastname: string
  birthDate: string // ISO
  address: string
}

const NONE = "__none__"

export default function InscriptionImportPage() {
  const { toast } = useToast()

  const [year, setYear] = useState<AcademicYear | null>(null)
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [customGroups, setCustomGroups] = useState<ApiFieldGroup[]>([])
  const [existingStudents, setExistingStudents] = useState<ExistingStudent[]>([])
  const [loadingMeta, setLoadingMeta] = useState(true)

  const [fileName, setFileName] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [dataRows, setDataRows] = useState<string[][]>([])
  const [csvDelim, setCsvDelim] = useState<string>(",")

  // mapping + defaults keyed by Target.id
  const [columnMap, setColumnMap] = useState<Record<string, number | null>>({})
  const [defaults, setDefaults] = useState<Record<string, string>>({})

  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<{
    summary: { total: number; created: number; updated: number; unchanged: number; failed: number }
    rows: Array<{ csvLine: number; nisu: string; status: BulkResult["status"]; message?: string }>
  } | null>(null)

  // ── Load year + sessions + custom schema ──────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingMeta(true)
      try {
        const y = await fetchActiveAcademicYear()
        if (cancelled) return
        setYear(y)
        const [sess, groups, students] = await Promise.all([
          y ? fetchClassSessions(y.id) : Promise.resolve([]),
          apiFetch<ApiFieldGroup[]>("/api/student-form-fields").catch(() => []),
          apiFetch<Array<{ id: string; nisu?: string | null; address?: string; user?: { firstname?: string; lastname?: string; birthDate?: string } }>>(
            "/api/students",
            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }
          ).catch(() => []),
        ])
        if (cancelled) return
        setSessions(Array.isArray(sess) ? sess : [])
        setCustomGroups(Array.isArray(groups) ? groups : [])
        setExistingStudents(
          (Array.isArray(students) ? students : []).map((s) => ({
            id: s.id,
            nisu: s.nisu ?? null,
            firstname: s.user?.firstname ?? "",
            lastname: s.user?.lastname ?? "",
            birthDate: s.user?.birthDate ?? "",
            address: s.address ?? "",
          }))
        )
      } finally {
        if (!cancelled) setLoadingMeta(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Custom targets (IMAGE excluded — can't be imported via CSV).
  const customTargets = useMemo<Target[]>(() => {
    const out: Target[] = []
    for (const g of [...customGroups].sort((a, b) => a.displayOrder - b.displayOrder)) {
      for (const f of [...g.fields].sort((a, b) => a.displayOrder - b.displayOrder)) {
        if (f.type === "IMAGE") continue
        const kind: Target["kind"] =
          f.type === "NUMBER" ? "number"
          : f.type === "DATE" ? "date"
          : f.type === "SELECT" || f.type === "RADIO" ? "select"
          : f.type === "CHECKBOX" ? "checkbox"
          : f.type === "MULTI_CHECKBOX" ? "multi"
          : "text"
        out.push({
          id: `cf:${f.id}`,
          label: `${g.name} · ${f.label}`,
          required: f.required,
          kind,
          options: f.config?.options ?? undefined,
          fieldId: f.id,
          fieldType: f.type,
        })
      }
    }
    return out
  }, [customGroups])

  const allTargets = useMemo(() => [...SYSTEM_TARGETS, ...customTargets], [customTargets])

  // Class resolver. Accepts the full label ("1ère AF A") or just the class-type
  // name ("1ère AF") when it maps to a single session. Returns the sessionId,
  // or "" with a reason ("ambiguous" when several sections share the name).
  const resolveClass = useCallback(
    (raw: string): { id: string; reason?: "ambiguous" } => {
      const n = normalize(raw)
      if (!n) return { id: "" }
      // 1) exact full-label match
      const exact = sessions.find((s) => normalize(getClassSessionName(s)) === n)
      if (exact) return { id: exact.id }
      // 2) class-type name match (e.g. "1ère AF") — only if a single section exists
      const byType = sessions.filter((s) => normalize(s.class.classType.name) === n)
      if (byType.length === 1) return { id: byType[0].id }
      if (byType.length > 1) return { id: "", reason: "ambiguous" }
      // 3) prefix match against the full label, unique only
      const byPrefix = sessions.filter((s) => normalize(getClassSessionName(s)).startsWith(n + " "))
      if (byPrefix.length === 1) return { id: byPrefix[0].id }
      if (byPrefix.length > 1) return { id: "", reason: "ambiguous" }
      return { id: "" }
    },
    [sessions]
  )

  // Lookups to detect already-registered students (idempotence): by NISU, and
  // by the (prénom, nom, naissance) triple for students with no NISU.
  const compositeKey = (f: string, l: string, isoDate: string) =>
    `${normalize(f)}|${normalize(l)}|${isoDate}`
  const { byNisu, byComposite } = useMemo(() => {
    const byNisu = new Map<string, ExistingStudent>()
    const byComposite = new Map<string, ExistingStudent>()
    for (const s of existingStudents) {
      if (s.nisu) byNisu.set(s.nisu.toUpperCase(), s)
      byComposite.set(compositeKey(s.firstname, s.lastname, (s.birthDate || "").slice(0, 10)), s)
    }
    return { byNisu, byComposite }
  }, [existingStudents])

  // ── File handling ──────────────────────────────────────────────────────────
  const onFile = useCallback(async (file: File) => {
    const text = decodeBytes(await file.arrayBuffer())
    const { headers: hdr, rows, delim } = parseCSV(text)
    if (hdr.length === 0) {
      toast({ title: "Fichier vide", description: "Aucune colonne détectée.", variant: "destructive" })
      return
    }
    setFileName(file.name)
    setHeaders(hdr)
    setDataRows(rows)
    setCsvDelim(delim)
    setResults(null)

    // Auto-map columns to targets by fuzzy header match.
    const map: Record<string, number | null> = {}
    const used = new Set<number>()
    for (const target of allTargets) {
      const want = normalize(target.label.split(" · ").pop() ?? target.label)
      let found = -1
      for (let i = 0; i < hdr.length; i++) {
        if (used.has(i)) continue
        const h = normalize(hdr[i])
        if (h === want || h.includes(want) || want.includes(h)) { found = i; break }
      }
      if (found >= 0) { map[target.id] = found; used.add(found) }
      else map[target.id] = null
    }
    setColumnMap(map)
    setDefaults({})
  }, [allTargets, toast])

  function clearFile() {
    setFileName(null)
    setHeaders([])
    setDataRows([])
    setColumnMap({})
    setDefaults({})
    setResults(null)
  }

  // ── Required-fields gate ─────────────────────────────────────────────────────
  // A required target is "satisfied" if it has a mapped column OR a default value.
  const missingRequired = useMemo(() => {
    return allTargets.filter(
      (t) => t.required && (columnMap[t.id] == null) && !(defaults[t.id] ?? "").trim()
    )
  }, [allTargets, columnMap, defaults])

  // ── Build prepared rows (client-side validation + preview) ──────────────────
  const prepared = useMemo<PreparedRow[]>(() => {
    if (dataRows.length === 0) return []

    const cellFor = (target: Target, row: string[]): string => {
      const col = columnMap[target.id]
      if (col != null && col >= 0 && col < row.length) {
        const v = (row[col] ?? "").trim()
        if (v) return v
      }
      return (defaults[target.id] ?? "").trim()
    }

    return dataRows.map((row, idx) => {
      const csvLine = idx + 1
      const get = (sys: SystemKey) => cellFor(allTargets.find((t) => t.system === sys)!, row)

      const nisu = get("nisu").toUpperCase()
      const lastName = get("lastName")
      const firstName = get("firstName")
      const birthRaw = get("birthDate")
      const address = get("address")
      const name = `${firstName} ${lastName}`.trim() || "—"

      // Class: a mapped column holds a label to resolve; a default holds a sessionId.
      const classCol = columnMap["sys:classSessionId"]
      let classSessionId = ""
      let className = ""
      let classAmbiguous = false
      if (classCol != null && classCol >= 0) {
        const levelRaw = (row[classCol] ?? "").trim()
        const salleRaw = get("salle") // separate column or default, may be empty
        const combined = salleRaw ? `${levelRaw} ${salleRaw}` : levelRaw
        className = combined
        // Prefer the level+salle combination; fall back to level-only.
        let r = resolveClass(combined)
        if (!r.id && salleRaw) r = resolveClass(levelRaw)
        classSessionId = r.id
        classAmbiguous = r.reason === "ambiguous"
      } else {
        classSessionId = (defaults["sys:classSessionId"] ?? "").trim()
        const s = sessions.find((x) => x.id === classSessionId)
        className = s ? getClassSessionName(s) : ""
      }

      // Validate system fields. NISU is optional — only checked when present.
      let error: string | null = null
      if (nisu && !/^[A-Z0-9]{20}$/.test(nisu)) error = "NISU invalide (20 alphanum. exactement)"
      else if (!lastName) error = "Nom manquant"
      else if (!firstName) error = "Prénom manquant"

      const birthDate = birthRaw ? normalizeDate(birthRaw) : null
      if (!error && !birthRaw) error = "Date de naissance manquante"
      else if (!error && !birthDate) error = `Date invalide : « ${birthRaw} »`

      if (!error && !classSessionId) {
        if (classAmbiguous) error = `Classe ambiguë : « ${className} » (plusieurs salles — précisez la salle)`
        else error = className ? `Classe introuvable : « ${className} »` : "Classe manquante"
      }

      // Custom values.
      const customValues: BulkCustomValue[] = []
      if (!error) {
        for (const t of customTargets) {
          const raw = cellFor(t, row)
          if (!raw) {
            if (t.required) { error = `Champ requis vide : ${t.label}`; break }
            continue
          }
          const entry: BulkCustomValue = { fieldId: t.fieldId! }
          switch (t.kind) {
            case "number": {
              const n = Number(raw.replace(",", "."))
              if (!isFinite(n)) { error = `Nombre invalide (${t.label}) : « ${raw} »`; break }
              entry.numberValue = n
              break
            }
            case "date": {
              const d = normalizeDate(raw)
              if (!d) { error = `Date invalide (${t.label}) : « ${raw} »`; break }
              entry.dateValue = d
              break
            }
            case "checkbox":
              entry.boolValue = isTruthy(raw)
              break
            case "multi":
              entry.jsonValue = raw.split(/[;,]/).map((x) => x.trim()).filter(Boolean)
              break
            default:
              entry.textValue = raw
          }
          if (error) break
          customValues.push(entry)
        }
      }

      const payload: BulkRow | null = error
        ? null
        : {
            nisu,
            firstName,
            lastName,
            birthDate: birthDate!,
            classSessionId,
            address: address || undefined,
            customValues: customValues.length > 0 ? customValues : undefined,
          }

      // Match against existing students for idempotence.
      let match: RowMatch = "new"
      let existingChanged = false
      if (error) {
        match = "error"
      } else {
        const found =
          (nisu && byNisu.get(nisu)) ||
          byComposite.get(compositeKey(firstName, lastName, birthDate!))
        if (found) {
          match = "existing"
          const exBirth = (found.birthDate || "").slice(0, 10)
          // Estimate (visible fields only — custom values are reconciled server-side).
          existingChanged =
            normalize(found.firstname) !== normalize(firstName) ||
            normalize(found.lastname) !== normalize(lastName) ||
            exBirth !== birthDate ||
            (found.address || "") !== (address || "")
        }
      }

      return { csvLine, nisu, name, className: className || "—", payload, error, match, existingChanged }
    })
  }, [dataRows, columnMap, defaults, allTargets, customTargets, resolveClass, sessions, byNisu, byComposite])

  const validRows = useMemo(() => prepared.filter((p) => p.payload), [prepared])
  const invalidRows = useMemo(() => prepared.filter((p) => p.error), [prepared])
  // Upload-time buckets requested by the admin.
  const newRows = useMemo(() => prepared.filter((p) => p.match === "new"), [prepared])
  const existingRows = useMemo(() => prepared.filter((p) => p.match === "existing"), [prepared])

  // ── Import ───────────────────────────────────────────────────────────────────
  async function runImport() {
    if (validRows.length === 0) return
    setImporting(true)
    setResults(null)
    try {
      // Idempotent on the server: existing students are updated only if changed,
      // identical rows are reported "unchanged" and not duplicated. We send every
      // valid row (new + existing) and let the backend reconcile.
      const payloads = validRows.map((p) => p.payload!)
      const res = await apiFetch<{
        summary: { total: number; created: number; updated: number; unchanged: number; failed: number }
        results: BulkResult[]
      }>("/api/students/bulk-enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payloads }),
      })

      // Map backend results (index into payloads) back to CSV line numbers,
      // then append the rows we skipped client-side as failures.
      const backendRows = (res.results ?? []).map((r) => ({
        csvLine: validRows[r.index]?.csvLine ?? r.index + 1,
        nisu: r.nisu ?? validRows[r.index]?.nisu ?? "—",
        status: r.status,
        message: r.message,
      }))
      const skipped = invalidRows.map((p) => ({
        csvLine: p.csvLine,
        nisu: p.nisu || "—",
        status: "error" as const,
        message: p.error ?? "Ligne ignorée",
      }))
      const merged = [...backendRows, ...skipped].sort((a, b) => a.csvLine - b.csvLine)
      const s = res.summary

      setResults({
        summary: {
          total: prepared.length,
          created: s?.created ?? 0,
          updated: s?.updated ?? 0,
          unchanged: s?.unchanged ?? 0,
          failed: (s?.failed ?? 0) + invalidRows.length,
        },
        rows: merged,
      })
      toast({ title: `${s?.created ?? 0} créé(s), ${s?.updated ?? 0} mis à jour, ${s?.unchanged ?? 0} inchangé(s)` })
      // Refresh the existing-student lookups so a second run sees the new state.
      try {
        const students = await apiFetch<Array<{ id: string; nisu?: string | null; address?: string; user?: { firstname?: string; lastname?: string; birthDate?: string } }>>(
          "/api/students",
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }
        )
        setExistingStudents(
          (Array.isArray(students) ? students : []).map((st) => ({
            id: st.id, nisu: st.nisu ?? null,
            firstname: st.user?.firstname ?? "", lastname: st.user?.lastname ?? "",
            birthDate: st.user?.birthDate ?? "", address: st.address ?? "",
          }))
        )
      } catch { /* best-effort refresh */ }
    } catch (err) {
      toast({ title: "Échec de l'import", description: toMessage(err), variant: "destructive" })
    } finally {
      setImporting(false)
    }
  }

  // ── Incomplete-rows CSV export ───────────────────────────────────────────────
  // Preserves the original column layout + delimiter, and appends an "Erreur"
  // column with the validation reason. The admin can fix in Excel and re-upload
  // directly — the importer's idempotence will avoid duplicates on the good rows.
  function escapeCell(s: string, delim: string): string {
    if (s.includes('"') || s.includes(delim) || s.includes("\n") || s.includes("\r")) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  function downloadIncompleteCSV() {
    if (invalidRows.length === 0) return
    const d = csvDelim
    const outHeaders = [...headers, "Erreur"]
    const lines: string[] = [outHeaders.map((h) => escapeCell(h, d)).join(d)]
    for (const p of invalidRows) {
      const raw = dataRows[p.csvLine - 1] ?? []
      // Pad to the header count so the error column always lands at the end.
      const cells: string[] = []
      for (let i = 0; i < headers.length; i++) cells.push(raw[i] ?? "")
      cells.push(p.error ?? "")
      lines.push(cells.map((c) => escapeCell(c, d)).join(d))
    }
    // BOM so Excel auto-detects UTF-8 (preserves "è", "ç", …).
    const csv = "﻿" + lines.join("\r\n") + "\r\n"
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const base = (fileName ?? "import").replace(/\.csv$/i, "")
    a.href = url
    a.download = `${base}-incomplets.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Template download ──────────────────────────────────────────────────────
  function downloadTemplate() {
    const cols = allTargets.map((t) => (t.label.split(" · ").pop() ?? t.label))
    const csv = cols.join(",") + "\n"
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "modele-import-eleves.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Default-value input renderer ─────────────────────────────────────────────
  function DefaultInput({ target }: { target: Target }) {
    const val = defaults[target.id] ?? ""
    const setVal = (v: string) => setDefaults((d) => ({ ...d, [target.id]: v }))

    if (target.kind === "class") {
      return (
        <Select value={val || NONE} onValueChange={(v) => setVal(v === NONE ? "" : v)}>
          <SelectTrigger className="h-8 w-[220px]"><SelectValue placeholder="Choisir une classe…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>—</SelectItem>
            {sessions.map((s) => (
              <SelectItem key={s.id} value={s.id}>{getClassSessionName(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }
    if (target.kind === "select" && target.options?.length) {
      return (
        <Select value={val || NONE} onValueChange={(v) => setVal(v === NONE ? "" : v)}>
          <SelectTrigger className="h-8 w-[220px]"><SelectValue placeholder="Valeur…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>—</SelectItem>
            {target.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      )
    }
    if (target.kind === "checkbox") {
      return (
        <Select value={val || NONE} onValueChange={(v) => setVal(v === NONE ? "" : v)}>
          <SelectTrigger className="h-8 w-[220px]"><SelectValue placeholder="Valeur…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>—</SelectItem>
            <SelectItem value="oui">Oui</SelectItem>
            <SelectItem value="non">Non</SelectItem>
          </SelectContent>
        </Select>
      )
    }
    return (
      <Input
        className="h-8 w-[220px]"
        type={target.kind === "date" ? "date" : target.kind === "number" ? "number" : "text"}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Valeur appliquée à toutes les lignes"
      />
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/all-students"
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Élèves
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Importer des élèves (CSV)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Importez un fichier CSV, associez chaque colonne à un champ, puis lancez l&apos;inscription en masse.
          {year ? <> Année active : <span className="font-medium text-foreground">{year.yearString}</span>.</> : null}
        </p>
      </div>

      {!year && !loadingMeta && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="py-4 text-sm text-amber-800">
            Aucune année scolaire active. Activez une année avant d&apos;importer des élèves.
          </CardContent>
        </Card>
      )}

      {/* ── Upload ── */}
      {!fileName ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1 · Fichier CSV</CardTitle>
            <CardDescription>
              Première ligne = en-têtes de colonnes. Séparateur « , » ou « ; ». Encodage UTF-8 recommandé.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label
              htmlFor="csv-input"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition-colors hover:border-[#2C4A6E] hover:bg-slate-100"
            >
              <UploadCloudIcon className="h-8 w-8 text-slate-400" />
              <span className="text-sm font-medium text-foreground">Cliquez pour choisir un fichier .csv</span>
              <span className="text-xs text-muted-foreground">ou glissez-le ici</span>
            </label>
            <input
              id="csv-input"
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = "" }}
            />
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={downloadTemplate} disabled={loadingMeta}>
                <DownloadIcon className="mr-2 h-4 w-4" />
                Télécharger un modèle
              </Button>
              <span className="text-xs text-muted-foreground">
                Le modèle contient une colonne par champ (système + personnalisés).
              </span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileSpreadsheetIcon className="h-5 w-5 flex-shrink-0 text-emerald-600" />
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">{fileName}</CardTitle>
                  <CardDescription>
                    {headers.length} colonne(s) · {dataRows.length} ligne(s) de données
                  </CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={clearFile}>
                <XIcon className="mr-1 h-4 w-4" /> Changer
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* ── Mapping ── */}
      {fileName && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">2 · Association des colonnes</CardTitle>
            <CardDescription>
              Pour chaque champ, choisissez la colonne CSV correspondante. Un champ requis sans colonne
              doit recevoir une valeur appliquée à toutes les lignes. Astuce : si une classe a plusieurs
              salles (A, B…), associez aussi « Salle / Section » — elle se combine à « Classe » (ex. « 1ère AF » + « A »).
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Champ</TableHead>
                  <TableHead className="w-[30%]">Colonne CSV</TableHead>
                  <TableHead>Valeur par défaut (si non associé)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTargets.map((t) => {
                  const mapped = columnMap[t.id]
                  const unmapped = mapped == null
                  const needsDefault = t.required && unmapped
                  const missing = needsDefault && !(defaults[t.id] ?? "").trim()
                  return (
                    <TableRow key={t.id} className={cn(missing && "bg-rose-50/60")}>
                      <TableCell className="align-middle">
                        <span className="text-sm font-medium text-foreground">{t.label}</span>
                        {t.required && <span className="ml-1 text-destructive">*</span>}
                        {t.id.startsWith("cf:") && (
                          <Badge variant="outline" className="ml-2 text-[10px]">perso.</Badge>
                        )}
                      </TableCell>
                      <TableCell className="align-middle">
                        <Select
                          value={mapped != null ? String(mapped) : NONE}
                          onValueChange={(v) =>
                            setColumnMap((m) => ({ ...m, [t.id]: v === NONE ? null : Number(v) }))
                          }
                        >
                          <SelectTrigger className="h-8 w-[220px]">
                            <SelectValue placeholder="— Aucune —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>— Aucune —</SelectItem>
                            {headers.map((h, i) => (
                              <SelectItem key={i} value={String(i)}>{h || `Colonne ${i + 1}`}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="align-middle">
                        {unmapped ? <DefaultInput target={t} /> : <span className="text-xs text-muted-foreground">— (colonne associée)</span>}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Required-fields prompt */}
      {fileName && missingRequired.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex items-start gap-2 py-4 text-sm text-amber-800">
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="font-medium">Champs requis à renseigner :</p>
              <p className="mt-0.5">
                {missingRequired.map((t) => t.label).join(", ")}. Associez une colonne ou saisissez une valeur par défaut ci-dessus.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Preview ── */}
      {fileName && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-2">
                <CardTitle className="text-base">3 · Aperçu</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    {newRows.length} nouveau(x) — données complètes
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
                    {existingRows.length} déjà inscrit(s)
                    {existingRows.some((r) => r.existingChanged) && (
                      <> · {existingRows.filter((r) => r.existingChanged).length} à mettre à jour</>
                    )}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                    {invalidRows.length} incomplet(s) — données manquantes
                  </span>
                </div>
              </div>
              <Button
                onClick={runImport}
                disabled={importing || validRows.length === 0 || missingRequired.length > 0}
                className="bg-[#2C4A6E] text-white hover:bg-[#1F3856]"
              >
                {importing
                  ? <><LoaderIcon className="mr-2 h-4 w-4 animate-spin" /> Import en cours…</>
                  : <>Importer {validRows.length} ligne(s)</>}
              </Button>
            </div>
            <CardDescription className="pt-1">
              Import idempotent : les nouveaux élèves sont créés, les élèves déjà inscrits sont mis à jour
              uniquement si leurs données ont changé, sinon ignorés. Les lignes incomplètes sont exclues.
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>NISU</TableHead>
                  <TableHead>Nom complet</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prepared.slice(0, 20).map((p) => (
                  <TableRow key={p.csvLine}>
                    <TableCell className="text-xs text-muted-foreground">{p.csvLine}</TableCell>
                    <TableCell className="font-mono text-xs">{p.nisu || "—"}</TableCell>
                    <TableCell className="text-sm">{p.name}</TableCell>
                    <TableCell className="text-sm">{p.className}</TableCell>
                    <TableCell>
                      {p.error ? (
                        <span className="text-xs text-rose-700">{p.error}</span>
                      ) : p.match === "existing" ? (
                        <Badge variant="outline" className="border-sky-200 bg-sky-50 text-[10px] text-sky-700">
                          {p.existingChanged ? "Déjà inscrit · à mettre à jour" : "Déjà inscrit"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700">Nouveau</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {prepared.length > 20 && (
              <p className="px-4 py-2 text-xs text-muted-foreground">
                … et {prepared.length - 20} autre(s) ligne(s).
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Incomplets : afficher + télécharger ── */}
      {fileName && invalidRows.length > 0 && (
        <Card className="border-rose-200">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangleIcon className="h-4 w-4 text-rose-600" />
                  Lignes incomplètes ({invalidRows.length})
                </CardTitle>
                <CardDescription>
                  Ces lignes sont exclues de l&apos;import. Téléchargez-les, corrigez-les dans Excel,
                  puis ré-importez le fichier corrigé — les lignes déjà importées seront ignorées (idempotence).
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={downloadIncompleteCSV}>
                <DownloadIcon className="mr-2 h-4 w-4" />
                Télécharger en CSV
              </Button>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="max-h-[420px] overflow-y-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>NISU</TableHead>
                  <TableHead>Nom complet</TableHead>
                  <TableHead>Classe (CSV)</TableHead>
                  <TableHead>Erreur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invalidRows.map((p) => (
                  <TableRow key={p.csvLine}>
                    <TableCell className="text-xs text-muted-foreground">{p.csvLine}</TableCell>
                    <TableCell className="font-mono text-xs">{p.nisu || "—"}</TableCell>
                    <TableCell className="text-sm">{p.name}</TableCell>
                    <TableCell className="text-sm">{p.className}</TableCell>
                    <TableCell className="text-xs text-rose-700">{p.error}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Results ── */}
      {results && (
        <Card className="border-2 border-[#2C4A6E]/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2Icon className="h-5 w-5 text-emerald-600" />
              Résultat de l&apos;import
            </CardTitle>
            <CardDescription>
              {results.summary.created} créé(s) · {results.summary.updated} mis à jour ·{" "}
              {results.summary.unchanged} inchangé(s) · {results.summary.failed} échec(s) sur{" "}
              {results.summary.total} ligne(s).
            </CardDescription>
          </CardHeader>
          {results.summary.failed > 0 && (
            <>
              <Separator />
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>NISU</TableHead>
                      <TableHead>Erreur</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.rows.filter((r) => r.status === "error").map((r) => (
                      <TableRow key={r.csvLine}>
                        <TableCell className="text-xs text-muted-foreground">{r.csvLine}</TableCell>
                        <TableCell className="font-mono text-xs">{r.nisu}</TableCell>
                        <TableCell className="text-xs text-rose-700">{r.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </>
          )}
          <Separator />
          <CardContent className="flex items-center justify-between py-3">
            <Button variant="outline" size="sm" onClick={clearFile}>Importer un autre fichier</Button>
            <Button asChild size="sm" className="bg-[#2C4A6E] text-white hover:bg-[#1F3856]">
              <Link href="/admin/all-students">Voir les élèves</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
