"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface EditLevelModalProps {
  level: {
    id: string
    name: string
    niveau: string
    description?: string
  }
  onConfirm?: (data: {
    description?: string
  }) => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function EditLevelModal({
  level,
  onConfirm,
  trigger,
  open,
  onOpenChange
}: EditLevelModalProps) {
  const [description, setDescription] = useState(level.description || '')
  const maxChars = 200

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setDescription(level.description || '')
    }
  }, [open, level.description])

  const hasChanges = description !== (level.description || '')
  const isFondamentale = level.niveau === 'Fondamentale'

  const title = `Modifier la classe ${level.name}`

  const handleConfirm = () => {
    if (hasChanges) {
      onConfirm?.({
        description: description.trim() || undefined
      })
      onOpenChange?.(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger}
      <DialogContent
        style={{
          maxWidth: '520px',
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
          <div className="space-y-5">
            {/* Niveau Field - Read-only */}
            <div>
              <Label
                style={{
                  color: '#1E1A17',
                  fontSize: '14px',
                  fontWeight: 500,
                  marginBottom: '8px',
                  display: 'block'
                }}
              >
                Niveau *
              </Label>
              <RadioGroup value={level.niveau} disabled>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RadioGroupItem
                      value="Fondamentale"
                      id="niveau-fondamentale"
                      disabled
                      style={{ opacity: 0.5 }}
                    />
                    <Label
                      htmlFor="niveau-fondamentale"
                      style={{
                        color: '#9CA3AF',
                        fontSize: '14px',
                        fontWeight: 400,
                        cursor: 'not-allowed'
                      }}
                    >
                      Fondamentale
                    </Label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RadioGroupItem
                      value="Nouveau Secondaire"
                      id="niveau-secondaire"
                      disabled
                      style={{ opacity: 0.5 }}
                    />
                    <Label
                      htmlFor="niveau-secondaire"
                      style={{
                        color: '#9CA3AF',
                        fontSize: '14px',
                        fontWeight: 400,
                        cursor: 'not-allowed'
                      }}
                    >
                      Nouveau Secondaire
                    </Label>
                  </div>
                </div>
              </RadioGroup>
              <p
                style={{
                  color: '#9CA3AF',
                  fontSize: '13px',
                  marginTop: '6px'
                }}
              >
                Le niveau ne peut pas être modifié
              </p>
            </div>

            {/* Nom de la classe Field - Read-only */}
            <div>
              <Label
                htmlFor="class-name"
                style={{
                  color: '#1E1A17',
                  fontSize: '14px',
                  fontWeight: 500,
                  marginBottom: '8px',
                  display: 'block'
                }}
              >
                Nom de la classe *
              </Label>
              <div
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #E8E6E3',
                  backgroundColor: '#F9FAFB',
                  color: '#9CA3AF',
                  fontSize: '14px',
                  cursor: 'not-allowed'
                }}
              >
                {level.name}
              </div>
              <p
                style={{
                  color: '#9CA3AF',
                  fontSize: '13px',
                  marginTop: '6px'
                }}
              >
                Le nom ne peut pas être modifié
              </p>
            </div>

            {/* Description Field - Editable */}
            <div>
              <Label
                htmlFor="description"
                style={{
                  color: '#1E1A17',
                  fontSize: '14px',
                  fontWeight: 500,
                  marginBottom: '8px',
                  display: 'block'
                }}
              >
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => {
                  const value = e.target.value
                  if (value.length <= maxChars) {
                    setDescription(value)
                  }
                }}
                placeholder="Description optionnelle..."
                style={{
                  minHeight: '100px',
                  resize: 'vertical',
                  borderRadius: '8px',
                  border: '1px solid #D1CECC',
                  fontSize: '14px'
                }}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: '6px'
                }}
              >
                <span
                  style={{
                    color: description.length >= maxChars ? '#B91C1C' : '#9CA3AF',
                    fontSize: '13px'
                  }}
                >
                  {description.length}/{maxChars} caractères
                </span>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <DialogFooter style={{ marginTop: '24px', gap: '12px', display: 'flex', flexDirection: 'row', justifyContent: 'flex-end' }}>
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
              disabled={!hasChanges}
              style={{
                backgroundColor: hasChanges ? '#2C4A6E' : '#9CA3AF',
                color: '#FFFFFF',
                borderRadius: '8px',
                cursor: hasChanges ? 'pointer' : 'not-allowed'
              }}
              className={hasChanges ? 'hover:bg-[#243D5A]' : ''}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
