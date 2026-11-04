/**
 * Compte rendu de POST /api/students/delete, élève par élève.
 *
 * Le serveur répond 200 avec `results[]` : `{ studentId, status, code?,
 * message? }`. Un élève qui a un historique scolaire (note, bulletin archivé ou
 * décision de promotion) est refusé avec le code STUDENT_HAS_ACADEMIC_HISTORY
 * (ADR-013 § 5) : la suppression est réservée aux erreurs de saisie, un élève
 * qui a un parcours relève du départ.
 *
 * Un élève qui figure dans un rapport MENFP gelé est refusé avec le code
 * STUDENT_IN_FROZEN_MENFP_REPORT (SPEC-MENFP M-56, lot 4B) : il faut d'abord
 * purger les rapports de sa salle, sur l'écran Liste MENFP.
 *
 * Fonctions pures, sans React ni DOM.
 */
import { adresseListeMenfp } from '@/lib/menfp/liens'

export const STUDENT_HAS_ACADEMIC_HISTORY = 'STUDENT_HAS_ACADEMIC_HISTORY'

/**
 * Motif affiché si le serveur refuse pour historique sans fournir de message.
 * Même forme que le message du serveur : motif, puis invitation au départ.
 */
export const ACADEMIC_HISTORY_REASON =
  "Suppression refusée : l'élève a un historique scolaire (notes, bulletins archivés ou décisions de promotion). Déclarez plutôt son départ."

/** Où déclarer le départ, affiché sous le motif d'un refus pour historique. */
export const DECLARE_DEPARTURE_HINT =
  "Pour le retirer de l'effectif : liste des élèves de l'année, action « Déclarer un départ »."

export const STUDENT_IN_FROZEN_MENFP_REPORT = 'STUDENT_IN_FROZEN_MENFP_REPORT'

/** Motif affiché si le serveur refuse pour rapport MENFP gelé sans fournir de message. */
export const FROZEN_MENFP_REPORT_REASON =
  "Suppression refusée : l'élève figure dans un rapport MENFP gelé. Purgez d'abord les rapports MENFP de sa salle (écran de préparation de la liste MENFP)."

const UNKNOWN_REASON = 'Échec de la suppression (motif non précisé par le serveur).'

export interface DeleteFailure {
  studentId: string
  /** « NOM Prénom », ou l'identifiant si l'élève n'est plus dans la liste. */
  name: string
  reason: string
  /** Invitation à déclarer un départ (refus pour historique scolaire). */
  hint?: string
  /** Écran où lever le refus (rapport MENFP gelé : écran Liste MENFP). */
  link?: { href: string; label: string }
}

interface DeleteResult {
  studentId?: unknown
  status?: unknown
  code?: unknown
  message?: unknown
}

/**
 * Échecs d'une suppression, dans l'ordre de la réponse. `nameOf` rend le nom
 * affiché d'un élève à partir de son identifiant (null s'il est inconnu).
 *
 *  - STUDENT_HAS_ACADEMIC_HISTORY : le message du serveur (français, avec les
 *    nombres qu'il a comptés), ou ACADEMIC_HISTORY_REASON s'il manque, plus
 *    l'invitation à déclarer un départ ;
 *  - STUDENT_IN_FROZEN_MENFP_REPORT : le message du serveur, ou
 *    FROZEN_MENFP_REPORT_REASON, plus un lien vers l'écran Liste MENFP ;
 *  - tout autre échec : le motif reçu.
 */
export function deleteFailures(
  body: unknown,
  nameOf: (studentId: string) => string | null,
): DeleteFailure[] {
  const results = (body as { results?: unknown } | null)?.results
  if (!Array.isArray(results)) return []

  const failures: DeleteFailure[] = []
  for (const raw of results as DeleteResult[]) {
    if (!raw || typeof raw !== 'object' || raw.status !== 'error') continue
    const studentId = typeof raw.studentId === 'string' ? raw.studentId : ''
    const message = typeof raw.message === 'string' && raw.message.trim() ? raw.message.trim() : null
    const name = (studentId && nameOf(studentId)) || studentId || 'Élève inconnu'

    if (raw.code === STUDENT_HAS_ACADEMIC_HISTORY) {
      failures.push({ studentId, name, reason: message ?? ACADEMIC_HISTORY_REASON, hint: DECLARE_DEPARTURE_HINT })
    } else if (raw.code === STUDENT_IN_FROZEN_MENFP_REPORT) {
      failures.push({
        studentId,
        name,
        reason: message ?? FROZEN_MENFP_REPORT_REASON,
        link: { href: adresseListeMenfp(), label: 'Ouvrir Liste MENFP' },
      })
    } else {
      failures.push({ studentId, name, reason: message ?? UNKNOWN_REASON })
    }
  }
  return failures
}
