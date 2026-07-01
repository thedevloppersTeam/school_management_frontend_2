"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeftIcon,
  PlusIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  PencilIcon,
  Trash2Icon,
  GripVerticalIcon,
  LockIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
  type ApiFieldGroup,
  type ApiCustomField,
  type CustomFieldType,
  FIELD_TYPE_LABEL,
} from "@/lib/api/student-form"

// ── Default (system) form preview ────────────────────────────────────────────
// Used purely as a visual reference at the top of the builder. These fields
// cannot be edited or removed; only the order of custom groups RELATIVE TO
// the system block can change (handled by displayOrder on custom groups).

const SYSTEM_GROUPS: Array<{ name: string; fields: Array<{ label: string; required: boolean; hint?: string }> }> = [
  {
    name: "Identité",
    fields: [
      { label: "NISU", required: false, hint: "optionnel · 20 caractères alphanumériques exactement" },
      { label: "Nom", required: true },
      { label: "Prénom", required: true },
      { label: "Date de naissance", required: true },
      { label: "Photo de promotion", required: false, hint: "Sert aussi de photo de profil" },
    ],
  },
  {
    name: "Scolarité",
    fields: [{ label: "Classe", required: true }],
  },
  {
    name: "Adresse",
    fields: [{ label: "Adresse", required: false }],
  },
]

// ── Field-editor modal state ──────────────────────────────────────────────────

interface FieldFormState {
  label: string
  type: CustomFieldType
  required: boolean
  placeholder: string
  helpText: string
  optionsText: string // newline-separated options for SELECT
  // Conditional visibility — empty parentFieldId means "always show"
  parentFieldId: string
  showWhenTrue: boolean
}

const EMPTY_FIELD: FieldFormState = {
  label: "",
  type: "TEXT",
  required: false,
  placeholder: "",
  helpText: "",
  optionsText: "",
  parentFieldId: "",
  showWhenTrue: true,
}

const NO_PARENT_SENTINEL = "__none__"

