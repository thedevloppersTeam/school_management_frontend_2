import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface DeleteClassroomModalProps {
  classroom: {
    id: string
    name: string
  }
  level: {
    name: string
    niveau: string
  }
  studentCount: number
  onConfirm?: () => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function DeleteClassroomModal({
  classroom,
  level,
  studentCount,
  onConfirm,
  trigger,
  open,
  onOpenChange
}: DeleteClassroomModalProps) {
  const isFondamentale = level.niveau === 'Fondamentale'
  const title = isFondamentale
    ? `Supprimer la Salle ${classroom.name} — ${level.name}`
    : `Supprimer la filière ${classroom.name} — ${level.name}`

  const handleConfirm = () => {
    onConfirm?.()
    onOpenChange?.(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger}
      <DialogContent
        style={{
          maxWidth: '480px',
          borderRadius: '10px',
          border: '1px solid #E8E6E3',
          padding: 0
        }}
      >
        <DialogHeader style={{ padding: '24px 24px 16px 24px' }}>
          <DialogTitle
            style={{
              color: '#1E1A17',
              fontSize: '18px',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)'
            }}
          >
            {title}
          </DialogTitle>
        </DialogHeader>

        <div style={{ padding: '0 24px 24px 24px' }}>
          {/* Warning Block */}
          <div
            style={{
              backgroundColor: '#FEE2E2',
              color: '#991B1B',
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '14px',
              lineHeight: '1.5'
            }}
          >
            Cette {isFondamentale ? 'salle' : 'filière'} contient {studentCount} élèves. La suppression retirera ces élèves de la {isFondamentale ? 'salle' : 'filière'}. Cette action est irréversible.
          </div>

          {/* 16px spacing */}
          <div style={{ height: '16px' }} />

          {/* Summary Line */}
          <div
            style={{
              color: '#5C5955',
              fontSize: '14px',
              fontWeight: 500,
              marginBottom: '24px'
            }}
          >
            Élèves affectés : {studentCount}
          </div>

          {/* Buttons */}
          <DialogFooter style={{ gap: '12px', display: 'flex', flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Button
              variant="outline"
              onClick={() => onOpenChange?.(false)}
              style={{
                borderRadius: '8px',
                border: '1px solid #D1CECC',
                color: '#1E1A17',
                backgroundColor: '#FFFFFF'
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
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
