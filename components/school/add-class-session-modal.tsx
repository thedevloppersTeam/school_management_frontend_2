"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
      <DialogContent style={{ maxWidth: '420px' }}>
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: '#2A3740' }}>
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">

          {/* Lettre de salle — fondamental et ns-tronc */}
          {level.category !== 'ns-filiere' && (
            <div className="space-y-2">
              <Label style={{ fontSize: '13px', fontWeight: 500, color: '#1E1A17' }}>
                Salle <span style={{ color: '#C43C3C' }}>*</span>
              </Label>
              <Input
                value={letter}
                onChange={e => setLetter(e.target.value.toUpperCase())}
                placeholder="Ex : A, B, C..."
                maxLength={2}
                style={{ border: '1px solid #D1CECC', borderRadius: '8px', textTransform: 'uppercase' }}
              />
              <p style={{ fontSize: '11px', color: '#78756F' }}>
                Lettre identifiant la salle physique
              </p>
            </div>
          )}

          {/* Filière — ns-tronc et ns-filiere */}
          {level.category !== 'fondamental' && (
            <div className="space-y-2">
              <Label style={{ fontSize: '13px', fontWeight: 500, color: '#1E1A17' }}>
                Filière <span style={{ color: '#C43C3C' }}>*</span>
              </Label>
              <Select value={trackId} onValueChange={setTrackId}>
                <SelectTrigger style={{ border: '1px solid #D1CECC', borderRadius: '8px' }}>
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

          {/* Aperçu */}
          <div style={{
            backgroundColor: '#F1F5F9',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '13px',
            color: '#5A7085',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontWeight: 500, color: '#3A4A57' }}>Résultat :</span>
            <span style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #D1CECC',
              borderRadius: '6px',
              padding: '2px 10px',
              fontWeight: 600,
              color: '#2C4A6E',
              fontSize: '13px'
            }}>
              {preview}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            style={{ borderColor: '#D1CECC', color: '#5C5955' }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid() || submitting}
            style={{
              backgroundColor: !isValid() || submitting ? '#9CA3AF' : '#5A7085',
              color: '#FFFFFF',
              borderRadius: '8px',
              cursor: !isValid() || submitting ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? 'Création...' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}