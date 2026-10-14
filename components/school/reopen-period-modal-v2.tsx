"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  ALERT_WARNING_CLASS,
  BTN_DIALOG_PRIMARY_CLASS,
  BTN_OUTLINE_CLASS,
  REQUIRED_MARK_CLASS,
} from "@/lib/cpmsl-classes"

interface ReopenPeriodModalV2Props {
  periodName: string
  onConfirm?: (reason: string) => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const REOPEN_REASONS = [
  "Erreur de saisie détectée",
  "Correction demandée par la direction",
  "Absence d'un enseignant lors de la saisie",
  "Notes incomplètes non détectées",
  "Autre (sur demande de la direction)"
]

export function ReopenPeriodModalV2({
  periodName,
  onConfirm,
  trigger,
  open,
  onOpenChange
}: ReopenPeriodModalV2Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedReason, setSelectedReason] = useState<string>("")

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedReason("")
    }
    if (onOpenChange) {
      onOpenChange(newOpen)
    } else {
      setIsOpen(newOpen)
    }
  }

  const currentOpen = open !== undefined ? open : isOpen

  const handleConfirm = () => {
    if (selectedReason) {
      onConfirm?.(selectedReason)
      handleOpenChange(false)
    }
  }

  return (
    <Dialog open={currentOpen} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className="max-w-xl rounded-lg border border-neutral-200 bg-white p-8"
     >
        <DialogHeader>
          <DialogTitle
            className="heading-3 mb-2 text-neutral-900"
         >
            Réouvrir la {periodName}
          </DialogTitle>
          <DialogDescription
            className="body-base text-neutral-600"
         >
            Cette action permettra de modifier les notes déjà saisies
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6">
          {/* Warning Alert */}
          <Alert className={ALERT_WARNING_CLASS}
         >
            <AlertDescription
              className="body-base font-medium text-warning-ink"
           >
              Réouvrir une étape clôturée peut affecter les bulletins déjà générés.
            </AlertDescription>
          </Alert>

          {/* Reason Selection */}
          <div className="space-y-2 mt-5">
            <Label
              htmlFor="reason"
              className="label-ui font-semibold text-neutral-900"
           >
              Raison de la réouverture <span className={REQUIRED_MARK_CLASS}>*</span>
            </Label>
            <Select value={selectedReason} onValueChange={setSelectedReason}>
              <SelectTrigger
                id="reason"
                className="focus:border-primary-500 focus:ring-primary-500 rounded-md border border-neutral-300 bg-white"
             >
                <SelectValue placeholder="Sélectionnez une raison" />
              </SelectTrigger>
              <SelectContent>
                {REOPEN_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)} className={BTN_OUTLINE_CLASS}
         >
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedReason} className={BTN_DIALOG_PRIMARY_CLASS}
         >
            Réouvrir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}