"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
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
import { Badge } from "@/components/ui/badge"
import { PlusIcon } from "lucide-react"
import type { AcademicYear } from "@/lib/api/dashboard"

interface CreateAcademicYearModalV2Props {
  activeYear?: AcademicYear
  archivedYears?: AcademicYear[]
  onSubmit?: (data: {
    name: string
    startDate?: string
    endDate?: string
    copyFromYearId?: string
  }) => void
  trigger?: React.ReactNode
}

export function CreateAcademicYearModalV2({
  activeYear,
  archivedYears = [],
  onSubmit,
  trigger
}: CreateAcademicYearModalV2Props) {
  // Generate next year name from active year
  const getNextYearName = () => {
    if (!activeYear) return ""
    const match = activeYear.name.match(/(\d{4})-(\d{4})/)
    if (match) {
      const startYear = parseInt(match[1])
      const endYear = parseInt(match[2])
      return `${startYear + 1}-${endYear + 1}`
    }
    return ""
  }

  const [open, setOpen] = useState(false)
  const [name] = useState(getNextYearName())
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [numberOfPeriods, setNumberOfPeriods] = useState<4 | 5>(4)
  const [creationType, setCreationType] = useState<"scratch" | "copy">("scratch")
  const [copyFromYearId, setCopyFromYearId] = useState<string>("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) return

    onSubmit?.({
      name: name.trim(),
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      copyFromYearId: creationType === "copy" ? copyFromYearId : undefined
    })

    // Reset form
    setStartDate("")
    setEndDate("")
    setNumberOfPeriods(4)
    setCreationType("scratch")
    setCopyFromYearId("")
    setOpen(false)
  }

  const handleCancel = () => {
    setStartDate("")
    setEndDate("")
    setNumberOfPeriods(4)
    setCreationType("scratch")
    setCopyFromYearId("")
    setOpen(false)
  }

  const getPeriodNames = (count: 4 | 5) => {
    const names = ["1ère Étape", "2ème Étape", "3ème Étape", "4ème Étape"]
    if (count === 5) names.push("5ème Étape")
    return names
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2">
            <PlusIcon className="h-4 w-4" />
            Nouvelle année
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px] border border-[#bebbb4] rounded-xl" style={{ backgroundColor: "#ffffff", maxHeight: "90vh", overflowY: "auto" }}>
        <form onSubmit={handleSubmit}>
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
              Nouvelle année scolaire
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-6">
            {/* SECTION 1 — Informations de base */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label 
                  htmlFor="name" 
                  className="font-sans" 
                  style={{ 
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#1f1a18" 
                  }}
                >
                  Nom de l'année <span style={{ color: "#C43C3C" }}>*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  readOnly
                  disabled
                  className="border-[#bebbb4] bg-[#f7f7f6] cursor-not-allowed"
                  style={{ color: "#5b6d77" }}
                />
                <p 
                  className="font-sans" 
                  style={{ 
                    fontSize: "12px",
                    color: "#5b6d77" 
                  }}
                >
                  Généré automatiquement
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label 
                    htmlFor="startDate" 
                    className="font-sans" 
                    style={{ 
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#1f1a18" 
                    }}
                  >
                    Date de début
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border-[#bebbb4] focus:border-[#c3b595] focus:ring-[#c3b595]"
                    style={{ color: "#1f1a18" }}
                  />
                </div>
                <div className="space-y-2">
                  <Label 
                    htmlFor="endDate" 
                    className="font-sans" 
                    style={{ 
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#1f1a18" 
                    }}
                  >
                    Date de fin
                  </Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="border-[#bebbb4] focus:border-[#c3b595] focus:ring-[#c3b595]"
                    style={{ color: "#1f1a18" }}
                  />
                </div>
              </div>
            </div>

            {/* Diviseur */}
            <div className="border-t border-[#bebbb4]" />

            {/* SECTION 2 — Nombre d'étapes */}
            <div className="space-y-3">
              <div>
                <div 
                  className="font-serif" 
                  style={{ 
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "#2C4A6E",
                    borderLeft: "3px solid #2C4A6E",
                    paddingLeft: "8px"
                  }}
                >
                  Nombre d'étapes
                </div>
                <p 
                  className="font-sans mt-1" 
                  style={{ 
                    fontSize: "13px",
                    fontWeight: 400,
                    color: "hsl(var(--muted-foreground))" 
                  }}
                >
                  L'école peut fonctionner avec 4 ou 5 étapes selon l'année
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNumberOfPeriods(4)}
                  className={`rounded-lg p-4 cursor-pointer transition-all ${
                    numberOfPeriods === 4
                      ? "border-2 border-[#c3b595]"
                      : "border border-[#bebbb4]"
                  }`}
                  style={{
                    backgroundColor: numberOfPeriods === 4 ? "rgba(195, 181, 149, 0.1)" : "#f7f7f6"
                  }}
                >
                  <div 
                    className="font-sans font-bold" 
                    style={{ 
                      fontSize: "36px",
                      color: numberOfPeriods === 4 ? "#1f1a18" : "#5b6d77" 
                    }}
                  >
                    4
                  </div>
                  <div 
                    className="font-sans text-center mt-1" 
                    style={{ 
                      fontSize: "13px",
                      color: numberOfPeriods === 4 ? "#1f1a18" : "#5b6d77" 
                    }}
                  >
                    4 Étapes
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setNumberOfPeriods(5)}
                  className={`rounded-lg p-4 cursor-pointer transition-all ${
                    numberOfPeriods === 5
                      ? "border-2 border-[#c3b595]"
                      : "border border-[#bebbb4]"
                  }`}
                  style={{
                    backgroundColor: numberOfPeriods === 5 ? "rgba(195, 181, 149, 0.1)" : "#f7f7f6"
                  }}
                >
                  <div 
                    className="font-sans font-bold" 
                    style={{ 
                      fontSize: "36px",
                      color: numberOfPeriods === 5 ? "#1f1a18" : "#5b6d77" 
                    }}
                  >
                    5
                  </div>
                  <div 
                    className="font-sans text-center mt-1" 
                    style={{ 
                      fontSize: "13px",
                      color: numberOfPeriods === 5 ? "#1f1a18" : "#5b6d77" 
                    }}
                  >
                    5 Étapes
                  </div>
                </button>
              </div>

              {/* Aperçu des étapes */}
              <div className="rounded-lg p-3" style={{ backgroundColor: "#f7f7f6" }}>
                <p 
                  className="font-sans mb-2" 
                  style={{ 
                    fontSize: "12px",
                    color: "#5b6d77" 
                  }}
                >
                  Étapes créées :
                </p>
                <div className="flex flex-wrap gap-2">
                  {getPeriodNames(numberOfPeriods).map((periodName, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="border border-[#bebbb4] rounded px-2 py-0.5"
                      style={{ 
                        backgroundColor: "white",
                        fontSize: "12px",
                        color: "#1f1a18" 
                      }}
                    >
                      {periodName}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Diviseur */}
            <div className="border-t border-[#bebbb4]" />

            {/* SECTION 3 — Type de création */}
            <div className="space-y-3">
              <div 
                className="font-serif" 
                style={{ 
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "#2C4A6E",
                  borderLeft: "3px solid #2C4A6E",
                  paddingLeft: "8px"
                }}
              >
                Type de création
              </div>

              <div className="space-y-3">
                {/* Option A — Créer depuis zéro */}
                <button
                  type="button"
                  onClick={() => setCreationType("scratch")}
                  className={`w-full rounded-lg p-4 text-left transition-all ${
                    creationType === "scratch"
                      ? "border-2 border-[#c3b595]"
                      : "border border-[#bebbb4]"
                  }`}
                  style={{
                    backgroundColor: creationType === "scratch" ? "rgba(195, 181, 149, 0.1)" : "white"
                  }}
                >
                  <div>
                    <div 
                      className="font-serif" 
                      style={{ 
                        fontSize: "15px",
                        fontWeight: 600,
                        color: "#1f1a18" 
                      }}
                    >
                      Créer depuis zéro
                    </div>
                    <p 
                      className="font-sans mt-1" 
                      style={{ 
                        fontSize: "13px",
                        fontWeight: 400,
                        color: "hsl(var(--muted-foreground))" 
                      }}
                    >
                      Commencer avec une année vierge. Vous devrez configurer les classes, matières et salles manuellement.
                    </p>
                  </div>
                </button>

                {/* Option B — Copier une année */}
                <button
                  type="button"
                  onClick={() => setCreationType("copy")}
                  className={`w-full rounded-lg p-4 text-left transition-all ${
                    creationType === "copy"
                      ? "border-2 border-[#c3b595]"
                      : "border border-[#bebbb4]"
                  }`}
                  style={{
                    backgroundColor: creationType === "copy" ? "rgba(195, 181, 149, 0.1)" : "white"
                  }}
                >
                  <div>
                    <div 
                      className="font-serif" 
                      style={{ 
                        fontSize: "15px",
                        fontWeight: 600,
                        color: "#1f1a18" 
                      }}
                    >
                      Copier une année existante
                    </div>
                    <p 
                      className="font-sans mt-1" 
                      style={{ 
                        fontSize: "13px",
                        fontWeight: 400,
                        color: "hsl(var(--muted-foreground))" 
                      }}
                    >
                      Dupliquer la structure d'une année archivée (classes, matières, salles). Les élèves et notes ne seront pas copiés.
                    </p>
                  </div>
                </button>
              </div>

              {/* Sélecteur d'année si copie */}
              {creationType === "copy" && (
                <div className="space-y-2">
                  <Label 
                    htmlFor="copyYear" 
                    className="font-sans" 
                    style={{ 
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#1f1a18" 
                    }}
                  >
                    Copier depuis <span style={{ color: "#C43C3C" }}>*</span>
                  </Label>
                  <Select value={copyFromYearId} onValueChange={setCopyFromYearId}>
                    <SelectTrigger 
                      id="copyYear"
                      className="border-[#bebbb4] focus:border-[#c3b595] focus:ring-[#c3b595]"
                      style={{ color: "#1f1a18" }}
                    >
                      <SelectValue placeholder="Sélectionnez une année source" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeYear && (
                        <SelectItem value={activeYear.id}>
                          {activeYear.name} (Active)
                        </SelectItem>
                      )}
                      {archivedYears.map((year) => (
                        <SelectItem key={year.id} value={year.id}>
                          {year.name} (Archivée)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleCancel}
              className="border-[#bebbb4] hover:bg-[#f7f7f6]"
              style={{ color: "#1f1a18" }}
            >
              Annuler
            </Button>
            <Button 
              type="submit" 
              disabled={!name.trim() || (creationType === "copy" && !copyFromYearId)}
              className="border-0 disabled:opacity-100"
              style={{ 
                backgroundColor: (!name.trim() || (creationType === "copy" && !copyFromYearId)) ? "#9CA3AF" : "#2C4A6E",
                color: "#ffffff" 
              }}
            >
              Créer l'année
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}