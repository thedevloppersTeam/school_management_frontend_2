/**
 * Libellés de CLASSE et de SALLE — le point de composition unique.
 *
 * Fonction PURE, sans React ni fetch — même motif que `lib/academic-years/`.
 *
 * ── POURQUOI ELLE EXISTE ────────────────────────────────────────────────────
 * Dix-neuf endroits composaient « niveau + lettre » en UNE chaîne (« 1e AF A »)
 * là où l'utilisateur lit une donnée : cinq copies locales de la même logique,
 * huit littéraux écrits en dur, aucun composant partagé. Deux conséquences :
 *   - on ne peut ni trier, ni filtrer, ni relire la salle seule ;
 *   - les copies divergeaient (repli sur un code de filière ici, pas là) sans
 *     qu'aucune soit « en tort », faute de règle écrite.
 * La règle est désormais dans `DESIGN.md` (« La Règle des Deux Champs ») et son
 * application est ici.
 *
 * ── CE QU'ELLE REND, ET CE QU'ELLE NE REND PAS ──────────────────────────────
 * Elle rend DEUX valeurs distinctes, jamais une chaîne fusionnée. La fusion
 * reste légitime — valeur d'option de liste, clé de tri, nom de fichier
 * exporté, prose de confirmation — mais elle a déjà son point unique :
 * `getClassSessionName` (`lib/api/dashboard.ts`). Ce module ne la duplique pas.
 *
 * LA FILIÈRE N'EN SORT JAMAIS. Une salle n'a pas de filière : le modèle ne la
 * porte ni sur `Class` ni sur `ClassSession`. Elle vit sur l'inscription de
 * l'élève (`Enrollment.trackId`) et sur la matière (`ClassSubject.trackId`).
 * Une même salle héberge donc plusieurs filières. Le type d'entrée ci-dessous
 * ne déclare aucun champ `track` : c'est délibéré, un appelant qui passe un
 * littéral portant `track` est rejeté à la compilation plutôt que silencieux.
 *
 * `ClassSession.displayName` est ignoré pour la même raison : c'est une chaîne
 * déjà fusionnée, donc un transport de données déguisé en affichage.
 */

/** Les deux champs, toujours les deux, jamais concaténés. */
export interface LibelleClasseSalle {
  /** Le niveau, ex. « 1e AF ». Chaîne VIDE si inconnu — jamais un tiret. */
  classe: string
  /** La salle, ex. « A ». Chaîne VIDE si la classe n'en porte pas. */
  salle: string
}

/**
 * Forme minimale d'une `Class` hydratée. Volontairement structurelle : on ne
 * dépend d'aucune interface d'API précise, seulement de leur forme commune —
 * même parti pris que `lib/bulletin/from-api.ts`.
 */
export interface ClasseSource {
  letter?: string | null
  classType?: { name?: string | null } | null
}

/** Forme minimale d'une `ClassSession` hydratée. */
export interface SessionSource {
  class?: ClasseSource | null
}

/**
 * Le repli sur le vide est DÉLIBÉRÉ, et il n'est pas un défaut d'affichage.
 * Rendre « — » ici obligerait chaque écran à ré-analyser ce tiret pour savoir
 * s'il y a une donnée ou non ; le placeholder appartient à la vue, qui seule
 * sait dire « Aucune classe » plutôt que « — ».
 */
const EMPTY: LibelleClasseSalle = { classe: '', salle: '' }

const texte = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

export function libelleClasseSalle(
  source: ClasseSource | SessionSource | null | undefined,
): LibelleClasseSalle {
  if (!source || typeof source !== 'object') return { ...EMPTY }

  // Une session porte sa classe ; une classe se présente telle quelle.
  const classe: ClasseSource | null | undefined =
    'class' in source ? (source as SessionSource).class : (source as ClasseSource)

  if (!classe || typeof classe !== 'object') return { ...EMPTY }

  return {
    classe: texte(classe.classType?.name),
    salle: texte(classe.letter),
  }
}