function fieldToForm(f: ApiCustomField): FieldFormState {
  return {
    label: f.label,
    type: f.type,
    required: f.required,
    placeholder: f.placeholder ?? "",
    helpText: f.helpText ?? "",
    optionsText: Array.isArray(f.config?.options) ? f.config.options.join("\n") : "",
    parentFieldId: f.parentFieldId ?? "",
    showWhenTrue: f.showWhenTrue ?? true,
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InscriptionFormBuilderPage() {
  const { toast } = useToast()
  const [groups, setGroups] = useState<ApiFieldGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Group create/edit modal
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<ApiFieldGroup | null>(null)
  const [groupForm, setGroupForm] = useState({ name: "", description: "" })

  // Field create/edit modal
  const [fieldModalOpen, setFieldModalOpen] = useState(false)
  const [fieldModalGroupId, setFieldModalGroupId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<ApiCustomField | null>(null)
  const [fieldForm, setFieldForm] = useState<FieldFormState>(EMPTY_FIELD)

  // Delete confirmations
  const [deletingGroup, setDeletingGroup] = useState<ApiFieldGroup | null>(null)
  const [deletingField, setDeletingField] = useState<ApiCustomField | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<ApiFieldGroup[]>("/api/student-form-fields")
      setGroups(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(toMessage(err, "lors du chargement du formulaire"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // ── Group actions ──────────────────────────────────────────────────────────

  function openCreateGroup() {
    setEditingGroup(null)
    setGroupForm({ name: "", description: "" })
    setGroupModalOpen(true)
  }

  function openEditGroup(group: ApiFieldGroup) {
    setEditingGroup(group)
    setGroupForm({ name: group.name, description: group.description ?? "" })
    setGroupModalOpen(true)
  }

  async function handleSaveGroup() {
    if (!groupForm.name.trim()) {
      toast({ title: "Nom requis", variant: "destructive" })
      return
    }
    setBusy(true)
    try {
      const url = editingGroup
        ? `/api/student-form-fields/groups/update/${editingGroup.id}`
        : "/api/student-form-fields/groups/create"
      await apiFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(groupForm),
      })
      toast({ title: editingGroup ? "Groupe mis à jour" : "Groupe créé" })
      setGroupModalOpen(false)
      await load()
    } catch (err) {
      toast({ title: "Erreur", description: toMessage(err), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  async function confirmDeleteGroup() {
    if (!deletingGroup) return
    setBusy(true)
    try {
      await apiFetch(`/api/student-form-fields/groups/delete/${deletingGroup.id}`, { method: "POST" })
      toast({ title: "Groupe supprimé" })
      setDeletingGroup(null)
      await load()
    } catch (err) {
      toast({ title: "Erreur", description: toMessage(err), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  // ── Field actions ──────────────────────────────────────────────────────────

  function openCreateField(groupId: string) {
    setEditingField(null)
    setFieldModalGroupId(groupId)
    setFieldForm(EMPTY_FIELD)
    setFieldModalOpen(true)
  }

  function openEditField(field: ApiCustomField) {
    setEditingField(field)
    setFieldModalGroupId(field.groupId)
    setFieldForm(fieldToForm(field))
    setFieldModalOpen(true)
  }

  async function handleSaveField() {
    if (!fieldForm.label.trim()) {
      toast({ title: "Libellé requis", variant: "destructive" })
      return
    }
    if (!fieldModalGroupId) return

    const config: { options?: string[] } = {}
    if (fieldForm.type === "SELECT" || fieldForm.type === "RADIO" || fieldForm.type === "MULTI_CHECKBOX") {
      const options = fieldForm.optionsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
      if (options.length === 0) {
        toast({
          title: "Options requises",
          description:
            fieldForm.type === "MULTI_CHECKBOX"
              ? "Au moins une option par ligne pour les cases à cocher."
              : fieldForm.type === "RADIO"
              ? "Au moins une option par ligne pour les boutons radio."
              : "Au moins une option par ligne pour une liste déroulante.",
          variant: "destructive",
        })
        return
      }
      config.options = options
    }

    setBusy(true)
    try {
      const body: Record<string, unknown> = {
        groupId: fieldModalGroupId,
        label: fieldForm.label.trim(),
        type: fieldForm.type,
        required: fieldForm.required,
        placeholder: fieldForm.placeholder.trim() || null,
        helpText: fieldForm.helpText.trim() || null,
        config: Object.keys(config).length > 0 ? config : null,
        // Conditional visibility — send null to clear, or the FK + flag.
        parentFieldId: fieldForm.parentFieldId || null,
        showWhenTrue: fieldForm.parentFieldId ? fieldForm.showWhenTrue : null,
      }
      const url = editingField
        ? `/api/student-form-fields/fields/update/${editingField.id}`
        : "/api/student-form-fields/fields/create"
      await apiFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      toast({ title: editingField ? "Champ mis à jour" : "Champ créé" })
      setFieldModalOpen(false)
      await load()
    } catch (err) {
      toast({ title: "Erreur", description: toMessage(err), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  async function confirmDeleteField() {
    if (!deletingField) return
    setBusy(true)
    try {
      await apiFetch(`/api/student-form-fields/fields/delete/${deletingField.id}`, { method: "POST" })
      toast({ title: "Champ supprimé" })
      setDeletingField(null)
      await load()
    } catch (err) {
      toast({ title: "Erreur", description: toMessage(err), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  // ── Reorder helpers ────────────────────────────────────────────────────────

  async function moveGroup(group: ApiFieldGroup, dir: -1 | 1) {
    const sorted = [...groups].sort((a, b) => a.displayOrder - b.displayOrder)
    const i = sorted.findIndex((g) => g.id === group.id)
    if (i < 0) return
    const j = i + dir
    if (j < 0 || j >= sorted.length) return
    ;[sorted[i], sorted[j]] = [sorted[j], sorted[i]]
    const payload = sorted.map((g, idx) => ({ id: g.id, displayOrder: idx }))
    setGroups(sorted.map((g, idx) => ({ ...g, displayOrder: idx })))
    try {
      await apiFetch("/api/student-form-fields/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups: payload }),
      })
    } catch (err) {
      toast({ title: "Erreur", description: toMessage(err), variant: "destructive" })
      await load()
    }
  }

  async function moveField(field: ApiCustomField, dir: -1 | 1) {
    const group = groups.find((g) => g.id === field.groupId)
    if (!group) return
    const sorted = [...group.fields].sort((a, b) => a.displayOrder - b.displayOrder)
    const i = sorted.findIndex((f) => f.id === field.id)
    if (i < 0) return
    const j = i + dir
    if (j < 0 || j >= sorted.length) return
    ;[sorted[i], sorted[j]] = [sorted[j], sorted[i]]
    const payload = sorted.map((f, idx) => ({ id: f.id, displayOrder: idx }))
    setGroups(
      groups.map((g) =>
        g.id === group.id ? { ...g, fields: sorted.map((f, idx) => ({ ...f, displayOrder: idx })) } : g
      )
    )
    try {
      await apiFetch("/api/student-form-fields/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: payload }),
      })
    } catch (err) {
      toast({ title: "Erreur", description: toMessage(err), variant: "destructive" })
      await load()
    }
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.displayOrder - b.displayOrder),
    [groups]
  )

  // All CHECKBOX fields across all groups — eligible parents for conditional fields.
  // Exclude the field currently being edited (a field can't depend on itself).
  const checkboxFields = useMemo(() => {
    const out: Array<{ id: string; label: string; groupName: string }> = []
    for (const g of groups) {
      for (const f of g.fields) {
        if (f.type !== "CHECKBOX") continue
        if (editingField && f.id === editingField.id) continue
        out.push({ id: f.id, label: f.label, groupName: g.name })
      }
    }
    return out
  }, [groups, editingField])

  // Resolve the parent's label (used in the field list to surface the rule).
  const fieldLabelById = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of groups) for (const f of g.fields) m.set(f.id, f.label)
    return m
  }, [groups])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin/all-students"
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Élèves
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Configurer le formulaire d&apos;inscription
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajoutez des groupes de champs personnalisés au formulaire d&apos;inscription. Les champs système ne peuvent pas être modifiés.
          </p>
        </div>
        <Button onClick={openCreateGroup} className="bg-[#2C4A6E] text-white hover:bg-[#1F3856]">
          <PlusIcon className="mr-2 h-4 w-4" />
          Nouveau groupe
        </Button>
      </div>

      {/* System (default) form preview */}
      <Card className="border-2 border-dashed bg-muted/30">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <LockIcon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base font-semibold">Champs système (non modifiables)</CardTitle>
          </div>
          <CardDescription>
            Ces champs apparaissent toujours en premier dans le formulaire d&apos;inscription. Vos groupes personnalisés s&apos;ajoutent à la suite — par exemple un groupe «&nbsp;Parents&nbsp;» avec nom du père / mère, téléphones et email si vous en avez besoin.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SYSTEM_GROUPS.map((sg) => (
            <div key={sg.name} className="rounded-md border bg-background p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#2C4A6E]">{sg.name}</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {sg.fields.map((f) => (
                  <li key={f.label} className="flex items-baseline gap-1">
                    <span>{f.label}</span>
                    {f.required && <span className="text-destructive">*</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Custom groups */}
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Groupes personnalisés</h2>
        <p className="text-sm text-muted-foreground">
          Les flèches haut / bas réordonnent les groupes et les champs.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ) : error ? (
        <Card className="border-destructive/40">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={load} className="mt-4">
              Réessayer
            </Button>
          </CardContent>
        </Card>
      ) : sortedGroups.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-sm font-semibold text-foreground">Aucun groupe personnalisé</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Créez un groupe pour ajouter des champs à votre formulaire (par exemple : Informations médicales, Contacts d&apos;urgence…).
            </p>
            <Button onClick={openCreateGroup} className="mt-4 bg-[#2C4A6E] text-white hover:bg-[#1F3856]">
              <PlusIcon className="mr-2 h-4 w-4" />
              Créer le premier groupe
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedGroups.map((group, gIdx) => {
            const fields = [...group.fields].sort((a, b) => a.displayOrder - b.displayOrder)
            return (
              <Card key={group.id} className="border bg-card shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col gap-0.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => moveGroup(group, -1)}
                          disabled={gIdx === 0}
                          className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                          aria-label="Monter le groupe"
                        >
                          <ChevronUpIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveGroup(group, 1)}
                          disabled={gIdx === sortedGroups.length - 1}
                          className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                          aria-label="Descendre le groupe"
                        >
                          <ChevronDownIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold">{group.name}</CardTitle>
                        {group.description && (
                          <CardDescription className="mt-0.5">{group.description}</CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openCreateField(group.id)}>
                        <PlusIcon className="mr-1 h-3.5 w-3.5" />
                        Champ
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEditGroup(group)}>
                        <PencilIcon className="mr-1 h-3.5 w-3.5" />
                        Renommer
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingGroup(group)}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2Icon className="mr-1 h-3.5 w-3.5" />
                        Supprimer
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="space-y-2 p-3">
                  {fields.length === 0 ? (
                    <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                      Aucun champ dans ce groupe. Cliquez sur « Champ » pour en ajouter.
                    </p>
                  ) : (
                    fields.map((field, fIdx) => (
                      <div
                        key={field.id}
                        className="flex items-center gap-3 rounded-md border bg-background px-3 py-2"
                      >
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveField(field, -1)}
                            disabled={fIdx === 0}
                            className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                            aria-label="Monter le champ"
                          >
                            <ChevronUpIcon className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveField(field, 1)}
                            disabled={fIdx === fields.length - 1}
                            className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                            aria-label="Descendre le champ"
                          >
                            <ChevronDownIcon className="h-3 w-3" />
                          </button>
                        </div>
                        <GripVerticalIcon className="h-4 w-4 text-muted-foreground/50" />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-medium text-foreground">{field.label}</span>
                            {field.required && (
                              <Badge variant="outline" className="border-rose-200 bg-rose-50 text-[10px] text-rose-700">
                                Requis
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px]">
                              {FIELD_TYPE_LABEL[field.type]}
                            </Badge>
                          </div>
                          {field.helpText && (
                            <p className="text-[10px] text-muted-foreground">{field.helpText}</p>
                          )}
                          {(field.type === "SELECT" || field.type === "RADIO" || field.type === "MULTI_CHECKBOX") && field.config?.options && (
                            <p className="text-[10px] text-muted-foreground">
                              Options : {field.config.options.join(" · ")}
                            </p>
                          )}
                          {field.parentFieldId && (
                            <p className="text-[10px] text-amber-700">
                              Visible si «&nbsp;{fieldLabelById.get(field.parentFieldId) ?? "champ supprimé"}&nbsp;» = {field.showWhenTrue ? "Oui" : "Non"}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center">
                          <Button variant="ghost" size="sm" onClick={() => openEditField(field)}>
                            <PencilIcon className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingField(field)}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2Icon className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Group modal */}
      <Dialog open={groupModalOpen} onOpenChange={setGroupModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Renommer le groupe" : "Nouveau groupe"}</DialogTitle>
            <DialogDescription>
              Les groupes regroupent visuellement plusieurs champs dans le formulaire.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="group-name">
                Nom <span className="text-destructive">*</span>
              </Label>
              <Input
                id="group-name"
                value={groupForm.name}
                onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Informations médicales"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-desc">Description (optionnel)</Label>
              <Input
                id="group-desc"
                value={groupForm.description}
                onChange={(e) => setGroupForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Ex: Allergies, médicaments, contact médical…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupModalOpen(false)} disabled={busy}>
              Annuler
            </Button>
            <Button onClick={handleSaveGroup} disabled={busy || !groupForm.name.trim()} className="bg-[#2C4A6E] text-white hover:bg-[#1F3856]">
              {editingGroup ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Field modal */}
      <Dialog open={fieldModalOpen} onOpenChange={setFieldModalOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingField ? "Modifier le champ" : "Nouveau champ"}</DialogTitle>
            <DialogDescription>
              Le type ne peut pas être changé après création pour préserver les données saisies.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="field-label">
                Libellé <span className="text-destructive">*</span>
              </Label>
              <Input
                id="field-label"
                value={fieldForm.label}
                onChange={(e) => setFieldForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Ex: Groupe sanguin"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="field-type">
                Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={fieldForm.type}
                onValueChange={(v) => setFieldForm((f) => ({ ...f, type: v as CustomFieldType }))}
                disabled={!!editingField}
              >
                <SelectTrigger id="field-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FIELD_TYPE_LABEL) as CustomFieldType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {FIELD_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
              <Switch
                id="field-required"
                checked={fieldForm.required}
                onCheckedChange={(v) => setFieldForm((f) => ({ ...f, required: v }))}
              />
              <Label htmlFor="field-required" className="cursor-pointer text-sm">
                Champ obligatoire
              </Label>
            </div>
            {(fieldForm.type === "TEXT" || fieldForm.type === "TEXTAREA" || fieldForm.type === "NUMBER") && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="field-placeholder">Placeholder (optionnel)</Label>
                <Input
                  id="field-placeholder"
                  value={fieldForm.placeholder}
                  onChange={(e) => setFieldForm((f) => ({ ...f, placeholder: e.target.value }))}
                  placeholder="Ex: Ex: A+, O-…"
                />
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="field-help">Texte d&apos;aide (optionnel)</Label>
              <Input
                id="field-help"
                value={fieldForm.helpText}
                onChange={(e) => setFieldForm((f) => ({ ...f, helpText: e.target.value }))}
                placeholder="Texte affiché sous le champ"
              />
            </div>
            {(fieldForm.type === "SELECT" || fieldForm.type === "RADIO" || fieldForm.type === "MULTI_CHECKBOX") && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="field-options">
                  Options <span className="text-destructive">*</span>{" "}
                  <span className="font-normal text-muted-foreground">
                    (une par ligne — {fieldForm.type === "MULTI_CHECKBOX"
                      ? "l'élève pourra cocher plusieurs valeurs"
                      : "l'élève choisira une seule valeur"})
                  </span>
                </Label>
                <Textarea
                  id="field-options"
                  rows={4}
                  value={fieldForm.optionsText}
                  onChange={(e) => setFieldForm((f) => ({ ...f, optionsText: e.target.value }))}
                  placeholder={
                    fieldForm.type === "MULTI_CHECKBOX"
                      ? "Arachides\nGluten\nLactose\nFruits à coque"
                      : fieldForm.type === "RADIO"
                      ? "Garçon\nFille"
                      : "A+\nA-\nB+\nB-\nO+\nO-\nAB+\nAB-"
                  }
                />
              </div>
            )}

            {/* ── Visibilité conditionnelle ── */}
            <div className="space-y-2 rounded-md border bg-muted/30 p-3 sm:col-span-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Visibilité conditionnelle (optionnel)
              </div>
              {checkboxFields.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Aucune case à cocher n&apos;est encore définie. Créez d&apos;abord un champ de type «&nbsp;Case à cocher&nbsp;» pour pouvoir y rattacher un champ conditionnel.
                </p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="field-parent" className="text-xs">
                      Afficher uniquement si...
                    </Label>
                    <Select
                      value={fieldForm.parentFieldId || NO_PARENT_SENTINEL}
                      onValueChange={(v) =>
                        setFieldForm((f) => ({ ...f, parentFieldId: v === NO_PARENT_SENTINEL ? "" : v }))
                      }
                    >
                      <SelectTrigger id="field-parent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_PARENT_SENTINEL}>Toujours afficher</SelectItem>
                        {checkboxFields.map((cb) => (
                          <SelectItem key={cb.id} value={cb.id}>
                            {cb.label}{" "}
                            <span className="text-muted-foreground">— {cb.groupName}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {fieldForm.parentFieldId && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">…vaut</Label>
                      <div className="inline-flex overflow-hidden rounded-md border bg-background">
                        <button
                          type="button"
                          onClick={() => setFieldForm((f) => ({ ...f, showWhenTrue: true }))}
                          className={cn(
                            "px-3 py-1.5 text-xs font-medium transition-colors",
                            fieldForm.showWhenTrue
                              ? "bg-emerald-600 text-white"
                              : "text-muted-foreground hover:bg-muted"
                          )}
                        >
                          Oui (coché)
                        </button>
                        <button
                          type="button"
                          onClick={() => setFieldForm((f) => ({ ...f, showWhenTrue: false }))}
                          className={cn(
                            "px-3 py-1.5 text-xs font-medium transition-colors",
                            !fieldForm.showWhenTrue
                              ? "bg-rose-600 text-white"
                              : "text-muted-foreground hover:bg-muted"
                          )}
                        >
                          Non (décoché)
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Quand la condition n&apos;est pas remplie, ce champ est masqué dans le formulaire d&apos;inscription et sa valeur n&apos;est pas demandée (même s&apos;il est marqué obligatoire).
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFieldModalOpen(false)} disabled={busy}>
              Annuler
            </Button>
            <Button
              onClick={handleSaveField}
              disabled={busy || !fieldForm.label.trim()}
              className="bg-[#2C4A6E] text-white hover:bg-[#1F3856]"
            >
              {editingField ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmations */}
      <AlertDialog open={!!deletingGroup} onOpenChange={(o) => !o && setDeletingGroup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le groupe « {deletingGroup?.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Tous les champs personnalisés de ce groupe et les valeurs déjà saisies pour les élèves seront supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteGroup}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingField} onOpenChange={(o) => !o && setDeletingField(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le champ « {deletingField?.label} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les valeurs saisies pour ce champ seront définitivement perdues.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteField}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
