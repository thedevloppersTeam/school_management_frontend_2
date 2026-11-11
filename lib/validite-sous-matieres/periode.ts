/**
 * Validité annuelle des sous-matières — période de vigueur, côté écran
 * (docs/SPEC-VALIDITE-SOUS-MATIERES.md v1.1, D-O5 ; fonctions pures, sans
 * React ni fetch).
 *
 * Une sous-matière porte deux bornes, validFromYearId (« En vigueur à partir
 * de ») et validUntilYearId (« jusqu'à ») : identifiants d'années scolaires,
 * ou null = sans limite. L'ordre de deux années est celui de leurs dates de
 * début, comme côté serveur (src/modules/programme/domain/vigueur.ts) ; la
 * validation ici ne fait qu'éviter un aller-retour, le serveur reste juge
 * (400 VALIDITE_PERIODE_INVERSEE).
 */

/** Valeur des listes « Sans limite » : aucun identifiant d'année ne peut la prendre. */
export const SANS_LIMITE = 'sans-limite'

export interface AnneeScolaire {
  id: string
  yearString: string
  /** Libellé affiché : yearString (ex. 2026-2027). */
  libelle: string
  /** Date de début, ISO ; sert au tri et à la comparaison des bornes. */
  startDate: string
}

export interface Bornes {
  validFromYearId?: string | null
  validUntilYearId?: string | null
}

const debut = (a: AnneeScolaire) => Date.parse(a.startDate)

/**
 * Années de GET /api/academic-years, triées par date de début croissante
 * (le serveur les rend par yearString décroissant). Entrée sans id, sans
 * yearString ou sans date de début lisible : écartée.
 */
export function anneesTriees(raw: unknown): AnneeScolaire[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
    .filter((a) => typeof a.id === 'string' && a.id !== '' && typeof a.yearString === 'string' && a.yearString !== '')
    .filter((a) => typeof a.startDate === 'string' && !Number.isNaN(Date.parse(a.startDate)))
    .map((a) => ({
      id: a.id as string,
      yearString: a.yearString as string,
      libelle: a.yearString as string,
      startDate: a.startDate as string,
    }))
    .sort((a, b) => debut(a) - debut(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** Borne reçue (null, absente ou id) → valeur de la liste. */
export function borneVersChoix(borne: string | null | undefined): string {
  return typeof borne === 'string' && borne !== '' ? borne : SANS_LIMITE
}

/** Valeur de la liste → borne envoyée au serveur. */
export function choixVersBorne(choix: string): string | null {
  return choix === SANS_LIMITE ? null : choix
}

function libelleDe(id: string, annees: AnneeScolaire[]): string {
  return annees.find((a) => a.id === id)?.libelle ?? 'une année introuvable'
}

/**
 * Période courte, pour une liste (Paramétrage → Relevé) : « depuis 2026-2027 »,
 * « jusqu'à 2025-2026 », « de … à … », « en … seulement » ; chaîne vide si
 * sans limite. Une année inconnue est signalée, jamais devinée.
 */
export function libellePeriode(bornes: Bornes, annees: AnneeScolaire[]): string {
  const de = bornes.validFromYearId || null
  const a = bornes.validUntilYearId || null
  if (!de && !a) return ''
  if (de && a) {
    if (de === a) return `en ${libelleDe(de, annees)} seulement`
    return `de ${libelleDe(de, annees)} à ${libelleDe(a, annees)}`
  }
  return de ? `depuis ${libelleDe(de, annees)}` : `jusqu’à ${libelleDe(a as string, annees)}`
}

/** Période actuelle, en phrase, pour la fenêtre de la sous-matière. */
export function libellePeriodeActuelle(bornes: Bornes, annees: AnneeScolaire[]): string {
  const court = libellePeriode(bornes, annees)
  return court ? `En vigueur ${court}` : 'En vigueur toutes les années (sans limite)'
}

/**
 * Contrôle de l'écran avant envoi : début ≤ fin (par date de début). Rend le
 * message à afficher, ou null si la période est acceptable.
 */
export function validerPeriode(choixDe: string, choixJusqua: string, annees: AnneeScolaire[]): string | null {
  const de = choixVersBorne(choixDe)
  const a = choixVersBorne(choixJusqua)
  const anneeDe = de ? annees.find((x) => x.id === de) : undefined
  const anneeA = a ? annees.find((x) => x.id === a) : undefined
  if ((de && !anneeDe) || (a && !anneeA)) return 'Une année choisie n’existe plus : rechargez la page.'
  if (anneeDe && anneeA && debut(anneeDe) > debut(anneeA)) {
    return (
      `« En vigueur à partir de » (${anneeDe.libelle}) est postérieure à « jusqu’à » (${anneeA.libelle}) : ` +
      'choisissez une fin égale ou postérieure au début.'
    )
  }
  return null
}
