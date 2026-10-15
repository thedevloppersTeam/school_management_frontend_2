/**
 * Un jour marqué dans le calendrier du tableau de bord.
 *
 * `kind` n'a qu'une valeur : la table `holidays` du serveur ne porte aucun
 * champ de type (constat du 2026-10-15). Les congés vivent ailleurs — les
 * événements scolaires de type `holiday` — et sont exclus du widget.
 */
export type CalendarDayKind = 'ferie'

export interface CalendarDayEvent {
  /** Date civile `YYYY-MM-DD`. */
  date: string
  label: string
  kind: CalendarDayKind
}
