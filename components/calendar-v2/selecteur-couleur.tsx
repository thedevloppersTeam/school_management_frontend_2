"use client"

/**
 * Sélecteur de couleur d'une ligne de légende (maquette CAL-2, § 4.2).
 *
 * - Les jetons sélectionnables, chacun avec sa pastille ET son nom affiché ; le
 *   nom technique du jeton n'est jamais montré.
 * - Puis « Sans couleur » (décision D-44 sur C-28, forme (a)) : pastille neutre,
 *   aucune valeur de jeton envoyée. Ce n'est pas un nom de jeton.
 * - Aucune option cochée par défaut, « Sans couleur » comprise : la valeur
 *   vient du parent (`null` = rien de choisi).
 * - Modification d'une ligne dont le jeton n'est plus sélectionnable
 *   (SPEC-CAL-2 C-27) : la couleur actuelle reste en tête, cochée, sous la
 *   mention « Couleur actuelle (retirée de la palette) ».
 *
 * Aucun appel réseau : la liste des sélectionnables arrive en props.
 */
import { useId } from "react"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { SANS_COULEUR, type ChoixCouleur } from "@/lib/calendar-v2/choix-couleur"
import { JETONS_CALENDRIER, PALETTE_CALENDRIER, estJetonConnu } from "@/lib/calendar-v2/palette"
import { CarrePastille } from "./pastille-categorie"

export interface SelecteurCouleurProps {
  /** Jeton choisi, `SANS_COULEUR`, ou `null` si rien n'est choisi. */
  valeur: ChoixCouleur
  onChange: (choix: ChoixCouleur) => void
  /** Jetons sélectionnables (contrat). Par défaut, la palette entière. */
  jetonsSelectionnables?: readonly string[]
  /** Jeton enregistré sur la ligne modifiée, même s'il n'est plus proposé. */
  jetonActuel?: string | null
  /** Identifiant du texte qui décrit le groupe (aide ou erreur). */
  ariaDescribedBy?: string
  disabled?: boolean
}

export function SelecteurCouleur({
  valeur,
  onChange,
  jetonsSelectionnables = JETONS_CALENDRIER,
  jetonActuel,
  ariaDescribedBy,
  disabled,
}: SelecteurCouleurProps) {
  const base = useId()
  // Seuls les jetons que la palette connaît ont un nom à montrer.
  const proposes = jetonsSelectionnables.filter(estJetonConnu)
  const actuelRetire =
    typeof jetonActuel === "string" && !proposes.some((j) => j === jetonActuel) ? jetonActuel : null

  return (
    <div className="space-y-2">
      {actuelRetire !== null && (
        <p className="text-xs text-muted-foreground">Couleur actuelle (retirée de la palette)</p>
      )}
      <RadioGroup
        value={valeur ?? ""}
        onValueChange={onChange}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        className="flex flex-wrap gap-x-6 gap-y-2"
      >
        {actuelRetire !== null && (
          <OptionCouleur
            id={`${base}-actuel`}
            valeur={actuelRetire}
            jeton={actuelRetire}
            nom={estJetonConnu(actuelRetire) ? PALETTE_CALENDRIER[actuelRetire].nomAffiche : "Couleur inconnue"}
          />
        )}
        {proposes.map((j) => (
          <OptionCouleur key={j} id={`${base}-${j}`} valeur={j} jeton={j} nom={PALETTE_CALENDRIER[j].nomAffiche} />
        ))}
        <OptionCouleur id={`${base}-sans`} valeur={SANS_COULEUR} jeton={null} nom="Sans couleur" />
      </RadioGroup>
    </div>
  )
}

function OptionCouleur({ id, valeur, jeton, nom }: { id: string; valeur: string; jeton: string | null; nom: string }) {
  return (
    <div className="flex items-center gap-2">
      <RadioGroupItem id={id} value={valeur} />
      <Label htmlFor={id} className="flex cursor-pointer items-center gap-2 font-normal">
        <CarrePastille jeton={jeton} />
        {nom}
      </Label>
    </div>
  )
}
