import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangleIcon } from "lucide-react"

interface ArchivedYearBannerProps {
  yearName: string
}

export function ArchivedYearBanner({ yearName }: ArchivedYearBannerProps) {
  return (
    <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
      <CardContent className="py-4">
        <div className="flex items-center gap-3">
          <AlertTriangleIcon className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
          <div>
            <p className="font-semibold text-orange-900 dark:text-orange-100">
              Année {yearName} — Archivée
            </p>
            <p className="text-sm text-orange-700 dark:text-orange-300">
              Année archivée — les données sont en lecture seule
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}