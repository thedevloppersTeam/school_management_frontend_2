"use client"

/**
 * Paramétrage → Relevé de notes.
 *
 * Par niveau : ordre des matières, colonne imposée (automatique, gauche,
 * droite) et présence sur le relevé ; ordre et présence de leurs
 * sous-matières. Le calcul et l'état de l'écran vivent dans
 * lib/releve-settings/model.ts (fonctions pures, testées).
 *
 * Enregistrement : la liste COMPLÈTE des matières du niveau (rangs 1..n), puis,
 * pour chaque matière dont les sous-matières ont changé, la liste COMPLÈTE de
 * ses sous-matières. Après un enregistrement, réussi ou non, l'écran recharge
 * l'état du serveur : il n'affiche jamais comme enregistré ce qui ne l'est pas.
 */
import { useEffect, useState } from "react"
import { ArrowDownIcon, ArrowUpIcon, ChevronDownIcon, ChevronRightIcon, RotateCcwIcon, SaveIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { ApiError, clientFetch } from "@/lib/client-fetch"
import {
  changedSectionSubjects,
  fromApiSubjects,
  hasChanges,
  moveItem,
  sectionsPayload,
  subjectsPayload,
  type ReleveColumnChoice,
  type SubjectSetting,
} from "@/lib/releve-settings/model"

interface ClassTypeRow {
  id: string
  name: string
}

const AIDE =
  "Ces réglages s'appliquent au relevé de notes de toutes les salles et de toutes les années du niveau. " +
  "Masquer une matière ne supprime aucune note et ne change pas le bulletin."

const COLONNES: { value: string; label: string; column: ReleveColumnChoice }[] = [
  { value: "AUTO", label: "Automatique", column: null },
  { value: "LEFT", label: "Gauche", column: "LEFT" },
  { value: "RIGHT", label: "Droite", column: "RIGHT" },
]

/** Message lisible d'une erreur : celui du serveur s'il existe. */
const messageOf = (err: unknown, defaut: string) =>
  err instanceof ApiError && err.message && !/^API error \d+$/.test(err.message) ? err.message : defaut

export default function ReleveSettingsPage() {
  const [classTypes, setClassTypes] = useState<ClassTypeRow[]>([])
  const [classTypeId, setClassTypeId] = useState<string>("")
  const [initial, setInitial] = useState<SubjectSetting[]>([])
  const [current, setCurrent] = useState<SubjectSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pendingType, setPendingType] = useState<string | null>(null)

  const dirty = hasChanges(initial, current)

  /** Charge les matières d'un niveau. Rend true si le chargement a réussi. */
  async function loadSubjects(typeId: string): Promise<boolean> {
    setLoading(true)
    setLoadError(null)
    try {
      const raw = await clientFetch<unknown>("/api/subjects")
      const list = fromApiSubjects(raw, typeId)
      setInitial(list)
      setCurrent(list)
      return true
    } catch (err) {
      setInitial([])
      setCurrent([])
      setLoadError(messageOf(err, "Les matières n'ont pas pu être chargées. Réessayez dans un instant."))
      return false
    } finally {
      setLoading(false)
    }
  }

  // Niveaux, puis matières du premier niveau. Les mises à jour d'état ont
  // lieu après les lectures, jamais de façon synchrone dans l'effet.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const raw = await clientFetch<unknown>("/api/class-types")
        if (cancelled) return
        const types = (Array.isArray(raw) ? raw : [])
          .filter((t): t is ClassTypeRow => !!t && typeof t.id === "string" && typeof t.name === "string")
          .sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }))
        setClassTypes(types)
        if (types.length === 0) {
          setLoading(false)
          return
        }
        setClassTypeId(types[0].id)
        await loadSubjects(types[0].id)
      } catch (err) {
        if (cancelled) return
        setLoadError(messageOf(err, "Les niveaux n'ont pas pu être chargés. Réessayez dans un instant."))
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // Chargement initial unique.
  }, [])

  function switchType(typeId: string) {
    setClassTypeId(typeId)
    setExpanded(new Set())
    setSaved(false)
    setSaveError(null)
    void loadSubjects(typeId)
  }

  function requestType(typeId: string) {
    if (typeId === classTypeId) return
    if (dirty) setPendingType(typeId)
    else switchType(typeId)
  }

  function update(next: SubjectSetting[]) {
    setCurrent(next)
    setSaved(false)
  }

  function patchSubject(id: string, patch: Partial<SubjectSetting>) {
    update(current.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  function moveSection(subjectId: string, index: number, delta: -1 | 1) {
    update(current.map((s) => (s.id === subjectId ? { ...s, sections: moveItem(s.sections, index, delta) } : s)))
  }

  function toggleSection(subjectId: string, sectionId: string, show: boolean) {
    update(
      current.map((s) =>
        s.id === subjectId
          ? { ...s, sections: s.sections.map((x) => (x.id === sectionId ? { ...x, showOnReleve: show } : x)) }
          : s,
      ),
    )
  }

  async function save() {
    if (!classTypeId || !dirty) return
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    let firstDone = false
    try {
      await clientFetch("/api/subjects/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subjectsPayload(classTypeId, current)),
      })
      firstDone = true
      for (const subjectId of changedSectionSubjects(initial, current)) {
        const subject = current.find((s) => s.id === subjectId)
        if (!subject) continue
        await clientFetch(`/api/subjects/${encodeURIComponent(subjectId)}/sections/reorder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sectionsPayload(subject)),
        })
      }
      if (await loadSubjects(classTypeId)) setSaved(true)
    } catch (err) {
      const message = messageOf(err, "L'enregistrement a échoué. Réessayez dans un instant.")
      if (firstDone) {
        // Une partie est enregistrée : l'écran recharge l'état réel du serveur.
        setSaveError(
          `Enregistrement incomplet : ${message} L'écran affiche maintenant ce qui est réellement enregistré.`,
        )
        await loadSubjects(classTypeId)
      } else {
        setSaveError(`Rien n'a été enregistré : ${message}`)
      }
    } finally {
      setSaving(false)
    }
  }

  const busy = loading || saving

  return (
    <div className="space-y-6">
      <div>
        <h1 className="heading-2 text-foreground">Relevé de notes</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{AIDE}</p>
      </div>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="text-base">Ordre, colonne et présence des matières</CardTitle>
            <CardDescription>Les matières sont imprimées dans l&apos;ordre ci-dessous.</CardDescription>
          </div>
          <div className="w-full space-y-1.5 sm:w-56">
            <Label htmlFor="releve-niveau">Niveau</Label>
            <Select value={classTypeId} onValueChange={requestType} disabled={busy || classTypes.length === 0}>
              <SelectTrigger id="releve-niveau">
                <SelectValue placeholder="Choisir un niveau" />
              </SelectTrigger>
              <SelectContent>
                {classTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {loadError && (
            <p role="alert" className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">
              {loadError}
            </p>
          )}
          {saveError && (
            <p role="alert" className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">
              {saveError}
            </p>
          )}
          {saved && !dirty && (
            <p role="status" className="rounded-md border border-success-border bg-success-soft px-3 py-2 text-sm text-success-ink">
              Réglages enregistrés.
            </p>
          )}

          {loading ? (
            <div className="space-y-2" aria-busy="true" aria-label="Chargement des matières">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !loadError && current.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {classTypes.length === 0 ? "Aucun niveau n'est défini." : "Aucune matière pour ce niveau."}
            </p>
          ) : (
            !loadError && (
              <ol className="divide-y rounded-md border">
                {current.map((s, i) => {
                  const open = expanded.has(s.id)
                  const columnValue = COLONNES.find((c) => c.column === s.releveColumn)?.value ?? "AUTO"
                  return (
                    <li key={s.id} className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={`Monter ${s.name}`}
                            disabled={saving || i === 0}
                            onClick={() => update(moveItem(current, i, -1))}
                          >
                            <ArrowUpIcon className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={`Descendre ${s.name}`}
                            disabled={saving || i === current.length - 1}
                            onClick={() => update(moveItem(current, i, 1))}
                          >
                            <ArrowDownIcon className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <span className={s.showOnReleve ? "min-w-0 flex-1 truncate font-medium" : "min-w-0 flex-1 truncate font-medium text-muted-foreground line-through"}>
                          {s.name}
                          <span className="ml-2 font-mono text-xs text-muted-foreground">{s.code}</span>
                        </span>
                        <Select
                          value={columnValue}
                          onValueChange={(v) => patchSubject(s.id, { releveColumn: COLONNES.find((c) => c.value === v)?.column ?? null })}
                          disabled={saving}
                        >
                          <SelectTrigger className="h-8 w-36" aria-label={`Colonne de ${s.name}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COLONNES.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`releve-show-${s.id}`}
                            checked={s.showOnReleve}
                            onCheckedChange={(v) => patchSubject(s.id, { showOnReleve: v })}
                            disabled={saving}
                          />
                          <Label htmlFor={`releve-show-${s.id}`} className="text-sm font-normal">
                            Sur le relevé
                          </Label>
                        </div>
                        {s.sections.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-expanded={open}
                            aria-controls={`releve-sections-${s.id}`}
                            onClick={() => {
                              const next = new Set(expanded)
                              if (open) next.delete(s.id)
                              else next.add(s.id)
                              setExpanded(next)
                            }}
                          >
                            {open ? <ChevronDownIcon className="mr-1 h-4 w-4" /> : <ChevronRightIcon className="mr-1 h-4 w-4" />}
                            Sous-matières ({s.sections.length})
                          </Button>
                        )}
                      </div>

                      {open && (
                        <ol id={`releve-sections-${s.id}`} className="ml-10 mt-2 space-y-1 border-l pl-3">
                          {s.sections.map((x, j) => (
                            <li key={x.id} className="flex flex-wrap items-center gap-2">
                              <div className="flex gap-1">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-6 w-6"
                                  aria-label={`Monter ${x.name}`}
                                  disabled={saving || j === 0}
                                  onClick={() => moveSection(s.id, j, -1)}
                                >
                                  <ArrowUpIcon className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-6 w-6"
                                  aria-label={`Descendre ${x.name}`}
                                  disabled={saving || j === s.sections.length - 1}
                                  onClick={() => moveSection(s.id, j, 1)}
                                >
                                  <ArrowDownIcon className="h-3 w-3" />
                                </Button>
                              </div>
                              <span className={x.showOnReleve ? "min-w-0 flex-1 truncate text-sm" : "min-w-0 flex-1 truncate text-sm text-muted-foreground line-through"}>
                                {x.name}
                              </span>
                              <div className="flex items-center gap-2">
                                <Switch
                                  id={`releve-show-${s.id}-${x.id}`}
                                  checked={x.showOnReleve}
                                  onCheckedChange={(v) => toggleSection(s.id, x.id, v)}
                                  disabled={saving}
                                />
                                <Label htmlFor={`releve-show-${s.id}-${x.id}`} className="text-sm font-normal">
                                  Sur le relevé
                                </Label>
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </li>
                  )
                })}
              </ol>
            )
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => switchType(classTypeId)} disabled={busy || !dirty}>
              <RotateCcwIcon className="mr-2 h-4 w-4" />
              Annuler les modifications
            </Button>
            <Button onClick={save} disabled={busy || !dirty || !!loadError}>
              <SaveIcon className="mr-2 h-4 w-4" />
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={pendingType !== null} onOpenChange={(o) => !o && setPendingType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Modifications non enregistrées</AlertDialogTitle>
            <AlertDialogDescription>
              Changer de niveau abandonne les modifications de ce niveau. Elles ne seront pas enregistrées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Rester sur ce niveau</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingType) switchType(pendingType)
                setPendingType(null)
              }}
            >
              Changer de niveau
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
