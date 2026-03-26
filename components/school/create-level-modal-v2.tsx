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
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"

interface Level {
  id: string
  name: string
  niveau: string
}

interface CreateLevelModalV2Props {
  existingLevels: Level[]
  yearName: string
  onSubmit?: (data: {
    niveau: 'Fondamentale' | 'Nouveau Secondaire'
    name: string
    filieres?: string[]
    description?: string
  }) => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function CreateLevelModalV2({
  existingLevels,
  yearName,
  onSubmit,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange
}: CreateLevelModalV2Props) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [niveau, setNiveau] = useState<'Fondamentale' | 'Nouveau Secondaire'>('Fondamentale')
  const [name, setName] = useState('')
  const [selectedFilieres, setSelectedFilieres] = useState<string[]>([])
  const [description, setDescription] = useState('')

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen

  // Get available class names based on niveau
  const getAvailableClassNames = () => {
    const existingNames = existingLevels
      .filter(l => l.niveau === niveau)
      .map(l => l.name)

    if (niveau === 'Fondamentale') {
      return ['7e', '8e', '9e'].filter(n => !existingNames.includes(n))
    } else {
      return ['NSI', 'NSII', 'NSIII', 'NSIV'].filter(n => !existingNames.includes(n))
    }
  }

  const availableClassNames = getAvailableClassNames()

