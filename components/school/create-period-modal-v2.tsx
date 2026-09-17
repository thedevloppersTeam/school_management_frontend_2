"use client"

import { useState } from "react"
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
import {
  BTN_DIALOG_PRIMARY_CLASS,
  BTN_OUTLINE_CLASS,
  REQUIRED_MARK_CLASS,
} from "@/lib/cpmsl-classes"

interface CreatePeriodModalV2Props {
  existingPeriodsCount: number
  onSubmit?: (data: {
    name: string
    type: 'normal' | 'blanc'
    startDate: string
    endDate: string
    description?: string
  }) => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function CreatePeriodModalV2({
  existingPeriodsCount,
  onSubmit,
  trigger,
  open,
  onOpenChange
}: CreatePeriodModalV2Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState("")
  const [type, setType] = useState<'normal' | 'blanc'>('normal')
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [description, setDescription] = useState("")
  const [dateError, setDateError] = useState("")

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setName("")
      setType('normal')
      setStartDate("")
      setEndDate("")
      setDescription("")
      setDateError("")
    }
    if (onOpenChange) {
      onOpenChange(newOpen)
    } else {
      setIsOpen(newOpen)
    }
  }

  const currentOpen = open !== undefined ? open : isOpen

  const validateDates = (start: string, end: string) => {
    // Validation uniquement si les DEUX dates sont fournies
    if (start && end) {
      const startDateTime = new Date(start).getTime()
      const endDateTime = new Date(end).getTime()
      if (endDateTime <= startDateTime) {
        setDateError("La date de fin doit être après la date de début")
        return false
      }
    }
    setDateError("")
    return true
  }

  const handleStartDateChange = (value: string) => {
    setStartDate(value)
    validateDates(value, endDate)
  }

  const handleEndDateChange = (value: string) => {
    setEndDate(value)
    validateDates(startDate, value)
  }

  // ── FIX 1 : dates non obligatoires (BR-DATE — contexte Haïti) ────────────
  const isFormValid = () => {
    return (
      name.trim() !== "" &&
      dateError === ""
      // startDate et endDate sont optionnels
    )
  }

  // ── FIX 2 : max 5 étapes — variable utilisée sur le bouton submit ─────────
  const isDisabled = existingPeriodsCount>= 5

  const handleSubmit = () => {
    if (isFormValid() && !isDisabled) {
      onSubmit?.({
        name,
        type,
        startDate,
        endDate,
        description: description.trim() || undefined
      })
      handleOpenChange(false)
    }
  }

  return (
    <Dialog open={currentOpen} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className="max-w-xl rounded-lg border border-neutral-200 bg-white p-8"
     >
        <DialogHeader>
          <DialogTitle
            className="heading-3 mb-2 text-neutral-900"
         >
            Nouvelle étape
          </DialogTitle>
          <DialogDescription
            className="body-base text-neutral-600"
         >
            {isDisabled
              ? "Maximum 5 étapes atteint — impossible d'en créer une nouvelle."
              : `${existingPeriodsCount} / 5 étapes créées pour cette année`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-[20px] mt-6">
          {/* Nom de l'étape */}
          <div className="space-y-2">
            <Label
              htmlFor="name"
              className="label-ui font-semibold text-neutral-900"
           >
              Nom de l&apos;étape <span className={REQUIRED_MARK_CLASS}>*</span>
            </Label>
            <Input
              id="name"
              placeholder="5ème Étape"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isDisabled}
              className="focus:border-primary-500 focus:ring-primary-500 rounded-md border border-neutral-300 bg-white disabled:bg-neutral-100"
            />
          </div>

          {/*
            Le type d'étape (« normale » / « blanc ») et la description ont été
            retirés du formulaire le 2026-09-16.

            Raison : ils n'avaient aucun stockage. Le modèle Prisma
            `AcademicYearStep` ne porte ni colonne `type` ni colonne
            `description`, et `createStep` (src/controllers/academicYearSteps.ts)
            ne lit que `name`, `stepNumber`, `startDate`, `endDate`. Le champ
            « Type » était de surcroît marqué obligatoire : l'écran exigeait une
            saisie qu'il jetait.

            Si l'étape blanche est une notion à conserver, elle demande une
            migration backend — décision consignée dans docs/BACKLOG.md.
          */}

          {/* Date de début — optionnelle */}
          <div className="space-y-2">
            <Label
              htmlFor="startDate"
              className="label-ui font-semibold text-neutral-900"
           >
              Date de début <span className="font-normal text-neutral-500">(optionnelle)</span>
            </Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              disabled={isDisabled}
              className="focus:border-primary-500 focus:ring-primary-500 rounded-md border border-neutral-300 bg-white disabled:bg-neutral-100"
            />
          </div>

          {/* Date de fin — optionnelle */}
          <div className="space-y-2">
            <Label
              htmlFor="endDate"
              className="label-ui font-semibold text-neutral-900"
           >
              Date de fin <span className="font-normal text-neutral-500">(optionnelle)</span>
            </Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              disabled={isDisabled}
              className={`rounded-md bg-white disabled:bg-neutral-100 focus:border-primary-500 focus:ring-primary-500 ${
                dateError ? "border border-error" : "border border-neutral-300"
              }`}
            />
            {dateError && (
              <p className="caption mt-1 text-error">
                {dateError}
              </p>
            )}
          </div>

        </div>

        <DialogFooter className="mt-6">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)} className={BTN_OUTLINE_CLASS}
         >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid() || isDisabled} className={BTN_DIALOG_PRIMARY_CLASS}
         >
            Créer l&apos;étape
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}