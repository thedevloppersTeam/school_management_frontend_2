"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PlusIcon, SearchIcon, PencilIcon, BookOpenIcon } from "lucide-react"
import { clientFetch as apiFetch } from "@/lib/client-fetch"
import { parseDecimal } from "@/lib/decimal"
import { toMessage } from "@/lib/errors"

interface ApiRubric {
  id: string
  name: string
  code: string
}

interface ApiSubject {
  id: string
  name: string
  code: string
  maxScore: unknown
  coefficient: unknown
  hasSections: boolean
  description?: string | null
  rubricId?: string | null
  rubric?: ApiRubric | null
}

interface SubjectRow {
  id: string
  name: string
  code: string
  maxScore: number
  coefficient: number
  hasSections: boolean
  description: string
  rubricId: string | null
  rubricName: string
  rubricCode: string
}

function normalizeSubject(s: ApiSubject): SubjectRow {
  return {
    id: s.id,
    name: s.name,
    code: s.code,
    maxScore: parseDecimal(s.maxScore) ?? 0,
    coefficient: parseDecimal(s.coefficient) ?? 1,
    hasSections: s.hasSections,
    description: s.description ?? "",
    rubricId: s.rubricId ?? null,
    rubricName: s.rubric?.name ?? "—",
    rubricCode: s.rubric?.code ?? "",
  }
}

interface FormState {
  name: string
  code: string
  maxScore: string
  coefficient: string
  rubricId: string
  hasSections: boolean
  description: string
}

const EMPTY_FORM: FormState = {
  name: "",
  code: "",
  maxScore: "100",
  coefficient: "1",
  rubricId: "none",
  hasSections: false,
  description: "",
}

