// Badge « Parti le … » d'un élève parti (inscription DROPPED, D-22). Même
// libellé sur toutes les listes : élèves inscrits, tous les élèves, saisie des
// notes et du comportement, bulletins, parcours.

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { leftLabel } from "@/lib/departures/presence"

export function LeftBadge({ leftAt, className }: { leftAt?: string | null; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("border-warning-border bg-warning-soft text-3xs font-medium text-warning-ink", className)}
    >
      {leftLabel(leftAt)}
    </Badge>
  )
}
