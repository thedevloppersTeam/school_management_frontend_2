/**
 * Nom de la prochaine année scolaire.
 *
 * Fonction PURE, sans React ni fetch — c'est ce qui la rend testable, et la
 * raison pour laquelle elle vit ici plutôt que dans le modal.
 *
 * ── LE DÉFAUT QU'ELLE CORRIGE ──────────────────────────────────────────────
 * Le nom proposé était dérivé de l'année ACTIVE, +1. Or créer une année ne la
 * rend pas courante (`isCurrent: false` à la création, par choix : l'activation
 * est un geste distinct). L'année active ne bougeait donc jamais, et le modal
 * reproposait indéfiniment le même nom — déjà pris dès la première création.
 * L'écran répondait 409 à perpétuité, sans aucun moyen d'en sortir : le champ
 * est en lecture seule.
 *
 * La source juste n'est pas « l'année courante » mais « la dernière année
 * connue », courante ou non. On prend donc le MAXIMUM des années existantes.
 *
 * ── CE QUE LA FONCTION NE SAIT PAS FAIRE ───────────────────────────────────
 * Elle ne comble pas les trous. Si 2024-2025 et 2026-2027 existent mais pas
 * 2025-2026, elle propose 2027-2028, jamais l'année manquante. C'est cohérent
 * avec un champ en lecture seule : créer une année passée est un cas qui
 * demanderait de rendre le champ saisissable, ce qui est une décision produit.
 */

/** Forme attendue d'un libellé d'année : deux millésimes consécutifs. */
const ANNEE_RE = /^(\d{4})-(\d{4})$/

/**
 * Millésime de début d'un libellé, ou `null` si le libellé n'a pas la forme
 * attendue. Les libellés hors format sont ignorés plutôt que devinés : une
 * année nommée « Rattrapage » ne doit pas décaler le calcul.
 */
export function anneeDeDebut(libelle: string | null | undefined): number | null {
  if (typeof libelle !== 'string') return null
  const m = ANNEE_RE.exec(libelle.trim())
  if (!m) return null
  const debut = Number(m[1])
  const fin = Number(m[2])
  // « 2026-2030 » n'est pas une année scolaire : les deux millésimes doivent
  // se suivre. Sans ce contrôle, une saisie aberrante déjà en base ferait
  // dérailler toutes les propositions suivantes.
  if (fin !== debut + 1) return null
  return debut
}

/** Libellé d'une année scolaire à partir de son millésime de début. */
export const libelleAnnee = (debut: number): string => `${debut}-${debut + 1}`

/**
 * Prochain libellé disponible, à partir des libellés déjà en base.
 *
 * @param existants libellés existants (`yearString`, ou `name` à défaut)
 * @returns le libellé suivant le plus grand millésime connu ; à défaut,
 *          l'année scolaire qui court à la date du jour
 */
export function prochainNomAnnee(
  existants: ReadonlyArray<string | null | undefined>,
  aujourdHui: Date = new Date(),
): string {
  const debuts = existants
    .map(anneeDeDebut)
    .filter((n): n is number => n !== null)

  if (debuts.length > 0) {
    return libelleAnnee(Math.max(...debuts) + 1)
  }

  // Aucune année exploitable : on repart de l'année scolaire en cours. Elle
  // commence en septembre — avant septembre, on est encore sur l'année
  // ouverte l'automne précédent.
  const annee = aujourdHui.getFullYear()
  const debut = aujourdHui.getMonth() >= 8 ? annee : annee - 1
  return libelleAnnee(debut)
}
