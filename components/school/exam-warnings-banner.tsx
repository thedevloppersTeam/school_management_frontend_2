// Bandeau RS-07 (SPEC-RESULTATS, lot M1) en tête du paramétrage de l'année :
// classes d'examen sans étape d'examen blanc, ou sans composant d'examen.
// Rien n'est rendu quand il n'y a rien à signaler.

import { AlertTriangleIcon } from "lucide-react"
import { warningsBanner, type ExamWarning } from "@/lib/exam-markers/markers"

export function ExamWarningsBanner({ warnings }: { warnings: ExamWarning[] }) {
  const banner = warningsBanner(warnings)
  if (!banner) return null
  return (
    <div
      role="status"
      className="flex gap-3 rounded-md border border-warning-border bg-warning-soft px-4 py-3 text-sm text-warning-ink"
    >
      <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-semibold">{banner.title}</p>
        <ul className="list-disc space-y-0.5 pl-4">
          {banner.lines.map((line) => <li key={line}>{line}</li>)}
        </ul>
        <p className="text-xs">
          Marqueurs posés à la main : onglet Étapes (« Étape d&apos;examen blanc »), affectation des matières d&apos;une
          classe d&apos;examen (« Matière d&apos;examen »), référentiel des matières (« Sous-matière d&apos;examen »).
        </p>
      </div>
    </div>
  )
}
