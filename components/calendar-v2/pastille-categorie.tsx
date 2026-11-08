/**
 * Pastille de catégorie du calendrier v2 : la couleur ET le libellé, jamais la
 * couleur seule (DESIGN.md, « L'exception du calendrier »).
 *
 * - Carré de 10 px, rayon 2 px, masqué aux lecteurs d'écran : le libellé porte
 *   l'identité de la catégorie.
 * - Jeton inconnu, vide ou absent : repli neutre, contour sans remplissage,
 *   sans message d'erreur.
 * - Libellé en encre, jamais coloré. Aucune icône de catégorie.
 *
 * Aucun appel réseau, aucun état.
 */
import { cn } from "@/lib/utils"
import { renduJeton } from "@/lib/calendar-v2/palette"

/** Le carré seul, décoratif. Ne s'emploie jamais sans libellé voisin. */
export function CarrePastille({ jeton, className }: { jeton: unknown; className?: string }) {
  const rendu = renduJeton(jeton)
  return (
    <span
      aria-hidden="true"
      data-jeton-connu={rendu.connu ? "oui" : "non"}
      className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]", rendu.classe, className)}
    />
  )
}

export interface PastilleCategorieProps {
  /** Nom du jeton reçu du serveur, tel quel. */
  jeton: unknown
  /** Libellé de la ligne de légende : obligatoire, c'est lui qui identifie. */
  libelle: string
  className?: string
}

export function PastilleCategorie({ jeton, libelle, className }: PastilleCategorieProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2 text-foreground", className)}>
      <CarrePastille jeton={jeton} />
      <span className="break-words">{libelle}</span>
    </span>
  )
}
