"use client"

/**
 * Formulaire d'une entrée du calendrier d'une année (maquette CAL-2, § 3.3.2 à
 * § 3.3.4).
 *
 * - Catégorie : une ligne de la légende de CETTE année, ordre du serveur,
 *   pastille et libellé. En création, une ligne dont la catégorie est
 *   désactivée est grisée ; en modification, la ligne actuelle reste choisie.
 * - Durée « Un jour » / « Une période » : aide à la saisie, non envoyée. Un
 *   jour envoie le même `AAAA-MM-JJ` en début et en fin.
 * - Récurrence SANS valeur par défaut (SPEC-CAL-2 C-33). « Même date chaque
 *   année » est réservée à un jour : désactivée pour une période, et décochée
 *   quand on passe à une période.
 * - Dates hors des bornes de l'année : avertissement NON bloquant,
 *   « Enregistrer » reste actif (C-34). Les bornes sont incluses.
 * - Dates : la valeur `AAAA-MM-JJ` du champ part telle quelle. Jamais de
 *   `new Date(valeur)`.
 *
 * Aucun appel réseau : données et callbacks en props. Noms de champs de
 * `onSubmit` : ceux proposés au contrat de CAL-2.3, à confirmer.
 */
import { AlertTriangle } from "lucide-react"
import { useId, useState, type FormEvent } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { parseCivil } from "@/lib/calendar/dates"
import { estHorsBornes, messageHorsBornes, type Bornes } from "@/lib/calendar-v2/hors-bornes"
import { champsModifies } from "@/lib/calendar-v2/modifications"
import type { FormeDates } from "@/lib/calendar-v2/dates"
import { PastilleCategorie } from "./pastille-categorie"

export const TITRE_MAX = 200
export const NOTE_MAX = 500

export type Recurrence = "DATE_FIXE" | "A_REVOIR_CHAQUE_ANNEE"

export const LIBELLES_RECURRENCE: Readonly<Record<Recurrence, string>> = {
  DATE_FIXE: "Même date chaque année",
  A_REVOIR_CHAQUE_ANNEE: "Date à revoir chaque année",
}

export interface LigneLegendeOption {
  id: string
  label: string
  /** `null` : ligne sans jeton, rendue en neutre comme un jeton inconnu. */
  colorToken: string | null
  /** `false` : catégorie désactivée. Absent : rien n'est grisé, le serveur tranche. */
  categoryIsActive?: boolean
}

export interface ValeursEntree {
  yearCategoryId: string
  title: string
  startDate: string
  endDate: string
  recurrence: Recurrence
  note: string | null
}

interface Communs {
  /** Lignes de la légende de l'année, dans l'ordre du serveur. */
  lignes: readonly LigneLegendeOption[]
  /** Nom et bornes de l'année, pour l'avertissement hors bornes. */
  annee: { nom: string; bornes: Bornes }
  onCancel: () => void
  erreur?: string | null
  enCours?: boolean
}

export type FormulaireEntreeProps =
  | (Communs & { mode: "creation"; onSubmit: (valeurs: ValeursEntree) => void })
  | (Communs & {
      mode: "modification"
      /** Valeurs enregistrées ; dates déjà lues en `AAAA-MM-JJ`. */
      entree: ValeursEntree
      onSubmit: (modifications: Partial<ValeursEntree>) => void
    })

const estCivile = (v: string) => parseCivil(v) !== null

