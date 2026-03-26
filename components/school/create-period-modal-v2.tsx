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
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

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
      // Reset form
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

  const isFormValid = () => {
    return (
      name.trim() !== "" &&
      startDate !== "" &&
      endDate !== "" &&
      dateError === ""
    )
  }

  const handleSubmit = () => {
    if (isFormValid()) {
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

  const isDisabled = existingPeriodsCount >= 5

  return (
    <Dialog open={currentOpen} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className="max-w-xl"
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
            Nouvelle étape
          </DialogTitle>
          <DialogDescription
            className="body-base"
            style={{ color: '#5C5955' }}
          >
            Disponible uniquement si moins de 5 étapes existent
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-[20px] mt-6">
          {/* Nom de l'étape */}
          <div className="space-y-2">
            <Label
              htmlFor="name"
              className="label-ui"
              style={{
                color: '#1E1A17',
                fontWeight: 600
              }}
            >
              Nom de l'étape <span style={{ color: '#C84A3D' }}>*</span>
            </Label>
            <Input
              id="name"
              placeholder="5ème Étape"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                border: '1px solid #D1CECC',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF'
              }}
              className="focus:border-[#2C4A6E] focus:ring-[#2C4A6E]"
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label
              className="label-ui"
              style={{
                color: '#1E1A17',
                fontWeight: 600
              }}
            >
              Type <span style={{ color: '#C84A3D' }}>*</span>
            </Label>
            <RadioGroup
              value={type}
              onValueChange={(value) => setType(value as 'normal' | 'blanc')}
              className="flex items-center gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="normal" id="normal" />
                <Label
                  htmlFor="normal"
                  className="body-base cursor-pointer"
                  style={{ color: '#1E1A17', fontWeight: 400 }}
                >
                  Évaluation normale
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="blanc" id="blanc" />
                <Label
                  htmlFor="blanc"
                  className="body-base cursor-pointer"
                  style={{ color: '#1E1A17', fontWeight: 400 }}
                >
                  Évaluation blanc
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Date de début */}
          <div className="space-y-2">
            <Label
              htmlFor="startDate"
              className="label-ui"
              style={{
                color: '#1E1A17',
                fontWeight: 600
              }}
            >
              Date de début <span style={{ color: '#C84A3D' }}>*</span>
            </Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              placeholder="jj/mm/aaaa"
              style={{
                border: '1px solid #D1CECC',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF'
              }}
              className="focus:border-[#2C4A6E] focus:ring-[#2C4A6E]"
            />
          </div>

          {/* Date de fin */}
          <div className="space-y-2">
            <Label
              htmlFor="endDate"
              className="label-ui"
              style={{
                color: '#1E1A17',
                fontWeight: 600
              }}
            >
              Date de fin <span style={{ color: '#C84A3D' }}>*</span>
            </Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              placeholder="jj/mm/aaaa"
              style={{
                border: dateError ? '1px solid #C84A3D' : '1px solid #D1CECC',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF'
              }}
              className="focus:border-[#2C4A6E] focus:ring-[#2C4A6E]"
            />
            {dateError && (
              <p
                className="caption"
                style={{
                  color: '#C84A3D',
                  marginTop: '4px'
                }}
              >
                {dateError}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label
              htmlFor="description"
              className="label-ui"
              style={{
                color: '#1E1A17',
                fontWeight: 600
              }}
            >
              Description
            </Label>
            <Textarea
              id="description"
              placeholder="Notes additionnelles sur cette étape..."
              value={description}
              onChange={(e) => {
                if (e.target.value.length <= 200) {
                  setDescription(e.target.value)
                }
              }}
              maxLength={200}
              rows={3}
              style={{
                border: '1px solid #D1CECC',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                resize: 'none'
              }}
              className="focus:border-[#2C4A6E] focus:ring-[#2C4A6E]"
            />
            <p
              className="caption"
              style={{
                color: '#78756F',
                textAlign: 'right'
              }}
            >
              {description.length}/200 caractères
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
            disabled={!isFormValid()}
            style={{
              backgroundColor: isFormValid() ? '#2C4A6E' : '#E8E6E3',
              color: isFormValid() ? '#FFFFFF' : '#A8A5A2',
              borderRadius: '8px',
              cursor: isFormValid() ? 'pointer' : 'not-allowed'
            }}
            className={isFormValid() ? 'hover:bg-[#243B56]' : ''}
          >
            Créer l'étape
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}