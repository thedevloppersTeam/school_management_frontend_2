/**
 * lib/api/step-exclusions.ts
 *
 * Dispenses de sous-matiere d'une salle, pour UNE etape.
 *
 * Extrait de lib/api/bulletin.ts, ou la fonction et son cache etaient prives.
 * Le bulletin n'est plus seul a en avoir besoin : le chemin annuel normatif
 * les relit etape par etape, et le releve de notes les relira de meme. Le
 * cache voyage avec la fonction — c'est lui qui evite de redemander la meme
 * (salle, etape) a chaque eleve d'un lot de trente.
 *
 * Extraction, pas copie : bulletin.ts importe d'ici et ne garde aucune
 * seconde implementation. `invalidateExclusionsCache` reste re-exporte par
 * lib/api/bulletin.ts pour que ses appelants existants ne bougent pas.
 */

import { WHOLE_SUBJECT } from '@/lib/bulletin/from-api'
import { safeFetch } from '@/lib/api/safe-fetch'

/**
 * Cle LOCALE d'une dispense : l'eleve est porte par la Map, l'etape par la
 * requete. Deux parties seulement, donc — `lib/bulletin/from-api` en attend
 * trois et le prefixage se fait chez l'appelant.
 *
 * WHOLE_SUBJECT vient de from-api : une seule sentinelle pour les deux schemas
 * de cle, celui d'ici et celui du module de calcul. Elle est le pendant de
 * grades.section_id IS NULL, qui signifie « note globale » — les classes
 * d'examen (9e, NS4) notent la matiere sans sous-matieres, et la dispense doit
 * alors porter sur la matiere entiere.
 */
export function exclusionKey(classSubjectId: string, sectionId: string | null): string {
  return `${classSubjectId}::${sectionId ?? WHOLE_SUBJECT}`
}

/** enrollmentId -> ensemble des cles locales de dispense. */
export type SessionStepExclusions = Map<string, Set<string>>

const exclusionsCache = new Map<string, Promise<SessionStepExclusions>>()

/** À appeler après l'enregistrement ou la suppression d'une dispense. */
export function invalidateExclusionsCache(classSessionId?: string, stepId?: string): void {
  if (!classSessionId) { exclusionsCache.clear(); return }
  if (stepId) { exclusionsCache.delete(`${classSessionId}:${stepId}`); return }
  for (const k of exclusionsCache.keys()) {
    if (k.startsWith(`${classSessionId}:`)) exclusionsCache.delete(k)
  }
}

export function fetchSessionStepExclusions(
  classSessionId: string,
  stepId: string,
): Promise<SessionStepExclusions> {
  const cacheKey = `${classSessionId}:${stepId}`
  const cached = exclusionsCache.get(cacheKey)
  if (cached) return cached

  const promise = (async () => {
    // Le backend renvoie les QUATRE parties de la clé. Le type les déclare
    // toutes : en n'en déclarant que deux, classSubjectId arrivait et était
    // silencieusement jeté.
    const rows = await safeFetch<
      Array<{
        enrollmentId: string
        classSubjectId: string
        sectionId: string | null
        stepId?: string
      }>
    >(
      `/api/enrollments/excluded-sections?classSessionId=${classSessionId}&stepId=${stepId}`,
      [],
    )
    const map: SessionStepExclusions = new Map()
    for (const row of rows) {
      // Une dispense sans portee ne peut pas etre appliquee : sans
      // classSubjectId on ne sait pas SUR QUELLE affectation elle porte.
      // Signale au lieu d'absorber en silence.
      if (!row.classSubjectId) {
        console.warn(
          `[dispenses] ligne ignoree : classSubjectId absent (eleve ${row.enrollmentId}, ` +
          `section ${row.sectionId}). Dispense sans portee dans ` +
          `enrollment_section_exclusions.`,
        )
        continue
      }
      if (!map.has(row.enrollmentId)) map.set(row.enrollmentId, new Set())
      map.get(row.enrollmentId)!.add(exclusionKey(row.classSubjectId, row.sectionId))
    }
    return map
  })()

  exclusionsCache.set(cacheKey, promise)
  return promise
}
