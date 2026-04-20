import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  iconClassName?: string
  iconBgClassName?: string
}

export function StatCard({
  label,
  value,
  icon: Icon,
  iconClassName = "text-primary",
  iconBgClassName = "bg-primary/10",
}: StatCardProps) {
  return (
    <Card className="border bg-card shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
            iconBgClassName
          )}
        >
          <Icon className={cn("h-6 w-6", iconClassName)} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="truncate text-2xl font-bold tracking-tight text-foreground">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
