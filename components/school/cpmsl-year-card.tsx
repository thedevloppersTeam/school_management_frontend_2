import { Button } from "@/components/ui/button"
import { CheckCircle2Icon, InfoIcon, ArrowRightIcon } from "lucide-react"

interface CPMSLYearCardProps {
  year: {
    id: string
    name: string
    status: 'active' | 'preparation' | 'archived'
  }
  stats?: {
    periods: { current: number; total: number; complete: boolean }
    classes: { current: number; complete: boolean }
    students: { current: number }
  }
  onConfigure: (yearId: string) => void
  isSelected?: boolean
}

export function CPMSLYearCard({ year, stats, onConfigure, isSelected }: CPMSLYearCardProps) {
  const statusBadges: Record<string, { bg: string; text: string; label: string; border?: string }> = {
    active: { bg: '#E8F5EC', text: '#2D7D46', label: 'Active' },
    preparation: { bg: '#FEF6E0', text: '#C48B1A', label: 'En préparation', border: '#C48B1A' },
    archived: { bg: '#F5F4F2', text: '#78756F', label: 'Archivée' }
  }

  const badge = statusBadges[year.status]

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E8E6E3',
        borderRadius: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        padding: '20px 24px'
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <h3 
            className="font-serif font-semibold" 
            style={{ 
              fontSize: '22px', 
              fontWeight: 600, 
              letterSpacing: '-0.02em',
              color: '#2A3740'
            }}
          >
            {year.name}
          </h3>
          
          <div
            className="caption"
            style={{
              backgroundColor: badge.bg,
              color: badge.text,
              border: badge.border ? `1px solid ${badge.border}` : 'none',
              padding: '4px 12px',
              borderRadius: '6px',
              fontWeight: 500
            }}
          >
            {badge.label}
          </div>
        </div>

        <Button
          onClick={() => onConfigure(year.id)}
          className="label-ui hover:opacity-90"
          style={{
            backgroundColor: year.status === 'active' ? '#5A7085' : 'transparent',
            color: year.status === 'active' ? '#FFFFFF' : '#5A7085',
            border: year.status === 'active' ? 'none' : '1px solid #D9E3EA',
            borderRadius: '8px',
            padding: '8px 16px'
          }}
        >
          {year.status === 'archived' ? 'Consulter' : 'Configurer'}
          <ArrowRightIcon className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {stats && (
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-2">
            <span className="label-ui text-muted-foreground">Étapes</span>
            <span className="label-ui font-medium" style={{ color: '#2A3740' }}>{stats.periods.current}</span>
            {stats.periods.complete
              ? <CheckCircle2Icon className="h-4 w-4" style={{ color: '#2D7D46' }} />
              : <InfoIcon className="h-4 w-4" style={{ color: '#A8A5A2' }} />}
          </div>

          <div style={{ width: '1px', height: '16px', backgroundColor: '#E8E6E3' }} />

          <div className="flex items-center gap-2">
            <span className="label-ui text-muted-foreground">Classes</span>
            <span className="label-ui font-medium" style={{ color: '#2A3740' }}>{stats.classes.current}</span>
            {stats.classes.complete
              ? <CheckCircle2Icon className="h-4 w-4" style={{ color: '#2D7D46' }} />
              : <InfoIcon className="h-4 w-4" style={{ color: '#A8A5A2' }} />}
          </div>

          <div style={{ width: '1px', height: '16px', backgroundColor: '#E8E6E3' }} />

          <div className="flex items-center gap-2">
            <span className="label-ui text-muted-foreground">Élèves</span>
            <span className="label-ui font-medium" style={{ color: '#2A3740' }}>{stats.students.current}</span>
          </div>
        </div>
      )}
    </div>
  )
}