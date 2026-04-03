"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface EditStudentData {
  address:      string
  motherName:   string
  fatherName:   string
  phone1:       string
  phone2:       string
  parentsEmail: string
}

interface EditStudentModalProps {
  open:          boolean
  onOpenChange:  (open: boolean) => void
  studentName:   string
  studentCode:   string
  initialData:   Partial<EditStudentData>
  submitting?:   boolean
  onSubmit:      (data: EditStudentData) => void
}

const C = {
  primary:  { 800: '#2A3740', 600: '#4A5D6E' },
  neutral:  { 200: '#E8E6E3', 300: '#D1CECC', 500: '#78756F' },
}

export function EditStudentModal({
  open,
  onOpenChange,
  studentName,
  studentCode,
  initialData,
  submitting = false,
  onSubmit,
}: EditStudentModalProps) {
  const [form, setForm] = useState<EditStudentData>({
    address:      '',
    motherName:   '',
    fatherName:   '',
    phone1:       '',
    phone2:       '',
    parentsEmail: '',
  })

  useEffect(() => {
    if (open) {
      setForm({
        address:      initialData.address      || '',
        motherName:   initialData.motherName   || '',
        fatherName:   initialData.fatherName   || '',
        phone1:       initialData.phone1       || '',
        phone2:       initialData.phone2       || '',
        parentsEmail: initialData.parentsEmail || '',
      })
    }
  }, [open, initialData])

  const set = (field: keyof EditStudentData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: '480px', backgroundColor: 'white', borderRadius: '12px' }}>
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 700, color: C.primary[800] }}>
            Modifier le profil
          </DialogTitle>
          <p style={{ fontSize: '13px', color: C.neutral[500], marginTop: '2px' }}>
            {studentName} · <span style={{ fontFamily: 'monospace' }}>{studentCode}</span>
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">

          <div className="space-y-2">
            <Label style={{ fontSize: '13px', fontWeight: 500 }}>Adresse</Label>
            <Input value={form.address} onChange={set('address')} placeholder="Adresse de l'élève"
              style={{ borderColor: C.neutral[300] }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label style={{ fontSize: '13px', fontWeight: 500 }}>Nom de la mère</Label>
              <Input value={form.motherName} onChange={set('motherName')} placeholder="Prénom Nom"
                style={{ borderColor: C.neutral[300] }} />
            </div>
            <div className="space-y-2">
              <Label style={{ fontSize: '13px', fontWeight: 500 }}>Nom du père</Label>
              <Input value={form.fatherName} onChange={set('fatherName')} placeholder="Prénom Nom"
                style={{ borderColor: C.neutral[300] }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label style={{ fontSize: '13px', fontWeight: 500 }}>Téléphone 1</Label>
              <Input value={form.phone1} onChange={set('phone1')} placeholder="+509..."
                style={{ borderColor: C.neutral[300] }} />
            </div>
            <div className="space-y-2">
              <Label style={{ fontSize: '13px', fontWeight: 500 }}>Téléphone 2</Label>
              <Input value={form.phone2} onChange={set('phone2')} placeholder="+509..."
                style={{ borderColor: C.neutral[300] }} />
            </div>
          </div>

          <div className="space-y-2">
            <Label style={{ fontSize: '13px', fontWeight: 500 }}>Email des parents</Label>
            <Input value={form.parentsEmail} onChange={set('parentsEmail')} type="email"
              placeholder="email@exemple.com" style={{ borderColor: C.neutral[300] }} />
          </div>

          <div style={{ backgroundColor: '#FEF6E0', border: '1px solid #C48B1A', borderRadius: '8px',
            padding: '10px 14px', fontSize: '12px', color: '#92400E' }}>
            Le NISU n'est pas modifiable après l'inscription.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}
            style={{ borderColor: C.neutral[300] }}>
            Annuler
          </Button>
          <Button onClick={() => onSubmit(form)} disabled={submitting}
            style={{ backgroundColor: submitting ? '#9CA3AF' : '#5A7085', color: '#FFFFFF' }}>
            {submitting ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}