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
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ClassroomGradeStatus {
  className: string
  classroomName: string
  gradesEntered: number
  totalGrades: number
  status: 'complete' | 'incomplete' | 'not-started'
}

interface ClosePeriodModalProps {
  periodName: string
  classroomStatuses: ClassroomGradeStatus[]
  onConfirm?: (periodId: string) => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ClosePeriodModal({
  periodName,
  classroomStatuses,
  onConfirm,
  trigger,
  open,
  onOpenChange
}: ClosePeriodModalProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen)
    } else {
      setIsOpen(newOpen)
    }
  }

  const currentOpen = open !== undefined ? open : isOpen

  const incompleteCount = classroomStatuses.filter(
    c => c.status === 'incomplete' || c.status === 'not-started'
  ).length

  const handleConfirm = () => {
    onConfirm?.('')
    handleOpenChange(false)
  }

  // Helper function to format classroom name
  const formatClassroomName = (className: string, classroomName: string) => {
    // Fondamentale classes: 7e, 8e, 9e - remove "Salle " prefix
    const isFondamentale = ['7e', '8e', '9e'].includes(className)
    if (isFondamentale && classroomName.startsWith('Salle ')) {
      return classroomName.replace('Salle ', '')
    }
    // Secondaire classes: keep as is (LLA, SES, SMP, SVT)
    return classroomName
  }

  return (
    <Dialog open={currentOpen} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className="max-w-2xl"
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E8E6E3',
          borderRadius: '10px',
          padding: '32px'
        }}
      >
        <DialogHeader>
          <DialogTitle
            className="heading-3"
            style={{ color: '#1E1A17', marginBottom: '8px' }}
          >
            Clôturer la {periodName}
          </DialogTitle>
          <DialogDescription
            className="body-base"
            style={{ color: '#5C5955' }}
          >
            Vérifiez les notes manquantes avant de clôturer
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-6">
          {/* Summary Table */}
          <div
            style={{
              border: '1px solid #E8E6E3',
              borderRadius: '8px',
              overflow: 'hidden'
            }}
          >
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '2px solid #D1D5DB' }}>
                  <th
                    className="label-ui"
                    style={{
                      color: '#2C4A6E',
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em'
                    }}
                  >
                    Classe
                  </th>
                  <th
                    className="label-ui"
                    style={{
                      color: '#2C4A6E',
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em'
                    }}
                  >
                    Salle
                  </th>
                  <th
                    className="label-ui"
                    style={{
                      color: '#2C4A6E',
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em'
                    }}
                  >
                    Notes saisies
                  </th>
                  <th
                    className="label-ui"
                    style={{
                      color: '#2C4A6E',
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em'
                    }}
                  >
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody>
                {classroomStatuses.map((classroom, index) => (
                  <tr
                    key={`${classroom.className}-${classroom.classroomName}`}
                    style={{
                      borderTop: index > 0 ? '1px solid #E8E6E3' : 'none',
                      backgroundColor: '#FFFFFF'
                    }}
                  >
                    <td
                      className="body-base"
                      style={{
                        padding: '12px 16px',
                        color: '#1E1A17',
                        fontWeight: 600
                      }}
                    >
                      {classroom.className}
                    </td>
                    <td
                      className="body-base"
                      style={{
                        padding: '12px 16px',
                        color: '#5C5955'
                      }}
                    >
                      {formatClassroomName(classroom.className, classroom.classroomName)}
                    </td>
                    <td
                      className="body-base"
                      style={{
                        padding: '12px 16px',
                        color: '#1E1A17'
                      }}
                    >
                      {classroom.gradesEntered}/{classroom.totalGrades}
                    </td>
                    <td
                      className="body-base"
                      style={{
                        padding: '12px 16px',
                        fontWeight: 600,
                        color:
                          classroom.status === 'complete'
                            ? '#2D7D46'
                            : classroom.status === 'incomplete'
                            ? '#C48B1A'
                            : '#C84A3D'
                      }}
                    >
                      {classroom.status === 'complete'
                        ? 'Complet'
                        : classroom.status === 'incomplete'
                        ? 'Incomplet'
                        : 'Non commencé'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Warning Message */}
          {incompleteCount > 0 && (
            <Alert
              style={{
                backgroundColor: '#FEF6E0',
                border: '1px solid #F0D98E',
                borderRadius: '8px'
              }}
            >
              <AlertDescription
                className="body-base"
                style={{
                  color: '#8B6914',
                  fontWeight: 500
                }}
              >
                {incompleteCount} {incompleteCount === 1 ? 'classe a' : 'classes ont'} des notes manquantes. Les élèves sans note seront exclus de la moyenne.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            style={{
              borderRadius: '8px',
              border: '1px solid #D1CECC',
              color: '#5C5955'
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            style={{
              backgroundColor: '#B91C1C',
              color: '#FFFFFF',
              borderRadius: '8px'
            }}
            className="hover:bg-[#991B1B]"
          >
            Clôturer quand même
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}