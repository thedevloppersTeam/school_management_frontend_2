"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { PlusIcon, SearchIcon, PencilIcon, TrashIcon, FileTextIcon, TrendingUpIcon, TrendingDownIcon } from "lucide-react"
import type { Grade, Student, Subject, Period } from "@/lib/data/school-data"

interface GradesManagementProps {
  grades: Grade[]
  students: Student[]
  subjects: Subject[]
  periods: Period[]
  isArchived?: boolean
  onAdd?: (grade: Omit<Grade, "id">) => void
  onEdit?: (id: string, grade: Partial<Grade>) => void
  onDelete?: (id: string) => void
}

export function GradesManagement({ 
  grades, 
  students,
  subjects,
  periods,
  isArchived = false,
  onAdd, 
  onEdit, 
  onDelete 
}: GradesManagementProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterPeriod, setFilterPeriod] = useState<string>("all")
  const [filterSubject, setFilterSubject] = useState<string>("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null)
  const [formData, setFormData] = useState({
    studentId: "",
    subjectId: "",
    periodId: "",
    value: "",
    maxValue: "20",
    comment: ""
  })

  const filteredGrades = grades.filter(grade => {
    const student = students.find(s => s.id === grade.studentId)
    const subject = subjects.find(s => s.id === grade.subjectId)
    const matchesSearch = student && 
      `${student.firstName} ${student.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesPeriod = filterPeriod === "all" || grade.periodId === filterPeriod
    const matchesSubject = filterSubject === "all" || grade.subjectId === filterSubject
    return matchesSearch && matchesPeriod && matchesSubject
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const gradeData = {
      studentId: formData.studentId,
      subjectId: formData.subjectId,
      periodId: formData.periodId,
      value: parseFloat(formData.value),
      maxValue: parseFloat(formData.maxValue),
      comment: formData.comment || undefined,
      date: new Date().toISOString().split('T')[0]
    }

    if (editingGrade) {
      onEdit?.(editingGrade.id, gradeData)
      setEditingGrade(null)
    } else {
      onAdd?.(gradeData as unknown as Omit<Grade, 'id'>)
      setIsAddDialogOpen(false)
    }

    setFormData({ studentId: "", subjectId: "", periodId: "", value: "", maxValue: "20", comment: "" })
  }

  const handleEdit = (grade: Grade) => {
    setEditingGrade(grade)
    setFormData({
      studentId: grade.studentId,
      subjectId: grade.subjectId,
      periodId: grade.periodId,
      value: grade.value.toString(),
      maxValue: grade.maxValue.toString(),
      comment: grade.comment || ""
    })
  }

  const handleCancelEdit = () => {
    setEditingGrade(null)
    setFormData({ studentId: "", subjectId: "", periodId: "", value: "", maxValue: "20", comment: "" })
  }

  const getStudentName = (studentId: string) => {
    const student = students.find(s => s.id === studentId)
    return student ? `${student.firstName} ${student.lastName}` : "Inconnu"
  }

  const getSubjectName = (subjectId: string) => {
    const subject = subjects.find(s => s.id === subjectId)
    return subject ? subject.name : "Inconnu"
  }

  const getPeriodName = (periodId: string) => {
    const period = periods.find(p => p.id === periodId)
    return period ? period.name : "Inconnu"
  }

  const calculateAverage = () => {
    if (filteredGrades.length === 0) return 0
    const sum = filteredGrades.reduce((acc, grade) => {
      return acc + (grade.value / grade.maxValue) * 10
    }, 0)
    return (sum / filteredGrades.length).toFixed(2)
  }

  const getGradeColor = (value: number, maxValue: number) => {
    const percentage = (value / maxValue) * 100
    if (percentage >= 80) return "text-green-600 dark:text-green-400"
    if (percentage >= 60) return "text-blue-600 dark:text-blue-400"
    if (percentage >= 40) return "text-orange-600 dark:text-orange-400"
    return "text-red-600 dark:text-red-400"
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1f1a18]">Gestion des Notes</h2>
          <p className="text-[#5b6d77]">
            Saisir et gérer les notes des élèves
          </p>
        </div>
        {!isArchived && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#c3b595] hover:bg-[#c3b595]/90 text-white">
                <PlusIcon className="mr-2 h-4 w-4" />
                Nouvelle Note
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle className="text-[#1f1a18]">Saisir une Note</DialogTitle>
                <DialogDescription className="text-[#5b6d77]">
                  Remplissez les informations de la note
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="studentId" className="text-[#1f1a18]">
                    Élève *
                  </Label>
                  <Select
                    value={formData.studentId}
                    onValueChange={(value) => setFormData({ ...formData, studentId: value })}
                    required
                  >
                    <SelectTrigger className="border-[#bebbb4]">
                      <SelectValue placeholder="Sélectionner un élève" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.firstName} {student.lastName} - {student.matricule}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subjectId" className="text-[#1f1a18]">
                    Matière *
                  </Label>
                  <Select
                    value={formData.subjectId}
                    onValueChange={(value) => setFormData({ ...formData, subjectId: value })}
                    required
                  >
                    <SelectTrigger className="border-[#bebbb4]">
                      <SelectValue placeholder="Sélectionner une matière" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name} ({subject.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="periodId" className="text-[#1f1a18]">
                    Période *
                  </Label>
                  <Select
                    value={formData.periodId}
                    onValueChange={(value) => setFormData({ ...formData, periodId: value })}
                    required
                  >
                    <SelectTrigger className="border-[#bebbb4]">
                      <SelectValue placeholder="Sélectionner une période" />
                    </SelectTrigger>
                    <SelectContent>
                      {periods.map((period) => (
                        <SelectItem key={period.id} value={period.id}>
                          {period.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="value" className="text-[#1f1a18]">
                      Note *
                    </Label>
                    <Input
                      id="value"
                      type="number"
                      step="0.5"
                      placeholder="Ex: 15"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                      required
                      min="0"
                      max={formData.maxValue}
                      className="border-[#bebbb4]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxValue" className="text-[#1f1a18]">
                      Sur *
                    </Label>
                    <Input
                      id="maxValue"
                      type="number"
                      step="0.5"
                      placeholder="Ex: 20"
                      value={formData.maxValue}
                      onChange={(e) => setFormData({ ...formData, maxValue: e.target.value })}
                      required
                      min="1"
                      className="border-[#bebbb4]"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comment" className="text-[#1f1a18]">
                    Commentaire (optionnel)
                  </Label>
                  <Input
                    id="comment"
                    placeholder="Ex: Bon travail, à améliorer..."
                    value={formData.comment}
                    onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                    className="border-[#bebbb4]"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="bg-[#c3b595] hover:bg-[#c3b595]/90 text-white">
                  Enregistrer la note
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-[#bebbb4]">
          <CardHeader className="pb-3">
            <CardDescription className="text-[#5b6d77]">Total Notes</CardDescription>
            <CardTitle className="text-3xl text-[#1f1a18]">{grades.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-[#bebbb4]">
          <CardHeader className="pb-3">
            <CardDescription className="text-[#5b6d77]">Moyenne Générale</CardDescription>
            <CardTitle className="text-3xl text-[#1f1a18]">{calculateAverage()}/10</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-[#bebbb4]">
          <CardHeader className="pb-3">
            <CardDescription className="text-[#5b6d77]">Notes Filtrées</CardDescription>
            <CardTitle className="text-3xl text-[#1f1a18]">{filteredGrades.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-[#bebbb4]">
          <CardHeader className="pb-3">
            <CardDescription className="text-[#5b6d77]">Élèves Notés</CardDescription>
            <CardTitle className="text-3xl text-[#1f1a18]">
              {new Set(grades.map(g => g.studentId)).size}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#5b6d77]" />
          <Input
            placeholder="Rechercher un élève..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 border-[#bebbb4]"
          />
        </div>
        <Select value={filterPeriod} onValueChange={setFilterPeriod}>
          <SelectTrigger className="border-[#bebbb4]">
            <SelectValue placeholder="Toutes les périodes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les périodes</SelectItem>
            {periods.map((period) => (
              <SelectItem key={period.id} value={period.id}>
                {period.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSubject} onValueChange={setFilterSubject}>
          <SelectTrigger className="border-[#bebbb4]">
            <SelectValue placeholder="Toutes les matières" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les matières</SelectItem>
            {subjects.map((subject) => (
              <SelectItem key={subject.id} value={subject.id}>
                {subject.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-[#bebbb4]">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#f7f7f6] dark:bg-[#1f1a18]/10">
                <TableHead className="text-[#1f1a18] dark:text-foreground font-semibold">Élève</TableHead>
                <TableHead className="text-[#1f1a18] dark:text-foreground font-semibold">Matière</TableHead>
                <TableHead className="text-[#1f1a18] dark:text-foreground font-semibold">Période</TableHead>
                <TableHead className="text-[#1f1a18] dark:text-foreground font-semibold">Note</TableHead>
                <TableHead className="text-[#1f1a18] dark:text-foreground font-semibold">Date</TableHead>
                <TableHead className="text-[#1f1a18] dark:text-foreground font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGrades.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-[#5b6d77]">
                    <FileTextIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Aucune note trouvée</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredGrades.map((grade) => {
                  const percentage = (grade.value / grade.maxValue) * 100
                  return (
                    <TableRow key={grade.id} className="hover:bg-[#f7f7f6]/50 dark:hover:bg-[#1f1a18]/5">
                      <TableCell className="font-medium text-[#1f1a18] dark:text-foreground">
                        {getStudentName(grade.studentId)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-[#5b6d77] text-[#5b6d77]">
                          {getSubjectName(grade.subjectId)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[#5b6d77]">
                        {getPeriodName(grade.periodId)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-lg ${getGradeColor(grade.value, grade.maxValue)}`}>
                            {grade.value}/{grade.maxValue}
                          </span>
                          {percentage >= 60 ? (
                            <TrendingUpIcon className="h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingDownIcon className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        {grade.comment && (
                          <p className="text-xs text-[#5b6d77] mt-1">{grade.comment}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-[#5b6d77]">
                        {new Date(grade.createdAt).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isArchived && (
                          <div className="flex items-center justify-end gap-2">
                            <Dialog 
                              open={editingGrade?.id === grade.id} 
                              onOpenChange={(open) => !open && handleCancelEdit()}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(grade)}
                                  className="text-[#5b6d77] hover:text-[#1f1a18] hover:bg-[#f7f7f6]"
                                >
                                  <PencilIcon className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px]">
                              <form onSubmit={handleSubmit}>
                                <DialogHeader>
                                  <DialogTitle className="text-[#1f1a18]">Modifier la Note</DialogTitle>
                                  <DialogDescription className="text-[#5b6d77]">
                                    Modifiez les informations de la note
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                  <div className="space-y-2">
                                    <Label className="text-[#1f1a18]">Élève</Label>
                                    <Input
                                      value={getStudentName(formData.studentId)}
                                      disabled
                                      className="border-[#bebbb4] bg-muted"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-[#1f1a18]">Matière</Label>
                                    <Input
                                      value={getSubjectName(formData.subjectId)}
                                      disabled
                                      className="border-[#bebbb4] bg-muted"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-[#1f1a18]">Période</Label>
                                    <Input
                                      value={getPeriodName(formData.periodId)}
                                      disabled
                                      className="border-[#bebbb4] bg-muted"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-value" className="text-[#1f1a18]">
                                        Note *
                                      </Label>
                                      <Input
                                        id="edit-value"
                                        type="number"
                                        step="0.5"
                                        value={formData.value}
                                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                        required
                                        min="0"
                                        max={formData.maxValue}
                                        className="border-[#bebbb4]"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-maxValue" className="text-[#1f1a18]">
                                        Sur *
                                      </Label>
                                      <Input
                                        id="edit-maxValue"
                                        type="number"
                                        step="0.5"
                                        value={formData.maxValue}
                                        onChange={(e) => setFormData({ ...formData, maxValue: e.target.value })}
                                        required
                                        min="1"
                                        className="border-[#bebbb4]"
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-comment" className="text-[#1f1a18]">
                                      Commentaire
                                    </Label>
                                    <Input
                                      id="edit-comment"
                                      value={formData.comment}
                                      onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                                      className="border-[#bebbb4]"
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={handleCancelEdit}
                                    className="border-[#bebbb4]"
                                  >
                                    Annuler
                                  </Button>
                                  <Button type="submit" className="bg-[#c3b595] hover:bg-[#c3b595]/90 text-white">
                                    Enregistrer
                                  </Button>
                                </DialogFooter>
                              </form>
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete?.(grade.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}