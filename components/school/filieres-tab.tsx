"use client"

// Gestion des filières (class_tracks). Une filière est ensuite affectée aux
// élèves de classe terminale et aux matières d'examen officiel.

import { useEffect, useState, useCallback } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { PlusIcon, PencilIcon, GraduationCapIcon } from "lucide-react"
import { toMessage } from "@/lib/errors"

interface Track { id: string; code: string; name: string; description?: string | null }
interface TrackForm { code: string; name: string; description: string }

const EMPTY: TrackForm = { code: "", name: "", description: "" }

export function FilieresTab() {
  const { toast } = useToast()
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Track | null>(null)
  const [form, setForm] = useState<TrackForm>(EMPTY)
  const [submitting, setSubmitting] = useState(false)

  const fetchTracks = useCallback(async (): Promise<Track[]> => {
    try {
      const res = await fetch("/api/class-tracks", { credentials: "include" })
      const data = res.ok ? await res.json() : []
      return Array.isArray(data) ? data : []
    } catch {
      return []
    }
  }, [])

  // Chargement initial : le .then s'exécute de façon asynchrone → pas de
  // setState synchrone dans l'effet.
  useEffect(() => {
    let cancelled = false
    fetchTracks().then(d => {
      if (cancelled) return
      setTracks(d)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [fetchTracks])

  const load = useCallback(async () => {
    setLoading(true)
    setTracks(await fetchTracks())
    setLoading(false)
  }, [fetchTracks])

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModalOpen(true) }
  const openEdit = (t: Track) => {
    setEditing(t)
    setForm({ code: t.code, name: t.name, description: t.description ?? "" })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) return
    setSubmitting(true)
    try {
      const url = editing
        ? `/api/class-tracks/update/${editing.id}`
        : "/api/class-tracks/create"
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          description: form.description.trim() || undefined,
        }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.message ?? "Échec de l'enregistrement")
      toast({ title: editing ? "Filière modifiée" : "Filière créée" })
      setModalOpen(false)
      await load()
    } catch (err) {
      toast({ title: "Erreur", description: toMessage(err, "lors de l'enregistrement de la filière"), variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="border bg-card shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <GraduationCapIcon className="h-4 w-4 text-muted-foreground" />
            Filières
          </CardTitle>
          <CardDescription>
            Les filières (SMP, SVT, LLA…) s&apos;affectent aux élèves de classe
            terminale et aux matières d&apos;examen officiel.
          </CardDescription>
        </div>
        <Button size="sm" onClick={openCreate} className="bg-[#2C4A6E] text-white hover:bg-[#1F3856]">
          <PlusIcon className="mr-2 h-4 w-4" />
          Nouvelle filière
        </Button>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-2 p-6">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : tracks.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            Aucune filière. Créez-en une pour pouvoir inscrire des élèves en classe terminale.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[120px] pl-6 font-semibold">Code</TableHead>
                <TableHead className="font-semibold">Nom</TableHead>
                <TableHead className="font-semibold">Description</TableHead>
                <TableHead className="pr-6 text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tracks.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="pl-6">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground">
                      {t.code}
                    </code>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{t.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.description || "—"}</TableCell>
                  <TableCell className="pr-6 text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                      <PencilIcon className="mr-1 h-3.5 w-3.5" />
                      Modifier
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Modal création / modification */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier la filière" : "Nouvelle filière"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="track-code">Code <span className="text-error">*</span></Label>
              <Input
                id="track-code"
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                placeholder="Ex : SMP, SVT, LLA"
                maxLength={10}
                className="uppercase"
              />
              <p className="text-xs text-muted-foreground">Court, unique — apparaît sur les bulletins.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="track-name">Nom <span className="text-error">*</span></Label>
              <Input
                id="track-name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex : Sciences Mathématiques et Physique"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="track-desc">Description (optionnel)</Label>
              <Input
                id="track-desc"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Précision éventuelle"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={submitting || !form.code.trim() || !form.name.trim()}
              className="bg-[#2C4A6E] text-white hover:bg-[#1F3856]"
            >
              {submitting ? "Enregistrement..." : editing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
