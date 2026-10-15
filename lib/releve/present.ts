/**
 * Relevé de notes — fonctions pures de PRÉSENTATION (lot 2).
 *
 * Aucune règle de calcul ici : les valeurs viennent déjà formatées de
 * ReleveData. Ce module ne décide que du nom du PDF, de l'échelle d'aperçu,
 * de la classe de couleur d'une bande et du dépassement de la zone utile.
 */
import type { GradeBand } from '@/lib/bulletin/grade-color'
import { PAPER_PX, USABLE_PX } from '@/components/releve/releve-layout'

/** Plus petite échelle d'aperçu : la feuille reste visible même sans largeur mesurée. */
const MIN_SCALE = 0.1

/**
 * « releve-<AAAA-AAAA>-<code élève>.pdf ». Aucun nom ni prénom : le fichier
 * circule hors de l'application. Seuls [A-Za-z0-9-] sont gardés.
 */
export function releveFileName(anneeScolaire: string, studentCode: string): string {
  const m = anneeScolaire.match(/(\d{4})\D+(\d{4})/)
  const annee = m ? `${m[1]}-${m[2]}` : 'annee'
  const code = studentCode.replace(/[^A-Za-z0-9-]/g, '') || 'eleve'
  return `releve-${annee}-${code}.pdf`
}

/** Échelle de l'aperçu pour tenir dans `availableWidth` : ]0 ; 1]. La capture se fait à 1. */
export function previewScale(availableWidth: number): number {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return MIN_SCALE
  return Math.max(MIN_SCALE, Math.min(1, availableWidth / PAPER_PX.width))
}

/** Classe CSS d'une bande : colorée pour echec, deficient, assez-bien ; aucune sinon. */
export function bandClass(band: GradeBand | null): string {
  return band === 'echec' || band === 'deficient' || band === 'assez-bien' ? `rlv-band-${band}` : ''
}

/**
 * Le contenu dépasse-t-il la zone utile ? Une hauteur illisible compte comme
 * un dépassement : mieux vaut bloquer le PDF qu'imprimer une feuille coupée.
 */
export function overflowsUsableArea(contentHeight: number): boolean {
  if (!Number.isFinite(contentHeight)) return true
  // Tolérance d'un millionième de pixel : 1056 − 3.9 × 96 et 1056 − 187.2 − 187.2
  // ne tombent pas sur le même flottant.
  return contentHeight > USABLE_PX.height + 1e-6
}
