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

import { RUBRIQUE_WEIGHTS } from "@/lib/bulletin/compute";

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

/** Champ en erreur : le filet passe au rouge, le reste ne bouge pas. */
export const INPUT_INVALID_CLASS = "border-error rounded-lg";

/** Texte d'aide sous un champ. Répond à une question implicite, ne répète
 *  jamais le libellé. */
export const FIELD_HINT_CLASS = "font-sans text-xs text-neutral-500";

/**
 * Marque de champ obligatoire.
 *
 * `error` est ici le rôle juste : c'est un constat sur le champ, pas une
 * action destructrice — voir la distinction erreur / destructif de DESIGN.md.
 * L'astérisque porte un libellé accessible parce que le symbole seul ne dit
 * rien à un lecteur d'écran.
 *
 * Exemple :
 *   Nom <span className={REQUIRED_MARK_CLASS} aria-label="obligatoire">*</span>
 */
export const REQUIRED_MARK_CLASS = "text-error";

// ─── Dialogues ─────────────────────────────────────────────────────────────

/**
 * Surface d'une modale. 14 px de rayon : c'est le pas « fiche » du système,
 * celui des cartes posées sur le papier crème.
 *
 * `sm:rounded-xl` n'est pas une redite : le DialogContent de shadcn porte
 * `sm:rounded-lg` par défaut, et sans variante `sm` explicite ce défaut
 * reprend la main au-dessus de 640 px — le rayon retomberait à 10 px sur
 * l'écran de bureau, qui est justement le seul écran de ce produit.
 */
export const DIALOG_CONTENT_CLASS = "bg-white rounded-xl sm:rounded-xl";

/**
 * Titre de modale.
 *
 * Note de dette : DESIGN.md place les titres de modale sur `.heading-4`,
 * sans-serif. L'implémentation est en serif partout. Le token existe pour que
 * l'arbitrage se fasse ici, en une ligne, plutôt que dans quinze fichiers.
 */
export const DIALOG_TITLE_CLASS =
  "font-serif text-xl font-bold text-primary-800";

/** Sous-titre de modale : la ligne qui nomme l'objet édité. */
export const DIALOG_DESCRIPTION_CLASS = "font-sans text-sm text-neutral-500";

/**
 * Encart d'aperçu ou de récapitulatif dans une modale — « Résultat : 7e A ».
 * Surface sourde, jamais une carte dans une carte.
 */
export const DIALOG_PREVIEW_CLASS =
  "flex items-center gap-2 rounded-md bg-primary-50 px-3.5 py-2.5 text-sm text-primary-500";

/** En-tête de modale : le filet qui sépare le titre du corps. */
export const DIALOG_HEADER_CLASS =
  "px-6 pt-6 pb-4 border-b border-neutral-200";

/** Corps de modale. */
export const DIALOG_BODY_CLASS = "p-6";

/** Pied de modale : filet, actions alignées à droite. */
export const DIALOG_FOOTER_CLASS =
  "flex justify-end gap-3 border-t border-neutral-200 px-6 py-4";

/**
 * Encart d'avertissement dans une modale — la conséquence d'une action.
 * `ink` est le pas de texte de la rampe : `warning` en plein n'atteint que
 * 2,86:1 et ne doit jamais porter de texte.
 */
export const ALERT_WARNING_CLASS =
  "rounded-md border border-warning-border bg-warning-soft p-4 text-sm text-warning-ink";

/** Encart d'erreur ou de conséquence irréversible dans une modale. */
export const ALERT_ERROR_CLASS =
  "rounded-md border border-error-border bg-error-soft p-4 text-sm text-error-ink";

// ─── Boutons ───────────────────────────────────────────────────────────────

export const BTN_PRIMARY_CLASS =
  "bg-primary-800 hover:bg-primary-700 text-white rounded-lg disabled:bg-neutral-400 disabled:cursor-not-allowed";

export const BTN_DIALOG_PRIMARY_CLASS =
  "bg-primary-500 hover:bg-primary-600 text-white rounded-lg disabled:bg-neutral-400 disabled:cursor-not-allowed";

export const BTN_OUTLINE_CLASS =
  "border-neutral-300 text-neutral-600 rounded-lg";

/**
 * Bouton d'une action qui détruit — supprimer une matière, une salle.
 *
 * `destructif` est `erreur` un pas plus profond : l'écart de teinte est ce qui
 * distingue l'action du constat. Ne pas l'utiliser pour signaler une erreur.
 */
export const BTN_DESTRUCTIVE_CLASS =
  "bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-lg disabled:bg-neutral-400 disabled:cursor-not-allowed";

export const LINK_BTN_CLASS =
  "text-sm font-medium hover:underline focus-visible:outline-2 focus-visible:rounded";

// ─── Sections (titres et sous-titres) ──────────────────────────────────────

/**
 * Titre de section. `font-bold` et non `font-semibold` : Libre Baskerville
 * n'expose pas de 600, et `font-synthesis: none` resout un 600 demande en 700.
 * Declarer 700 dit ce qui est rendu — meme correction que celle deja passee
 * sur `.heading-2` / `.heading-3` et sur `app/login/layout.tsx`.
 */
export const SECTION_HEADER_TITLE_CLASS =
  "font-serif text-lg font-bold text-primary-800";

export const SECTION_HEADER_SUBTITLE_CLASS =
  "font-sans text-sm text-neutral-500 mt-0.5";

// ─── Rubriques du bulletin ─────────────────────────────────────────────────

/**
 * Traitement visuel d'un badge de rubrique (R1, R2, R3).
 *
 * Une seule valeur pour les trois : la couleur ne catégorise plus, elle est
 * réservée aux états (ouverte / clôturée / archivée). Ce qui distingue R1 de
 * R3, c'est son poids sur le bulletin, et c'est le texte qui le porte — voir
 * rubriqueShare(). Effets :
 *   - le vert ne désigne plus à la fois « R2 » et « étape ouverte » ;
 *   - l'or reste le sceau de la marque, il ne sert plus de catégorie ;
 *   - l'information ne dépend plus de la perception des couleurs (WCAG 1.4.1),
 *     ce qui clôt aussi A11Y-004 (R3 était à 2,6:1) par construction.
 *
 * Exemple :
 *   <Badge className={`border-0 ${RUBRIQUE_BADGE_CLASS}`}>
 *     R3 · {rubriqueShare('R3')}
 *   </Badge>
 */
export const RUBRIQUE_BADGE_CLASS = "bg-primary-50 text-primary-800";

// ─── Helper : poids d'une rubrique sur le bulletin ─────────────────────────

/**
 * Part d'une rubrique dans la moyenne d'étape, formatée pour l'affichage.
 *
 * La valeur vient de RUBRIQUE_WEIGHTS (lib/bulletin/compute.ts), qui fait
 * autorité — BR-001, docs/CALCUL-BULLETIN.md. Elle n'est jamais recopiée ici :
 * si la MOA arbitre une autre pondération, l'interface suit sans retouche.
 *
 * @param code 'R1' | 'R2' | 'R3' | autre
 * @returns '70 %' · '25 %' · '5 %', ou null si le code n'est pas une rubrique
 */
export function rubriqueShare(code?: string | null): string | null {
  if (code !== "R1" && code !== "R2" && code !== "R3") return null;
  return `${RUBRIQUE_WEIGHTS[code].times(100).toNumber()} %`;
}
