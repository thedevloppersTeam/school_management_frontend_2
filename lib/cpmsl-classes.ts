/**
 * lib/cpmsl-classes.ts
 *
 * Bibliothèque centralisée des classes Tailwind utilisées dans toute l'app CPMSL.
 *
 * Pourquoi ce fichier ?
 *   - DRY : une seule source de vérité pour le design système
 *   - Cohérence : si on change BTN_PRIMARY_CLASS, tous les boutons primary changent
 *   - Lisibilité : `className={CARD_CLASS}` est plus clair qu'une string de 80 chars
 *   - Maintenance : centraliser le styling rend les futurs changements (ex: dark mode,
 *     redesign) beaucoup plus simples
 *
 * Convention :
 *   - Préfixe par usage (CARD, BTN, INPUT, TABLE, etc.)
 *   - Suffixe _CLASS pour distinguer des composants React
 *   - Pas de logique conditionnelle ici (c'est du pur design token)
 */

// ─── Cards et conteneurs ───────────────────────────────────────────────────

export const CARD_CLASS =
  "bg-white rounded-lg border border-neutral-200 shadow-sm";

export const CARD_HEADER_CLASS =
  "px-6 py-5 border-b border-neutral-200 flex items-center justify-between";

export const CARD_BODY_CLASS = "p-6";

// ─── Tables ────────────────────────────────────────────────────────────────

export const TH_CLASS =
  "font-sans text-xs font-bold uppercase tracking-wider text-primary-800";

export const TABLE_WRAPPER_CLASS =
  "rounded-lg border border-neutral-200 overflow-hidden";

export const TABLE_HEAD_ROW_CLASS =
  "bg-primary-50 border-b-2 border-neutral-300";

// ─── Formulaires ───────────────────────────────────────────────────────────

export const FIELD_LABEL_CLASS =
  "font-sans text-sm font-medium text-neutral-900";

export const INPUT_CLASS = "border-neutral-300 rounded-lg";

// ─── Boutons ───────────────────────────────────────────────────────────────

export const BTN_PRIMARY_CLASS =
  "bg-primary-800 hover:bg-primary-700 text-white rounded-lg disabled:bg-neutral-400 disabled:cursor-not-allowed";

export const BTN_DIALOG_PRIMARY_CLASS =
  "bg-primary-500 hover:bg-primary-600 text-white rounded-lg disabled:bg-neutral-400 disabled:cursor-not-allowed";

export const BTN_OUTLINE_CLASS =
  "border-neutral-300 text-neutral-600 rounded-lg";

export const LINK_BTN_CLASS =
  "text-sm font-medium hover:underline focus-visible:outline-2 focus-visible:rounded";

// ─── Sections (titres et sous-titres) ──────────────────────────────────────

export const SECTION_HEADER_TITLE_CLASS =
  "font-serif text-lg font-semibold text-primary-800";

export const SECTION_HEADER_SUBTITLE_CLASS =
  "font-sans text-sm text-neutral-500 mt-0.5";

// ─── Helper : mapping rubrique → classes Tailwind ──────────────────────────

/**
 * Retourne les classes Tailwind à utiliser pour afficher un Badge/Label de
 * rubrique (R1, R2, R3) selon le code.
 *
 * Fix A11Y-004 : R3 utilisait #B0A07A sur #FAF8F3 (contraste 2.6:1, fail WCAG).
 * Maintenant : text-secondary-700 (#7A6E50) sur bg-secondary-50 (#FAF8F3),
 * contraste 5.2:1, conforme WCAG AA.
 *
 * @param code 'R1' | 'R2' | 'R3' | autre
 * @returns { badge, weight } classes Tailwind à appliquer
 *
 * Exemple :
 *   const c = rubricClasses('R3')
 *   <Badge className={`border-0 ${c.badge}`}>R3</Badge>
 */
export function rubricClasses(code?: string): {
  badge: string;
  weight: string;
} {
  if (code === "R1")
    return { badge: "bg-info-soft text-info", weight: "text-info" };
  if (code === "R2")
    return { badge: "bg-success-soft text-success", weight: "text-success" };
  if (code === "R3")
    return {
      badge: "bg-secondary-50 text-secondary-700",
      weight: "text-secondary-700",
    };
  return {
    badge: "bg-primary-50 text-primary-500",
    weight: "text-primary-500",
  };
}
