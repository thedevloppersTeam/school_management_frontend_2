"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { FileTextIcon, DownloadIcon, UsersIcon } from "lucide-react"
import { type Classroom, type Student, type Period, type Grade, type Subject } from "@/lib/data/school-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"

interface ClassReportGeneratorProps {
  classroom: Classroom
  students: Student[]
  periods: Period[]
  grades: Grade[]
  subjects: Subject[]
  onGenerate?: (classroomId: string, periodId?: string, studentIds?: string[]) => void
  trigger?: React.ReactNode
}

export function ClassReportGenerator({ 
  classroom, 
  students, 
  periods, 
  grades, 
  subjects, 
  onGenerate, 
  trigger 
}: ClassReportGeneratorProps) {
  const [open, setOpen] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<string>('')
  const [reportType, setReportType] = useState<'period' | 'global'>('period')
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(true)

  const classStudents = students.filter(s => s.classroomId === classroom.id)

  const calculateAverage = (studentId: string, periodId?: string) => {
    const filteredGrades = periodId 
      ? grades.filter(g => g.studentId === studentId && g.periodId === periodId)
      : grades.filter(g => g.studentId === studentId)

    if (filteredGrades.length === 0) return 0

    let totalWeighted = 0
    let totalCoefficients = 0

    filteredGrades.forEach(grade => {
      const subject = subjects.find(s => s.id === grade.subjectId)
      if (subject) {
        const gradeValue = (grade.value / grade.maxValue) * 20
        totalWeighted += gradeValue * subject.coefficient
        totalCoefficients += subject.coefficient
      }
    })

    return totalCoefficients > 0 ? totalWeighted / totalCoefficients : 0
  }

  const calculateClassAverage = (periodId?: string) => {
    const averages = classStudents.map(s => calculateAverage(s.id, periodId))
    return averages.length > 0 ? averages.reduce((a, b) => a + b, 0) / averages.length : 0
  }

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked)
    if (checked) {
      setSelectedStudents([])
    } else {
      setSelectedStudents(classStudents.map(s => s.id))
    }
  }

  const handleSelectStudent = (studentId: string, checked: boolean) => {
    if (checked) {
      setSelectedStudents(prev => [...prev, studentId])
    } else {
      setSelectedStudents(prev => prev.filter(id => id !== studentId))
    }
    setSelectAll(false)
  }

  const handleGenerate = () => {
    const periodId = reportType === 'period' && selectedPeriod ? selectedPeriod : undefined
    const studentIds = selectAll ? undefined : selectedStudents
    onGenerate?.(classroom.id, periodId, studentIds)
    setOpen(false)
  }

  const studentsToGenerate = selectAll ? classStudents : classStudents.filter(s => selectedStudents.includes(s.id))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-gradient-to-r from-[#c3b595] to-[#5b6d77] hover:opacity-90 text-white">
            <FileTextIcon className="mr-2 h-4 w-4" />
            Bulletins de classe
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#1f1a18]">
            Générer les bulletins - {classroom.name}
          </DialogTitle>
          <DialogDescription className="text-[#5b6d77]">
            Générez les bulletins pour plusieurs élèves en une seule fois
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
              <Label htmlFor="period">Période *</Label>
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

          {/* Sélection des élèves */}
          <Card className="border-[#bebbb4]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-[#1f1a18]">Élèves à inclure</CardTitle>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="selectAll"
                    checked={selectAll}
                    onCheckedChange={handleSelectAll}
                  />
                  <Label htmlFor="selectAll" className="text-sm cursor-pointer">
                    Tous les élèves
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {classStudents.map(student => (
                  <div key={student.id} className="flex items-center justify-between p-2 hover:bg-[#f7f7f6] rounded">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={student.id}
                        checked={selectAll || selectedStudents.includes(student.id)}
                        onCheckedChange={(checked) => handleSelectStudent(student.id, checked as boolean)}
                        disabled={selectAll}
                      />
                      <Label htmlFor={student.id} className="cursor-pointer">
                        <p className="text-sm font-medium text-[#1f1a18]">
                          {student.firstName} {student.lastName}
                        </p>
                        <p className="text-xs text-[#5b6d77]">{student.matricule}</p>
                      </Label>
                    </div>
                    <p className="text-sm font-semibold text-[#1f1a18]">
                      {calculateAverage(student.id, reportType === 'period' ? selectedPeriod : undefined).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Aperçu */}
          <Card className="border-[#bebbb4] bg-[#f7f7f6]">
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <UsersIcon className="h-6 w-6 mx-auto mb-2 text-[#5b6d77]" />
                  <p className="text-2xl font-bold text-[#1f1a18]">{studentsToGenerate.length}</p>
                  <p className="text-xs text-[#5b6d77]">Bulletins à générer</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1f1a18]">
                    {calculateClassAverage(reportType === 'period' ? selectedPeriod : undefined).toFixed(2)}
                  </p>
                  <p className="text-xs text-[#5b6d77]">Moyenne de classe</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1f1a18]">{classroom.capacity}</p>
                  <p className="text-xs text-[#5b6d77]">Capacité totale</p>
                </div>
              </div>
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
              onClick={handleGenerate}
              disabled={reportType === 'period' && !selectedPeriod}
              className="bg-gradient-to-r from-[#c3b595] to-[#5b6d77] hover:opacity-90 text-white"
            >
              <DownloadIcon className="mr-2 h-4 w-4" />
              Générer {studentsToGenerate.length} bulletin{studentsToGenerate.length > 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}