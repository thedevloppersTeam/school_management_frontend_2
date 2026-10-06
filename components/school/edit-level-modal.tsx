"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  BTN_DIALOG_PRIMARY_CLASS,
  FIELD_LABEL_CLASS,
} from "@/lib/cpmsl-classes"

interface EditLevelModalProps {
  level: {
    id: string
    name: string
    niveau: string
    description?: string
  }
  onConfirm?: (data: {
    description?: string
  }) => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function EditLevelModal({
  level,
  onConfirm,
  trigger,
  open,
  onOpenChange
}: EditLevelModalProps) {
  const [description, setDescription] = useState(level.description || '')
  const maxChars = 200

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setDescription(level.description || '')
    }
  }, [open, level.description])

  const hasChanges = description !== (level.description || '')
  const isFondamentale = level.niveau === 'Fondamentale'

  const title = `Modifier la classe ${level.name}`

  const handleConfirm = () => {
    if (hasChanges) {
      onConfirm?.({
        description: description.trim() || undefined
      })
      onOpenChange?.(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger}
      <DialogContent className="max-w-[520px] rounded-lg border border-neutral-200 p-0"
     >
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="font-sans text-lg font-semibold text-neutral-900"
         >
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6">
          <div className="space-y-5">
            {/* Niveau Field - Read-only */}
            <div>
              <Label className={`${FIELD_LABEL_CLASS} mb-2 block`}
             >
                Niveau *
              </Label>
              <RadioGroup value={level.niveau} disabled>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem
                      value="Fondamentale"
                      id="niveau-fondamentale"
                      disabled className="opacity-50"
                    />
                    <Label
                      htmlFor="niveau-fondamentale" className="cursor-not-allowed text-sm font-normal text-neutral-400"
                   >
                      Fondamentale
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem
                      value="Nouveau Secondaire"
                      id="niveau-secondaire"
                      disabled className="opacity-50"
                    />
                    <Label
                      htmlFor="niveau-secondaire" className="cursor-not-allowed text-sm font-normal text-neutral-400"
                   >
                      Nouveau Secondaire
                    </Label>
                  </div>
                </div>
              </RadioGroup>
              <p className="mt-1.5 text-sm text-neutral-400"
             >
                Le niveau ne peut pas être modifié
              </p>
            </div>

            {/* Nom de la classe Field - Read-only */}
            <div>
              <Label
                htmlFor="class-name" className={`${FIELD_LABEL_CLASS} mb-2 block`}
             >
                Nom de la classe *
              </Label>
              <div className="w-full cursor-not-allowed rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-400"
             >
                {level.name}
              </div>
              <p className="mt-1.5 text-sm text-neutral-400"
             >
                Le nom ne peut pas être modifié
              </p>
            </div>

            {/* Description Field - Editable */}
            <div>
              <Label
                htmlFor="description" className={`${FIELD_LABEL_CLASS} mb-2 block`}
             >
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => {
                  const value = e.target.value
                  if (value.length <= maxChars) {
                    setDescription(value)
                  }
                }}
                placeholder="Description optionnelle..." className="min-h-[100px] resize-y rounded-md border border-neutral-300 text-sm"
              />
              <div className="mt-1.5 flex justify-end"
             >
                <span
                  className={`text-sm ${
                    description.length>= maxChars
                      ? "text-error-ink"
                      : "text-neutral-400"
                  }`}
               >
                  {description.length}/{maxChars} caractères
                </span>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <DialogFooter className="mt-6 flex flex-row justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange?.(false)} className="rounded-md border border-neutral-300 bg-white text-neutral-900"
           >
              Annuler
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!hasChanges} className={BTN_DIALOG_PRIMARY_CLASS}
           >
              Enregistrer
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
