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
import {
  BTN_DIALOG_PRIMARY_CLASS,
  BTN_OUTLINE_CLASS,
  DIALOG_CONTENT_CLASS,
  DIALOG_FOOTER_CLASS,
  DIALOG_HEADER_CLASS,
  FIELD_LABEL_CLASS,
  REQUIRED_MARK_CLASS,
} from "@/lib/cpmsl-classes"

interface CreateSubjectParentModalProps {
  yearName: string
  existingSubjects: Array<{ code: string }>
  onSubmit?: (data: {
    name: string
    code: string
    rubrique: 'R1' | 'R2' | 'R3'
    coefficient: number
  }) => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function CreateSubjectParentModal({
  yearName,
  existingSubjects,
  onSubmit,
  trigger,
  open: controlledOpen,
  onOpenChange
}: CreateSubjectParentModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [name, setName] = useState("")
  const [rubrique, setRubrique] = useState<'R1' | 'R2' | 'R3' | ''>('')

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen

  const setIsOpen = (open: boolean) => {
    if (isControlled) {
      onOpenChange?.(open)
    } else {
      setInternalOpen(open)
    }
  }

  // Generate code from name
  const generateCode = (subjectName: string): string => {
    if (!subjectName.trim()) return ""

    // Extract first 3 letters (uppercase)
    const letters = subjectName
      .replace(/[^a-zA-Z]/g, '')
      .substring(0, 3)
      .toUpperCase()
      .padEnd(3, 'X')

    // Find next available number starting from 101
    let number = 101
    const existingCodes = existingSubjects.map(s => s.code)

    while (existingCodes.includes(`${letters}${number}`)) {
      number++
    }

    return `${letters}${number}`
  }

  const generatedCode = generateCode(name)

  // Check if form is valid — le coefficient n'est plus affiché : les
  // coefficients ne sont pas utilisés pour le moment (valeur par défaut : 1).
  const isFormValid = name.trim() !== '' && rubrique !== ''

  const handleSubmit = () => {
    if (!isFormValid) return

    onSubmit?.({
      name: name.trim(),
      code: generatedCode,
      rubrique: rubrique as 'R1' | 'R2' | 'R3',
      coefficient: 1
    })

    // Reset form
    setName("")
    setRubrique('')
    setIsOpen(false)
  }

  const handleCancel = () => {
    setName("")
    setRubrique('')
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className={`${DIALOG_CONTENT_CLASS} max-w-[520px] border border-neutral-200 p-0`}
     >
        <DialogHeader className={DIALOG_HEADER_CLASS}>
          <DialogTitle className="mb-2 font-serif text-xl font-bold text-neutral-900"
         >
            Nouvelle matière
          </DialogTitle>
          <DialogDescription className="text-sm font-normal text-neutral-600"
         >
            Ajoutez une matière pour l'année {yearName}
          </DialogDescription>
        </DialogHeader>

        <div  className="space-y-5 p-6">
          {/* Nom */}
          <div className="space-y-2">
            <Label
              htmlFor="name" className={FIELD_LABEL_CLASS}
           >
              Nom <span className={REQUIRED_MARK_CLASS}>*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Mathématiques"
              className="focus:border-primary-500 focus:ring-primary-500 rounded-md border border-neutral-300"
            />
          </div>

          {/* Code (read-only with real-time preview) */}
          <div className="space-y-2">
            <Label
              htmlFor="code" className={FIELD_LABEL_CLASS}
           >
              Code
            </Label>
            <Input
              id="code"
              value={generatedCode}
              placeholder={!name.trim() ? "Généré automatiquement" : ""}
              readOnly
              disabled className="cursor-not-allowed rounded-md border border-neutral-300 bg-neutral-100 font-mono uppercase text-neutral-500"
            />
          </div>

          {/* Rubrique */}
          <div className="space-y-2">
            <Label className={FIELD_LABEL_CLASS}
           >
              Rubrique <span className={REQUIRED_MARK_CLASS}>*</span>
            </Label>
            <RadioGroup
              value={rubrique}
              onValueChange={(value) => setRubrique(value as 'R1' | 'R2' | 'R3')}
              className="flex gap-4"
           >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="R1" id="r1" />
                <Label
                  htmlFor="r1" className="cursor-pointer text-sm font-normal text-neutral-900"
               >
                  R1
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="R2" id="r2" />
                <Label
                  htmlFor="r2" className="cursor-pointer text-sm font-normal text-neutral-900"
               >
                  R2
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="R3" id="r3" />
                <Label
                  htmlFor="r3" className="cursor-pointer text-sm font-normal text-neutral-900"
               >
                  R3
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Coefficient masqué : non utilisé pour le moment (valeur par défaut : 1). */}
        </div>

        <DialogFooter className={DIALOG_FOOTER_CLASS}
       >
          <Button
            variant="outline"
            onClick={handleCancel} className={BTN_OUTLINE_CLASS}
         >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid} className={BTN_DIALOG_PRIMARY_CLASS}
         >
            Créer la matière
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
