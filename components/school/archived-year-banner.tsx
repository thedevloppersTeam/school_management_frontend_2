import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { ArchiveIcon } from "lucide-react"

interface ArchivedYearBannerProps {
  yearName: string
}

export function ArchivedYearBanner({ yearName }: ArchivedYearBannerProps) {
  return (
    <Alert className="border-warning-border bg-warning-soft text-warning-ink">
      <ArchiveIcon className="h-4 w-4 !text-warning-ink" />
      <AlertTitle>Année {yearName} — Archivée</AlertTitle>
      <AlertDescription>
        Année archivée — les données sont en lecture seule
      </AlertDescription>
    </Alert>
  )
}
