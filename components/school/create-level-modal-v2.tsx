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
import {
  BTN_DIALOG_PRIMARY_CLASS,
  DIALOG_CONTENT_CLASS,
  DIALOG_FOOTER_CLASS,
  DIALOG_HEADER_CLASS,
  FIELD_HINT_CLASS,
  REQUIRED_MARK_CLASS,
} from "@/lib/cpmsl-classes"

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
        className={`${DIALOG_CONTENT_CLASS} sm:max-w-[520px] border border-neutral-200 p-0`}
     >
        <DialogHeader className={DIALOG_HEADER_CLASS}>
          <DialogTitle className="mb-1 font-serif text-xl font-bold text-primary-800"
         >
            Nouvelle classe
          </DialogTitle>
          <DialogDescription className="text-sm font-normal text-neutral-600"
         >
            Ajoutez une classe pour l'année {yearName}
          </DialogDescription>
        </DialogHeader>

        <div  className="space-y-6 p-6">
          {/* Niveau Selection */}
          <div className="space-y-3">
            <Label className="block text-sm font-medium text-primary-800"
           >
              Niveau <span className={REQUIRED_MARK_CLASS}>*</span>
            </Label>
            <RadioGroup
              value={niveau}
              onValueChange={(value) => setNiveau(value as 'Fondamentale' | 'Nouveau Secondaire')}
              className="flex items-center gap-6"
           >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Fondamentale" id="fondamentale" />
                <Label
                  htmlFor="fondamentale" className="cursor-pointer text-sm font-normal text-primary-800"
               >
                  Fondamentale
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Nouveau Secondaire" id="secondaire" />
                <Label
                  htmlFor="secondaire" className="cursor-pointer text-sm font-normal text-primary-800"
               >
                  Nouveau Secondaire
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Class Name Selection */}
          <div className="space-y-3">
            <Label
              htmlFor="name" className="block text-sm font-medium text-primary-800"
           >
              Nom de la classe <span className={REQUIRED_MARK_CLASS}>*</span>
            </Label>
            <Select value={name} onValueChange={setName}>
              <SelectTrigger
                id="name"
                className="focus:border-primary-500 focus:ring-primary-500 rounded-md border border-neutral-300 bg-white"
             >
                <SelectValue placeholder="Sélectionnez une classe" />
              </SelectTrigger>
              <SelectContent>
                {availableClassNames.length === 0 ? (
                  <div className="px-3 py-2 text-center text-sm text-neutral-500"
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
              <Label className="block text-sm font-medium text-primary-800"
             >
                Filières disponibles <span className={REQUIRED_MARK_CLASS}>*</span>
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
                      htmlFor={filiere} className="cursor-pointer text-sm font-normal text-primary-800"
                   >
                      {filiere}
                    </Label>
                  </div>
                ))}
              </div>
              <p className={`${FIELD_HINT_CLASS} mt-2`}
             >
                Chaque filière sélectionnée créera une salle automatiquement
              </p>
            </div>
          )}

          {/* Description */}
          <div className="space-y-3">
            <Label
              htmlFor="description" className="block text-sm font-medium text-primary-800"
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
              className="focus:border-primary-500 focus:ring-primary-500 min-h-20 resize-none rounded-md border border-neutral-300"
            />
            <p className="text-right text-xs font-normal text-neutral-500"
           >
              {charCount}/{maxChars} caractères
            </p>
          </div>
        </div>

        <DialogFooter className={DIALOG_FOOTER_CLASS}
       >
          <Button
            variant="outline"
            onClick={() => setOpen(false)} className="rounded-md border border-neutral-300 bg-white text-primary-800"
         >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid()} className={BTN_DIALOG_PRIMARY_CLASS}
         >
            Créer la classe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}