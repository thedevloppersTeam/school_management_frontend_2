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
} from "@/components/ui/dialog"

/**
 * delete-classroom-modal.tsx — Patch EP-006
 *
 * Ajoute un champ typed-name conditionnel :
 *   - studentCount > 0  → l'Administrateur doit taper le nom exact
 *                         de la salle/filière pour activer le bouton
 *   - studentCount = 0  → bouton actif immédiatement (salle vide,
 *                         pas de friction)
 *
 * Le reste du style (inline) est conservé volontairement — la migration
 * vers Tailwind/shadcn tokens (AI-002) est un chantier séparé.
 */

interface DeleteClassroomModalProps {
  classroom: {
    id: string
    name: string
  }
  level: {
    name: string
    niveau: string
  }
  studentCount: number
  onConfirm?: () => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function DeleteClassroomModal({
  classroom,
  level,
  studentCount,
  onConfirm,
  trigger,
  open,
  onOpenChange
}: DeleteClassroomModalProps) {
  const [typedName, setTypedName] = useState("")

  // Reset à chaque ouverture
  useEffect(() => {
    if (open) setTypedName("")
  }, [open])

  const isFondamentale = level.niveau === 'Fondamentale'
  const title = isFondamentale
    ? `Supprimer la Salle ${classroom.name} — ${level.name}`
    : `Supprimer la filière ${classroom.name} — ${level.name}`

  // Typed-name exigé uniquement si impact > 0
  const needsTypedName = studentCount > 0
  const typedMatches = !needsTypedName || typedName.trim() === classroom.name.trim()
  const canConfirm = typedMatches

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm?.()
    onOpenChange?.(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger}
      <DialogContent
        style={{
          maxWidth: '480px',
          borderRadius: '10px',
          border: '1px solid #E8E6E3',
          padding: 0
        }}
      >
        <DialogHeader style={{ padding: '24px 24px 16px 24px' }}>
          <DialogTitle
            style={{
              color: '#1E1A17',
              fontSize: '18px',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)'
            }}
          >
            {title}
          </DialogTitle>
        </DialogHeader>

        <div style={{ padding: '0 24px 24px 24px' }}>
          {/* Warning Block */}
          <div
            style={{
              backgroundColor: '#FEE2E2',
              color: '#991B1B',
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '14px',
              lineHeight: '1.5'
            }}
          >
            Cette {isFondamentale ? 'salle' : 'filière'} contient {studentCount} élèves.
            La suppression retirera ces élèves de la {isFondamentale ? 'salle' : 'filière'}.
            Cette action est irréversible.
          </div>

          {/* 16px spacing */}
          <div style={{ height: '16px' }} />

          {/* Summary Line */}
          <div
            style={{
              color: '#5C5955',
              fontSize: '14px',
              fontWeight: 500,
              marginBottom: needsTypedName ? '16px' : '24px'
            }}
          >
            Élèves affectés : {studentCount}
          </div>

          {/* Typed-name confirmation (uniquement si impact > 0) */}
          {needsTypedName && (
            <div style={{ marginBottom: '24px' }}>
              <Label
                htmlFor={`confirm-classroom-${classroom.id}`}
                style={{
                  fontSize: '13px',
                  color: '#1E1A17',
                  display: 'block',
                  marginBottom: '6px'
                }}
              >
                Pour confirmer, saisissez{" "}
                <code
                  style={{
                    backgroundColor: '#F0EDE8',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    color: '#1E1A17'
                  }}
                >
                  {classroom.name}
                </code>{" "}
                ci-dessous :
              </Label>
              <Input
                id={`confirm-classroom-${classroom.id}`}
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder={classroom.name}
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

          {/* Buttons */}
          <DialogFooter style={{ gap: '12px', display: 'flex', flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Button
              variant="outline"
              onClick={() => onOpenChange?.(false)}
              style={{
                borderRadius: '8px',
                border: '1px solid #D1CECC',
                color: '#1E1A17',
                backgroundColor: '#FFFFFF'
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
              className={canConfirm ? 'hover:bg-[#991B1B]' : ''}
            >
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}