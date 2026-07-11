"use client"

// Dispense d'étape : un élève dispensé d'une étape entière voit la moyenne de
// cette étape exclue de sa moyenne générale annuelle. Scopé par inscription.

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"

interface StepOption {
  id: string
  name: string
  stepNumber: number
}

interface StepExemptionModalProps {
  open:         boolean
  onOpenChange: (open: boolean) => void
  enrollmentId: string
  studentName:  string
  steps:        StepOption[]
}

const C = {
  primary: { 800: '#2A3740' },
  neutral: { 200: '#E8E6E3', 300: '#D1CECC', 500: '#78756F' },
}

export function StepExemptionModal({
  open,
  onOpenChange,
  enrollmentId,
  studentName,
  steps,
}: StepExemptionModalProps) {
  const { toast } = useToast()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [reason, setReason]     = useState('')
  const [loading, setLoading]   = useState(false)
  const [saving, setSaving]     = useState(false)

  // Charger les dispenses existantes à l'ouverture
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/enrollments/${enrollmentId}/step-exemptions`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : [])
      .then((rows: Array<{ stepId: string; reason?: string | null }>) => {
        if (cancelled) return
        setSelected(new Set(rows.map(r => r.stepId)))
        setReason(rows.find(r => r.reason)?.reason ?? '')
      })
      .catch(() => { if (!cancelled) setSelected(new Set()) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, enrollmentId])

  const toggle = (stepId: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(stepId)) next.delete(stepId)
      else next.add(stepId)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/enrollments/${enrollmentId}/step-exemptions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepIds: Array.from(selected), reason: reason || undefined }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.message ?? 'Échec de la mise à jour des dispenses')
      toast({
        title: "Dispenses mises à jour",
        description: selected.size > 0
          ? `${selected.size} étape${selected.size > 1 ? 's' : ''} dispensée${selected.size > 1 ? 's' : ''} — exclue${selected.size > 1 ? 's' : ''} de la moyenne générale`
          : "Aucune étape dispensée",
      })
      onOpenChange(false)
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible d'enregistrer les dispenses",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const ordered = [...steps].sort((a, b) => a.stepNumber - b.stepNumber)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: '440px', backgroundColor: 'white', borderRadius: '12px' }}>
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 700, color: C.primary[800] }}>
            Dispenser d&apos;une étape
          </DialogTitle>
          <p style={{ fontSize: '13px', color: C.neutral[500], marginTop: '2px' }}>
            {studentName}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Label style={{ fontSize: '13px', fontWeight: 500 }}>
            Étapes dispensées
          </Label>
          <div style={{ border: `1px solid ${C.neutral[200]}`, borderRadius: '8px', overflow: 'hidden' }}>
            {loading ? (
              <p style={{ padding: '12px 14px', fontSize: '13px', color: C.neutral[500] }}>Chargement…</p>
            ) : ordered.length === 0 ? (
              <p style={{ padding: '12px 14px', fontSize: '13px', color: C.neutral[500] }}>
                Aucune étape définie pour cette année
              </p>
            ) : (
              ordered.map((step, i) => {
                const checked = selected.has(step.id)
                const inputId = `step-exemption-${step.id}`
                return (
                  <label
                    key={step.id}
                    htmlFor={inputId}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 14px', cursor: 'pointer', fontSize: '14px',
                      borderTop: i > 0 ? `1px solid ${C.neutral[200]}` : 'none',
                      backgroundColor: checked ? '#F0F4F7' : 'white',
                      fontWeight: checked ? 600 : 400,
                      color: '#1F2937',
                    }}
                  >
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(step.id)}
                      style={{ width: '16px', height: '16px', accentColor: '#2C4A6E', cursor: 'pointer' }}
                    />
                    {step.name}
                  </label>
                )
              })
            )}
          </div>

          {/* Motif */}
          <div className="space-y-2">
            <Label style={{ fontSize: '13px', fontWeight: 500 }}>Motif (optionnel)</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Ex : Arrivé en cours d'année, raison médicale..."
              style={{ borderColor: C.neutral[300] }} />
          </div>

          {/* Explication */}
          <div style={{ backgroundColor: '#FEF6E0', border: '1px solid #C48B1A', borderRadius: '8px',
            padding: '10px 14px', fontSize: '12px', color: '#92400E' }}>
            La moyenne d&apos;une étape dispensée n&apos;entre pas dans le calcul de la moyenne
            générale de l&apos;élève. Les autres étapes de l&apos;année ne sont pas affectées.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}
            style={{ borderColor: C.neutral[300] }}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}
            style={{ backgroundColor: saving || loading ? '#9CA3AF' : '#2C4A6E', color: '#FFFFFF' }}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
