/**
 * Sélection de la CLASSE puis de la SALLE — la logique, sans React.
 *
 * Fonctions PURES, même motif que `lib/classes/labels.ts` : elles ne font ni
 * fetch ni rendu, et elles sont testées seules (`__tests__/selection.test.ts`).
 * Le composant `components/school/classe-salle-select.tsx` ne fait que les
 * brancher sur deux listes.
 *
 * ── POURQUOI ELLES EXISTENT ─────────────────────────────────────────────────
 * Les pages de notes avaient trois copies de la même cascade Classe → Salle
 * (Saisie par matière, Saisie par élève, Comportement), qui divergeaient : tri
 * alphabétique ici, numérique là, ordre du serveur ailleurs ; remise à zéro de
 * la salle signalée au parent dans une copie, pas dans les autres. Chantier W2,
 * décisions D1 à D8 (`docs/DECISIONS.md` D-38).
 *
 * ── CE QUI EST SÉLECTIONNÉ ──────────────────────────────────────────────────
 * La « classe » est le niveau (`ClassType`, ex. « 1e AF »). La « salle » choisie
 * est une `ClassSession` — la salle (`Class`, une lettre) POUR l'année affichée.
 * D'où `sessionId`, et non un identifiant de la table `classes`.
 *
 * ── LIBELLÉS ────────────────────────────────────────────────────────────────
 * La lettre de salle passe par `libelleClasseSalle`, le point de composition
 * unique (DESIGN.md, « La Règle des Deux Champs »). Rien n'est fusionné ici.
 */
import { libelleClasseSalle } from './labels'

/**
 * Forme minimale d'une session de classe. Structurelle : `ClassSession`
 * (`lib/api/dashboard.ts`) et `ApiClassSession` (`lib/api/students.ts`) y
 * entrent toutes deux. `levelOrder` est facultatif : le second type ne le
 * déclare pas, bien que `GET /api/class-sessions` le renvoie.
 */
export interface SessionClasseSalle {
  id: string
  class: {
    letter?: string | null
    classType: { id: string; name: string; levelOrder?: number | null }
  }
}

/** `sessionId` est l'identifiant d'une ClassSession (salle × année), pas d'une Class. */
export interface SelectionClasseSalle {
  /** `ClassType.id`. `null` : aucune classe (ou « Toutes » en mode filtre). */
  classeId: string | null
  /** `ClassSession.id`. `null` : aucune salle (ou « Toutes » en mode filtre). Jamais "". */
  sessionId: string | null
}

/**
 * - `selection` : il faut une salle précise (Saisie, Consultation, Comportement).
 * - `filtre` : « Toutes » est une valeur à part entière (Avancement, D3).
 */
export type ModeClasseSalle = 'selection' | 'filtre'

export const SELECTION_VIDE: SelectionClasseSalle = Object.freeze({ classeId: null, sessionId: null })

export interface OptionClasse {
  id: string
  nom: string
}

export interface OptionSalle {
  sessionId: string
  /** Lettre de la salle, ex. « A ». Chaîne VIDE si la salle n'en porte pas. */
  lettre: string
}

const texte = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

const comparerNoms = (a: string, b: string) => a.localeCompare(b, 'fr', { numeric: true })

/** Une session sans classe exploitable est ignorée plutôt que de faire échouer la liste. */
function classeDe(s: SessionClasseSalle | null | undefined) {
  const ct = s?.class?.classType
  return ct && typeof ct.id === 'string' && ct.id !== '' ? ct : null
}

/**
 * Classes présentes dans les sessions, sans doublon. Ordre (D2) : `levelOrder`
 * croissant ; puis les niveaux sans `levelOrder`, par nom (fr, numérique).
 */
export function optionsClasses(sessions: readonly SessionClasseSalle[]): OptionClasse[] {
  const vues = new Map<string, { id: string; nom: string; rang: number | null }>()
  for (const s of sessions) {
    const ct = classeDe(s)
    if (!ct || vues.has(ct.id)) continue
    const rang = typeof ct.levelOrder === 'number' && Number.isFinite(ct.levelOrder) ? ct.levelOrder : null
    vues.set(ct.id, { id: ct.id, nom: texte(ct.name), rang })
  }
  return [...vues.values()]
    .sort((a, b) => {
      if (a.rang !== null && b.rang !== null && a.rang !== b.rang) return a.rang - b.rang
      if (a.rang !== null && b.rang === null) return -1
      if (a.rang === null && b.rang !== null) return 1
      return comparerNoms(a.nom, b.nom) || comparerNoms(a.id, b.id)
    })
    .map(({ id, nom }) => ({ id, nom }))
}

/** Salles d'une classe, par lettre (fr, numérique). Sans classe : liste vide. */
export function optionsSalles(sessions: readonly SessionClasseSalle[], classeId: string | null): OptionSalle[] {
  if (classeId === null) return []
  return sessions
    .filter((s) => classeDe(s)?.id === classeId)
    .map((s) => ({ sessionId: s.id, lettre: libelleClasseSalle(s).salle }))
    .sort((a, b) => comparerNoms(a.lettre, b.lettre) || comparerNoms(a.sessionId, b.sessionId))
}

