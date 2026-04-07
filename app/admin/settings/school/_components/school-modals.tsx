// app/(dashboard)/settings/school/_components/school-modals.tsx
"use client"

import { Button }   from "@/components/ui/button"
import { Input }    from "@/components/ui/input"
import { Label }    from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  type Rubric, type Subject, type Class, type Attitude,
  type RubricForm, type SubjectForm, type SectionForm, type ClassForm,
  CYCLES_MENFP, generateCode,
} from "../_hooks/use-school-settings"

// ── Shared style ──────────────────────────────────────────────────────────────

const inputStyle    = { borderColor:'#D1CECC' }
const btnPrimary    = { backgroundColor:'#2C4A6E', color:'white' }
const btnOutline    = { borderColor:'#D1CECC' }
const infoBox       = { backgroundColor:'#F0F4F7', borderRadius:'8px', padding:'10px 14px', fontSize:'12px', color:'#5A7085' }
const titleStyle    = { fontSize:'22px', fontWeight:700, color:'#2A3740' }

// ── RubricModal ───────────────────────────────────────────────────────────────
// Complexity: 1 (disabled check)

interface RubricModalProps {
  open: boolean; onOpenChange: (v:boolean) => void
  editing: Rubric | null
  form: RubricForm; setForm: (fn:(f:RubricForm)=>RubricForm) => void
  onSave: () => void; submitting: boolean
}
export function RubricModal({ open, onOpenChange, editing, form, setForm, onSave, submitting }: RubricModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ backgroundColor:'white', borderRadius:'12px' }}>
        <DialogHeader>
          <DialogTitle className="font-serif" style={titleStyle}>{editing ? 'Modifier la rubrique' : 'Nouvelle rubrique'}</DialogTitle>
          <DialogDescription className="sr-only">Formulaire rubrique</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label style={{ fontSize:'13px', fontWeight:500 }}>Code * <span style={{ color:'#78756F', fontWeight:400 }}>(ex: R1)</span></Label>
              <Input value={form.code} onChange={e => setForm(f => ({ ...f, code:e.target.value.toUpperCase() }))}
                disabled={!!editing} placeholder="R1"
                style={{ ...inputStyle, backgroundColor:editing ? '#F5F4F2' : 'white' }} />
              {editing && <p style={{ fontSize:'11px', color:'#78756F' }}>Le code ne peut pas être modifié</p>}
            </div>
            <div className="space-y-1">
              <Label style={{ fontSize:'13px', fontWeight:500 }}>Nom *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name:e.target.value }))}
                style={inputStyle} placeholder="Ex: Évaluation continue" />
            </div>
          </div>
          <div className="space-y-1">
            <Label style={{ fontSize:'13px', fontWeight:500 }}>Description</Label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description:e.target.value }))} style={inputStyle} />
          </div>
          <div style={infoBox}><strong>Poids BR-001 :</strong> R1 = 70% · R2 = 25% · R3 = 5%</div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} style={btnOutline}>Annuler</Button>
          <Button onClick={onSave} disabled={submitting || !form.name || !form.code} style={btnPrimary}>
            {submitting ? 'En cours...' : editing ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── SubjectModal ──────────────────────────────────────────────────────────────
// Complexity: 1 (readOnly ternary)

interface SubjectModalProps {
  open: boolean; onOpenChange: (v:boolean) => void
  editing: Subject | null; rubrics: Rubric[]
  form: SubjectForm; setForm: (fn:(f:SubjectForm)=>SubjectForm) => void
  subjectCount: number
  onSave: () => void; submitting: boolean
}
export function SubjectModal({ open, onOpenChange, editing, rubrics, form, setForm, subjectCount, onSave, submitting }: SubjectModalProps) {
  const handleNameChange = (name: string) => {
    setForm(f => ({ ...f, name, ...(!editing && { code:generateCode(name, subjectCount) }) }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ backgroundColor:'white', borderRadius:'12px' }}>
        <DialogHeader>
          <DialogTitle className="font-serif" style={titleStyle}>{editing ? 'Modifier la matière' : 'Nouvelle matière'}</DialogTitle>
          <DialogDescription className="sr-only">Formulaire matière</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label style={{ fontSize:'13px', fontWeight:500 }}>Nom *</Label>
              <Input value={form.name} onChange={e => handleNameChange(e.target.value)} style={inputStyle} />
            </div>
            <div className="space-y-1">
              <Label style={{ fontSize:'13px', fontWeight:500 }}>Code</Label>
              <Input value={form.code} readOnly={!editing}
                onChange={e => editing && setForm(f => ({ ...f, code:e.target.value.toUpperCase() }))}
                style={{ ...inputStyle, backgroundColor:!editing ? '#F5F4F2' : 'white' }} />
              {!editing && <p style={{ fontSize:'11px', color:'#78756F' }}>Généré automatiquement depuis le nom</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label style={{ fontSize:'13px', fontWeight:500 }}>Coefficient</Label>
              <Input type="number" step="0.5" value={form.coefficient}
                onChange={e => setForm(f => ({ ...f, coefficient:e.target.value }))} style={inputStyle} />
            </div>
            <div className="space-y-1">
              <Label style={{ fontSize:'13px', fontWeight:500 }}>Note max</Label>
              <Input type="number" value={form.maxScore}
                onChange={e => setForm(f => ({ ...f, maxScore:e.target.value }))} style={inputStyle} />
            </div>
          </div>
          <div className="space-y-1">
            <Label style={{ fontSize:'13px', fontWeight:500 }}>Rubrique *</Label>
            <Select value={form.rubricId} onValueChange={v => setForm(f => ({ ...f, rubricId:v }))}>
              <SelectTrigger style={inputStyle}><SelectValue placeholder="Sélectionner une rubrique" /></SelectTrigger>
              <SelectContent>{rubrics.map(r => <SelectItem key={r.id} value={r.id}>{r.code} — {r.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="hasSections" checked={form.hasSections}
              onChange={e => setForm(f => ({ ...f, hasSections:e.target.checked }))} />
            <Label htmlFor="hasSections" style={{ fontSize:'13px', fontWeight:500, cursor:'pointer' }}>
              Cette matière a des sous-matières (sections)
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} style={btnOutline}>Annuler</Button>
          <Button onClick={onSave} disabled={submitting || !form.name || !form.code} style={btnPrimary}>
            {submitting ? 'En cours...' : editing ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── SectionModal ──────────────────────────────────────────────────────────────
// Complexity: 2 (forEach in cycles display + warning ternary)

interface SectionModalProps {
  open: boolean; onOpenChange: (v:boolean) => void
  parentSectionCount: number
  form: SectionForm; setForm: (fn:(f:SectionForm)=>SectionForm) => void
  onSave: () => void; submitting: boolean
}

function buildSectionCode(name: string, sectionCount: number): string {
  const clean = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z\s]/g, '').toUpperCase().trim()
  const words = clean.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''                                          // +1
  const letters = words.length === 1 ? words[0].slice(0, 3)                // +1
    : words.length === 2 ? words[0].slice(0, 2) + words[1].slice(0, 1)    // +1
    : words.map((w:string) => w[0]).join('').slice(0, 3)
  return `${letters}-${String(sectionCount + 1).padStart(3, '0')}`
}
// buildSectionCode complexity: 3

export function SectionModal({ open, onOpenChange, parentSectionCount, form, setForm, onSave, submitting }: SectionModalProps) {
  const handleNameChange = (name: string) => {
    const code = buildSectionCode(name, parentSectionCount)
    setForm(f => ({ ...f, name, code }))
  }

  const toggleCycle = (key: string, checked: boolean) =>
    setForm(f => ({ ...f, cycles: checked ? [...f.cycles, key] : f.cycles.filter(c => c !== key) }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ backgroundColor:'white', borderRadius:'12px' }}>
        <DialogHeader>
          <DialogTitle className="font-serif" style={titleStyle}>Nouvelle sous-matière</DialogTitle>
          <DialogDescription className="sr-only">Formulaire sous-matière</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label style={{ fontSize:'13px', fontWeight:500 }}>Nom *</Label>
              <Input value={form.name} onChange={e => handleNameChange(e.target.value)} style={inputStyle} />
            </div>
            <div className="space-y-1">
              <Label style={{ fontSize:'13px', fontWeight:500 }}>Code</Label>
              <Input value={form.code} readOnly style={{ ...inputStyle, backgroundColor:'#F5F4F2' }} />
              <p style={{ fontSize:'11px', color:'#78756F' }}>Généré automatiquement depuis le nom</p>
            </div>
          </div>
          <div className="space-y-1">
            <Label style={{ fontSize:'13px', fontWeight:500 }}>Note max</Label>
            <Input type="number" value={form.maxScore}
              onChange={e => setForm(f => ({ ...f, maxScore:e.target.value }))} style={inputStyle} />
          </div>
          <div className="space-y-2">
            <Label style={{ fontSize:'13px', fontWeight:500 }}>
              Cycles applicables *
              <span style={{ color:'#78756F', fontWeight:400, marginLeft:'6px', fontSize:'12px' }}>
                Dans quels cycles cette sous-matière est enseignée ?
              </span>
            </Label>
            <div style={{ border:'1px solid #E8E6E3', borderRadius:'8px', overflow:'hidden' }}>
              {CYCLES_MENFP.map((cycle, i) => (
                <label key={cycle.key} style={{
                  display:'flex', alignItems:'center', gap:'12px', padding:'10px 14px', cursor:'pointer',
                  borderTop: i > 0 ? '1px solid #F0EDE8' : 'none',
                  backgroundColor: form.cycles.includes(cycle.key) ? '#F0F4F7' : 'white'
                }}>
                  <input type="checkbox" checked={form.cycles.includes(cycle.key)}
                    onChange={e => toggleCycle(cycle.key, e.target.checked)}
                    style={{ width:'16px', height:'16px', accentColor:'#2C4A6E', cursor:'pointer' }} />
                  <div>
                    <span style={{ fontSize:'13px', fontWeight:600, color:'#1E1A17' }}>{cycle.label}</span>
                    <span style={{ fontSize:'12px', color:'#78756F', marginLeft:'8px' }}>{cycle.description}</span>
                  </div>
                </label>
              ))}
            </div>
            {form.cycles.length === 0 && (
              <p style={{ fontSize:'11px', color:'#C48B1A' }}>
                ⚠ Aucun cycle sélectionné — la sous-matière s&apos;appliquera à toutes les classes
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} style={btnOutline}>Annuler</Button>
          <Button onClick={onSave} disabled={submitting || !form.name || !form.code} style={btnPrimary}>
            {submitting ? 'En cours...' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── AttitudeModal ─────────────────────────────────────────────────────────────
// Complexity: 0

interface AttitudeModalProps {
  open: boolean; onOpenChange: (v:boolean) => void
  editing: Attitude | null
  label: string; setLabel: (v:string) => void
  onSave: () => void; submitting: boolean
}
export function AttitudeModal({ open, onOpenChange, editing, label, setLabel, onSave, submitting }: AttitudeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ backgroundColor:'white', borderRadius:'12px' }}>
        <DialogHeader>
          <DialogTitle className="font-serif" style={titleStyle}>
            {editing ? "Modifier l'attitude" : 'Nouvelle attitude'}
          </DialogTitle>
          <DialogDescription style={{ fontSize:'13px', color:'#78756F' }}>
            L&apos;attitude sera évaluée Oui / Non pour chaque élève lors de la saisie du comportement.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label style={{ fontSize:'13px', fontWeight:500 }}>Libellé *</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)}
              placeholder="Ex: Respectueux(se), Ponctuel(le)..."
              style={inputStyle} onKeyDown={e => e.key === 'Enter' && onSave()} autoFocus />
          </div>
          <div style={infoBox}>
            Exemples d&apos;attitudes : Respectueux(se) · Ponctuel(le) · Attentif(ve) · Travailleur(se) · Perturbateur(trice)
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} style={btnOutline}>Annuler</Button>
          <Button onClick={onSave} disabled={submitting || !label.trim()} style={btnPrimary}>
            {submitting ? 'En cours...' : editing ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── ClassModal ────────────────────────────────────────────────────────────────
// Complexity: 0

interface ClassModalProps {
  open: boolean; onOpenChange: (v:boolean) => void
  editing: Class | null
  form: ClassForm; setForm: (fn:(f:ClassForm)=>ClassForm) => void
  onSave: () => void; submitting: boolean
}
export function ClassModal({ open, onOpenChange, editing, form, setForm, onSave, submitting }: ClassModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ backgroundColor:'white', borderRadius:'12px' }}>
        <DialogHeader>
          <DialogTitle className="font-serif" style={titleStyle}>Modifier la classe</DialogTitle>
          <DialogDescription className="sr-only">Modifier le nombre max d&apos;élèves</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div style={{ backgroundColor:'#F0F4F7', borderRadius:'8px', padding:'12px 16px' }}>
            <p style={{ fontSize:'12px', color:'#78756F', marginBottom:'4px' }}>Classe</p>
            <p style={{ fontSize:'16px', fontWeight:700, color:'#2A3740' }}>
              {editing?.classType?.name} — Salle A
            </p>
          </div>
          <div className="space-y-1">
            <Label style={{ fontSize:'13px', fontWeight:500 }}>Max élèves</Label>
            <Input type="number" value={form.maxStudents}
              onChange={e => setForm(f => ({ ...f, maxStudents:e.target.value }))} style={inputStyle} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} style={btnOutline}>Annuler</Button>
          <Button onClick={onSave} disabled={submitting} style={btnPrimary}>
            {submitting ? 'En cours...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}