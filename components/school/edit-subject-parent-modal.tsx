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
  ALERT_WARNING_CLASS,
  BTN_DIALOG_PRIMARY_CLASS,
  BTN_OUTLINE_CLASS,
  DIALOG_CONTENT_CLASS,
  DIALOG_FOOTER_CLASS,
  DIALOG_HEADER_CLASS,
  FIELD_HINT_CLASS,
  FIELD_LABEL_CLASS,
  REQUIRED_MARK_CLASS,
  rubriqueShare,
} from "@/lib/cpmsl-classes"

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
  const [rubriqueAcknowledged, setRubriqueAcknowledged] = useState(false)

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
      setRubriqueAcknowledged(false)
    }
  }, [isOpen, subject])

  // Changer la rubrique d'une matiere deplace le poids de toutes ses notes sur
  // tous les bulletins de toutes les classes ou elle est enseignee, etapes
  // cloturees comprises : R1 pese 70 % de la moyenne d'etape, R3 en pese 5 %.
  // C'est le meme rayon d'action que la note maximale de la matiere, qui exige
  // deja un acquittement — d'ou le meme regime ici.
  const rubriqueChanged = rubrique !== subject.rubrique

  // Check if any field has changed
  const hasChanges =
    name.trim() !== subject.name ||
    rubriqueChanged

  // Check if form is valid — le coefficient n'est plus affiché : les
  // coefficients ne sont pas utilisés pour le moment (valeur existante conservée).
  const isFormValid = name.trim() !== ''

  const isSubmitEnabled =
    hasChanges && isFormValid && (!rubriqueChanged || rubriqueAcknowledged)

  const handleSubmit = () => {
    if (!isSubmitEnabled) return
    if (rubriqueChanged && !rubriqueAcknowledged) return

    onSubmit?.({
      name: name.trim(),
      rubrique,
      coefficient: subject.coefficient
    })

    setIsOpen(false)
  }

  const handleCancel = () => {
    setName(subject.name)
    setRubrique(subject.rubrique)
    setRubriqueAcknowledged(false)
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className={`${DIALOG_CONTENT_CLASS} max-w-[520px] border border-neutral-200 p-0`}
     >
        <DialogHeader className={DIALOG_HEADER_CLASS}>
          <DialogTitle className="font-serif text-xl font-bold text-neutral-900"
         >
            Modifier la matière — {subject.name}
          </DialogTitle>
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

          {/* Code (read-only) */}
          <div className="space-y-2">
            <Label
              htmlFor="code" className={FIELD_LABEL_CLASS}
           >
              Code
            </Label>
            <Input
              id="code"
              value={subject.code}
              readOnly
              disabled className="cursor-not-allowed rounded-md border border-neutral-300 bg-neutral-100 font-mono uppercase text-neutral-500"
            />
            <p className={`${FIELD_HINT_CLASS} mt-1.5`}
           >
              Modifier le nom ne met pas à jour le code
            </p>
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
              {(['R1', 'R2', 'R3'] as const).map((code) => (
                <div key={code} className="flex items-center space-x-2">
                  <RadioGroupItem value={code} id={code.toLowerCase()} />
                  <Label
                    htmlFor={code.toLowerCase()}
                    className="cursor-pointer text-sm font-normal text-neutral-900"
                  >
                    {code}{' '}
                    <span className="tabular-nums text-neutral-500">
                      — {rubriqueShare(code)}
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <p className={FIELD_HINT_CLASS}>
              La rubrique décide du poids des notes de cette matière dans la
              moyenne d&apos;étape imprimée sur le bulletin.
            </p>

            {rubriqueChanged && (
              <div className={`${ALERT_WARNING_CLASS} space-y-2`}>
                <p>
                  <span className="font-semibold">
                    {subject.name} passe de {subject.rubrique} (
                    {rubriqueShare(subject.rubrique)}) à {rubrique} (
                    {rubriqueShare(rubrique)}).
                  </span>{' '}
                  Le poids de ses notes change sur les bulletins de{' '}
                  <span className="font-semibold">toutes</span> les classes où
                  elle est enseignée, y compris les étapes déjà clôturées.
                </p>
                <label className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={rubriqueAcknowledged}
                    onChange={(e) => setRubriqueAcknowledged(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 text-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                  />
                  <span>
                    Je comprends que ce changement modifie les moyennes déjà
                    calculées pour {subject.name}.
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Coefficient masqué : non utilisé pour le moment (valeur existante conservée). */}
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
