import { Button } from "@/components/ui/button"
import { InfoIcon, ArrowRightIcon, ZapIcon } from "lucide-react"

interface CPMSLYearCardProps {
  year: {
    id: string
    name: string
    status: 'active' | 'preparation' | 'archived'
    endDate?: string
  }
  stats?: {
    periods:     { current: number; total: number; complete: boolean }
    classes:     { current: number; complete: boolean }
    subjects:    { current: number; complete: boolean }
    enrollments?: number
    archivedDate?: string
  }
  onConfigure:  (yearId: string) => void
  onActivate?:  (yearId: string) => void
  isActivating?: boolean
  isSelected?: boolean
}

export function CPMSLYearCard({
  year,
  stats,
  onConfigure,
  onActivate,
  isActivating = false,
}: CPMSLYearCardProps) {

  const statusBadges: Record<string, { bg: string; text: string; label: string; border?: string }> = {
    active:      { bg: '#E8F5EC', text: '#2D7D46', label: 'Active' },
    preparation: { bg: '#FEF6E0', text: '#C48B1A', label: 'En préparation', border: '#C48B1A' },
    archived:    { bg: '#F5F4F2', text: '#78756F', label: 'Archivée' }
  }

  const badge = statusBadges[year.status]

  const archivedDateLabel = (() => {
    const raw = stats?.archivedDate ?? year.endDate
    if (!raw) return null
    const d = new Date(raw)
    if (isNaN(d.getTime())) return null
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  })()

  return (
    <div style={{
      backgroundColor: '#FFFFFF',
      border: year.status === 'active' ? '1px solid #2D7D46' : '1px solid #E8E6E3',
      borderRadius: '10px',
      boxShadow: year.status === 'active' ? '0 2px 12px rgba(45,125,70,0.12)' : '0 2px 8px rgba(0,0,0,0.06)',
      padding: '20px 24px'
    }}>
      <div className="flex items-center justify-between">

        {/* Gauche : nom + badge */}
        <div className="flex items-center gap-4 flex-1">
          <h3 className="font-serif font-semibold" style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', color: '#2A3740' }}>
            {year.name}
          </h3>
          <div
            style={{
              backgroundColor: badge.bg,
              color: badge.text,
              border: badge.border ? `1px solid ${badge.border}` : 'none',
              padding: '4px 12px',
              borderRadius: '6px',
              fontWeight: 500,
              fontSize: '12px'
            }}
          >
            {badge.label}
          </div>
        </div>

        {/* Droite : actions selon statut */}
        <div className="flex items-center gap-2">

          {/* Bouton Activer — seulement pour "preparation" */}
          {year.status === 'preparation' && onActivate && (
            <Button
              onClick={() => onActivate(year.id)}
              disabled={isActivating}
              variant="outline"
              className="gap-2"
              style={{
                borderColor: '#2D7D46',
                color: '#2D7D46',
                backgroundColor: 'white',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 500
              }}
            >
              <ZapIcon className="h-4 w-4" />
              {isActivating ? 'Activation...' : 'Activer'}
            </Button>
          )}

          {/* Bouton principal : Configurer / Consulter */}
          {year.status !== 'archived' && (
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
              Configurer
              <ArrowRightIcon className="ml-2 h-4 w-4" />
            </Button>
          )}

          {year.status === 'archived' && (
            <Button
              onClick={() => onConfigure(year.id)}
              variant="ghost"
              style={{ color: '#78756F', borderRadius: '8px', padding: '8px 16px' }}
            >
              Consulter
              <ArrowRightIcon className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Stats pour année en préparation */}
      {stats && year.status === 'preparation' && (
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-2">
            <span className="label-ui text-muted-foreground">Étapes</span>
            <span className="label-ui text-muted-foreground">{stats.periods.current}/{stats.periods.total}</span>
            <InfoIcon className="h-4 w-4" style={{ color: '#A8A5A2' }} />
          </div>
          <div style={{ width: '1px', height: '16px', backgroundColor: '#E8E6E3' }} />
          <div className="flex items-center gap-2">
            <span className="label-ui text-muted-foreground">Classes</span>
            <span className="label-ui text-muted-foreground">{stats.classes.current}</span>
            <InfoIcon className="h-4 w-4" style={{ color: '#A8A5A2' }} />
          </div>
          <div style={{ width: '1px', height: '16px', backgroundColor: '#E8E6E3' }} />
          <div className="flex items-center gap-2">
            <span className="label-ui text-muted-foreground">Matières</span>
            <span className="label-ui text-muted-foreground">{stats.subjects.current}</span>
            <InfoIcon className="h-4 w-4" style={{ color: '#A8A5A2' }} />
          </div>
        </div>
      )}

      {/* Stats pour année active */}
      {stats && year.status === 'active' && (
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-2">
            <span className="label-ui text-muted-foreground">Étapes</span>
            <span className="label-ui text-muted-foreground">{stats.periods.current}/{stats.periods.total}</span>
          </div>
          <div style={{ width: '1px', height: '16px', backgroundColor: '#E8E6E3' }} />
          <div className="flex items-center gap-2">
            <span className="label-ui text-muted-foreground">Classes</span>
            <span className="label-ui text-muted-foreground">{stats.classes.current}</span>
          </div>
        </div>
      )}

      {/* Stats pour année archivée */}
      {year.status === 'archived' && (
        <div className="mt-3">
          <p className="font-sans text-muted-foreground" style={{ fontSize: '13px' }}>
            {stats?.classes?.current != null ? `${stats.classes.current} classes` : '—'}
            {stats?.enrollments != null ? `  |  ${stats.enrollments} élèves` : ''}
            {archivedDateLabel ? `  |  Archivée le ${archivedDateLabel}` : ''}
          </p>
        </div>
      )}
    </div>
  )
}