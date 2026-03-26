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
import { PlusIcon, PencilIcon } from "lucide-react"
import type { Period } from "@/lib/data/school-data"

interface CreatePeriodModalProps {
  period?: Period
  onSubmit?: (data: { name: string }) => void
  trigger?: React.ReactNode
}

export function CreatePeriodModal({ period, onSubmit, trigger }: CreatePeriodModalProps) {
  const isEditMode = !!period
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(period?.name || "")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onSubmit?.({ name: name.trim() })
      setName("")
      setOpen(false)
    }
  }

  const handleCancel = () => {
    setName("")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          isEditMode ? (
            <Button variant="ghost" size="sm" className="gap-2">
              <PencilIcon className="h-4 w-4" />
              Modifier
            </Button>
          ) : (
            <Button size="sm" className="gap-2">
              <PlusIcon className="h-4 w-4" />
              Nouvelle étape
            </Button>
          )
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Modifier l\'\u00e9tape' : 'Nouvelle étape'}</DialogTitle>
            <DialogDescription>
              {isEditMode ? 'Modifiez le nom de l\'\u00e9tape' : 'Créez une nouvelle étape d\'évaluation pour cette année scolaire'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Nom de l'étape <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Ex: 1er Trimestre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Annuler
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}