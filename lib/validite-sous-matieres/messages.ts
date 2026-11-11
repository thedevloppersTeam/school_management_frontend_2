/**
 * Validité annuelle des sous-matières — refus du serveur traduits en français
 * simple (docs/SPEC-VALIDITE-SOUS-MATIERES.md v1.1 § 6 et § 8 ; fonctions
 * pures).
 *
 * Codes : SECTION_HORS_VIGUEUR (note ou dispense sur une sous-matière hors
 * vigueur), MATIERE_HORS_VIGUEUR (première note de matière entière sur une
 * matière masquée), ANNEE_INCONNUE, VALIDITE_PERIODE_INVERSEE,
 * VALIDITE_INVALIDE, VALIDITE_EXCLUT_NOTES. Formes des corps : serveur,
 * src/controllers/grades.ts, enrollments.ts et subjectSections.ts.
 *
 * Textes fixes, comme lib/errors.ts : rien n'est recopié du message du
 * serveur. Seuls entrent un nombre (taille de `entries` ou de `sectionIds`)
 * et, pour VALIDITE_EXCLUT_NOTES, les années scolaires de `annees` au format
 * AAAA-AAAA (aucune donnée d'élève).
 */

const OU_REGLER = 'Sa période se règle dans Paramétrage → Établissement → Matières.'

export const MESSAGES_VALIDITE: Record<string, string> = {
  SECTION_HORS_VIGUEUR:
    'Cette sous-matière n’est pas enseignée cette année (hors de sa période de vigueur) : aucune note ni dispense ne peut y être ajoutée. ' +
    OU_REGLER,
  MATIERE_HORS_VIGUEUR:
    'Cette matière n’est plus enseignée cette année : aucune note ne peut y être ajoutée (aucune de ses sous-matières n’est en vigueur pour l’année de cette classe).',
  ANNEE_INCONNUE: 'Une année choisie pour la période n’existe plus : rechargez la page puis choisissez à nouveau.',
  VALIDITE_PERIODE_INVERSEE:
    'Période refusée : « En vigueur à partir de » est postérieure à « jusqu’à ». Choisissez une fin égale ou postérieure au début.',
  VALIDITE_INVALIDE:
    'Période refusée : une borne envoyée n’est pas une année scolaire. Rechargez la page puis choisissez à nouveau.',
  VALIDITE_EXCLUT_NOTES:
    'Une période ne peut pas exclure des notes déjà saisies : des notes ou des dispenses existent sur cette sous-matière hors de la nouvelle période. Elles ne sont jamais supprimées : élargissez la période.',
}

/** Objet du lot, au singulier et au pluriel, par code. */
const LOT: Record<string, { un: string; plusieurs: string }> = {
  MATIERE_HORS_VIGUEUR: {
    un: 'saisie porte sur une matière qui n’est plus enseignée cette année',
    plusieurs: 'saisies portent sur une matière qui n’est plus enseignée cette année',
  },
  SECTION_HORS_VIGUEUR: {
    un: 'saisie porte sur une sous-matière qui n’est pas enseignée cette année',
    plusieurs: 'saisies portent sur une sous-matière qui n’est pas enseignée cette année',
  },
}

const ANNEE = /^\d{4}-\d{4}$/

function champ(body: object, nom: string): unknown {
  return (body as Record<string, unknown>)[nom]
}

/**
 * Message pour un corps d'erreur dont le `code` relève de la validité annuelle,
 * sinon null (l'appelant garde sa traduction habituelle).
 */
export function messageValidite(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const code = champ(body, 'code')
  if (typeof code !== 'string' || !(code in MESSAGES_VALIDITE)) return null

  // Saisie en lot : tout le lot est refusé, `entries` liste les saisies en cause.
  const entries = champ(body, 'entries')
  if (LOT[code] && Array.isArray(entries) && entries.length > 0) {
    const n = entries.length
    return `Lot refusé, aucune note enregistrée : ${n} ${n > 1 ? LOT[code].plusieurs : LOT[code].un}.`
  }

  // Dispense : le serveur liste les sous-matières en cause dans `sectionIds`.
  const sectionIds = champ(body, 'sectionIds')
  if (code === 'SECTION_HORS_VIGUEUR' && Array.isArray(sectionIds) && sectionIds.length > 0) {
    return sectionIds.length > 1
      ? `Dispense refusée : ${sectionIds.length} sous-matières ne sont pas enseignées cette année (hors de leur période de vigueur). ` +
          'Leur période se règle dans Paramétrage → Établissement → Matières.'
      : `Dispense refusée : cette sous-matière n’est pas enseignée cette année (hors de sa période de vigueur). ${OU_REGLER}`
  }

  // Période qui exclurait des notes ou des dispenses : années en cause, si lisibles.
  if (code === 'VALIDITE_EXCLUT_NOTES') {
    const annees = champ(body, 'annees')
    const libelles = (Array.isArray(annees) ? annees : [])
      .map((a) => (a && typeof a === 'object' ? champ(a, 'yearString') : undefined))
      .filter((y): y is string => typeof y === 'string' && ANNEE.test(y))
    if (libelles.length > 0 && Array.isArray(annees) && libelles.length === annees.length) {
      return (
        'Une période ne peut pas exclure des notes déjà saisies : des notes ou des dispenses existent sur cette sous-matière en ' +
        `${libelles.join(', ')}. Elles ne sont jamais supprimées : élargissez la période pour inclure ces années.`
      )
    }
  }

  return MESSAGES_VALIDITE[code]
}
