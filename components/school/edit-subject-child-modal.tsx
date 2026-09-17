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
  FIELD_HINT_CLASS,
  FIELD_LABEL_CLASS,
  REQUIRED_MARK_CLASS,
} from "@/lib/cpmsl-classes"

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
    }
  }, [isOpen, child])

  // Check if any field has changed
  const hasChanges =
    name.trim() !== child.name ||
    type !== child.type

  // Check if form is valid — le coefficient n'est plus affiché : les coefficients
  // de sous-matières ne sont pas utilisés pour le moment (le backend les ignore).
  const isFormValid = name.trim() !== ''

  const isSubmitEnabled = hasChanges && isFormValid

  const handleSubmit = () => {
    if (!isSubmitEnabled) return

    onSubmit?.({
      name: name.trim(),
      type,
      coefficient: child.coefficient
    })

    setIsOpen(false)
  }

  const handleCancel = () => {
    setName(child.name)
    setType(child.type)
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className={`${DIALOG_CONTENT_CLASS} max-w-[560px] border border-neutral-200 p-0`}
     >
        <DialogHeader className={DIALOG_HEADER_CLASS}>
          <DialogTitle className="mb-2 font-serif text-xl font-bold text-neutral-900"
         >
            Modifier la sous-matière — {child.name}
          </DialogTitle>
          <DialogDescription className="text-sm font-normal text-neutral-600"
         >
            {child.code} · Matière parent: {parent.code}
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
              placeholder="Ex: Communication Française"
              className="focus:border-primary-500 focus:ring-primary-500 rounded-md border border-neutral-300"
            />
          </div>

          {/* Code (read-only) */}
          <div className="space-y-2">
            <Label
              htmlFor="code" className={FIELD_LABEL_CLASS}
           >
              Code
            </Label>
            <Input
              id="code"
              value={child.code}
              readOnly
              disabled className="cursor-not-allowed rounded-md border border-neutral-300 bg-neutral-100 font-mono uppercase text-neutral-500"
            />
            <p className={`${FIELD_HINT_CLASS} mt-1.5`}
           >
              Non modifiable
            </p>
          </div>

          {/* Type de sous-matière */}
          <div className="space-y-2">
            <Label className={FIELD_LABEL_CLASS}
           >
              Type de sous-matière <span className={REQUIRED_MARK_CLASS}>*</span>
            </Label>
            <RadioGroup
              value={type}
              onValueChange={(value) => setType(value as 'L' | 'C' | 'N' | 'P' | 'T')}
              className="flex flex-wrap gap-3"
           >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="L" id="type-l" />
                <Label
                  htmlFor="type-l" className="cursor-pointer text-sm font-normal text-neutral-900"
               >
                  L — Langue / Communication
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="C" id="type-c" />
                <Label
                  htmlFor="type-c" className="cursor-pointer text-sm font-normal text-neutral-900"
               >
                  C — Calcul / Logique
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="N" id="type-n" />
                <Label
                  htmlFor="type-n" className="cursor-pointer text-sm font-normal text-neutral-900"
               >
                  N — Naturelle / Science
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="P" id="type-p" />
                <Label
                  htmlFor="type-p" className="cursor-pointer text-sm font-normal text-neutral-900"
               >
                  P — Pratique / Application
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="T" id="type-t" />
                <Label
                  htmlFor="type-t" className="cursor-pointer text-sm font-normal text-neutral-900"
               >
                  T — Théorie
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Coefficient masqué : non utilisé pour le moment — seule la note
              maximum compte sur les bulletins. La valeur existante est conservée. */}
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
            disabled={!isSubmitEnabled} className={BTN_DIALOG_PRIMARY_CLASS}
         >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
