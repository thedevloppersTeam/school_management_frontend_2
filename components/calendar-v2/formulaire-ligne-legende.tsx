"use client"

/**
 * Formulaire d'une ligne de légende d'une année (maquette CAL-2, § 3.2.3 et
 * § 3.2.4).
 *
 * Création : catégorie du catalogue (actives, ordre du serveur), libellé
 * affiché pré-rempli avec le libellé interne tant que l'administrateur ne l'a
 * pas modifié, couleur SANS valeur par défaut, ordre (0 par défaut).
 * Modification : la catégorie ne change pas ; seuls les champs modifiés sont
 * rendus, et un jeton qu'on ne touche pas n'est pas renvoyé (SPEC-CAL-2 C-27).
 *
 * « Sans couleur » (D-44, C-28 forme (a)) : en création, la clé `colorToken`
 * est omise ; en modification, `colorToken: null` retire le jeton (une clé
 * omise signifie « inchangé », mise à jour partielle, contrat F4 et F7).
 *
 * Toutes les catégories actives sont proposées : une catégorie déjà dans la
 * légende est refusée par le serveur (409), sans comparaison côté écran.
 *
 * Aucun appel réseau : données et callbacks en props. Noms de champs de
 * `onSubmit` : ceux proposés au contrat de CAL-2.3, à confirmer.
 */
import Link from "next/link"
import { useId, useState, type FormEvent } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { choixDepuisJeton, jetonDepuisChoix, type ChoixCouleur } from "@/lib/calendar-v2/choix-couleur"
import { champsModifies } from "@/lib/calendar-v2/modifications"
import { SelecteurCouleur } from "./selecteur-couleur"

export const LIBELLE_AFFICHE_MAX = 100

export interface CategorieCatalogue {
  id: string
  internalLabel: string
}

export interface LigneLegendeInitiale {
  categoryInternalLabel: string
  /** `false` affiche le badge « Désactivée » ; absent, rien n'est affiché. */
  categoryIsActive?: boolean
  label: string
  /** `null` : ligne sans jeton. */
  colorToken: string | null
  sortOrder: number
}

export interface CreationLigneLegende {
  categoryId: string
  label: string
  /** Omis pour une ligne sans jeton (« Sans couleur »). */
  colorToken?: string
  sortOrder: number
}

export interface ModificationLigneLegende {
  label?: string
  /** `null` retire le jeton ; absent, le jeton est inchangé. */
  colorToken?: string | null
  sortOrder?: number
}

interface Communs {
  /** Nom de l'année, pour l'aide de la modification. */
  nomAnnee: string
  jetonsSelectionnables?: readonly string[]
  onCancel: () => void
  erreur?: string | null
  enCours?: boolean
}

export type FormulaireLigneLegendeProps =
  | (Communs & {
      mode: "creation"
      /** Catégories actives du catalogue, dans l'ordre du serveur. */
      categories: readonly CategorieCatalogue[]
      /** Lien vers le catalogue, quand il n'a aucune catégorie active. */
      hrefCatalogue?: string
      onSubmit: (valeur: CreationLigneLegende) => void
    })
  | (Communs & {
      mode: "modification"
      ligne: LigneLegendeInitiale
      onSubmit: (modifications: ModificationLigneLegende) => void
    })

const ORDRE_VALIDE = /^\d+$/