export default function SubjectsManagementPage() {
  const { toast } = useToast()

  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [rubrics, setRubrics] = useState<ApiRubric[]>([])
  const [loading, setLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState("")
  const [filterRubric, setFilterRubric] = useState<string>("all")

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [subjectsData, rubricsData] = await Promise.all([
        apiFetch<ApiSubject[]>("/api/subjects"),
        apiFetch<ApiRubric[]>("/api/subject-rubrics"),
      ])
      setSubjects(subjectsData.map(normalizeSubject))
      setRubrics(rubricsData)
    } catch (err) {
      toast({
        title: "Erreur",
        description: toMessage(err, "lors du chargement des matières"),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const displayed = useMemo(() => {
    let result = subjects
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          s.rubricName.toLowerCase().includes(q)
      )
    }
    if (filterRubric !== "all") {
      result = result.filter((s) => s.rubricId === filterRubric)
    }
    return result
  }, [subjects, searchQuery, filterRubric])

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setIsFormOpen(true)
  }

  function openEdit(row: SubjectRow) {
    setEditingId(row.id)
    setForm({
      name: row.name,
      code: row.code,
      maxScore: String(row.maxScore),
      coefficient: String(row.coefficient),
      rubricId: row.rubricId ?? "none",
      hasSections: row.hasSections,
      description: row.description,
    })
    setIsFormOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return

    const trimmedName = form.name.trim()
    const trimmedCode = form.code.trim().toUpperCase()
    const maxScore = Number(form.maxScore)
    const coefficient = Number(form.coefficient)

    if (!trimmedName || !trimmedCode) {
      toast({ title: "Champs requis", description: "Le nom et le code sont obligatoires", variant: "destructive" })
      return
    }
    if (!Number.isFinite(maxScore) || maxScore <= 0) {
      toast({ title: "Note maximale invalide", description: "Doit être un nombre supérieur à 0", variant: "destructive" })
      return
    }
    if (!Number.isFinite(coefficient) || coefficient <= 0) {
      toast({ title: "Coefficient invalide", description: "Doit être un nombre supérieur à 0", variant: "destructive" })
      return
    }

    const payload = {
      name: trimmedName,
      maxScore,
      coefficient,
      hasSections: form.hasSections,
      rubricId: form.rubricId === "none" ? null : form.rubricId,
      description: form.description.trim() || null,
      ...(editingId ? {} : { code: trimmedCode }),
    }

    setSubmitting(true)
    try {
      if (editingId) {
        await apiFetch(`/api/subjects/update/${editingId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        toast({ title: "Matière modifiée" })
      } else {
        await apiFetch("/api/subjects/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        toast({ title: "Matière créée" })
      }
      setIsFormOpen(false)
      await loadData()
    } catch (err) {
      toast({
        title: editingId ? "Échec de la modification" : "Échec de la création",
        description: toMessage(err),
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-96" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Matières</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Référentiel global des matières — utilisé par toutes les classes et années scolaires.
        </p>
      </div>

      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Liste des matières</CardTitle>
              <CardDescription>
                {displayed.length} matière{displayed.length > 1 ? "s" : ""}
                {filterRubric !== "all" && ` — ${rubrics.find((r) => r.id === filterRubric)?.name ?? ""}`}
                {searchQuery && ` — "${searchQuery}"`}
              </CardDescription>
            </div>
            <Button size="sm" onClick={openCreate}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Nouvelle matière
            </Button>
          </div>
        </CardHeader>

        <Separator />

        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, code ou rubrique..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterRubric} onValueChange={setFilterRubric}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Toutes les rubriques" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les rubriques</SelectItem>
              {rubrics.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <CardContent className="p-0">
          {displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <BookOpenIcon className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">
                {searchQuery || filterRubric !== "all" ? "Aucune matière trouvée" : "Aucune matière"}
              </h3>
              <p className="mt-1 max-w-[320px] text-center text-sm text-muted-foreground">
                {searchQuery || filterRubric !== "all"
                  ? "Modifiez vos critères de recherche."
                  : "Commencez par ajouter votre première matière."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6 font-semibold">Code</TableHead>
                  <TableHead className="font-semibold">Nom</TableHead>
                  <TableHead className="font-semibold">Rubrique</TableHead>
                  <TableHead className="text-right font-semibold">Note max</TableHead>
                  <TableHead className="text-right font-semibold">Coefficient</TableHead>
                  <TableHead className="font-semibold">Sections</TableHead>
                  <TableHead className="pr-6 text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="pl-6">
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                        {row.code}
                      </code>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.rubricName}
                      {row.rubricCode && (
                        <span className="ml-1 text-xs text-muted-foreground/70">({row.rubricCode})</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.maxScore}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.coefficient}</TableCell>
                    <TableCell>
                      {row.hasSections ? (
                        <Badge className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">
                          Avec sections
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Simple</Badge>
                      )}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                        <PencilIcon className="mr-1 h-4 w-4" />
                        Modifier
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier la matière" : "Nouvelle matière"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Le code est immuable après création. Tous les autres champs peuvent être modifiés."
                : "Renseignez les informations de la matière. Le code est définitif après création."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="subject-name">Nom *</Label>
                <Input
                  id="subject-name"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Mathématiques"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject-code">Code *</Label>
                <Input
                  id="subject-code"
                  value={form.code}
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                  placeholder="Ex: MATH"
                  maxLength={10}
                  disabled={!!editingId}
                  required
                />
                {editingId && (
                  <p className="text-xs text-muted-foreground">Le code ne peut pas être modifié.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject-rubric">Rubrique</Label>
                <Select
                  value={form.rubricId}
                  onValueChange={(v) => setForm((p) => ({ ...p, rubricId: v }))}
                >
                  <SelectTrigger id="subject-rubric">
                    <SelectValue placeholder="Aucune" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {rubrics.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject-maxscore">Note maximale *</Label>
                <Input
                  id="subject-maxscore"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.maxScore}
                  onChange={(e) => setForm((p) => ({ ...p, maxScore: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject-coefficient">Coefficient *</Label>
                <Input
                  id="subject-coefficient"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.coefficient}
                  onChange={(e) => setForm((p) => ({ ...p, coefficient: e.target.value }))}
                  required
                />
              </div>

              <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 sm:col-span-2">
                <Switch
                  id="subject-sections"
                  checked={form.hasSections}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, hasSections: v }))}
                />
                <Label htmlFor="subject-sections" className="cursor-pointer text-sm">
                  Cette matière a des sections
                  <span className="ml-2 text-xs text-muted-foreground">
                    (les sections se gèrent dans la configuration de l&apos;année)
                  </span>
                </Label>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="subject-description">Description</Label>
                <Textarea
                  id="subject-description"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  placeholder="Optionnel"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} disabled={submitting}>
                Annuler
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Enregistrement..." : editingId ? "Enregistrer" : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
