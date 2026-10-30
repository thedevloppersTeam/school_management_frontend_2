/**
 * Compte rendu d'un enregistrement de notes, tel que le serveur le décrit.
 *
 * Une note par case (ADR-009 § 5) : POST /api/grades/bulk-create crée la note
 * d'une case vide et REMPLACE celle d'une case qui en porte déjà une (écran
 * périmé, deux onglets). La réponse dit combien de chaque : `created`,
 * `replaced`. Ces compteurs sont affichés tels quels, jamais recalculés.
 *
 * Fonctions pures, sans React ni DOM.
 */

export interface BulkCreateCounts {
  created: number
  replaced: number
}

function isCount(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0
}

/**
 * Lit `created` et `replaced` dans la réponse de bulk-create. null si l'un des
 * deux manque ou n'est pas un entier positif (serveur antérieur) : l'écran garde
 * alors son ancien message.
 */
export function readBulkCreateCounts(body: unknown): BulkCreateCounts | null {
  if (!body || typeof body !== 'object') return null
  const { created, replaced } = body as { created?: unknown; replaced?: unknown }
  if (!isCount(created) || !isCount(replaced)) return null
  return { created, replaced }
}

/**
 * Partie « notes du lot » d'un message de succès.
 *
 *  - `counts` null (ancien serveur) : exactement l'ancien texte, sur le nombre
 *    de saisies envoyées (« 3 notes créées », ou « 3 créées » sans le nom) ;
 *  - sinon : les compteurs du serveur, la partie à 0 omise
 *    (« 3 notes créées », « 1 note remplacée »).
 *
 * `withNoun` : la grille par matière écrit « 3 notes créées », la saisie par
 * élève « 3 créées » ; chaque écran garde sa forme.
 */
export function bulkCreateParts(
  requested: number,
  counts: BulkCreateCounts | null,
  withNoun: boolean,
): string[] {
  const part = (n: number, participle: string) => {
    const s = n > 1 ? 's' : ''
    return withNoun ? `${n} note${s} ${participle}${s}` : `${n} ${participle}${s}`
  }

  if (counts === null) {
    return requested > 0 ? [part(requested, 'créée')] : []
  }

  const parts: string[] = []
  if (counts.created > 0) parts.push(part(counts.created, 'créée'))
  if (counts.replaced > 0) parts.push(part(counts.replaced, 'remplacée'))
  return parts
}
