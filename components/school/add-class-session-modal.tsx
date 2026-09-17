"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  BTN_DIALOG_PRIMARY_CLASS,
  BTN_OUTLINE_CLASS,
  DIALOG_CONTENT_CLASS,
  DIALOG_PREVIEW_CLASS,
  DIALOG_TITLE_CLASS,
  FIELD_HINT_CLASS,
  FIELD_LABEL_CLASS,
  INPUT_CLASS,
  REQUIRED_MARK_CLASS,
} from "@/lib/cpmsl-classes"

interface Track {
  id: string
  code: string
  name: string
}

interface AddClassSessionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  level: {
    id: string
    name: string
    category: 'fondamental' | 'ns-tronc' | 'ns-filiere'
  }
  tracks: Track[]
  submitting?: boolean
  onSubmit: (data: { letter?: string; trackId?: string }) => void
}

export function AddClassSessionModal({
  open,
  onOpenChange,
  level,
  tracks,
  submitting = false,
  onSubmit,
}: Readonly<AddClassSessionModalProps>) {
  const [letter,  setLetter]  = useState('')
  const [trackId, setTrackId] = useState('')

  const isValid = () => {
    if (level.category === 'fondamental') return letter.trim().length > 0
    if (level.category === 'ns-tronc')   return letter.trim().length > 0 && trackId.length > 0
    if (level.category === 'ns-filiere') return trackId.length > 0
    return false
  }

  const handleSubmit = () => {
    if (!isValid() || submitting) return
    onSubmit({
      letter:  level.category !== 'ns-filiere' ? letter.trim().toUpperCase() : undefined,
      trackId: level.category !== 'fondamental' ? trackId : undefined,
    })
    reset()
  }

  const reset = () => { setLetter(''); setTrackId('') }

  const handleOpenChange = (o: boolean) => {
    if (!o) reset()
    onOpenChange(o)
  }

  const selectedTrack = tracks.find(t => t.id === trackId)

  const title =
    level.category === 'fondamental' ? `Ajouter une salle — ${level.name}` :
    level.category === 'ns-tronc'    ? `Ajouter une classe — ${level.name}` :
                                       `Ajouter une filière — ${level.name}`

  const preview =
    level.category === 'fondamental'
      ? `${level.name} ${letter || '?'}`
      : level.category === 'ns-tronc'
      ? `${level.name} ${letter || '?'}${selectedTrack ? ` — ${selectedTrack.code}` : ' — ?'}`
      : `${level.name} ${selectedTrack ? selectedTrack.code : '?'}`

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={`${DIALOG_CONTENT_CLASS} max-w-[420px]`}>
        <DialogHeader>
          <DialogTitle className={DIALOG_TITLE_CLASS}>
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">

          {/* Lettre de salle — fondamental et ns-tronc */}
          {level.category !== 'ns-filiere' && (
            <div className="space-y-2">
              <Label htmlFor="class-session-letter" className={FIELD_LABEL_CLASS}>
                Salle <span className={REQUIRED_MARK_CLASS} aria-label="obligatoire">*</span>
              </Label>
              <Input
                id="class-session-letter"
                value={letter}
                onChange={e => setLetter(e.target.value.toUpperCase())}
                placeholder="Ex : A, B, C..."
                maxLength={2}
                className={`${INPUT_CLASS} uppercase`}
              />
              <p className={FIELD_HINT_CLASS}>
                Lettre identifiant la salle physique
              </p>
            </div>
          )}

          {/* Filière — ns-tronc et ns-filiere */}
          {level.category !== 'fondamental' && (
            <div className="space-y-2">
              <Label htmlFor="class-session-track" className={FIELD_LABEL_CLASS}>
                Filière <span className={REQUIRED_MARK_CLASS} aria-label="obligatoire">*</span>
              </Label>
              <Select value={trackId} onValueChange={setTrackId}>
                <SelectTrigger id="class-session-track" className={INPUT_CLASS}>
                  <SelectValue placeholder="Sélectionner une filière" />
                </SelectTrigger>
                <SelectContent>
                  {tracks.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.code} — {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Aperçu du nom qui sera créé */}
          <div className={DIALOG_PREVIEW_CLASS}>
            <span className="font-medium text-primary-700">Résultat :</span>
            <span className="rounded-sm border border-neutral-300 bg-white px-2.5 py-0.5 text-sm font-semibold text-primary-800">
              {preview}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className={BTN_OUTLINE_CLASS}
         >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid() || submitting}
            className={BTN_DIALOG_PRIMARY_CLASS}
         >
            {submitting ? 'Création...' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
