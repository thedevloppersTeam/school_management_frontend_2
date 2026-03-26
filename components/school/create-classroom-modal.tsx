"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PlusIcon } from "lucide-react"
import { type Classroom, type Level } from "@/lib/data/school-data"

interface CreateClassroomModalProps {
  classroom?: Classroom
  level: Level
  existingClassrooms: Classroom[]
  onSubmit?: (data: { name: string; capacity: number }) => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function CreateClassroomModal({
  classroom,
  level,
  existingClassrooms,
  onSubmit,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange
}: CreateClassroomModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [name, setName] = useState("")
  const [capacity, setCapacity] = useState("")
  const [errors, setErrors] = useState<{ name?: string; capacity?: string }>({})

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen

  const isEditing = !!classroom

  useEffect(() => {
    if (open) {
      if (classroom) {
        setName(classroom.name)
        setCapacity(String(classroom.capacity))
      } else {
        setName("")
        setCapacity("")
      }
      setErrors({})
    }
  }, [open, classroom])

  const validate = () => {
    const newErrors: { name?: string; capacity?: string } = {}

    // Validation du nom
    if (!name.trim()) {
      newErrors.name = "Le nom de la salle est requis"
    } else if (name.trim().length > 3) {
      newErrors.name = "Le nom doit être une lettre unique (ex: A, B, C)"
    } else {
      // Vérifier les doublons (sauf si on édite la même salle)
      const isDuplicate = existingClassrooms.some(
        c => c.name.toUpperCase() === name.trim().toUpperCase() && 
        c.levelId === level.id && 
        c.id !== classroom?.id
      )
      if (isDuplicate) {
        newErrors.name = `La salle ${name.trim().toUpperCase()} existe déjà pour ${level.name}`
      }
    }

    // Validation de la capacité
    const capacityNum = parseInt(capacity)
    if (!capacity.trim()) {
      newErrors.capacity = "La capacité est requise"
    } else if (isNaN(capacityNum)) {
      newErrors.capacity = "La capacité doit être un nombre"
    } else if (capacityNum < 1 || capacityNum > 60) {
      newErrors.capacity = "La capacité doit être entre 1 et 60"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validate()) return

    onSubmit?.({
      name: name.trim().toUpperCase(),
      capacity: parseInt(capacity)
    })

    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button>
            <PlusIcon className="mr-2 h-4 w-4" />
            Ajouter une salle
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Modifier la salle" : "Ajouter une salle"}
            </DialogTitle>
            <DialogDescription>
              {isEditing 
                ? `Modifier la salle ${classroom.name} de ${level.name}`
                : `Ajouter une nouvelle salle pour ${level.name}`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="classroom-name">
                Nom de la salle <span className="text-destructive">*</span>
              </Label>
              <Input
                id="classroom-name"
                placeholder="Ex: A, B, C"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={3}
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="classroom-capacity">
                Capacité <span className="text-destructive">*</span>
              </Label>
              <Input
                id="classroom-capacity"
                type="number"
                min="1"
                max="60"
                placeholder="Ex: 35"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className={errors.capacity ? "border-destructive" : ""}
              />
              {errors.capacity && (
                <p className="text-sm text-destructive">{errors.capacity}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Nombre maximum d'élèves (entre 1 et 60)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Classe</Label>
              <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm">
                {level.name}
              </div>
              <p className="text-sm text-muted-foreground">
                La classe ne peut pas être modifiée
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit">
              {isEditing ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
