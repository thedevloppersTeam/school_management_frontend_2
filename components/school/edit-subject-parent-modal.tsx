"use client"

import { useState, useEffect } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface SubjectParent {
  id: string
  code: string
  name: string
  rubrique: 'R1' | 'R2' | 'R3'
  coefficient: number
}

interface EditSubjectParentModalProps {
  subject: SubjectParent
  onSubmit?: (data: {
    name: string
    rubrique: 'R1' | 'R2' | 'R3'
    coefficient: number
  }) => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function EditSubjectParentModal({
  subject,
  onSubmit,
  trigger,
  open: controlledOpen,
  onOpenChange
}: EditSubjectParentModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [name, setName] = useState(subject.name)
  const [rubrique, setRubrique] = useState<'R1' | 'R2' | 'R3'>(subject.rubrique)
  const [coefficient, setCoefficient] = useState(subject.coefficient.toString())

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen

  const setIsOpen = (open: boolean) => {
    if (isControlled) {
      onOpenChange?.(open)
    } else {
      setInternalOpen(open)
    }
  }

  // Reset form when subject changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setName(subject.name)
      setRubrique(subject.rubrique)
      setCoefficient(subject.coefficient.toString())
    }
  }, [isOpen, subject])

  // Check if any field has changed
  const hasChanges = 
    name.trim() !== subject.name ||
    rubrique !== subject.rubrique ||
    parseInt(coefficient) !== subject.coefficient

  // Check if form is valid
  const isFormValid = name.trim() !== '' && coefficient !== '' && 
    parseInt(coefficient) >= 1 && parseInt(coefficient) <= 100

  const isSubmitEnabled = hasChanges && isFormValid

  const handleSubmit = () => {
    if (!isSubmitEnabled) return

    onSubmit?.({
      name: name.trim(),
      rubrique,
      coefficient: parseInt(coefficient)
    })

    setIsOpen(false)
  }

  const handleCancel = () => {
    setName(subject.name)
    setRubrique(subject.rubrique)
    setCoefficient(subject.coefficient.toString())
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        style={{
          maxWidth: '520px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E8E6E3',
          borderRadius: '12px',
          padding: 0
        }}
      >
        <DialogHeader style={{ padding: '24px 24px 16px 24px', borderBottom: '1px solid #E8E6E3' }}>
          <DialogTitle
            style={{
              color: '#1E1A17',
              fontSize: '20px',
              fontWeight: 600,
              fontFamily: 'var(--font-serif)'
            }}
          >
            Modifier la matière — {subject.name}
          </DialogTitle>
        </DialogHeader>

        <div style={{ padding: '24px' }} className="space-y-5">
          {/* Nom */}
          <div className="space-y-2">
            <Label
              htmlFor="name"
              style={{
                color: '#1E1A17',
                fontSize: '13px',
                fontWeight: 500
              }}
            >
              Nom <span style={{ color: '#C84A3D' }}>*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Mathématiques"
              style={{
                border: '1px solid #D1CECC',
                borderRadius: '8px'
              }}
              className="focus:border-[#5A7085] focus:ring-[#5A7085]"
            />
          </div>

          {/* Code (read-only) */}
          <div className="space-y-2">
            <Label
              htmlFor="code"
              style={{
                color: '#1E1A17',
                fontSize: '13px',
                fontWeight: 500
              }}
            >
              Code
            </Label>
            <Input
              id="code"
              value={subject.code}
              readOnly
              disabled
              style={{
                border: '1px solid #D1CECC',
                borderRadius: '8px',
                backgroundColor: '#F7F7F6',
                color: '#78756F',
                fontFamily: 'monospace',
                textTransform: 'uppercase',
                cursor: 'not-allowed'
              }}
            />
            <p
              style={{
                color: '#78756F',
                fontSize: '12px',
                marginTop: '6px'
              }}
            >
              Modifier le nom ne met pas à jour le code
            </p>
          </div>

          {/* Rubrique */}
          <div className="space-y-2">
            <Label
              style={{
                color: '#1E1A17',
                fontSize: '13px',
                fontWeight: 500
              }}
            >
              Rubrique <span style={{ color: '#C84A3D' }}>*</span>
            </Label>
            <RadioGroup
              value={rubrique}
              onValueChange={(value) => setRubrique(value as 'R1' | 'R2' | 'R3')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="R1" id="r1" />
                <Label
                  htmlFor="r1"
                  style={{
                    color: '#1E1A17',
                    fontSize: '14px',
                    fontWeight: 400,
                    cursor: 'pointer'
                  }}
                >
                  R1
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="R2" id="r2" />
                <Label
                  htmlFor="r2"
                  style={{
                    color: '#1E1A17',
                    fontSize: '14px',
                    fontWeight: 400,
                    cursor: 'pointer'
                  }}
                >
                  R2
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="R3" id="r3" />
                <Label
                  htmlFor="r3"
                  style={{
                    color: '#1E1A17',
                    fontSize: '14px',
                    fontWeight: 400,
                    cursor: 'pointer'
                  }}
                >
                  R3
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Coefficient */}
          <div className="space-y-2">
            <Label
              htmlFor="coefficient"
              style={{
                color: '#1E1A17',
                fontSize: '13px',
                fontWeight: 500
              }}
            >
              Coefficient <span style={{ color: '#C84A3D' }}>*</span>
            </Label>
            <Input
              id="coefficient"
              type="number"
              min="1"
              max="100"
              value={coefficient}
              onChange={(e) => setCoefficient(e.target.value)}
              placeholder="Ex: 60"
              style={{
                border: '1px solid #D1CECC',
                borderRadius: '8px'
              }}
              className="focus:border-[#5A7085] focus:ring-[#5A7085]"
            />
          </div>
        </div>

        <DialogFooter
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #E8E6E3',
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}
        >
          <Button
            variant="outline"
            onClick={handleCancel}
            style={{
              border: '1px solid #D1CECC',
              color: '#5C5955',
              borderRadius: '8px'
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isSubmitEnabled}
            style={{
              backgroundColor: isSubmitEnabled ? '#2C4A6E' : '#9CA3AF',
              color: '#FFFFFF',
              borderRadius: '8px',
              cursor: isSubmitEnabled ? 'pointer' : 'not-allowed'
            }}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
