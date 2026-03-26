"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { PlusIcon, Trash2Icon, AlertCircleIcon } from "lucide-react"
import type { Level, SubjectParent, SubjectChild } from "@/lib/data/school-data"
import { cn } from "@/lib/utils"

interface SubjectChildData {
  id: string
  name: string
  coefficient: number
}

interface CreateSubjectModalProps {
  subjectParent?: SubjectParent
  subjectChildren?: SubjectChild[]
  levels: Level[]
  onSubmit?: (data: {
    parent: {
      name: string
      rubrique: 'R1' | 'R2' | 'R3'
      levelIds: string[]
      coefficients: {
        filiereId: string | null
        valeur: number
      }[]
    }
    children: {
      name: string
      coefficient: number
    }[]
  }) => void
  trigger?: React.ReactNode
}

export function CreateSubjectModal({ subjectParent, subjectChildren, levels, onSubmit, trigger }: CreateSubjectModalProps) {
  const isEditMode = !!subjectParent
  const [open, setOpen] = useState(false)
  
  // Section 1 - Matière parent
  const [name, setName] = useState(subjectParent?.name || "")
  const [rubrique, setRubrique] = useState<'R1' | 'R2' | 'R3' | ''>(subjectParent?.rubrique || '')
  const [selectedLevels, setSelectedLevels] = useState<string[]>(subjectParent?.levelIds || [])
  
  // Coefficients par filière (Nouveau Secondaire)
  const [coeffLLA, setCoeffLLA] = useState(subjectParent?.coefficients.find(c => c.filiereId === 'LLA')?.valeur.toString() || "")
  const [coeffSES, setCoeffSES] = useState(subjectParent?.coefficients.find(c => c.filiereId === 'SES')?.valeur.toString() || "")
  const [coeffSMP, setCoeffSMP] = useState(subjectParent?.coefficients.find(c => c.filiereId === 'SMP')?.valeur.toString() || "")
  const [coeffSVT, setCoeffSVT] = useState(subjectParent?.coefficients.find(c => c.filiereId === 'SVT')?.valeur.toString() || "")
  
  // Coefficient tronc commun (Primaire)
  const [coeffTroncCommun, setCoeffTroncCommun] = useState(subjectParent?.coefficients.find(c => c.filiereId === null)?.valeur.toString() || "")
  
  // Section 2 - Sous-matières
  const [children, setChildren] = useState<SubjectChildData[]>(
    subjectChildren?.map(sc => ({ id: sc.id, name: sc.name, coefficient: sc.coefficient })) || []
  )

  // Déterminer si les niveaux sélectionnés sont Primaire ou Nouveau Secondaire
  const selectedLevelsData = levels.filter(l => selectedLevels.includes(l.id))
  const isPrimaire = selectedLevelsData.every(l => l.niveau === 'Fondamentale')
  const isNouveauSecondaire = selectedLevelsData.every(l => l.niveau === 'Nouveau Secondaire')
  
  const addChild = () => {
    setChildren([...children, { id: `temp-${Date.now()}`, name: "", coefficient: 0 }])
  }
  
  const removeChild = (id: string) => {
    setChildren(children.filter(c => c.id !== id))
  }
  
  const updateChild = (id: string, field: 'name' | 'coefficient', value: string | number) => {
    setChildren(children.map(c => c.id === id ? { ...c, [field]: value } : c))
  }
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!name.trim() || !rubrique || selectedLevels.length === 0) return
    if (children.length === 0) return
    if (children.some(c => !c.name.trim() || c.coefficient <= 0)) return
    
    // Construire les coefficients selon le type de niveau
    let coefficients: { filiereId: string | null; valeur: number }[] = []
    
    if (isPrimaire) {
      if (!coeffTroncCommun) return
      coefficients = [{ filiereId: null, valeur: parseFloat(coeffTroncCommun) }]
    } else if (isNouveauSecondaire) {
      if (!coeffLLA || !coeffSES || !coeffSMP || !coeffSVT) return
      coefficients = [
        { filiereId: 'LLA', valeur: parseFloat(coeffLLA) },
        { filiereId: 'SES', valeur: parseFloat(coeffSES) },
        { filiereId: 'SMP', valeur: parseFloat(coeffSMP) },
        { filiereId: 'SVT', valeur: parseFloat(coeffSVT) }
      ]
    }
    
    onSubmit?.({
      parent: {
        name: name.trim(),
        rubrique,
        levelIds: selectedLevels,
        coefficients
      },
      children: children.map(c => ({
        name: c.name.trim(),
        coefficient: c.coefficient
      }))
    })
    
    // Reset form
    resetForm()
    setOpen(false)
  }
  
  const resetForm = () => {
    setName("")
    setRubrique('')
    setSelectedLevels([])
    setCoeffTroncCommun("")
    setCoeffLLA("")
    setCoeffSES("")
    setCoeffSMP("")
    setCoeffSVT("")
    setChildren([])
  }

  const handleCancel = () => {
    resetForm()
    setOpen(false)
  }
  
  // Validation
  const isParentValid = name.trim() && rubrique && selectedLevels.length > 0
  const isCoefficientsValid = isPrimaire ? !!coeffTroncCommun : (isNouveauSecondaire ? (!!coeffLLA && !!coeffSES && !!coeffSMP && !!coeffSVT) : false)
  const isChildrenValid = children.length > 0 && children.every(c => c.name.trim() && c.coefficient > 0)
  const isValid = isParentValid && isCoefficientsValid && isChildrenValid

  // Grouper les niveaux par type
  const primairelevels = levels.filter(l => l.niveau === 'Fondamentale')
  const nouveauSecondaireLevels = levels.filter(l => l.niveau === 'Nouveau Secondaire')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="gap-2">
            <PlusIcon className="h-4 w-4" />
            Nouvelle matière
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Modifier la matière' : 'Nouvelle matière'}</DialogTitle>
            <DialogDescription>
              Créez une matière parent (MENFP) avec ses sous-matières (CPMSL)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* SECTION 1 - MATIÈRE PARENT */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Section 1 — Matière parent</h3>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name">
                  Nom de la matière <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Ex: Communication Française"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rubrique">
                  Rubrique <span className="text-destructive">*</span>
                </Label>
                <Select value={rubrique} onValueChange={(value: any) => setRubrique(value)}>
                  <SelectTrigger id="rubrique">
                    <SelectValue placeholder="Sélectionner une rubrique" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="R1">R1</SelectItem>
                    <SelectItem value="R2">R2</SelectItem>
                    <SelectItem value="R3">R3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>
                  Niveaux concernés <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {primairelevels.map(level => (
                    <Button
                      key={level.id}
                      type="button"
                      variant={selectedLevels.includes(level.id) ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSelectedLevels(prev =>
                          prev.includes(level.id)
                            ? prev.filter(id => id !== level.id)
                            : [...prev, level.id]
                        )
                      }}
                      className="justify-start"
                    >
                      {level.name}
                    </Button>
                  ))}
                  {nouveauSecondaireLevels.map(level => (
                    <Button
                      key={level.id}
                      type="button"
                      variant={selectedLevels.includes(level.id) ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSelectedLevels(prev =>
                          prev.includes(level.id)
                            ? prev.filter(id => id !== level.id)
                            : [...prev, level.id]
                        )
                      }}
                      className="justify-start"
                    >
                      {level.name}
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Coefficients selon le type de niveau */}
              {isPrimaire && (
                <div className="space-y-2">
                  <Label htmlFor="coeff-tronc-commun">
                    Coefficient (tronc commun) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="coeff-tronc-commun"
                    type="number"
                    min="1"
                    placeholder="Ex: 60"
                    value={coeffTroncCommun}
                    onChange={(e) => setCoeffTroncCommun(e.target.value)}
                    required
                  />
                </div>
              )}
              
              {isNouveauSecondaire && (
                <div className="space-y-3">
                  <Label>Coefficients par filière <span className="text-destructive">*</span></Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="coeff-lla" className="text-xs text-muted-foreground">Coefficient LLA</Label>
                      <Input
                        id="coeff-lla"
                        type="number"
                        min="1"
                        placeholder="40"
                        value={coeffLLA}
                        onChange={(e) => setCoeffLLA(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="coeff-ses" className="text-xs text-muted-foreground">Coefficient SES</Label>
                      <Input
                        id="coeff-ses"
                        type="number"
                        min="1"
                        placeholder="50"
                        value={coeffSES}
                        onChange={(e) => setCoeffSES(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="coeff-smp" className="text-xs text-muted-foreground">Coefficient SMP</Label>
                      <Input
                        id="coeff-smp"
                        type="number"
                        min="1"
                        placeholder="100"
                        value={coeffSMP}
                        onChange={(e) => setCoeffSMP(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="coeff-svt" className="text-xs text-muted-foreground">Coefficient SVT</Label>
                      <Input
                        id="coeff-svt"
                        type="number"
                        min="1"
                        placeholder="60"
                        value={coeffSVT}
                        onChange={(e) => setCoeffSVT(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <Separator />
            
            {/* SECTION 2 - SOUS-MATIÈRES */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Section 2 — Sous-matières</h3>
                <Button type="button" variant="outline" size="sm" onClick={addChild} className="gap-2">
                  <PlusIcon className="h-4 w-4" />
                  Ajouter
                </Button>
              </div>
              
              {children.length === 0 ? (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
                  <AlertCircleIcon className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Au moins une sous-matière est requise
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Header */}
                  <div className="grid grid-cols-[1fr,120px,40px] gap-2 px-2 text-xs font-medium text-muted-foreground">
                    <div>Nom</div>
                    <div>Coefficient</div>
                    <div></div>
                  </div>
                  
                  {/* Rows */}
                  {children.map((child) => (
                    <div key={child.id} className="grid grid-cols-[1fr,120px,40px] gap-2 items-center">
                      <Input
                        placeholder="Ex: Dissertation"
                        value={child.name}
                        onChange={(e) => updateChild(child.id, 'name', e.target.value)}
                        className={cn(!child.name.trim() && "border-destructive")}
                      />
                      <Input
                        type="number"
                        min="1"
                        placeholder="60"
                        value={child.coefficient || ""}
                        onChange={(e) => updateChild(child.id, 'coefficient', parseFloat(e.target.value) || 0)}
                        className={cn(child.coefficient <= 0 && "border-destructive")}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeChild(child.id)}
                        className="h-9 w-9 p-0"
                      >
                        <Trash2Icon className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Annuler
            </Button>
            <Button type="submit" disabled={!isValid}>
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}