export function FormulaireEntree(props: FormulaireEntreeProps) {
  const base = useId()
  const initiale = props.mode === "modification" ? props.entree : null

  const [ligneId, setLigneId] = useState(initiale?.yearCategoryId ?? "")
  const [titre, setTitre] = useState(initiale?.title ?? "")
  const [duree, setDuree] = useState<FormeDates>(
    initiale && initiale.startDate !== initiale.endDate ? "periode" : "jour",
  )
  const [debut, setDebut] = useState(initiale?.startDate ?? "")
  const [fin, setFin] = useState(initiale && initiale.startDate !== initiale.endDate ? initiale.endDate : "")
  const [recurrence, setRecurrence] = useState<Recurrence | null>(initiale?.recurrence ?? null)
  const [note, setNote] = useState(initiale?.note ?? "")

  const finEnvoyee = duree === "jour" ? debut : fin
  const datesLisibles = estCivile(debut) && estCivile(finEnvoyee)
  const horsBornes = estHorsBornes(debut, finEnvoyee, props.annee.bornes)

  function changerDuree(v: string) {
    const d: FormeDates = v === "periode" ? "periode" : "jour"
    setDuree(d)
    // Ne jamais envoyer une combinaison refusée (CAL_DATE_FIXE_PERIODE).
    if (d === "periode" && recurrence === "DATE_FIXE") setRecurrence(null)
  }

  const courant: ValeursEntree | null =
    recurrence === null
      ? null
      : {
          yearCategoryId: ligneId,
          title: titre,
          startDate: debut,
          endDate: finEnvoyee,
          recurrence,
          note: note === "" ? null : note,
        }

  const complet = courant !== null && ligneId !== "" && titre.trim() !== "" && datesLisibles
  const modifications = initiale && courant ? champsModifies(initiale, courant) : {}
  const desactive =
    props.enCours || !complet || (props.mode === "modification" && Object.keys(modifications).length === 0)

  function soumettre(e: FormEvent) {
    e.preventDefault()
    if (desactive || courant === null) return
    if (props.mode === "creation") props.onSubmit(courant)
    else props.onSubmit(modifications)
  }

  const idAvertissement = `${base}-hors-bornes`
  const idConsigne = `${base}-consigne`

  return (
    <form onSubmit={soumettre} className="space-y-4" noValidate>
      {props.erreur && (
        <Alert className="border-error-border bg-error-soft text-error-ink" role="alert">
          <AlertDescription>{props.erreur}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={`${base}-ligne`}>Catégorie</Label>
        <Select value={ligneId} onValueChange={setLigneId}>
          <SelectTrigger id={`${base}-ligne`}>
            <SelectValue placeholder="Choisir une catégorie de la légende" />
          </SelectTrigger>
          <SelectContent>
            {props.lignes.map((l) => {
              const desactivee = l.categoryIsActive === false
              const grisee = desactivee && l.id !== initiale?.yearCategoryId
              return (
                <SelectItem key={l.id} value={l.id} disabled={grisee}>
                  <PastilleCategorie jeton={l.colorToken} libelle={l.label} />
                  {desactivee && <span className="ml-2 text-xs text-muted-foreground">catégorie désactivée</span>}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${base}-titre`}>Titre</Label>
        <Input
          id={`${base}-titre`}
          value={titre}
          maxLength={TITRE_MAX}
          required
          aria-describedby={idConsigne}
          onChange={(e) => setTitre(e.target.value)}
        />
        <p id={idConsigne} className="text-xs text-muted-foreground">
          Décrivez la vie de l&apos;école ; ne nommez aucun élève.
        </p>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium leading-none">Durée</legend>
        <RadioGroup value={duree} onValueChange={changerDuree} className="flex flex-wrap gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <RadioGroupItem id={`${base}-jour`} value="jour" />
            <Label htmlFor={`${base}-jour`} className="font-normal">
              Un jour
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem id={`${base}-periode`} value="periode" />
            <Label htmlFor={`${base}-periode`} className="font-normal">
              Une période
            </Label>
          </div>
        </RadioGroup>
      </fieldset>

      {duree === "jour" ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${base}-date`}>Date</Label>
          <Input
            id={`${base}-date`}
            type="date"
            value={debut}
            required
            className="w-48 tabular-nums"
            aria-describedby={horsBornes ? idAvertissement : undefined}
            onChange={(e) => setDebut(e.target.value)}
          />
        </div>
      ) : (
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1.5">
            <Label htmlFor={`${base}-du`}>Du</Label>
            <Input
              id={`${base}-du`}
              type="date"
              value={debut}
              required
              className="w-48 tabular-nums"
              aria-describedby={horsBornes ? idAvertissement : undefined}
              onChange={(e) => setDebut(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${base}-au`}>Au</Label>
            <Input
              id={`${base}-au`}
              type="date"
              value={fin}
              min={estCivile(debut) ? debut : undefined}
              required
              className="w-48 tabular-nums"
              aria-describedby={horsBornes ? idAvertissement : undefined}
              onChange={(e) => setFin(e.target.value)}
            />
          </div>
        </div>
      )}

      {horsBornes && (
        <p id={idAvertissement} className="flex items-start gap-2 text-sm text-warning-ink">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{messageHorsBornes(duree, props.annee.nom, props.annee.bornes)}</span>
        </p>
      )}

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium leading-none">Chaque année</legend>
        <RadioGroup
          value={recurrence ?? ""}
          onValueChange={(v) => setRecurrence(v === "DATE_FIXE" || v === "A_REVOIR_CHAQUE_ANNEE" ? v : null)}
          aria-describedby={`${base}-aide-recurrence`}
          className="gap-2"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem id={`${base}-fixe`} value="DATE_FIXE" disabled={duree === "periode"} />
            <Label htmlFor={`${base}-fixe`} className="font-normal">
              {LIBELLES_RECURRENCE.DATE_FIXE}
              {duree === "periode" && <span className="ml-2 text-xs text-muted-foreground">un seul jour seulement</span>}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem id={`${base}-revoir`} value="A_REVOIR_CHAQUE_ANNEE" />
            <Label htmlFor={`${base}-revoir`} className="font-normal">
              {LIBELLES_RECURRENCE.A_REVOIR_CHAQUE_ANNEE}
            </Label>
          </div>
        </RadioGroup>
        <p id={`${base}-aide-recurrence`} className="text-xs text-muted-foreground">
          Ce choix servira à préparer le calendrier de l&apos;année suivante ; il n&apos;a aucun effet pour
          l&apos;instant.
        </p>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor={`${base}-note`}>Note</Label>
        <Textarea
          id={`${base}-note`}
          value={note}
          maxLength={NOTE_MAX}
          aria-describedby={`${base}-consigne-note ${base}-compteur`}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex justify-between gap-4 text-xs text-muted-foreground">
          <p id={`${base}-consigne-note`}>Décrivez la vie de l&apos;école ; ne nommez aucun élève.</p>
          <p id={`${base}-compteur`} className="shrink-0 tabular-nums">
            {note.length} / {NOTE_MAX}
          </p>
        </div>
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
