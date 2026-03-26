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
        className="max-w-xl"
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E8E6E3',
          borderRadius: '10px',
          padding: '32px'
        }}
      >
        <DialogHeader>
          <DialogTitle
            className="heading-3"
            style={{ color: '#1E1A17', marginBottom: '8px' }}
          >
            Réouvrir la {periodName}
          </DialogTitle>
          <DialogDescription
            className="body-base"
            style={{ color: '#5C5955' }}
          >
            Cette action permettra de modifier les notes déjà saisies
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6">
          {/* Warning Alert */}
          <Alert
            style={{
              backgroundColor: '#FEF6E0',
              border: '1px solid #F0D98E',
              borderRadius: '8px'
            }}
          >
            <AlertDescription
              className="body-base"
              style={{
                color: '#8B6914',
                fontWeight: 500
              }}
            >
              Réouvrir une étape clôturée peut affecter les bulletins déjà générés.
            </AlertDescription>
          </Alert>

          {/* Reason Selection */}
          <div className="space-y-2" style={{ marginTop: '20px' }}>
            <Label
              htmlFor="reason"
              className="label-ui"
              style={{
                color: '#1E1A17',
                fontWeight: 600
              }}
            >
              Raison de la réouverture <span style={{ color: '#C84A3D' }}>*</span>
            </Label>
            <Select value={selectedReason} onValueChange={setSelectedReason}>
              <SelectTrigger
                id="reason"
                style={{
                  border: '1px solid #D1CECC',
                  borderRadius: '8px',
                  backgroundColor: '#FFFFFF'
                }}
                className="focus:border-[#2C4A6E] focus:ring-[#2C4A6E]"
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
            onClick={() => handleOpenChange(false)}
            style={{
              borderRadius: '8px',
              border: '1px solid #D1CECC',
              color: '#5C5955'
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedReason}
            style={{
              backgroundColor: selectedReason ? '#2C4A6E' : '#E8E6E3',
              color: selectedReason ? '#FFFFFF' : '#A8A5A2',
              borderRadius: '8px',
              cursor: selectedReason ? 'pointer' : 'not-allowed'
            }}
            className={selectedReason ? 'hover:bg-[#243B56]' : ''}
          >
            Réouvrir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}