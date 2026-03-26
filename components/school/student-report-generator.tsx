"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { FileTextIcon, DownloadIcon, PrinterIcon } from "lucide-react"
import { type Student, type Period, type Grade, type Subject } from "@/lib/data/school-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface StudentReportGeneratorProps {
  student: Student
  periods: Period[]
  grades: Grade[]
  subjects: Subject[]
  onGenerate?: (studentId: string, periodId?: string) => void
  trigger?: React.ReactNode
}

export function StudentReportGenerator({ 
  student, 
  periods, 
  grades, 
  subjects, 
  onGenerate, 
  trigger 
}: StudentReportGeneratorProps) {
  const [open, setOpen] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all')
  const [reportType, setReportType] = useState<'period' | 'global'>('period')

  const calculateAverage = (periodId?: string) => {
    const filteredGrades = periodId 
      ? grades.filter(g => g.studentId === student.id && g.periodId === periodId)
      : grades.filter(g => g.studentId === student.id)

    if (filteredGrades.length === 0) return "0"

    let totalWeighted = 0
    let totalCoefficients = 0

    filteredGrades.forEach(grade => {
      const subject = subjects.find(s => s.id === grade.subjectId)
      if (subject) {
        const gradeValue = (grade.value / grade.maxValue) * 10
        totalWeighted += gradeValue * subject.coefficient
        totalCoefficients += subject.coefficient
      }
    })

    return totalCoefficients > 0 ? (totalWeighted / totalCoefficients).toFixed(2) : '0.00'
  }

  const getGradesByPeriod = (periodId: string) => {
    return grades.filter(g => g.studentId === student.id && g.periodId === periodId)
  }

  const handleGenerate = () => {
    const periodId = reportType === 'period' && selectedPeriod !== 'all' ? selectedPeriod : undefined
    onGenerate?.(student.id, periodId)
    setOpen(false)
  }

  const getAppreciation = (average: number) => {
    if (average >= 9) return { text: 'Excellent', color: 'bg-green-500' }
    if (average >= 8) return { text: 'Très bien', color: 'bg-green-400' }
    if (average >= 7) return { text: 'Bien', color: 'bg-blue-500' }
    if (average >= 6) return { text: 'Assez bien', color: 'bg-blue-400' }
    if (average >= 5) return { text: 'Passable', color: 'bg-yellow-500' }
    return { text: 'Insuffisant', color: 'bg-red-500' }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="border-[#bebbb4]">
            <FileTextIcon className="mr-2 h-4 w-4" />
            Bulletin
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#1f1a18]">
            Générer le bulletin de {student.firstName} {student.lastName}
          </DialogTitle>
          <DialogDescription className="text-[#5b6d77]">
            Choisissez le type de bulletin à générer
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Type de bulletin */}
          <div className="space-y-3">
            <Label>Type de bulletin</Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={reportType === 'period' ? 'default' : 'outline'}
                onClick={() => setReportType('period')}
                className={reportType === 'period' ? 'bg-[#c3b595]' : 'border-[#bebbb4]'}
              >
                Bulletin par période
              </Button>
              <Button
                type="button"
                variant={reportType === 'global' ? 'default' : 'outline'}
                onClick={() => setReportType('global')}
                className={reportType === 'global' ? 'bg-[#c3b595]' : 'border-[#bebbb4]'}
              >
                Bulletin global
              </Button>
            </div>
          </div>

          {/* Sélection de période */}
          {reportType === 'period' && (
            <div className="space-y-2">
              <Label htmlFor="period">Période</Label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une période" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map(period => (
                    <SelectItem key={period.id} value={period.id}>
                      {period.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Aperçu du bulletin */}
          <Card className="border-[#bebbb4]">
            <CardHeader className="bg-gradient-to-r from-[#c3b595] to-[#5b6d77] text-white">
              <CardTitle className="text-lg">Aperçu du bulletin</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {/* Informations élève */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-[#5b6d77]">Élève:</span>
                  <p className="font-semibold text-[#1f1a18]">{student.firstName} {student.lastName}</p>
                </div>
                <div>
                  <span className="text-[#5b6d77]">Matricule:</span>
                  <p className="font-semibold text-[#1f1a18]">{student.matricule}</p>
                </div>
                <div>
                  <span className="text-[#5b6d77]">Code élève:</span>
                  <p className="font-semibold text-[#1f1a18]">{student.studentCode}</p>
                </div>
                <div>
                  <span className="text-[#5b6d77]">NISU:</span>
                  <p className="font-semibold text-[#1f1a18]">{student.nisu}</p>
                </div>
                {student.stream && (
                  <div>
                    <span className="text-[#5b6d77]">Filière:</span>
                    <p className="font-semibold text-[#1f1a18]">{student.stream}</p>
                  </div>
                )}
              </div>

              {/* Moyennes */}
              {reportType === 'period' && selectedPeriod !== 'all' ? (
                <div className="pt-4 border-t border-[#bebbb4]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[#5b6d77]">
                        Moyenne - {periods.find(p => p.id === selectedPeriod)?.name}
                      </p>
                      <p className="text-3xl font-bold text-[#1f1a18]">
                        {calculateAverage(selectedPeriod)} / 10
                      </p>
                    </div>
                    <Badge className={`${getAppreciation(parseFloat(calculateAverage(selectedPeriod))).color} text-white`}>
                      {getAppreciation(parseFloat(calculateAverage(selectedPeriod))).text}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#5b6d77] mt-2">
                    Nombre de notes: {getGradesByPeriod(selectedPeriod).length}
                  </p>
                </div>
              ) : (
                <div className="pt-4 border-t border-[#bebbb4]">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-[#5b6d77]">Moyenne générale annuelle</p>
                      <p className="text-3xl font-bold text-[#1f1a18]">
                        {calculateAverage()} / 10
                      </p>
                    </div>
                    <Badge className={`${getAppreciation(parseFloat(calculateAverage())).color} text-white`}>
                      {getAppreciation(parseFloat(calculateAverage())).text}
                    </Badge>
                  </div>
                  
                  {/* Moyennes par période */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[#5b6d77]">Évolution par période:</p>
                    <div className="grid grid-cols-3 gap-2">
                      {periods.map(period => (
                        <div key={period.id} className="bg-[#f7f7f6] p-2 rounded">
                          <p className="text-xs text-[#5b6d77]">{period.name}</p>
                          <p className="text-lg font-semibold text-[#1f1a18]">
                            {calculateAverage(period.id)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[#bebbb4]">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-[#bebbb4]"
            >
              Annuler
            </Button>
            <Button
              variant="outline"
              onClick={handleGenerate}
              className="border-[#bebbb4]"
            >
              <PrinterIcon className="mr-2 h-4 w-4" />
              Imprimer
            </Button>
            <Button
              onClick={handleGenerate}
              className="bg-gradient-to-r from-[#c3b595] to-[#5b6d77] hover:opacity-90 text-white"
            >
              <DownloadIcon className="mr-2 h-4 w-4" />
              Télécharger PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}