"use client"

/**
 * ClasseSalleSelect — choisir la CLASSE, puis la SALLE parmi les salles de
 * cette classe. Composant partagé des quatre onglets de notes (chantier W2, T2).
 *
 * CONTRÔLÉ : la page tient la sélection et la reçoit par `onChange`. Toute la
 * logique (tri, salle unique, « Toutes ») vit dans `lib/classes/selection.ts`,
 * testée sans React ; ce composant ne fait que la brancher sur deux listes.
 *
 * Rendu : deux champs frères (fragment), « Classe » et « Salle », chacun avec
 * son étiquette reliée au déclencheur. Ils prennent place dans la grille de
 * sélection de l'onglet, à côté de l'étape ou de la matière.
 *
 * Aucun libellé fusionné « 1e AF A » ici, y compris dans les options : DESIGN.md,
 * « La Règle des Deux Champs », exclusion propre aux pages de notes (D4).
 */
import { useId, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  memeSelection,
  optionsClasses,
  optionsSalles,
  selectionAffichee,
  selectionApresChoixClasse,
  selectionApresChoixSession,
  type ModeClasseSalle,
  type SelectionClasseSalle,
  type SessionClasseSalle,
} from "@/lib/classes/selection"

export interface ClasseSalleSelectProps {
  sessions: readonly SessionClasseSalle[]
  value: SelectionClasseSalle
  onChange: (next: SelectionClasseSalle) => void
  /**
   * - "selection" (défaut) : une salle précise est attendue. La liste Salle est
   *   désactivée, avec « Choisir une classe d'abord », tant qu'aucune classe
   *   n'est choisie ; la salle unique d'une classe est préremplie (D1).
   * - "filtre" : chaque liste commence par « Toutes », de valeur `null`. Classe
   *   « Toutes » : la liste Salle est désactivée et affiche « Toutes les
   *   salles ». Changer de classe remet la salle à « Toutes les salles ». La
   *   salle unique n'est jamais préremplie.
   */
  mode?: ModeClasseSalle
  /**
   * Garde facultative, même contrat que `guardContextChange` (grille de
   * saisie) : reçoit « de classe » ou « de salle » et la fonction qui applique
   * le changement. Si la garde ne l'appelle pas, rien ne change.
   */
  garde?: (libelle: string, appliquer: () => void) => void
  disabled?: boolean
  /** Données de l'onglet en cours de chargement : la liste Salle affiche « Chargement… ». */
  chargement?: boolean
}

/** Valeur interne de l'option « Toutes » : Radix refuse "" comme valeur d'option. */
const TOUTES = "__toutes__"

const LABEL_CLASS = "text-xs font-medium text-muted-foreground"

export function ClasseSalleSelect({
  sessions,
  value,
  onChange,
  mode = "selection",
  garde,
  disabled = false,
  chargement = false,
}: ClasseSalleSelectProps) {
  const idClasse = useId()
  const idSalle = useId()
  const filtre = mode === "filtre"

  const classes = useMemo(() => optionsClasses(sessions), [sessions])
  const affichee = useMemo(() => selectionAffichee(sessions, value), [sessions, value])
  const salles = useMemo(() => optionsSalles(sessions, affichee.classeId), [sessions, affichee.classeId])

  function proposer(libelle: string, suivante: SelectionClasseSalle) {
    if (memeSelection(suivante, affichee)) return
    const appliquer = () => onChange(suivante)
    if (garde) garde(libelle, appliquer)
    else appliquer()
  }

  function choisirClasse(v: string) {
    const classeId = v === TOUTES ? null : v
    proposer("de classe", selectionApresChoixClasse(sessions, affichee, classeId, mode))
  }

  function choisirSalle(v: string) {
    const sessionId = v === TOUTES ? null : v
    proposer("de salle", selectionApresChoixSession(sessions, affichee, sessionId))
  }

  const aucuneClasse = classes.length === 0
  const classeDesactivee = disabled || aucuneClasse
  const salleDesactivee = disabled || chargement || affichee.classeId === null

  // En filtre, « Toutes » est une valeur affichée ; en sélection, "" laisse le
  // déclencheur montrer son texte d'invite.
  const valeurClasse = affichee.classeId ?? (filtre ? TOUTES : "")
  const valeurSalle = affichee.sessionId ?? (filtre ? TOUTES : "")

  const inviteClasse = aucuneClasse ? "Aucune classe pour cette année" : "Sélectionner une classe"
  const inviteSalle = chargement
    ? "Chargement…"
    : affichee.classeId === null
      ? "Choisir une classe d'abord"
      : "Sélectionner une salle"

  return (
    <>
      <div className="space-y-1.5">
        <label htmlFor={idClasse} className={LABEL_CLASS}>Classe</label>
        <Select value={valeurClasse} onValueChange={choisirClasse} disabled={classeDesactivee}>
          <SelectTrigger id={idClasse}>
            <SelectValue placeholder={inviteClasse} />
          </SelectTrigger>
          <SelectContent>
            {filtre && <SelectItem value={TOUTES}>Toutes les classes</SelectItem>}
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id} title={c.nom}>
                <span className="block max-w-[16rem] truncate">{c.nom}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={idSalle} className={LABEL_CLASS}>Salle</label>
        <Select value={valeurSalle} onValueChange={choisirSalle} disabled={salleDesactivee}>
          <SelectTrigger id={idSalle}>
            <SelectValue placeholder={inviteSalle} />
          </SelectTrigger>
          <SelectContent>
            {filtre && <SelectItem value={TOUTES}>Toutes les salles</SelectItem>}
            {salles.map((s) => (
              <SelectItem key={s.sessionId} value={s.sessionId}>
                {s.lettre || "—"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  )
}
