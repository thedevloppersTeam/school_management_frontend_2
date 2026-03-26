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

interface SubjectChild {
  id: string
  code: string
  parentId: string
  coefficient: number
}

interface AddSubjectChildModalProps {
  parent: SubjectParent
  existingChildren: SubjectChild[]
  onSubmit?: (data: {
    name: string
    code: string
    type: 'L' | 'C' | 'N' | 'P' | 'T'
    coefficient: number
  }) => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function AddSubjectChildModal({
  parent,
  existingChildren,
  onSubmit,
  trigger,
  open: controlledOpen,
  onOpenChange
}: AddSubjectChildModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [name, setName] = useState("")
  const [type, setType] = useState<'L' | 'C' | 'N' | 'P' | 'T' | ''>('')
  const [coefficient, setCoefficient] = useState("")

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen

  const setIsOpen = (open: boolean) => {
    if (isControlled) {
      onOpenChange?.(open)
    } else {
      setInternalOpen(open)
    }
  }

  // Generate code from parent code and type
  const generateCode = (selectedType: string): string => {
    if (!selectedType) return ""
    
    // Extract first 3 letters from parent code
    const parentLetters = parent.code.substring(0, 3)
    
    // Find next available number for this type
    let number = 1
    const existingCodesForType = existingChildren
      .filter(c => c.code.startsWith(`${parentLetters}${selectedType}`))
      .map(c => c.code)
    
    while (existingCodesForType.includes(`${parentLetters}${selectedType}${number.toString().padStart(2, '0')}`)) {
      number++
    }
    
    return `${parentLetters}${selectedType}${number.toString().padStart(2, '0')}`
  }

  const generatedCode = generateCode(type)

  // Calculate current total coefficient
  const currentTotal = existingChildren
    .filter(c => c.parentId === parent.id)
    .reduce((sum, c) => sum + c.coefficient, 0)
  
  const newTotal = currentTotal + (coefficient ? parseInt(coefficient) : 0)
  const isValidTotal = newTotal <= parent.coefficient
  const isMaxReached = currentTotal >= parent.coefficient
  const availableCoefficient = parent.coefficient - currentTotal

  // Check if form is valid
  const isFormValid = name.trim() !== '' && type !== '' && coefficient !== '' && 
    parseInt(coefficient) >= 1 && isValidTotal && !isMaxReached

  const handleSubmit = () => {
    if (!isFormValid) return

    onSubmit?.({
      name: name.trim(),
      code: generatedCode,
      type: type as 'L' | 'C' | 'N' | 'P' | 'T',
      coefficient: parseInt(coefficient)
    })

    // Reset form
    setName("")
    setType('')
    setCoefficient("")
    setIsOpen(false)
  }

  const handleCancel = () => {
    setName("")
    setType('')
    setCoefficient("")
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
            Ajouter une sous-matière — {parent.name}
          </DialogTitle>
          <DialogDescription
            style={{
              color: '#5C5955',
              fontSize: '14px',
              fontWeight: 400
            }}
          >
            {parent.code} · {parent.rubrique} · Coefficient parent: {parent.coefficient}
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
              value={generatedCode}
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
              Généré automatiquement — non modifiable
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
              placeholder={isMaxReached ? `Solde disponible : 0` : `Ex: 30`}
              disabled={isMaxReached}
              style={{
                border: '1px solid #D1CECC',
                borderRadius: '8px',
                backgroundColor: isMaxReached ? '#F7F7F6' : '#FFFFFF',
                cursor: isMaxReached ? 'not-allowed' : 'text'
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
                color: isValidTotal ? '#2D7D46' : '#C48B1A',
                fontSize: '13px',
                fontWeight: 500,
                marginTop: '6px'
              }}
            >
              Total actuel: {newTotal} / {parent.coefficient}
            </p>
            {isMaxReached && (
              <p
                style={{
                  color: '#DC2626',
                  fontSize: '13px',
                  fontWeight: 500,
                  marginTop: '6px'
                }}
              >
                Coefficient maximum atteint. Impossible d'ajouter une sous-matière.
              </p>
            )}
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
            disabled={!isFormValid}
            style={{
              backgroundColor: isFormValid ? '#2C4A6E' : '#9CA3AF',
              color: '#FFFFFF',
              borderRadius: '8px',
              cursor: isFormValid ? 'pointer' : 'not-allowed'
            }}
          >
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
