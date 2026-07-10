"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export interface BulkTransferStudent {
  enrollmentId: string
  name: string
  className: string
  classSessionId: string
  classTypeId?: string
}

interface ClassSessionOption {
  id: string
  label: string
  classTypeId?: string
}

interface BulkTransferModalProps {
  open:         boolean
  onOpenChange: (open: boolean) => void
  students:     BulkTransferStudent[]
  sessions:     ClassSessionOption[]
  submitting?:  boolean
  onSubmit:     (data: { newClassSessionId: string; notes?: string; migrateGrades: boolean }) => void
}

const C = {
  primary:  { 800: '#2A3740' },
  neutral:  { 200: '#E8E6E3', 300: '#D1CECC', 500: '#78756F' },
}

export function BulkTransferModal({
  open,
  onOpenChange,
  students,
  sessions,
  submitting = false,
  onSubmit,
}: BulkTransferModalProps) {
  const [newClassSessionId, setNewClassSessionId] = useState('')
  const [notes, setNotes] = useState('')
  const [migrateGrades, setMigrateGrades] = useState(true)

  const handleOpenChange = (o: boolean) => {
    if (!o) { setNewClassSessionId(''); setNotes(''); setMigrateGrades(true) }
    onOpenChange(o)
  }

  const selectedSession = sessions.find(s => s.id === newClassSessionId)

  // Élèves déjà dans la salle cible : ignorés lors du transfert
  const alreadyThere = selectedSession
    ? students.filter(s => s.classSessionId === selectedSession.id)
    : []
  const toTransfer = selectedSession
    ? students.filter(s => s.classSessionId !== selectedSession.id)
    : students

  // Migration des notes possible seulement si TOUS les élèves à transférer
  // sont du même niveau que la salle cible (le backend refuse sinon, par élève).
  const migrationCompatible =
    !selectedSession ||
    (!!selectedSession.classTypeId &&
      toTransfer.every(s => s.classTypeId === selectedSession.classTypeId))
  const effectiveMigrate = migrateGrades && migrationCompatible && !!selectedSession

  const isValid = newClassSessionId.length > 0 && toTransfer.length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent style={{ maxWidth: '480px', backgroundColor: 'white', borderRadius: '12px' }}>
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 700, color: C.primary[800] }}>
            Transférer {students.length} élève{students.length > 1 ? 's' : ''}
          </DialogTitle>
          <p style={{ fontSize: '13px', color: C.neutral[500], marginTop: '2px' }}>
            Transfert groupé vers une autre salle
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">

          {/* Élèves sélectionnés */}
          <div style={{ border: `1px solid ${C.neutral[200]}`, borderRadius: '8px',
            maxHeight: '160px', overflowY: 'auto' }}>
            {students.map((s, i) => {
              const skipped = alreadyThere.some(a => a.enrollmentId === s.enrollmentId)
              return (
                <div key={s.enrollmentId}
                  style={{
                    display: 'flex', justifyContent: 'space-between', gap: '12px',
                    padding: '7px 12px', fontSize: '13px',
                    borderTop: i > 0 ? `1px solid ${C.neutral[200]}` : 'none',
                    opacity: skipped ? 0.5 : 1,
                  }}>
                  <span style={{ fontWeight: 500, color: '#1F2937' }}>{s.name}</span>
                  <span style={{ color: C.neutral[500], whiteSpace: 'nowrap' }}>
                    {s.className}{skipped ? ' — déjà dans cette salle' : ''}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Nouvelle salle */}
          <div className="space-y-2">
            <Label style={{ fontSize: '13px', fontWeight: 500 }}>
              Salle de destination <span style={{ color: '#C43C3C' }}>*</span>
            </Label>
            <Select value={newClassSessionId} onValueChange={setNewClassSessionId}>
              <SelectTrigger style={{ border: '1px solid #D1CECC', borderRadius: '8px' }}>
                <SelectValue placeholder="Sélectionner une salle" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedSession && alreadyThere.length > 0 && (
              <p style={{ fontSize: '12px', color: '#C48B1A' }}>
                {alreadyThere.length} élève{alreadyThere.length > 1 ? 's' : ''} déjà dans cette salle — ignoré{alreadyThere.length > 1 ? 's' : ''}.
              </p>
            )}
          </div>

          {/* Motif */}
          <div className="space-y-2">
            <Label style={{ fontSize: '13px', fontWeight: 500 }}>Motif (optionnel)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Ex : Rééquilibrage des salles..."
              style={{ borderColor: C.neutral[300] }} />
          </div>

          {/* Migration des notes */}
          <div className="space-y-1">
            <label
              htmlFor="bulk-transfer-migrate-grades"
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                fontSize: '13px', fontWeight: 500,
                color: migrationCompatible ? '#1F2937' : '#9CA3AF',
                cursor: migrationCompatible ? 'pointer' : 'not-allowed',
              }}
            >
              <input
                id="bulk-transfer-migrate-grades"
                type="checkbox"
                checked={migrateGrades && migrationCompatible}
                disabled={!migrationCompatible}
                onChange={e => setMigrateGrades(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#2C4A6E',
                  cursor: migrationCompatible ? 'pointer' : 'not-allowed' }}
              />
              Transférer aussi les notes vers la nouvelle salle
            </label>
            {!migrationCompatible && selectedSession && (
              <p style={{ fontSize: '12px', color: '#C48B1A', marginLeft: '24px' }}>
                Les notes ne peuvent être migrées que si tous les élèves sélectionnés sont du même niveau que la salle cible.
              </p>
            )}
          </div>

          {/* Avertissement */}
          <div style={{ backgroundColor: '#FEF6E0', border: '1px solid #C48B1A', borderRadius: '8px',
            padding: '10px 14px', fontSize: '12px', color: '#92400E' }}>
            {effectiveMigrate
              ? `Les notes, comportements et dispenses de ${toTransfer.length} élève${toTransfer.length > 1 ? 's' : ''} seront transférés vers la nouvelle salle.`
              : "L'historique des notes restera attaché aux anciennes classes."}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}
            disabled={submitting}
            style={{ borderColor: C.neutral[300] }}>
            Annuler
          </Button>
          <Button
            onClick={() => onSubmit({ newClassSessionId, notes: notes || undefined, migrateGrades: effectiveMigrate })}
            disabled={!isValid || submitting}
            style={{ backgroundColor: !isValid || submitting ? '#9CA3AF' : '#2C4A6E', color: '#FFFFFF' }}>
            {submitting
              ? 'Transfert en cours...'
              : `Transférer ${toTransfer.length} élève${toTransfer.length > 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
