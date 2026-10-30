"use client"

import { InfoIcon } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { MESSAGE_FILIERE_HORS_CLASSE } from "@/lib/grades/accepte-notes"
import { cn } from "@/lib/utils"

/**
 * Indication d'une matière que le serveur déclare non saisissable
 * (`accepteNotes === false`). Le déclencheur est un vrai bouton : il prend le
 * focus au clavier, ce qui ouvre l'infobulle, et porte le message en
 * `aria-label` pour les lecteurs d'écran — les cases grisées, elles, sont
 * désactivées et ne reçoivent pas le focus.
 */
export function FiliereHorsClasseHint({ className }: { className?: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={MESSAGE_FILIERE_HORS_CLASSE}
            className={cn(
              "inline-flex items-center justify-center rounded p-0.5 align-middle text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              className,
            )}
          >
            <InfoIcon className="h-3.5 w-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent>{MESSAGE_FILIERE_HORS_CLASSE}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
