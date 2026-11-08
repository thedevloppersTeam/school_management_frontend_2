"use client"

/**
 * Formulaire d'une catégorie du catalogue (maquette CAL-2, § 3.1.2).
 *
 * Un seul champ : le libellé interne. Ni code (généré par le serveur), ni
 * couleur, ni icône, ni groupe. La saisie part telle quelle : le serveur
 * retire les espaces de bord et tranche l'unicité.
 *
 * Aucun appel réseau : le parent reçoit la valeur par `onSubmit`, et lui
 * renvoie l'erreur déjà traduite (`toMessage`) par `erreur`. La modale qui
 * l'entoure reste ouverte avec la saisie en cas de refus.
 */
import { useId, useState, type FormEvent } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export const LIBELLE_INTERNE_MAX = 150

export interface FormulaireCategorieProps {
  /** Libellé actuel en modification ; absent en création. */
  libelleInitial?: string
  onSubmit: (valeur: { internalLabel: string }) => void
  onCancel: () => void
  /** Message d'erreur du serveur, déjà traduit. */
  erreur?: string | null
  enCours?: boolean
}

export function FormulaireCategorie({ libelleInitial, onSubmit, onCancel, erreur, enCours }: FormulaireCategorieProps) {
  const base = useId()
  const [libelle, setLibelle] = useState(libelleInitial ?? "")
  const modification = libelleInitial !== undefined
  const vide = libelle.trim() === ""
  const inchange = modification && libelle === libelleInitial
  const desactive = enCours || vide || inchange

  function soumettre(e: FormEvent) {
    e.preventDefault()
    if (desactive) return
    onSubmit({ internalLabel: libelle })
  }

  return (
    <form onSubmit={soumettre} className="space-y-4" noValidate>
      {erreur && (
        <Alert className="border-error-border bg-error-soft text-error-ink" role="alert">
          <AlertDescription>{erreur}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-1.5">
        <Label htmlFor={`${base}-libelle`}>Libellé interne</Label>
        <Input
          id={`${base}-libelle`}
          value={libelle}
          maxLength={LIBELLE_INTERNE_MAX}
          required
          aria-describedby={`${base}-aide`}
          onChange={(e) => setLibelle(e.target.value)}
        />
        <p id={`${base}-aide`} className="text-xs text-muted-foreground">
          Sert à reconnaître la catégorie dans ce catalogue. Il n&apos;apparaît jamais sur le tableau de bord.
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={enCours}>
          Annuler
        </Button>
        <Button type="submit" disabled={desactive}>
          Enregistrer
        </Button>
      </div>
    </form>
  )
}