export function FormulaireLigneLegende(props: FormulaireLigneLegendeProps) {
  const base = useId()
  const initiale = props.mode === "modification" ? props.ligne : null

  const [categoryId, setCategoryId] = useState<string>("")
  const [libelle, setLibelle] = useState(initiale?.label ?? "")
  const [libelleTouche, setLibelleTouche] = useState(false)
  // Création : rien de choisi. Modification : le jeton enregistré, ou « Sans couleur ».
  const [choix, setChoix] = useState<ChoixCouleur>(initiale ? choixDepuisJeton(initiale.colorToken) : null)
  const jeton = jetonDepuisChoix(choix)
  const [ordre, setOrdre] = useState(String(initiale?.sortOrder ?? 0))

  const ordreValide = ORDRE_VALIDE.test(ordre)
  const libelleValide = libelle.trim() !== ""

  function choisirCategorie(id: string) {
    setCategoryId(id)
    if (props.mode !== "creation" || libelleTouche) return
    const c = props.categories.find((x) => x.id === id)
    if (c) setLibelle(c.internalLabel.slice(0, LIBELLE_AFFICHE_MAX))
  }

  let modifications: ModificationLigneLegende = {}
  if (initiale && ordreValide && jeton !== undefined) {
    modifications = champsModifies(
      { label: initiale.label, colorToken: initiale.colorToken, sortOrder: initiale.sortOrder },
      { label: libelle, colorToken: jeton, sortOrder: Number(ordre) },
    )
  }

  const complet = libelleValide && ordreValide && jeton !== undefined
  const desactive =
    props.enCours ||
    !complet ||
    (props.mode === "creation" ? categoryId === "" : Object.keys(modifications).length === 0)

  function soumettre(e: FormEvent) {
    e.preventDefault()
    if (desactive || jeton === undefined) return
    if (props.mode === "creation") {
      const valeur: CreationLigneLegende = { categoryId, label: libelle, sortOrder: Number(ordre) }
      if (jeton !== null) valeur.colorToken = jeton
      props.onSubmit(valeur)
    } else {
      props.onSubmit(modifications)
    }
  }

  const catalogueVide = props.mode === "creation" && props.categories.length === 0

  return (
    <form onSubmit={soumettre} className="space-y-4" noValidate>
      {props.mode === "modification" && (
        <p className="text-sm text-muted-foreground">Ce changement ne touche que {props.nomAnnee}.</p>
      )}
      {props.erreur && (
        <Alert className="border-error-border bg-error-soft text-error-ink" role="alert">
          <AlertDescription>{props.erreur}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={`${base}-categorie`}>Catégorie</Label>
        {props.mode === "modification" ? (
          <p id={`${base}-categorie`} className="flex flex-wrap items-center gap-2 text-sm text-foreground">
            {props.ligne.categoryInternalLabel}
            {props.ligne.categoryIsActive === false && (
              <Badge variant="outline" className="font-normal">
                Désactivée
              </Badge>
            )}
          </p>
        ) : catalogueVide ? (
          <p id={`${base}-categorie`} className="text-sm text-muted-foreground">
            Aucune catégorie active dans le catalogue.{" "}
            <Link href={props.hrefCatalogue ?? "/admin/settings/calendrier"} className="text-primary underline underline-offset-4">
              Créer une catégorie
            </Link>
          </p>
        ) : (
          <Select value={categoryId} onValueChange={choisirCategorie}>
            <SelectTrigger id={`${base}-categorie`}>
              <SelectValue placeholder="Choisir une catégorie" />
            </SelectTrigger>
            <SelectContent>
              {props.categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.internalLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${base}-libelle`}>Libellé affiché</Label>
        <Input
          id={`${base}-libelle`}
          value={libelle}
          maxLength={LIBELLE_AFFICHE_MAX}
          required
          onChange={(e) => {
            setLibelle(e.target.value)
            setLibelleTouche(true)
          }}
        />
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium leading-none">Couleur</legend>
        <SelecteurCouleur
          valeur={choix}
          onChange={setChoix}
          jetonsSelectionnables={props.jetonsSelectionnables}
          jetonActuel={initiale?.colorToken ?? null}
        />
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor={`${base}-ordre`}>Ordre</Label>
        <Input
          id={`${base}-ordre`}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={ordre}
          className="w-28 tabular-nums"
          aria-invalid={!ordreValide}
          onChange={(e) => setOrdre(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={props.onCancel} disabled={props.enCours}>
          Annuler
        </Button>
        <Button type="submit" disabled={desactive}>
          Enregistrer
        </Button>
      </div>
    </form>
  )
}
