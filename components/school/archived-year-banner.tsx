import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { ArchiveIcon } from "lucide-react"

interface ArchivedYearBannerProps {
  yearName: string
}

export function ArchivedYearBanner({ yearName }: ArchivedYearBannerProps) {
  return (
    <Alert className="border-amber-200 bg-amber-50 text-amber-900">
      <ArchiveIcon className="h-4 w-4 !text-amber-600" />
      <AlertTitle>Année {yearName} — Archivée</AlertTitle>
      <AlertDescription>
        Année archivée — les données sont en lecture seule
      </AlertDescription>
    </Alert>
  )
}
