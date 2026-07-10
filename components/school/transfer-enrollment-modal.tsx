"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ClassSession {
  id: string
  label: string
  classTypeId?: string
}

interface TransferEnrollmentModalProps {
  open:               boolean
  onOpenChange:       (open: boolean) => void
  studentName:        string
  currentClassName:   string
  currentClassTypeId?: string
  sessions:           ClassSession[]
  submitting?:        boolean
  onSubmit:           (data: { newClassSessionId: string; notes?: string; migrateGrades?: boolean }) => void
}

const C = {
  primary:  { 800: '#2A3740' },
  neutral:  { 200: '#E8E6E3', 300: '#D1CECC', 500: '#78756F' },
}

export function TransferEnrollmentModal({
  open,
  onOpenChange,
  studentName,
  currentClassName,
  currentClassTypeId,
  sessions,
  submitting = false,
  onSubmit,
}: TransferEnrollmentModalProps) {
  const [newClassSessionId, setNewClassSessionId] = useState('')
  const [notes, setNotes] = useState('')
  const [migrateGrades, setMigrateGrades] = useState(true)

  const handleOpenChange = (o: boolean) => {
    if (!o) { setNewClassSessionId(''); setNotes(''); setMigrateGrades(true) }
    onOpenChange(o)
  }

  const isValid = newClassSessionId.length > 0

  // La migration des notes n'est possible que vers une salle du même niveau
  // (même classType), dans la même année — le backend le vérifie aussi.
  const selectedSession = sessions.find(s => s.id === newClassSessionId)
  const migrationSupported = !!currentClassTypeId
  const migrationCompatible =
    migrationSupported &&
    (!selectedSession || selectedSession.classTypeId === currentClassTypeId)
  const effectiveMigrate = migrateGrades && migrationCompatible && !!selectedSession

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent style={{ maxWidth: '440px', backgroundColor: 'white', borderRadius: '12px' }}>
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 700, color: C.primary[800] }}>
            Transférer l&apos;élève
          </DialogTitle>
          <p style={{ fontSize: '13px', color: C.neutral[500], marginTop: '2px' }}>
            {studentName}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">

          {/* Classe actuelle */}
          <div style={{ backgroundColor: '#F1F5F9', borderRadius: '8px', padding: '10px 14px',
            fontSize: '13px', color: '#5A7085' }}>
            <span style={{ fontWeight: 500 }}>Classe actuelle : </span>
            <span style={{ fontWeight: 600, color: '#2C4A6E' }}>{currentClassName}</span>
          </div>

          {/* Nouvelle classe */}
          <div className="space-y-2">
            <Label style={{ fontSize: '13px', fontWeight: 500 }}>
              Nouvelle classe <span style={{ color: '#C43C3C' }}>*</span>
            </Label>
            <Select value={newClassSessionId} onValueChange={setNewClassSessionId}>
              <SelectTrigger style={{ border: '1px solid #D1CECC', borderRadius: '8px' }}>
                <SelectValue placeholder="Sélectionner une classe" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label style={{ fontSize: '13px', fontWeight: 500 }}>Motif (optionnel)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Ex : Changement de filière, décision direction..."
              style={{ borderColor: C.neutral[300] }} />
          </div>

          {/* Migration des notes */}
          {migrationSupported && (
            <div className="space-y-1">
              <label
                htmlFor="transfer-migrate-grades"
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  fontSize: '13px', fontWeight: 500,
                  color: migrationCompatible ? '#1F2937' : '#9CA3AF',
                  cursor: migrationCompatible ? 'pointer' : 'not-allowed',
                }}
              >
                <input
                  id="transfer-migrate-grades"
                  type="checkbox"
                  checked={migrateGrades && migrationCompatible}
                  disabled={!migrationCompatible}
                  onChange={e => setMigrateGrades(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#2C4A6E',
                    cursor: migrationCompatible ? 'pointer' : 'not-allowed' }}
                />
                Transférer aussi les notes vers la nouvelle classe
              </label>
              {!migrationCompatible && selectedSession && (
                <p style={{ fontSize: '12px', color: '#C48B1A', marginLeft: '24px' }}>
                  Les notes ne peuvent être migrées que vers une salle du même niveau.
                </p>
              )}
            </div>
          )}

          {/* Avertissement */}
          <div style={{ backgroundColor: '#FEF6E0', border: '1px solid #C48B1A', borderRadius: '8px',
            padding: '10px 14px', fontSize: '12px', color: '#92400E' }}>
            {effectiveMigrate
              ? "Les notes, comportements et dispenses seront transférés vers la nouvelle classe. Le nouvel enrollment sera actif immédiatement."
              : "L'historique des notes reste attaché à l'ancienne classe. Le nouvel enrollment sera actif immédiatement."}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}
            style={{ borderColor: C.neutral[300] }}>
            Annuler
          </Button>
          <Button onClick={() => onSubmit({ newClassSessionId, notes: notes || undefined, migrateGrades: effectiveMigrate })}
            disabled={!isValid || submitting}
            style={{ backgroundColor: !isValid || submitting ? '#9CA3AF' : '#2C4A6E', color: '#FFFFFF' }}>
            {submitting ? 'Transfert...' : 'Confirmer le transfert'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
