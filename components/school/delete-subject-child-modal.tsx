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
 * delete-subject-child-modal.tsx — Patch EP-006
 *
 * Typed-name exigé si studentCount > 0 (des élèves sont affectés).
 *
 * Note : aujourd'hui l'appelant (cpmsl-year-config-tabs.tsx) passe
 * studentCount via getStudentCountForSubjectChild() qui retourne 0
 * en attendant l'endpoint backend. Donc le typed-name ne sera pas
 * demandé tant que le backend n'expose pas la vraie donnée.
 *
 * C'est une dégradation PROPRE : mieux vaut ne pas demander qu'afficher
 * un chiffre faux comme avant (studentCount={32} hardcodé).
 */

interface DeleteSubjectChildModalProps {
  child: {
    id: string
    name: string
  }
  studentCount: number
  onConfirm?: () => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function DeleteSubjectChildModal({
  child,
  studentCount,
  onConfirm,
  trigger,
  open,
  onOpenChange
}: DeleteSubjectChildModalProps) {
  const [typedName, setTypedName] = useState("")

  useEffect(() => {
    if (open) setTypedName("")
  }, [open])

  const needsTypedName = studentCount > 0
  const typedMatches = !needsTypedName || typedName.trim() === child.name.trim()
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
            Supprimer — {child.name}
          </DialogTitle>
        </DialogHeader>

        <div  className="space-y-4 p-6">
          {/* Warning block */}
          <div className={ALERT_ERROR_CLASS}
         >
            <p className="text-sm leading-normal text-error-ink"
           >
              La suppression de cette sous-matière est irréversible. Les notes associées seront perdues.
            </p>
          </div>

          {/* Summary */}
          <div className="mt-4">
            <p className="text-sm font-medium text-neutral-600"
           >
              Élèves affectés : {studentCount}
            </p>
          </div>

          {/* Typed-name (si impact > 0) */}
          {needsTypedName && (
            <div className="space-y-2 pt-2">
              <Label
                htmlFor={`confirm-child-${child.id}`} className="text-sm text-neutral-900"
             >
                Pour confirmer, saisissez{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  {child.name}
                </code>{" "}
                ci-dessous :
              </Label>
              <Input
                id={`confirm-child-${child.id}`}
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder={child.name}
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