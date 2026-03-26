import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface DeleteLevelModalProps {
  level: {
    id: string
    name: string
    niveau: string
  }
  classroomCount: number
  studentCount: number
  onConfirm?: () => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function DeleteLevelModal({
  level,
  classroomCount,
  studentCount,
  onConfirm,
  trigger,
  open,
  onOpenChange,
}: DeleteLevelModalProps) {
  const handleConfirm = () => {
    onConfirm?.()
    onOpenChange?.(false)
  }

  const getTitle = () => {
    if (level.niveau === 'Fondamentale') {
      return `Supprimer la classe ${level.name}`
    }
    return `Supprimer la classe ${level.name}`
  }

  const getClassroomLabel = () => {
    if (level.niveau === 'Nouveau Secondaire') {
      return 'filières'
    }
    return 'salles'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {getTitle()}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Confirmer la suppression de la classe
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning block */}
          <div className="bg-[#FEE2E2] border border-[#FCA5A5] rounded-md p-4">
            <p className="text-sm text-[#991B1B] leading-relaxed">
              Cette classe contient {classroomCount} {getClassroomLabel()} et {studentCount} élèves. 
              La suppression retirera toutes les {getClassroomLabel()} et tous les élèves associés. 
              Cette action est irréversible.
            </p>
          </div>

          {/* 16px spacing */}
          <div style={{ height: '16px' }} />

          {/* Summary lines */}
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              {level.niveau === 'Nouveau Secondaire' ? 'Filières' : 'Salles'} supprimées : <span className="font-medium text-foreground">{classroomCount}</span>
            </p>
            <p>
              Élèves affectés : <span className="font-medium text-foreground">{studentCount}</span>
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange?.(false)}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            className="bg-[#B91C1C] hover:bg-[#991B1B] text-white"
          >
            Supprimer définitivement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}