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

interface DeleteSubjectChildModalProps {
  child: {
    id: string
    name: string
  }
  studentCount: number
  onConfirm?: () => void
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function DeleteSubjectChildModal({
  child,
  studentCount,
  onConfirm,
  trigger,
  open,
  onOpenChange
}: DeleteSubjectChildModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        style={{
          maxWidth: '520px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E8E6E3',
          borderRadius: '12px',
          padding: 0
        }}
      >
        <DialogHeader style={{ padding: '24px 24px 16px 24px', borderBottom: '1px solid #E8E6E3' }}>
          <DialogTitle
            style={{
              color: '#1E1A17',
              fontSize: '20px',
              fontWeight: 600,
              fontFamily: 'var(--font-serif)'
            }}
          >
            Supprimer — {child.name}
          </DialogTitle>
        </DialogHeader>

        <div style={{ padding: '24px' }} className="space-y-4">
          {/* Warning block */}
          <div
            style={{
              backgroundColor: '#FEE2E2',
              border: '1px solid #FCA5A5',
              borderRadius: '8px',
              padding: '16px'
            }}
          >
            <p
              style={{
                color: '#991B1B',
                fontSize: '14px',
                lineHeight: '1.5'
              }}
            >
              La suppression de cette sous-matière est irréversible. Les notes associées seront perdues.
            </p>
          </div>

          {/* Summary */}
          <div style={{ marginTop: '16px' }}>
            <p
              style={{
                color: '#5C5955',
                fontSize: '14px',
                fontWeight: 500
              }}
            >
              Élèves affectés : {studentCount}
            </p>
          </div>
        </div>

        <DialogFooter
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #E8E6E3',
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}
        >
          <Button
            variant="outline"
            onClick={() => onOpenChange?.(false)}
            style={{
              border: '1px solid #D1CECC',
              color: '#5C5955',
              borderRadius: '8px'
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={() => {
              onConfirm?.()
              onOpenChange?.(false)
            }}
            style={{
              backgroundColor: '#B91C1C',
              color: '#FFFFFF',
              borderRadius: '8px'
            }}
          >
            Supprimer définitivement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
