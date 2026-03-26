"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { CreateClassroomModal } from "@/components/school/create-classroom-modal"
import { PencilIcon, TrashIcon, UsersIcon, DoorOpenIcon, LayoutGridIcon } from "lucide-react"
import { type Classroom, type Level, type Student } from "@/lib/data/school-data"

interface ClassroomsManagementProps {
  classrooms: Classroom[]
  levels: Level[]
  students: Student[]
  isArchived?: boolean
  onAddClassroom?: (levelId: string, data: { name: string; capacity: number }) => void
  onEditClassroom?: (classroomId: string, data: { name: string; capacity: number }) => void
  onDeleteClassroom?: (classroomId: string) => void
}

export function ClassroomsManagement({
  classrooms,
  levels,
  students,
  isArchived = false,
  onAddClassroom,
  onEditClassroom,
  onDeleteClassroom
}: ClassroomsManagementProps) {
  const [selectedLevelId, setSelectedLevelId] = useState<string>("")
  const [classroomToDelete, setClassroomToDelete] = useState<Classroom | null>(null)
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const selectedLevel = useMemo(() => {
    return levels.find(l => l.id === selectedLevelId)
  }, [levels, selectedLevelId])

  const levelClassrooms = useMemo(() => {
    if (!selectedLevelId) return []
    return classrooms.filter(c => c.levelId === selectedLevelId)
  }, [classrooms, selectedLevelId])

  const classroomStats = useMemo(() => {
    return levelClassrooms.map(classroom => {
      const enrolledCount = students.filter(s => s.classroomId === classroom.id).length
      return {
        ...classroom,
        enrolledCount
      }
    })
  }, [levelClassrooms, students])

  const kpis = useMemo(() => {
    const totalClassrooms = classroomStats.length
    const totalCapacity = classroomStats.reduce((sum, c) => sum + c.capacity, 0)
    const totalEnrolled = classroomStats.reduce((sum, c) => sum + c.enrolledCount, 0)

    return { totalClassrooms, totalCapacity, totalEnrolled }
  }, [classroomStats])

  const handleDelete = (classroom: Classroom) => {
    const enrolledCount = students.filter(s => s.classroomId === classroom.id).length
    if (enrolledCount > 0) {
      // Bloquer la suppression si des élèves sont inscrits
      alert(`Impossible de supprimer — ${enrolledCount} élève${enrolledCount > 1 ? 's sont inscrits' : ' est inscrit'} dans cette salle`)
      return
    }
    setClassroomToDelete(classroom)
  }

  const confirmDelete = () => {
    if (classroomToDelete) {
      onDeleteClassroom?.(classroomToDelete.id)
      setClassroomToDelete(null)
    }
  }

  const handleEdit = (classroom: Classroom) => {
    setEditingClassroom(classroom)
    setIsEditModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header avec sélecteur de classe */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-xs">
          <Select value={selectedLevelId} onValueChange={setSelectedLevelId}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionnez une classe" />
            </SelectTrigger>
            <SelectContent>
              {levels.map(level => (
                <SelectItem key={level.id} value={level.id}>
                  {level.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedLevel && !isArchived && (
          <CreateClassroomModal
            level={selectedLevel}
            existingClassrooms={levelClassrooms}
            onSubmit={(data) => onAddClassroom?.(selectedLevel.id, data)}
          />
        )}
      </div>

      {!selectedLevelId ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <DoorOpenIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Sélectionnez une classe pour gérer ses salles
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="label-ui">Total salles</CardTitle>
                <LayoutGridIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="heading-3">{kpis.totalClassrooms}</div>
                <p className="caption text-muted-foreground">
                  pour {selectedLevel?.name}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="label-ui">Capacité totale</CardTitle>
                <DoorOpenIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="heading-3">{kpis.totalCapacity}</div>
                <p className="caption text-muted-foreground">
                  places disponibles
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="label-ui">Élèves inscrits</CardTitle>
                <UsersIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="heading-3">{kpis.totalEnrolled}</div>
                <p className="caption text-muted-foreground">
                  {kpis.totalCapacity > 0 
                    ? `${Math.round((kpis.totalEnrolled / kpis.totalCapacity) * 100)}% de remplissage`
                    : 'Aucune capacité'
                  }
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tableau des salles */}
          {classroomStats.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <DoorOpenIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center mb-4">
                  Aucune salle configurée pour {selectedLevel?.name}
                </p>
                {!isArchived && selectedLevel && (
                  <CreateClassroomModal
                    level={selectedLevel}
                    existingClassrooms={levelClassrooms}
                    onSubmit={(data) => onAddClassroom?.(selectedLevel.id, data)}
                    trigger={
                      <Button variant="outline">
                        Ajouter la première salle
                      </Button>
                    }
                  />
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="heading-3">Salles de {selectedLevel?.name}</CardTitle>
                <CardDescription className="body-base">
                  Gérez les salles et leur capacité
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Salle</TableHead>
                      <TableHead>Capacité</TableHead>
                      <TableHead>Élèves inscrits</TableHead>
                      {!isArchived && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classroomStats.map(classroom => (
                      <TableRow key={classroom.id}>
                        <TableCell className="font-medium">
                          Salle {classroom.name}
                        </TableCell>
                        <TableCell>{classroom.capacity}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{classroom.enrolledCount}</span>
                            {classroom.enrolledCount > classroom.capacity && (
                              <span className="text-xs text-destructive font-medium">
                                (Surcharge)
                              </span>
                            )}
                          </div>
                        </TableCell>
                        {!isArchived && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(classroom)}
                              >
                                <PencilIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(classroom)}
                              >
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Modal de modification */}
      {editingClassroom && selectedLevel && (
        <CreateClassroomModal
          classroom={editingClassroom}
          level={selectedLevel}
          existingClassrooms={levelClassrooms}
          onSubmit={(data) => {
            onEditClassroom?.(editingClassroom.id, data)
            setEditingClassroom(null)
          }}
          open={isEditModalOpen}
          onOpenChange={(open) => {
            setIsEditModalOpen(open)
            if (!open) setEditingClassroom(null)
          }}
        />
      )}

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={!!classroomToDelete} onOpenChange={(open) => !open && setClassroomToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer la Salle {classroomToDelete?.name} de {selectedLevel?.name} ?
              <br />
              <br />
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
