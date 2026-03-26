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
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface EditClassroomModalProps {
  classroom: {
    id: string
    name: string
    capacity: number
    description?: string
  }
  level: {
    name: string
    niveau: string
  }
  existingClassrooms?: Array<{
    id: string
    name: string
  }>
  onConfirm?: (data: {
    name: string
    capacity: number
    description?: string
  }) => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const FONDAMENTALE_OPTIONS = ["A", "B", "C", "D", "E"]
const SECONDAIRE_OPTIONS = ["LLA", "SES", "SMP", "SVT"]

export function EditClassroomModal({
  classroom,
  level,
  existingClassrooms = [],
  onConfirm,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: EditClassroomModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [name, setName] = useState(classroom.name)
  const [capacity, setCapacity] = useState(classroom.capacity.toString())
  const [description, setDescription] = useState(classroom.description || "")

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen

  const isFondamentale = level.niveau === "Fondamentale"
  const allNameOptions = isFondamentale ? FONDAMENTALE_OPTIONS : SECONDAIRE_OPTIONS
  
  // Filter out already-used names (except the current classroom's name)
  const usedNames = existingClassrooms
    .filter(c => c.id !== classroom.id)
    .map(c => c.name)
  const nameOptions = allNameOptions.filter(option => !usedNames.includes(option))
  
  const maxDescriptionLength = 200
  const maxCapacity = 60

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setName(classroom.name)
      setCapacity(classroom.capacity.toString())
      setDescription(classroom.description || "")
    }
  }, [open, classroom])

  // Check if any field has changed
  const hasChanges = 
    name !== classroom.name ||
    capacity !== classroom.capacity.toString() ||
    description !== (classroom.description || "")

  const capacityNum = parseInt(capacity)
  const isFormValid = 
    name && 
    capacity && 
    capacityNum > 0 && 
    capacityNum <= maxCapacity

  const isValid = isFormValid && hasChanges

  const handleSubmit = () => {
    if (!isValid) return

    onConfirm?.({
      name,
      capacity: parseInt(capacity),
      description: description || undefined,
    })
    setOpen(false)
  }

  const modalTitle = isFondamentale
    ? `Modifier la Salle ${classroom.name} — ${level.name}`
    : `Modifier la filière ${classroom.name} — ${level.name}`

  const modalSubtitle = isFondamentale
    ? `Salle ${classroom.name} · ${classroom.capacity} élèves inscrits`
    : `Filière ${classroom.name} · ${classroom.capacity} élèves inscrits`

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger}
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-foreground">{modalTitle}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {modalSubtitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Name field */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground">
              {isFondamentale ? "Nom de la salle" : "Nom de la filière"} <span className="text-destructive">*</span>
            </Label>
            <Select value={name} onValueChange={setName}>
              <SelectTrigger id="name" className="bg-background">
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                {nameOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Capacity field */}
          <div className="space-y-2">
            <Label htmlFor="capacity" className="text-foreground">
              Capacité maximale <span className="text-destructive">*</span>
            </Label>
            <Input
              id="capacity"
              type="number"
              min="1"
              max="60"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="Ex: 30"
              className="bg-background"
            />
            {capacity && parseInt(capacity) > maxCapacity && (
              <p className="text-xs text-destructive">
                La capacité maximale est de {maxCapacity} élèves
              </p>
            )}
          </div>

          {/* Description field */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-foreground">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => {
                if (e.target.value.length <= maxDescriptionLength) {
                  setDescription(e.target.value)
                }
              }}
              placeholder="Ajouter une description (optionnel)"
              className="bg-background resize-none min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground text-right">
              {description.length}/{maxDescriptionLength} caractères
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid}
            style={{
              backgroundColor: isValid ? "#2C4A6E" : "#9CA3AF",
              color: "white",
            }}
            className={isValid ? "" : "cursor-not-allowed"}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
