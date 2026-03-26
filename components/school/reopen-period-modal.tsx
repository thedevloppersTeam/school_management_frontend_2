"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircleIcon } from "lucide-react"

interface ReopenPeriodModalProps {
  periodName: string
  onConfirm?: (reason: string) => void
  trigger?: React.ReactNode
}

export function ReopenPeriodModal({ periodName, onConfirm, trigger }: ReopenPeriodModalProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")

  const handleConfirm = () => {
    if (reason.trim()) {
      onConfirm?.(reason)
      setOpen(false)
      setReason("")
    }
  }

  const handleCancel = () => {
    setOpen(false)
    setReason("")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm">
            Réouvrir
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircleIcon className="h-5 w-5 text-orange-500" />
            Réouverture de l'étape
          </DialogTitle>
          <DialogDescription>
            Cette action déverrouille la saisie des notes pour cette étape.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-foreground">
              Motif de la réouverture <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Correction d'une erreur de saisie..."
              rows={4}
              className="resize-none border-border focus:border-primary focus:ring-primary"
            />
            {reason.trim() === "" && (
              <p className="text-xs text-muted-foreground">
                Ce champ est obligatoire pour justifier la réouverture
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} className="border-border">
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={reason.trim() === ""}
            className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirmer la réouverture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}