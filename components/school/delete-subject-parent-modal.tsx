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
      <DialogContent
        style={{
          maxWidth: '520px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E8E6E3',
          borderRadius: '12px',
          padding: 0
        }}
      >
        <DialogHeader style={{ padding: '24px 24px 16px 24px', borderBottom: '1px solid #E8E6E3' }}>
          <DialogTitle
            style={{
              color: '#1E1A17',
              fontSize: '20px',
              fontWeight: 600,
              fontFamily: 'var(--font-serif)'
            }}
          >
            Supprimer la matière {subject.name}
          </DialogTitle>
        </DialogHeader>

        <div style={{ padding: '24px' }} className="space-y-4">
          {/* Warning block */}
          <div
            style={{
              backgroundColor: '#FEE2E2',
              border: '1px solid #FCA5A5',
              borderRadius: '8px',
              padding: '16px'
            }}
          >
            <p
              style={{
                color: '#991B1B',
                fontSize: '14px',
                lineHeight: '1.5'
              }}
            >
              Cette matière contient {childCount} {childCount === 1 ? 'sous-matière' : 'sous-matières'}. La suppression retirera toutes les sous-matières associées. Cette action est irréversible.
            </p>
          </div>

          {/* Summary */}
          <div style={{ marginTop: '16px' }} className="space-y-1">
            <p
              style={{
                color: '#5C5955',
                fontSize: '14px',
                fontWeight: 500
              }}
            >
              Sous-matières supprimées : {childCount}
            </p>
            {/* Élèves affectés : affiché uniquement si le chiffre est fourni */}
            {studentCount !== undefined && (
              <p
                style={{
                  color: '#5C5955',
                  fontSize: '14px',
                  fontWeight: 500
                }}
              >
                Élèves affectés : {studentCount}
              </p>
            )}
            <p
              style={{
                color: '#5C5955',
                fontSize: '14px',
                fontWeight: 500
              }}
            >
              Notes associées : toutes les notes de cette matière seront supprimées
            </p>
          </div>

          {/* Typed-name (si impact > 0) */}
          {needsTypedName && (
            <div className="space-y-2 pt-2">
              <Label
                htmlFor={`confirm-subject-${subject.id}`}
                style={{ fontSize: '13px', color: '#1E1A17' }}
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
                autoFocus
                style={{
                  borderRadius: '8px',
                  border: '1px solid #D1CECC',
                  fontSize: '14px'
                }}
              />
            </div>
          )}
        </div>

        <DialogFooter
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #E8E6E3',
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}
        >
          <Button
            variant="outline"
            onClick={() => onOpenChange?.(false)}
            style={{
              border: '1px solid #D1CECC',
              color: '#5C5955',
              borderRadius: '8px'
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            style={{
              backgroundColor: canConfirm ? '#B91C1C' : '#D1CECC',
              color: '#FFFFFF',
              borderRadius: '8px',
              cursor: canConfirm ? 'pointer' : 'not-allowed'
            }}
          >
            Supprimer définitivement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}