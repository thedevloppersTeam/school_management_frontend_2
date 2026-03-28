"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertTriangleIcon, UploadIcon, XIcon, UserIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { type Student, type Level } from "@/lib/data/school-data"

interface StudentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  student?: Student | null
  levels: Level[]
  yearId: string
  existingStudents: Student[]
  onSubmit: (data: StudentFormData) => void
  trigger?: React.ReactNode
}

export interface StudentFormData {
  nisu: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: "M" | "F"
  levelId: string
  subdivisionId?: string
  avatar: string
  studentCode: string
}

export function StudentFormDialog({
  open,
  onOpenChange,
  student,
  levels,
  yearId,
  existingStudents,
  onSubmit,
  trigger
}: StudentFormDialogProps) {
  const [formData, setFormData] = useState<StudentFormData>({
    nisu: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "M",
    levelId: "",
    subdivisionId: undefined,
    avatar: "",
    studentCode: ""
  })
  const [nisuError, setNisuError] = useState("")
  const [photoPreview, setPhotoPreview] = useState<string>("")
  const [showNisuError, setShowNisuError] = useState(false)

  // Extract base level from level name (e.g., "7e A" -> "7e", "NSI LLA" -> "NSI")
  const getBaseLevel = (levelName: string): string => {
    const match = levelName.match(/^(\d+e|NSII|NSI)/)
    return match ? match[1] : levelName
  }

  // Extract subdivision from level name (e.g., "7e A" -> "A", "NSI LLA" -> "LLA")
  const getSubdivision = (levelName: string): string => {
    const baseLevel = getBaseLevel(levelName)
    const subdivision = levelName.replace(baseLevel, '').trim()
    return subdivision || ''
  }

  // Get unique base levels (7e, 8e, 9e, NSI, NSII)
  const uniqueBaseLevels = useMemo(() => {
    const baseLevels = new Set<string>()
    levels
      .filter(l => l.academicYearId === yearId)
      .forEach(level => {
        baseLevels.add(getBaseLevel(level.name))
      })
    return Array.from(baseLevels).sort((a, b) => {
      const order = ['7e', '8e', '9e', 'NSI', 'NSII']
      const indexA = order.indexOf(a)
      const indexB = order.indexOf(b)
      return indexA - indexB
    })
  }, [levels, yearId])

  // Get levels for selected base level
  const levelsForBaseLevel = useMemo(() => {
    if (!formData.levelId) return []
    
    const selectedLevel = levels.find(l => l.id === formData.levelId)
    if (!selectedLevel) return []
    
    const baseLevel = getBaseLevel(selectedLevel.name)
    return levels.filter(l => 
      l.academicYearId === yearId && 
      getBaseLevel(l.name) === baseLevel
    )
  }, [formData.levelId, levels, yearId])

  // Get subdivisions for selected base level
  const availableSubdivisions = useMemo(() => {
    if (!formData.levelId) return []
    
    const selectedLevel = levels.find(l => l.id === formData.levelId)
    if (!selectedLevel) return []
    
    const baseLevel = getBaseLevel(selectedLevel.name)
    const subdivisions = new Map<string, string>() // subdivision -> levelId
    
    levels
      .filter(l => l.academicYearId === yearId && getBaseLevel(l.name) === baseLevel)
      .forEach(level => {
        const subdivision = getSubdivision(level.name)
        if (subdivision) {
          subdivisions.set(subdivision, level.id)
        }
      })
    
    // Sort subdivisions: letters first (A, B, C), then filières (LLA, SES, SMP, SVT)
    return Array.from(subdivisions.entries())
      .sort(([a], [b]) => {
        const aIsLetter = /^[A-Z]$/.test(a)
        const bIsLetter = /^[A-Z]$/.test(b)
        
        if (aIsLetter && !bIsLetter) return -1
        if (!aIsLetter && bIsLetter) return 1
        
        return a.localeCompare(b)
      })
      .map(([subdivision, levelId]) => ({ subdivision, levelId }))
  }, [formData.levelId, levels, yearId])

  // Check if selected level has subdivisions
  const hasSubdivisions = availableSubdivisions.length > 0

  // Initialize form when student changes
  useEffect(() => {
    if (student) {
      const level = levels.find(l => l.id === student.levelId)
      setFormData({
        nisu: student.nisu,
        firstName: student.firstName,
        lastName: student.lastName,
        dateOfBirth: student.dateOfBirth,
        gender: student.gender,
        levelId: student.levelId,
        subdivisionId: undefined,
        avatar: student.avatar || "",
        studentCode: student.studentCode || ""
      })
      setPhotoPreview(student.avatar || "")
      setNisuError("")
    } else {
      setFormData({
        nisu: "",
        firstName: "",
        lastName: "",
        dateOfBirth: "",
        gender: "M",
        levelId: "",
        subdivisionId: undefined,
        avatar: "",
        studentCode: ""
      })
      setPhotoPreview("")
      setNisuError("")
    }
  }, [student, levels])

  // Validate NISU
  const validateNisu = (nisu: string) => {
    if (!nisu) {
      setNisuError("")
      return false
    }
    if (!/^\d{12}$/.test(nisu)) {
      setNisuError("Le NISU doit contenir exactement 12 chiffres")
      return false
    }
    const isDuplicate = existingStudents.some(s => 
      s.nisu === nisu && s.id !== student?.id
    )
    if (isDuplicate) {
      setNisuError("Ce NISU est déjà attribué à un élève")
      return false
    }
    setNisuError("")
    return true
  }

  // Handle photo file selection
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Check file type
      if (!file.type.startsWith('image/')) {
        alert('Veuillez sélectionner une image (JPG ou PNG)')
        return
      }
      
      // Create preview URL
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        setPhotoPreview(result)
        setFormData({ ...formData, avatar: result })
      }
      reader.readAsDataURL(file)
    }
  }

  // Remove photo
  const handleRemovePhoto = () => {
    setPhotoPreview("")
    setFormData({ ...formData, avatar: "" })
  }

  // Handle base level change
  const handleBaseLevelChange = (baseLevel: string) => {
    // Find first level with this base level
    const firstLevel = levels.find(l => 
      l.academicYearId === yearId && 
      getBaseLevel(l.name) === baseLevel
    )
    
    if (firstLevel) {
      setFormData({ 
        ...formData, 
        levelId: firstLevel.id,
        subdivisionId: undefined
      })
    }
  }

  // Handle subdivision change
  const handleSubdivisionChange = (subdivisionLevelId: string) => {
    setFormData({ 
      ...formData, 
      levelId: subdivisionLevelId,
      subdivisionId: subdivisionLevelId
    })
  }

  // Get selected base level
  const selectedBaseLevel = useMemo(() => {
    if (!formData.levelId) return ""
    const level = levels.find(l => l.id === formData.levelId)
    return level ? getBaseLevel(level.name) : ""
  }, [formData.levelId, levels])

  // Format date for display (DD/MM/YYYY)
  const formatDateForDisplay = (dateString: string): string => {
    if (!dateString) return ""
    const [year, month, day] = dateString.split('-')
    return `${day}/${month}/${year}`
  }

  // Handle submit
  const handleSubmit = () => {
    // Show NISU error if empty and not editing
    if (!student && !formData.nisu) {
      setShowNisuError(true)
      return
    }
    
    if (!validateNisu(formData.nisu) && formData.nisu) return
    if (!formData.firstName || !formData.lastName || !formData.dateOfBirth || !formData.levelId) {
      return
    }

    onSubmit(formData)
    onOpenChange(false)
    setShowNisuError(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle 
            className="font-serif" 
            style={{ 
              fontSize: "24px",
              fontWeight: 700,
              lineHeight: 1.25,
              letterSpacing: "-0.02em",
              color: "#1f1a18" 
            }}
          >
            {student ? "Modifier un élève" : "Inscrire un élève"}
          </DialogTitle>
          <DialogDescription
            className="font-sans"
            style={{
              fontSize: "13px",
              fontWeight: 400,
              color: "hsl(var(--muted-foreground))"
            }}
          >
            {student ? "Modifiez les informations de l'élève" : "Remplissez les informations de l'élève"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-3">
          {/* Section Identité */}
          <div className="space-y-3">
            <h3 
              className="font-serif" 
              style={{ 
                fontSize: "15px",
                fontWeight: 600,
                color: '#2C4A6E', 
                borderLeft: '3px solid #2C4A6E', 
                paddingLeft: '8px' 
              }}
            >
              Identité
            </h3>
            <div className="space-y-3">
              {student && formData.studentCode && (
                <div className="space-y-1.5">
                  <Label htmlFor="studentCode" className="text-xs">Code élève (généré automatiquement)</Label>
                  <Input
                    id="studentCode"
                    type="text"
                    value={formData.studentCode}
                    disabled
                    className="h-9 bg-muted"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label 
                  htmlFor="nisu" 
                  className="font-sans" 
                  style={{ 
                    fontSize: "13px",
                    fontWeight: 500
                  }}
                >
                  NISU {!student && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="nisu"
                  type="text"
                  maxLength={12}
                  placeholder="123456789012"
                  value={formData.nisu}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '')
                    setFormData({ ...formData, nisu: value })
                    setShowNisuError(false)
                    validateNisu(value)
                  }}
                  className={cn("h-9", (nisuError || (showNisuError && !formData.nisu)) && "border-destructive")}
                />
                {nisuError && (
                  <p className="text-xs text-destructive">{nisuError}</p>
                )}
                {showNisuError && !formData.nisu && (
                  <p className="text-xs text-destructive">Le NISU est obligatoire (12 chiffres)</p>
                )}
                {formData.nisu && !nisuError && (
                  <p className="text-xs text-green-600 dark:text-green-400">✓ NISU valide</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label 
                    htmlFor="lastName" 
                    className="font-sans" 
                    style={{ 
                      fontSize: "13px",
                      fontWeight: 500
                    }}
                  >
                    Nom <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label 
                    htmlFor="firstName" 
                    className="font-sans" 
                    style={{ 
                      fontSize: "13px",
                      fontWeight: 500
                    }}
                  >
                    Prénom <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="h-9"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label 
                    htmlFor="dateOfBirth" 
                    className="font-sans" 
                    style={{ 
                      fontSize: "13px",
                      fontWeight: 500
                    }}
                  >
                    Date de naissance <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="h-9"
                  />
                  {student && formData.dateOfBirth && (
                    <p className="text-xs text-muted-foreground">{formatDateForDisplay(formData.dateOfBirth)}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label 
                    className="font-sans" 
                    style={{ 
                      fontSize: "13px",
                      fontWeight: 500
                    }}
                  >
                    Sexe <span className="text-destructive">*</span>
                  </Label>
                  <RadioGroup
                    value={formData.gender}
                    onValueChange={(value) => setFormData({ ...formData, gender: value as "M" | "F" })}
                    className="flex gap-4 pt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="M" id="male" />
                      <Label htmlFor="male" className="text-xs font-normal cursor-pointer">Masculin</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="F" id="female" />
                      <Label htmlFor="female" className="text-xs font-normal cursor-pointer">Féminin</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </div>
          </div>

          {/* Section Scolarité */}
          <div className="space-y-3">
            <h3 
              className="font-serif" 
              style={{ 
                fontSize: "15px",
                fontWeight: 600,
                color: '#2C4A6E', 
                borderLeft: '3px solid #2C4A6E', 
                paddingLeft: '8px' 
              }}
            >
              Scolarité
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label 
                  htmlFor="level" 
                  className="font-sans" 
                  style={{ 
                    fontSize: "13px",
                    fontWeight: 500
                  }}
                >
                  Classe <span className="text-destructive">*</span>
                </Label>
                <Select value={selectedBaseLevel} onValueChange={handleBaseLevelChange}>
                  <SelectTrigger id="level" className="h-9">
                    <SelectValue placeholder="Sélectionnez une classe" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueBaseLevels.map(baseLevel => (
                      <SelectItem key={baseLevel} value={baseLevel}>
                        {baseLevel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label 
                  htmlFor="subdivision" 
                  className="font-sans" 
                  style={{ 
                    fontSize: "13px",
                    fontWeight: 500
                  }}
                >
                  Salle
                </Label>
                <Select 
                  value={formData.subdivisionId || formData.levelId} 
                  onValueChange={handleSubdivisionChange}
                  disabled={!formData.levelId || !hasSubdivisions}
                >
                  <SelectTrigger id="subdivision" className="h-9">
                    <SelectValue placeholder={!formData.levelId ? "Sélectionnez d'abord une classe" : (hasSubdivisions ? "Sélectionnez une salle" : "Aucune salle")} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubdivisions.map(({ subdivision, levelId }) => (
                      <SelectItem key={levelId} value={levelId}>
                        {subdivision}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hasSubdivisions && formData.levelId && (
                  <p className="text-xs text-muted-foreground">
                    Optionnel - Laissez vide si aucune salle spécifique
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section Photo */}
          <div className="space-y-3">
            <h3 
              className="font-serif" 
              style={{ 
                fontSize: "15px",
                fontWeight: 600,
                color: '#2C4A6E', 
                borderLeft: '3px solid #2C4A6E', 
                paddingLeft: '8px' 
              }}
            >
              Photo
            </h3>
            <div className="space-y-3">
              {photoPreview ? (
                <div className="flex items-start gap-4">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={photoPreview} />
                    <AvatarFallback className="bg-muted">
                      <UserIcon className="h-12 w-12 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm text-muted-foreground">Photo actuelle</p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('photo-upload')?.click()}
                      >
                        <UploadIcon className="h-4 w-4 mr-2" />
                        Changer la photo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRemovePhoto}
                      >
                        <XIcon className="h-4 w-4 mr-2" />
                        Supprimer
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <UserIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('photo-upload')?.click()}
                  >
                    <UploadIcon className="h-4 w-4 mr-2" />
                    Choisir une photo
                  </Button>
                  <p className="text-xs text-muted-foreground mt-3">
                    Format accepté : JPG, PNG
                  </p>
                </div>
              )}
              <input
                id="photo-upload"
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                onChange={handlePhotoChange}
                className="hidden"
              />
              <p className="text-xs text-muted-foreground">
                Si absente, une vignette sera utilisée sur le bulletin
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!formData.firstName || !formData.lastName || !formData.dateOfBirth || !formData.levelId || !!nisuError || (!student && !formData.nisu)}
            className="border-0 disabled:opacity-100"
            style={{
              backgroundColor: (!formData.firstName || !formData.lastName || !formData.dateOfBirth || !formData.levelId || !!nisuError || (!student && !formData.nisu)) ? '#9CA3AF' : '#2C4A6E',
              color: '#ffffff'
            }}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}