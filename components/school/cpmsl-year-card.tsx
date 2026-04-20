import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ArrowRightIcon, ZapIcon } from "lucide-react"
import { cn } from "@/lib/utils"

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

  const statusConfig = {
    active:      { label: 'Active',          variant: 'default' as const, className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' },
    preparation: { label: 'En préparation',  variant: 'outline' as const, className: 'border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-50' },
    archived:    { label: 'Archivée',        variant: 'secondary' as const, className: '' },
  }

  const config = statusConfig[year.status]

  const archivedDateLabel = (() => {
    const raw = stats?.archivedDate ?? year.endDate
    if (!raw) return null
    const d = new Date(raw)
    if (isNaN(d.getTime())) return null
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  })()

  return (
    <Card className={cn(
      "border bg-card shadow-sm transition-shadow hover:shadow-md",
      year.status === 'active' && "border-emerald-300 shadow-emerald-100/50"
    )}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <h3 className="text-xl font-semibold tracking-tight text-foreground truncate">
              {year.name}
            </h3>
            <Badge variant={config.variant} className={config.className}>
              {config.label}
            </Badge>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {year.status === 'preparation' && onActivate && (
              <Button
                onClick={() => onActivate(year.id)}
                disabled={isActivating}
                variant="outline"
                size="sm"
                className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                <ZapIcon className="h-3.5 w-3.5" />
                {isActivating ? 'Activation...' : 'Activer'}
              </Button>
            )}

            {year.status !== 'archived' ? (
              <Button
                onClick={() => onConfigure(year.id)}
                size="sm"
                variant={year.status === 'active' ? 'default' : 'outline'}
                className="gap-1.5"
              >
                Configurer
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                onClick={() => onConfigure(year.id)}
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
              >
                Consulter
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Stats for preparation/active year */}
        {stats && (year.status === 'preparation' || year.status === 'active') && (
          <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
            <span>Étapes <span className="font-medium text-foreground">{stats.periods.current}/{stats.periods.total}</span></span>
            <Separator orientation="vertical" className="h-4" />
            <span>Classes <span className="font-medium text-foreground">{stats.classes.current}</span></span>
            <Separator orientation="vertical" className="h-4" />
            <span>Matières <span className="font-medium text-foreground">{stats.subjects.current}</span></span>
          </div>
        )}

        {/* Stats for archived year */}
        {year.status === 'archived' && (
          <p className="mt-3 text-sm text-muted-foreground">
            {stats?.classes?.current != null ? `${stats.classes.current} classes` : '—'}
            {stats?.enrollments != null ? ` · ${stats.enrollments} élèves` : ''}
            {archivedDateLabel ? ` · Archivée le ${archivedDateLabel}` : ''}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
