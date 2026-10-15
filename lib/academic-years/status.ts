/**
 * Statut d'affichage d'une année scolaire.
 *
 * Fonction PURE, sans React ni fetch — même motif que `next-name.ts`.
 *
 * ── POURQUOI ELLE EXISTE ────────────────────────────────────────────────────
 * La règle était recopiée à CINQ endroits, et une seule des copies portait la
 * garde `NaN` : les quatre autres classaient en « preparation » une année dont
 * la date de fin était illisible, par accident de comparaison — `NaN < x` est
 * toujours faux. La version conservée ici est celle de
 * `app/admin/academic-years/page.tsx`, la seule qui traitait ce cas.
 *
 * ── CE QUE LE STATUT EST, ET N'EST PAS ──────────────────────────────────────
 * C'est une INFÉRENCE DE DATE, pas un état de registre. La base ne porte
 * aucune colonne de statut : `academic_years` n'a que `is_current`. Une année
 * réellement close avant son terme, ou prolongée, sera donc mal classée.
 * Le champ de statut explicite côté backend est le correctif de fond —
 * chantier ouvert, voir `docs/BACKLOG.md`.
 *
 * `isCurrent` PRIME sur la date : l'année active reste active même si sa date
 * de fin est passée. C'est l'administratrice qui bascule, pas le calendrier.
 */

export type AcademicYearStatus = 'active' | 'preparation' | 'archived'

/** Forme minimale exigée : on ne dépend pas de l'interface complète. */
export interface AcademicYearStatusInput {
  isCurrent: boolean
  endDate: string | Date
}

export function deriveAcademicYearStatus(
  year: AcademicYearStatusInput,
  maintenant: Date = new Date(),
): AcademicYearStatus {
  if (year.isCurrent) return 'active'

  const fin = year.endDate instanceof Date ? year.endDate : new Date(year.endDate)

  // La garde `NaN` est le cœur de cette consolidation. Sans elle, une date
  // illisible rend la comparaison fausse et l'année bascule en « preparation »
  // — c'est-à-dire, sur la carte, avec un bouton « Activer » à un clic.
  // Ne rien affirmer vaut mieux qu'affirmer à tort : on retombe sur
  // « preparation », mais DÉLIBÉRÉMENT et en le disant ici.
  if (!Number.isNaN(fin.getTime()) && fin.getTime() < maintenant.getTime()) {
    return 'archived'
  }

  return 'preparation'
}

/** Raccourci de lecture, pour les écrans qui ne veulent que ce booléen. */
export const estArchivee = (
  year: AcademicYearStatusInput,
  maintenant: Date = new Date(),
): boolean => deriveAcademicYearStatus(year, maintenant) === 'archived'
