"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * delete-level-modal.tsx — Patch EP-006
 *
 * Typed-name exigé si impact > 0 (classrooms ou élèves existants).
 * Une classe vide (0 salle, 0 élève) se supprime directement.
 */

interface DeleteLevelModalProps {
  level: {
    id: string
    name: string
    niveau: string
  }
  classroomCount: number
  studentCount: number
  onConfirm?: () => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function DeleteLevelModal({
  level,
  classroomCount,
  studentCount,
  onConfirm,
  trigger,
  open,
  onOpenChange,
}: DeleteLevelModalProps) {
  const [typedName, setTypedName] = useState("")

  useEffect(() => {
    if (open) setTypedName("")
  }, [open])

  const needsTypedName = classroomCount > 0 || studentCount > 0
  const typedMatches = !needsTypedName || typedName.trim() === level.name.trim()
  const canConfirm = typedMatches

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm?.()
    onOpenChange?.(false)
  }

  const getTitle = () => `Supprimer la classe ${level.name}`

  const getClassroomLabel = () => {
    if (level.niveau === 'Nouveau Secondaire') return 'filières'
    return 'salles'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {getTitle()}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Confirmer la suppression de la classe
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning block */}
          <div className="bg-[#FEE2E2] border border-[#FCA5A5] rounded-md p-4">
            <p className="text-sm text-[#991B1B] leading-relaxed">
              Cette classe contient {classroomCount} {getClassroomLabel()} et {studentCount} élèves.
              La suppression retirera toutes les {getClassroomLabel()} et tous les élèves associés.
              Cette action est irréversible.
            </p>
          </div>

          {/* Summary lines */}
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              {level.niveau === 'Nouveau Secondaire' ? 'Filières' : 'Salles'} supprimées :{" "}
              <span className="font-medium text-foreground">{classroomCount}</span>
            </p>
            <p>
              Élèves affectés : <span className="font-medium text-foreground">{studentCount}</span>
            </p>
          </div>

          {/* Typed-name confirmation (uniquement si impact > 0) */}
          {needsTypedName && (
            <div className="space-y-2 pt-2">
              <Label htmlFor={`confirm-level-${level.id}`} className="text-sm">
                Pour confirmer, saisissez{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  {level.name}
                </code>{" "}
                ci-dessous :
              </Label>
              <Input
                id={`confirm-level-${level.id}`}
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder={level.name}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange?.(false)}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="bg-[#B91C1C] hover:bg-[#991B1B] text-white disabled:bg-[#D1CECC] disabled:cursor-not-allowed disabled:hover:bg-[#D1CECC]"
          >
            Supprimer définitivement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}