/**
 * Sélection complète à partir d'une seule session (ex. navigation Avancement →
 * Saisie). Session inconnue ou `null` : `SELECTION_VIDE`.
 */
export function selectionDepuisSession(
  sessions: readonly SessionClasseSalle[],
  sessionId: string | null,
): SelectionClasseSalle {
  if (sessionId === null) return SELECTION_VIDE
  const s = sessions.find((x) => x.id === sessionId)
  const ct = classeDe(s)
  return s && ct ? { classeId: ct.id, sessionId: s.id } : SELECTION_VIDE
}

/**
 * Ce que l'écran doit montrer pour `value`, rendu cohérent avec `sessions` :
 * - une session connue impose sa classe ;
 * - une session inconnue (sessions pas encore chargées, autre année) est
 *   montrée vide, sans erreur ;
 * - une classe inconnue est montrée vide.
 */
export function selectionAffichee(
  sessions: readonly SessionClasseSalle[],
  value: SelectionClasseSalle,
): SelectionClasseSalle {
  if (value.sessionId !== null) {
    const depuisSession = selectionDepuisSession(sessions, value.sessionId)
    if (depuisSession.sessionId !== null) return depuisSession
  }
  if (value.classeId !== null && sessions.some((s) => classeDe(s)?.id === value.classeId)) {
    return { classeId: value.classeId, sessionId: null }
  }
  return SELECTION_VIDE
}

/**
 * Sélection après un choix de classe.
 * - Même classe que l'actuelle : rien ne change (la salle choisie reste).
 * - `null` (« Toutes » ou aucune) : tout est remis à `null`.
 * - Mode `selection` : la salle est préremplie si la classe n'en a qu'une (D1),
 *   sinon elle est vide.
 * - Mode `filtre` : la salle revient à « Toutes » (`null`), jamais préremplie —
 *   D1 ne s'applique qu'au mode `selection`.
 */
export function selectionApresChoixClasse(
  sessions: readonly SessionClasseSalle[],
  courante: SelectionClasseSalle,
  classeId: string | null,
  mode: ModeClasseSalle = 'selection',
): SelectionClasseSalle {
  if (classeId === courante.classeId) return courante
  if (classeId === null) return SELECTION_VIDE
  if (mode === 'filtre') return { classeId, sessionId: null }
  const salles = optionsSalles(sessions, classeId)
  return { classeId, sessionId: salles.length === 1 ? salles[0].sessionId : null }
}

/**
 * Sélection après un choix de salle (`null` = « Toutes », en mode filtre).
 * Une salle qui n'appartient pas à la classe courante est ignorée : la liste
 * Salle ne propose que les salles de la classe choisie.
 */
export function selectionApresChoixSession(
  sessions: readonly SessionClasseSalle[],
  courante: SelectionClasseSalle,
  sessionId: string | null,
): SelectionClasseSalle {
  if (courante.classeId === null) return courante
  if (sessionId === null) return { classeId: courante.classeId, sessionId: null }
  const appartient = optionsSalles(sessions, courante.classeId).some((o) => o.sessionId === sessionId)
  return appartient ? { classeId: courante.classeId, sessionId } : courante
}

/**
 * Ce qu'un écran doit faire de ses données quand la sélection change
 * (chantier W2, PR 2 : défauts 1 et 2 de l'audit).
 *
 * - `viderAvant` : effacer d'abord tout ce qui appartient à la salle
 *   précédente (matière choisie, notes, matières, inscriptions). C'est vrai
 *   pour TOUT changement de salle, y compris quand une autre salle va être
 *   chargée : à aucun moment l'en-tête d'une salle ne doit côtoyer la matière
 *   ou les notes d'une autre.
 * - `charger` : la session à charger ensuite, ou `null` s'il n'y a rien à
 *   charger. Jamais une chaîne vide.
 */
export interface EffetChangementSalle {
  viderAvant: boolean
  charger: string | null
}

const AUCUN_EFFET: EffetChangementSalle = Object.freeze({ viderAvant: false, charger: null })

/**
 * Effet d'un passage de `avant` à `apres` sur les données de l'écran.
 * - Même salle : rien (un changement de classe sans salle, de « aucune » à
 *   « aucune », ne recharge rien non plus).
 * - Plus de salle (classe à plusieurs salles, ou « Toutes ») : vider, sans charger.
 * - Autre salle (choix de salle, salle unique préremplie, navigation depuis
 *   Avancement) : vider, PUIS charger la nouvelle salle.
 */
export function effetChangementSalle(
  avant: SelectionClasseSalle,
  apres: SelectionClasseSalle,
): EffetChangementSalle {
  const cible = apres.sessionId === '' ? null : apres.sessionId
  const courante = avant.sessionId === '' ? null : avant.sessionId
  if (cible === courante) return AUCUN_EFFET
  return { viderAvant: true, charger: cible }
}

/** Deux sélections désignent-elles la même chose ? */
export function memeSelection(a: SelectionClasseSalle, b: SelectionClasseSalle): boolean {
  return a.classeId === b.classeId && a.sessionId === b.sessionId
}
