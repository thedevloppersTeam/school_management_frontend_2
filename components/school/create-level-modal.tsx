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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PlusIcon, PencilIcon } from "lucide-react"
import type { Level } from "@/lib/data/school-data"

interface CreateLevelModalProps {
  level?: Level
  onSubmit?: (data: {
    name: string
    niveau: 'Fondamentale' | 'Nouveau Secondaire'
    filiere?: 'LLA' | 'SES' | 'SMP' | 'SVT'
  }) => void
  trigger?: React.ReactNode
}

export function CreateLevelModal({ level, onSubmit, trigger }: CreateLevelModalProps) {
  const isEditMode = !!level
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(level?.name || "")
  const [niveau, setNiveau] = useState<'Fondamentale' | 'Nouveau Secondaire' | ''>(level?.niveau || '')
  const [filiere, setFiliere] = useState<'LLA' | 'SES' | 'SMP' | 'SVT' | ''>(level?.filiere || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim() && niveau) {
      // Si Nouveau Secondaire, la filière est obligatoire
      if (niveau === 'Nouveau Secondaire' && !filiere) {
        return
      }
      
      onSubmit?.({
        name: name.trim(),
        niveau,
        filiere: filiere || undefined
      })
      
      // Reset form
      setName("")
      setNiveau('')
      setFiliere('')
      setOpen(false)
    }
  }

  const handleCancel = () => {
    setName("")
    setNiveau('')
    setFiliere('')
    setOpen(false)
  }

  const isValid = name.trim() && niveau && (niveau === 'Fondamentale' || filiere)

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
              Nouvelle classe
            </Button>
          )
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Modifier la classe' : 'Nouvelle classe'}</DialogTitle>
            <DialogDescription>
              {isEditMode ? 'Modifiez les informations de la classe' : 'Créez une nouvelle classe pour cette année scolaire'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Nom de la classe <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Ex: 7e A, NSI LLA"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="niveau">
                Niveau <span className="text-destructive">*</span>
              </Label>
              <Select value={niveau} onValueChange={(value: any) => {
                setNiveau(value)
                // Reset filiere si on change de niveau
                if (value === 'Fondamentale') {
                  setFiliere('')
                }
              }}>
                <SelectTrigger id="niveau">
                  <SelectValue placeholder="Sélectionner un niveau" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fondamentale">Fondamentale</SelectItem>
                  <SelectItem value="Nouveau Secondaire">Nouveau Secondaire</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {niveau === 'Nouveau Secondaire' && (
              <div className="space-y-2">
                <Label htmlFor="filiere">
                  Filière <span className="text-destructive">*</span>
                </Label>
                <Select value={filiere} onValueChange={(value: any) => setFiliere(value)}>
                  <SelectTrigger id="filiere">
                    <SelectValue placeholder="Sélectionner une filière" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LLA">LLA</SelectItem>
                    <SelectItem value="SES">SES</SelectItem>
                    <SelectItem value="SMP">SMP</SelectItem>
                    <SelectItem value="SVT">SVT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Annuler
            </Button>
            <Button type="submit" disabled={!isValid}>
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}