/**
 * ClasseSalleInfo — « Classe : 1e AF » et « Salle : A », deux badges étiquetés
 * (chantier W2, T3 ; D8). Format repris de l'en-tête de l'onglet Comportement
 * (`cpmsl-behavior-grid.tsx`), généralisé aux quatre onglets de notes.
 *
 * Rendu : un fragment de deux badges. L'onglet garde son propre conteneur
 * (flex, gap) et peut y ajouter ses badges (étape, étape clôturée).
 *
 * Les deux valeurs viennent de `libelleClasseSalle`, le point de composition
 * unique (DESIGN.md, « La Règle des Deux Champs »). Le texte de remplacement
 * d'une valeur absente appartient à l'écran : d'où `remplacement`.
 */
import { Badge } from "@/components/ui/badge"
import { libelleClasseSalle, type ClasseSource, type SessionSource } from "@/lib/classes/labels"

export interface ClasseSalleInfoProps {
  /** Une session, une classe, `null` ou `undefined` : même entrée que `libelleClasseSalle`. */
  source: ClasseSource | SessionSource | null | undefined
  /** Texte affiché à la place d'une valeur absente. « — » par défaut. */
  remplacement?: string
}

export function ClasseSalleInfo({ source, remplacement = "—" }: ClasseSalleInfoProps) {
  const { classe, salle } = libelleClasseSalle(source)
  return (
    <>
      <Badge variant="outline">
        Classe : <span className="ml-1 font-semibold text-foreground">{classe || remplacement}</span>
      </Badge>
      <Badge variant="outline">
        Salle : <span className="ml-1 font-mono font-semibold text-foreground">{salle || remplacement}</span>
      </Badge>
    </>
  )
}