  // Reset form when niveau changes
  useEffect(() => {
    setName('')
    setSelectedFilieres([])
  }, [niveau])

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setNiveau('Fondamentale')
      setName('')
      setSelectedFilieres([])
      setDescription('')
    }
  }, [open])

  const handleFiliereToggle = (filiere: string) => {
    setSelectedFilieres(prev =>
      prev.includes(filiere)
        ? prev.filter(f => f !== filiere)
        : [...prev, filiere]
    )
  }

  const isFormValid = () => {
    if (!name) return false
    if (niveau === 'Nouveau Secondaire' && selectedFilieres.length === 0) return false
    return true
  }

  const handleSubmit = () => {
    if (!isFormValid()) return

    onSubmit?.({
      niveau,
      name,
      filieres: niveau === 'Nouveau Secondaire' ? selectedFilieres : undefined,
      description: description.trim() || undefined
    })

    setOpen(false)
  }

  const charCount = description.length
  const maxChars = 200

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className="sm:max-w-[520px]"
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E8E6E3',
          borderRadius: '12px',
          padding: 0
        }}
      >
        <DialogHeader style={{ padding: '24px 24px 16px 24px', borderBottom: '1px solid #E8E6E3' }}>
          <DialogTitle
            style={{
              color: '#2A3740',
              fontSize: '20px',
              fontWeight: 600,
              fontFamily: 'var(--font-serif)',
              marginBottom: '4px'
            }}
          >
            Nouvelle classe
          </DialogTitle>
          <DialogDescription
            style={{
              color: '#5C5955',
              fontSize: '14px',
              fontWeight: 400
            }}
          >
            Ajoutez une classe pour l'année {yearName}
          </DialogDescription>
        </DialogHeader>

        <div style={{ padding: '24px' }} className="space-y-6">
          {/* Niveau Selection */}
          <div className="space-y-3">
            <Label
              style={{
                color: '#2A3740',
                fontSize: '13px',
                fontWeight: 500,
                display: 'block'
              }}
            >
              Niveau <span style={{ color: '#C84A3D' }}>*</span>
            </Label>
            <RadioGroup
              value={niveau}
              onValueChange={(value) => setNiveau(value as 'Fondamentale' | 'Nouveau Secondaire')}
              className="flex items-center gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Fondamentale" id="fondamentale" />
                <Label
                  htmlFor="fondamentale"
                  style={{
                    color: '#2A3740',
                    fontSize: '14px',
                    fontWeight: 400,
                    cursor: 'pointer'
                  }}
                >
                  Fondamentale
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Nouveau Secondaire" id="secondaire" />
                <Label
                  htmlFor="secondaire"
                  style={{
                    color: '#2A3740',
                    fontSize: '14px',
                    fontWeight: 400,
                    cursor: 'pointer'
                  }}
                >
                  Nouveau Secondaire
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Class Name Selection */}
          <div className="space-y-3">
            <Label
              htmlFor="name"
              style={{
                color: '#2A3740',
                fontSize: '13px',
                fontWeight: 500,
                display: 'block'
              }}
            >
              Nom de la classe <span style={{ color: '#C84A3D' }}>*</span>
            </Label>
            <Select value={name} onValueChange={setName}>
              <SelectTrigger
                id="name"
                style={{
                  border: '1px solid #D1CECC',
                  borderRadius: '8px',
                  backgroundColor: '#FFFFFF'
                }}
                className="focus:border-[#5A7085] focus:ring-[#5A7085]"
              >
                <SelectValue placeholder="Sélectionnez une classe" />
              </SelectTrigger>
              <SelectContent>
                {availableClassNames.length === 0 ? (
                  <div
                    style={{
                      padding: '8px 12px',
                      color: '#78756F',
                      fontSize: '14px',
                      textAlign: 'center'
                    }}
                  >
                    Toutes les classes sont déjà créées
                  </div>
                ) : (
                  availableClassNames.map((className) => (
                    <SelectItem key={className} value={className}>
                      {className}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Filières Selection (only for Nouveau Secondaire) */}
          {niveau === 'Nouveau Secondaire' && (
            <div className="space-y-3">
              <Label
                style={{
                  color: '#2A3740',
                  fontSize: '13px',
                  fontWeight: 500,
                  display: 'block'
                }}
              >
                Filières disponibles <span style={{ color: '#C84A3D' }}>*</span>
              </Label>
              <div className="flex items-center gap-4">
                {['LLA', 'SES', 'SMP', 'SVT'].map((filiere) => (
                  <div key={filiere} className="flex items-center space-x-2">
                    <Checkbox
                      id={filiere}
                      checked={selectedFilieres.includes(filiere)}
                      onCheckedChange={() => handleFiliereToggle(filiere)}
                    />
                    <Label
                      htmlFor={filiere}
                      style={{
                        color: '#2A3740',
                        fontSize: '14px',
                        fontWeight: 400,
                        cursor: 'pointer'
                      }}
                    >
                      {filiere}
                    </Label>
                  </div>
                ))}
              </div>
              <p
                style={{
                  color: '#78756F',
                  fontSize: '12px',
                  fontWeight: 400,
                  marginTop: '8px'
                }}
              >
                Chaque filière sélectionnée créera une salle automatiquement
              </p>
            </div>
          )}

          {/* Description */}
          <div className="space-y-3">
            <Label
              htmlFor="description"
              style={{
                color: '#2A3740',
                fontSize: '13px',
                fontWeight: 500,
                display: 'block'
              }}
            >
              Description
            </Label>
            <Textarea
              id="description"
              placeholder="Notes additionnelles..."
              value={description}
              onChange={(e) => {
                if (e.target.value.length <= maxChars) {
                  setDescription(e.target.value)
                }
              }}
              style={{
                border: '1px solid #D1CECC',
                borderRadius: '8px',
                minHeight: '80px',
                resize: 'none'
              }}
              className="focus:border-[#5A7085] focus:ring-[#5A7085]"
            />
            <p
              style={{
                color: '#78756F',
                fontSize: '12px',
                fontWeight: 400,
                textAlign: 'right'
              }}
            >
              {charCount}/{maxChars} caractères
            </p>
          </div>
        </div>

        <DialogFooter
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #E8E6E3',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px'
          }}
        >
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            style={{
              border: '1px solid #D1CECC',
              borderRadius: '8px',
              color: '#2A3740',
              backgroundColor: '#FFFFFF'
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid()}
            style={{
              backgroundColor: isFormValid() ? '#2C4A6E' : '#9CA3AF',
              color: '#FFFFFF',
              borderRadius: '8px',
              cursor: isFormValid() ? 'pointer' : 'not-allowed'
            }}
          >
            Créer la classe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}