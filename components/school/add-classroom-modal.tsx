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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Level {
  id: string
  name: string
  niveau: string
}

interface Classroom {
  id: string
  name: string
  levelId: string
  capacity: number
}

interface AddClassroomModalProps {
  level: Level
  existingClassrooms: Classroom[]
  onSubmit?: (data: {
    name: string
    capacity: number
    description?: string
  }) => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function AddClassroomModal({
  level,
  existingClassrooms,
  onSubmit,
  trigger,
  open,
  onOpenChange
}: AddClassroomModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState("")
  const [capacity, setCapacity] = useState("")
  const [description, setDescription] = useState("")

  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen)
    } else {
      setIsOpen(newOpen)
    }
    
    // Reset form when closing
    if (!newOpen) {
      setName("")
      setCapacity("")
      setDescription("")
    }
  }

    const currentOpen = open ?? isOpen

  const isFondamentale = level.niveau === 'Fondamentale'
  const modalTitle = isFondamentale 
    ? `Ajouter une salle — ${level.name}`
    : `Ajouter une filière — ${level.name}`

  // Get available options based on level type
  const getAvailableOptions = () => {
    const usedNames = existingClassrooms.map(c => c.name)
    
    if (isFondamentale) {
      // For Fondamentale: A, B, C, D, E
      const allOptions = ['A', 'B', 'C', 'D', 'E']
      return allOptions.filter(option => !usedNames.includes(option))
    } else {
      // For Secondaire: LLA, SES, SMP, SVT
      const allOptions = ['LLA', 'SES', 'SMP', 'SVT']
      return allOptions.filter(option => !usedNames.includes(option))
    }
  }

  const availableOptions = getAvailableOptions()

  // Validation
   const isValid = name.trim() !== "" && capacity.trim() !== "" && 
                  Number.parseInt(capacity) >= 1 && Number.parseInt(capacity) <= 60

  const handleSubmit = () => {
    if (!isValid) return

    onSubmit?.({
      name: name.trim(),
      capacity: Number.parseInt(capacity),
      description: description.trim() || undefined
    })
    
    handleOpenChange(false)
  }

  const maxDescriptionLength = 200
  const charCount = description.length

  return (
    <Dialog open={currentOpen} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className="max-w-lg"
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
            {modalTitle}
          </DialogTitle>
          <DialogDescription
            className="body-base"
            style={{ color: '#5C5955' }}
          >
            {isFondamentale 
              ? 'Configurez une nouvelle salle pour cette classe'
              : 'Configurez une nouvelle filière pour ce niveau'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-6">
          {/* Nom Field */}
          <div className="space-y-2">
            <Label
              htmlFor="name"
              className="label-ui"
              style={{ color: '#1E1A17', fontWeight: 600 }}
            >
              Nom <span style={{ color: '#C84A3D' }}>*</span>
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
                <SelectValue placeholder={isFondamentale ? "Sélectionnez une lettre" : "Sélectionnez une filière"} />
              </SelectTrigger>
              <SelectContent>
                {availableOptions.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    Toutes les options sont déjà utilisées
                  </div>
                ) : (
                  availableOptions.map(option => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Capacité maximale Field */}
          <div className="space-y-2">
            <Label
              htmlFor="capacity"
              className="label-ui"
              style={{ color: '#1E1A17', fontWeight: 600 }}
            >
              Capacité maximale <span style={{ color: '#C84A3D' }}>*</span>
            </Label>
            <Input
              id="capacity"
              type="number"
              min="1"
              max="60"
              placeholder="Ex: 30"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              style={{
                border: '1px solid #D1CECC',
                borderRadius: '8px'
              }}
              className="focus:border-[#5A7085] focus:ring-[#5A7085]"
            />
            <p
              className="caption"
              style={{ color: '#78756F', marginTop: '6px' }}
            >
              Nombre maximum d'élèves dans ce groupe
            </p>
          </div>

          {/* Description Field */}
          <div className="space-y-2">
            <Label
              htmlFor="description"
              className="label-ui"
              style={{ color: '#1E1A17', fontWeight: 600 }}
            >
              Description
            </Label>
            <Textarea
              id="description"
              placeholder="Notes additionnelles..."
              value={description}
              onChange={(e) => {
                if (e.target.value.length <= maxDescriptionLength) {
                  setDescription(e.target.value)
                }
              }}
              rows={3}
              style={{
                border: '1px solid #D1CECC',
                borderRadius: '8px',
                resize: 'none'
              }}
              className="focus:border-[#5A7085] focus:ring-[#5A7085]"
            />
            <p
              className="caption"
              style={{ 
                color: '#78756F',
                marginTop: '6px',
                textAlign: 'right'
              }}
            >
              {charCount}/{maxDescriptionLength} caractères
            </p>
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
            onClick={handleSubmit}
            disabled={!isValid}
            style={{
              backgroundColor: isValid ? '#2C4A6E' : '#9CA3AF',
              color: '#FFFFFF',
              borderRadius: '8px',
              cursor: isValid ? 'pointer' : 'not-allowed'
            }}
            className={isValid ? "hover:bg-[#243D5A]" : ""}
          >
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}