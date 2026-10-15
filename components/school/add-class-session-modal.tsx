"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
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

interface AddClassSessionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  level: {
    id: string
    name: string
    /**
     * Plus lu ici : le titre ne depend plus de la categorie du niveau (voir
     * plus bas). Le champ reste declare le temps que soit tranche le sort de
     * la categorie `ns-filiere` elle-meme, qui n'existe qu'au frontend.
     */
    category: 'fondamental' | 'ns-tronc' | 'ns-filiere'
  }
  submitting?: boolean
  onSubmit: (data: { letter?: string }) => void
}

/**
 * Creation d'une salle pour un niveau donne.
 *
 * Une salle NE PORTE PAS de filiere. `Class` n'a aucune colonne `track` et
 * `createClass` ne persiste que { classTypeId, letter, maxStudents,
 * description }. La filiere est individuelle : elle vit sur l'inscription de
 * l'eleve (`Enrollment.trackId`) et se choisit a l'inscription, pas ici. Le
 * champ « Filiere * » qui figurait dans ce formulaire n'etait enregistre nulle
 * part et son apercu annoncait un libelle (« NSIII SMP ») que la liste des
 * salles n'affichait jamais : le nom reel est toujours
 * `${classType.name} ${letter}`.
 *
 * Le seul discriminant d'une salle, quel que soit le niveau, est donc sa
 * lettre — y compris pour NSIII / NSIV, ou elle n'etait pas demandee et
 * retombait silencieusement sur « A ».
 */
export function AddClassSessionModal({
  open,
  onOpenChange,
  level,
  submitting = false,
  onSubmit,
}: Readonly<AddClassSessionModalProps>) {
  const [letter, setLetter] = useState('')

  const isValid = () => letter.trim().length > 0

  const handleSubmit = () => {
    if (!isValid() || submitting) return
    onSubmit({ letter: letter.trim().toUpperCase() })
    reset()
  }

  const reset = () => { setLetter('') }

  const handleOpenChange = (o: boolean) => {
    if (!o) reset()
    onOpenChange(o)
  }

  /**
   * Un seul titre, quel que soit le niveau. Il en existait trois — « salle »
   * au fondamental, « classe » pour NS1/NS2, « filière » pour NS3/NS4 — reste
   * de la conception ou une salle de NS3 ETAIT une filiere. Le formulaire ne
   * demande qu'une lettre de salle et l'action qui l'ouvre dit « Ajouter
   * salle » pour tous les niveaux : le titre disait autre chose que ce que la
   * modale fait.
   */
  const title = `Ajouter une salle — ${level.name}`

  const preview = `${level.name} ${letter || '?'}`

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={`${DIALOG_CONTENT_CLASS} max-w-[420px]`}>
        <DialogHeader>
          <DialogTitle className={DIALOG_TITLE_CLASS}>
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">

          {/* Lettre de salle — seul identifiant persiste d'une salle */}
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
