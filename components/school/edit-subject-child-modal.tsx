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
  coefficient: number
}

interface SubjectChild {
  id: string
  code: string
  parentId: string
  name: string
  type: 'L' | 'C' | 'N' | 'P' | 'T'
  coefficient: number
}

interface EditSubjectChildModalProps {
  child: SubjectChild
  parent: SubjectParent
  existingChildren: SubjectChild[]
  onSubmit?: (data: {
    name: string
    type: 'L' | 'C' | 'N' | 'P' | 'T'
    coefficient: number
  }) => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function EditSubjectChildModal({
  child,
  parent,
  existingChildren,
  onSubmit,
  trigger,
  open: controlledOpen,
  onOpenChange
}: EditSubjectChildModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [name, setName] = useState(child.name)
  const [type, setType] = useState<'L' | 'C' | 'N' | 'P' | 'T'>(child.type)
  const [coefficient, setCoefficient] = useState(child.coefficient.toString())

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen

  const setIsOpen = (open: boolean) => {
    if (isControlled) {
      onOpenChange?.(open)
    } else {
      setInternalOpen(open)
    }
  }

  // Reset form when child changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setName(child.name)
      setType(child.type)
      setCoefficient(child.coefficient.toString())
    }
  }, [isOpen, child])

  // Calculate current total coefficient (excluding this child)
  const otherChildrenTotal = existingChildren
    .filter(c => c.parentId === parent.id && c.id !== child.id)
    .reduce((sum, c) => sum + c.coefficient, 0)
  
  const newTotal = otherChildrenTotal + (coefficient ? parseInt(coefficient) : 0)
  const isValidTotal = newTotal <= parent.coefficient

  // Check if any field has changed
  const hasChanges = 
    name.trim() !== child.name ||
    type !== child.type ||
    parseInt(coefficient) !== child.coefficient

  // Check if form is valid
  const isFormValid = name.trim() !== '' && coefficient !== '' && 
    parseInt(coefficient) >= 1 && isValidTotal

  const isSubmitEnabled = hasChanges && isFormValid

  const handleSubmit = () => {
    if (!isSubmitEnabled) return

    onSubmit?.({
      name: name.trim(),
      type,
      coefficient: parseInt(coefficient)
    })

    setIsOpen(false)
  }

  const handleCancel = () => {
    setName(child.name)
    setType(child.type)
    setCoefficient(child.coefficient.toString())
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        style={{
          maxWidth: '560px',
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
              fontFamily: 'var(--font-serif)',
              marginBottom: '8px'
            }}
          >
            Modifier la sous-matière — {child.name}
          </DialogTitle>
          <DialogDescription
            style={{
              color: '#5C5955',
              fontSize: '14px',
              fontWeight: 400
            }}
          >
            {child.code} · Matière parent: {parent.code}
          </DialogDescription>
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
              placeholder="Ex: Communication Française"
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
              value={child.code}
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
              Non modifiable
            </p>
          </div>

          {/* Type de sous-matière */}
          <div className="space-y-2">
            <Label
              style={{
                color: '#1E1A17',
                fontSize: '13px',
                fontWeight: 500
              }}
            >
              Type de sous-matière <span style={{ color: '#C84A3D' }}>*</span>
            </Label>
            <RadioGroup
              value={type}
              onValueChange={(value) => setType(value as 'L' | 'C' | 'N' | 'P' | 'T')}
              className="flex flex-wrap gap-3"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="L" id="type-l" />
                <Label
                  htmlFor="type-l"
                  style={{
                    color: '#1E1A17',
                    fontSize: '14px',
                    fontWeight: 400,
                    cursor: 'pointer'
                  }}
                >
                  L — Langue / Communication
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="C" id="type-c" />
                <Label
                  htmlFor="type-c"
                  style={{
                    color: '#1E1A17',
                    fontSize: '14px',
                    fontWeight: 400,
                    cursor: 'pointer'
                  }}
                >
                  C — Calcul / Logique
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="N" id="type-n" />
                <Label
                  htmlFor="type-n"
                  style={{
                    color: '#1E1A17',
                    fontSize: '14px',
                    fontWeight: 400,
                    cursor: 'pointer'
                  }}
                >
                  N — Naturelle / Science
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="P" id="type-p" />
                <Label
                  htmlFor="type-p"
                  style={{
                    color: '#1E1A17',
                    fontSize: '14px',
                    fontWeight: 400,
                    cursor: 'pointer'
                  }}
                >
                  P — Pratique / Application
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="T" id="type-t" />
                <Label
                  htmlFor="type-t"
                  style={{
                    color: '#1E1A17',
                    fontSize: '14px',
                    fontWeight: 400,
                    cursor: 'pointer'
                  }}
                >
                  T — Théorie
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
              value={coefficient}
              onChange={(e) => setCoefficient(e.target.value)}
              placeholder="Ex: 30"
              style={{
                border: '1px solid #D1CECC',
                borderRadius: '8px'
              }}
              className="focus:border-[#5A7085] focus:ring-[#5A7085]"
            />
            <p
              style={{
                color: '#78756F',
                fontSize: '12px',
                marginTop: '6px'
              }}
            >
              La somme des coefficients des sous-matières doit égaler {parent.coefficient}
            </p>
            <p
              style={{
                color: isValidTotal ? '#2D7D46' : '#DC2626',
                fontSize: '13px',
                fontWeight: 500,
                marginTop: '6px'
              }}
            >
              {isValidTotal 
                ? `Total actuel: ${newTotal} / ${parent.coefficient}`
                : `Total ${newTotal} / ${parent.coefficient} — Dépasse le coefficient parent`
              }
            </p>
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
