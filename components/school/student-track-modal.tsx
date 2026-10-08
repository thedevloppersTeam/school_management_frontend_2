"use client"

// Filière d'un élève (portée par son inscription). Obligatoire en classe
// terminale — une même salle peut mélanger des élèves de filières différentes.

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"

interface TrackOption { id: string; code: string; name: string }

interface Props {
  open:          boolean
  onOpenChange:  (open: boolean) => void
  enrollmentId:  string
  studentName:   string
  /** La CLASSE seule, ex. « NS3 ». Deux champs distincts jusqu'au rendu :
   *  voir « La Règle des Deux Champs » dans DESIGN.md. */
  classe:        string
  /** La SALLE seule, ex. « A ». Jamais un code de filière : la filière est
   *  précisément ce que cette modale fait saisir, et elle est individuelle. */
  salle:         string
  currentTrackId?: string | null
  onSaved?:      () => void
}

const C = {
  primary: { 800: '#2A3740' },
  neutral: { 300: '#D1CECC', 500: '#78756F' },
}

export function StudentTrackModal({
  open, onOpenChange, enrollmentId, studentName, classe, salle, currentTrackId, onSaved,
}: Props) {
  const { toast } = useToast()
  const [tracks, setTracks] = useState<TrackOption[]>([])
  // Choix explicite de l'utilisateur ; sinon on retombe sur la filière actuelle.
  const [picked, setPicked] = useState<string | null>(null)
  const trackId = picked ?? currentTrackId ?? ""
  const setTrackId = (v: string) => setPicked(v)
  const [saving, setSaving] = useState(false)

  // Le parent remonte le modal à chaque ouverture (rendu conditionnel), donc
  // `picked` repart naturellement à null — pas de reset nécessaire ici.
  useEffect(() => {
    if (!open) return
    fetch("/api/class-tracks", { credentials: "include" })
      .then(r => (r.ok ? r.json() : []))
      .then((d: TrackOption[]) => setTracks(Array.isArray(d) ? d : []))
      .catch(() => setTracks([]))
  }, [open])

  const handleSave = async () => {
    if (!trackId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/enrollments/track-update/${enrollmentId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.message ?? "Échec de la mise à jour")
      const t = tracks.find(x => x.id === trackId)
      toast({ title: "Filière mise à jour", description: t ? `${studentName} → ${t.code}` : undefined })
      onOpenChange(false)
      onSaved?.()
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible d'enregistrer la filière",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: '420px', backgroundColor: 'white', borderRadius: '12px' }}>
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-xl)', fontWeight: 700, color: C.primary[800] }}>
            Filière de l&apos;élève
          </DialogTitle>
          {/* Identité de l'inscription. La classe et la salle sont deux champs
              étiquetés, pas « NS3 A » : c'est ici qu'on choisit une filière,
              et confondre une lettre de salle avec un code de filière est
              exactement l'erreur que cette page doit rendre impossible. */}
          <p style={{ fontSize: 'var(--text-sm)', color: C.neutral[500], marginTop: '2px' }}>
            {studentName}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="text-2xs uppercase tracking-wide">Classe</span>
              <span className={classe ? "font-medium text-foreground" : "italic"}>
                {classe || "non renseignée"}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-2xs uppercase tracking-wide">Salle</span>
              {salle ? (
                <span className="inline-flex items-center justify-center rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
                  {salle}
                </span>
              ) : (
                <span className="italic">non attribuée</span>
              )}
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
              Filière <span style={{ color: '#C43C3C' }}>*</span>
            </Label>
            <Select value={trackId} onValueChange={setTrackId}>
              <SelectTrigger style={{ border: '1px solid #D1CECC', borderRadius: '8px' }}>
                <SelectValue placeholder="Sélectionner une filière" />
              </SelectTrigger>
              <SelectContent>
                {tracks.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.code} — {t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tracks.length === 0 && (
              <p style={{ fontSize: 'var(--text-xs)', color: '#C43C3C' }}>
                Aucune filière définie. Créez-en une d&apos;abord.
              </p>
            )}
          </div>

          <div style={{ backgroundColor: '#F1F5F9', borderRadius: '8px', padding: '10px 14px', fontSize: 'var(--text-xs)', color: '#5A7085' }}>
            La filière détermine les matières d&apos;examen officiel de l&apos;élève. Les
            matières du tronc commun restent les mêmes pour toute la salle.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}
            style={{ borderColor: C.neutral[300] }}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || !trackId}
            style={{ backgroundColor: saving || !trackId ? '#9CA3AF' : '#2C4A6E', color: '#FFFFFF' }}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
