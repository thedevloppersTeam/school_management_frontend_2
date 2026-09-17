"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  ALERT_ERROR_CLASS,
  BTN_DESTRUCTIVE_CLASS,
  BTN_OUTLINE_CLASS,
  DIALOG_CONTENT_CLASS,
  DIALOG_FOOTER_CLASS,
  DIALOG_HEADER_CLASS,
} from "@/lib/cpmsl-classes"

/**
 * delete-subject-parent-modal.tsx — Patch EP-006
 *
 * Typed-name exigé si childCount > 0 (la matière a des sous-matières).
 *
 * Nettoyage bonus : suppression du default `studentCount = 62` qui était
 * un chiffre arbitraire jamais passé par l'appelant. Le champ devient
 * optionnel et affiché uniquement si fourni réellement.
 */

interface DeleteSubjectParentModalProps {
  subject: {
    id: string
    name: string
  }
  childCount: number
  /**
   * Nombre d'élèves impactés. Optionnel — si non fourni, la ligne
   * "Élèves affectés" n'est pas affichée (au lieu d'afficher un
   * chiffre arbitraire).
   */
  studentCount?: number
  onConfirm?: () => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function DeleteSubjectParentModal({
  subject,
  childCount,
  studentCount,
  onConfirm,
  trigger,
  open,
  onOpenChange
}: DeleteSubjectParentModalProps) {
  const [typedName, setTypedName] = useState("")

  useEffect(() => {
    if (open) setTypedName("")
  }, [open])

  const needsTypedName = childCount > 0
  const typedMatches = !needsTypedName || typedName.trim() === subject.name.trim()
  const canConfirm = typedMatches

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm?.()
    onOpenChange?.(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className={`${DIALOG_CONTENT_CLASS} max-w-[520px] border border-neutral-200 p-0`}
     >
        <DialogHeader className={DIALOG_HEADER_CLASS}>
          <DialogTitle className="font-serif text-xl font-bold text-neutral-900"
         >
            Supprimer la matière {subject.name}
          </DialogTitle>
        </DialogHeader>

        <div  className="space-y-4 p-6">
          {/* Warning block */}
          <div className={ALERT_ERROR_CLASS}
         >
            <p className="text-sm leading-normal text-error-ink"
           >
              Cette matière contient {childCount} {childCount === 1 ? 'sous-matière' : 'sous-matières'}. La suppression retirera toutes les sous-matières associées. Cette action est irréversible.
            </p>
          </div>

          {/* Summary */}
          <div  className="space-y-1 mt-4">
            <p className="text-sm font-medium text-neutral-600"
           >
              Sous-matières supprimées : {childCount}
            </p>
            {/* Élèves affectés : affiché uniquement si le chiffre est fourni */}
            {studentCount !== undefined && (
              <p className="text-sm font-medium text-neutral-600"
             >
                Élèves affectés : {studentCount}
              </p>
            )}
            <p className="text-sm font-medium text-neutral-600"
           >
              Notes associées : toutes les notes de cette matière seront supprimées
            </p>
          </div>

          {/* Typed-name (si impact > 0) */}
          {needsTypedName && (
            <div className="space-y-2 pt-2">
              <Label
                htmlFor={`confirm-subject-${subject.id}`} className="text-sm text-neutral-900"
             >
                Pour confirmer, saisissez{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  {subject.name}
                </code>{" "}
                ci-dessous :
              </Label>
              <Input
                id={`confirm-subject-${subject.id}`}
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder={subject.name}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                autoFocus className="rounded-md border border-neutral-300 text-sm"
              />
            </div>
          )}
        </div>

        <DialogFooter className={DIALOG_FOOTER_CLASS}
       >
          <Button
            variant="outline"
            onClick={() => onOpenChange?.(false)} className={BTN_OUTLINE_CLASS}
         >
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm} className={BTN_DESTRUCTIVE_CLASS}
         >
            Supprimer définitivement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}