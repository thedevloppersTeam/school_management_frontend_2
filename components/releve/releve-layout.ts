/**
 * Relevé de notes — CONSTANTES DE MISE EN PAGE, seul fichier à modifier pour
 * ajuster la feuille sans toucher au gabarit (ReleveNotesPrintable.tsx).
 *
 * Référence : docs/GABARIT-RELEVE.md v0.4 (hors dépôt), §1, §5, §7.
 * Fichier PUR : aucune dépendance React ni next/font, pour pouvoir être lu par
 * les fonctions pures et leurs tests (lib/releve/present.ts).
 */

// ── Papier (§1) ─────────────────────────────────────────────────────────────

/** Rendu CSS : 96 px par pouce. */
export const CSS_DPI = 96

/** Letter portrait, 8½ × 11 in. */
export const PAPER_IN = { width: 8.5, height: 11 } as const
export const PAPER_PX = { width: PAPER_IN.width * CSS_DPI, height: PAPER_IN.height * CSS_DPI } as const

/**
 * Réserves de la feuille à EN-TÊTE préimprimée (estimées depuis le scan,
 * ajustables). Rien n'est imprimé dedans.
 */
export const RESERVES_IN = { top: 1.95, bottom: 1.95, left: 0.7, right: 0.70 } as const

export const RESERVES_PX = {
  top: RESERVES_IN.top * CSS_DPI,
  bottom: RESERVES_IN.bottom * CSS_DPI,
  left: RESERVES_IN.left * CSS_DPI,
  right: RESERVES_IN.right * CSS_DPI,
} as const

/** Zone utile : la feuille moins les réserves. */
export const USABLE_PX = {
  width: PAPER_PX.width - RESERVES_PX.left - RESERVES_PX.right,
  height: PAPER_PX.height - RESERVES_PX.top - RESERVES_PX.bottom,
} as const

// ── Polices (§7) ────────────────────────────────────────────────────────────

/**
 * Piles de polices. La première est celle du scan, appelée sur le POSTE
 * (police installée localement, jamais copiée dans le dépôt : licences
 * Windows / Office). La variable CSS est la police LIBRE de remplacement,
 * intégrée par next/font/google (components/releve/releve-fonts.ts). Le
 * dernier terme est le générique.
 *
 * Changer une police = changer une ligne ici.
 */
export const FONT_STACKS = {
  /** Valeurs d'identité (prénom, nom, date, niveau, année). */
  identite: '"Lucida Handwriting", var(--font-releve-identite), cursive',
  /** Texte de la remarque. */
  remarque: '"French Script MT", var(--font-releve-remarque), cursive',
  /** Titre « Relevé de Notes ». */
  titre: 'Arial, Helvetica, sans-serif',
  /** Nombres des tableaux. */
  nombres: 'Arial, Helvetica, sans-serif',
  /** En-têtes de colonnes. */
  entetes: 'Arial, Helvetica, sans-serif',
  /** Libellés de lignes et titres de groupes. */
  libelles: '"Times New Roman", Times, serif',
  /** Libellés d'identité (« Prénom(s) », « Nom », « Date de naissance ») et légende. */
  calibri: 'Calibri, Carlito, "Segoe UI", sans-serif',
  /** « Niveau », « Année scolaire », « Direction », adresse. */
  cambria: 'Cambria, Caladea, Georgia, serif',
} as const

// ── Couleurs (§5) ───────────────────────────────────────────────────────────

/**
 * Bandes de couleur des notes. Valeurs RECOPIÉES du bulletin (lecture seule) :
 * components/school/bulletin-printable.tsx:1122-1123 (--red, --orange,
 * --green), appliquées par colorClass (:25-35). `neutre` et `null` : aucune
 * couleur (encre du texte).
 */
export const BAND_COLORS = {
  echec: '#cf3a35',
  deficient: '#d9a21b',
  'assez-bien': '#318c53',
} as const

/** Encres de la feuille. Bleus et encre recopiés du bulletin (bulletin-printable.tsx:500, :1121). */
export const INKS = {
  texte: '#1c1c22',
  titre: '#4DA3CF',
  libelleClair: '#4a9bcc',
  manuscrit: '#16335c',
  trait: '#2a2a2a',
  traitDirection: '#4a9bcc',
} as const

// ── Tailles (ajustables) ────────────────────────────────────────────────────

export const SIZES = {
  /** Hauteur d'une rangée de tableau, en px. */
  row: 12.5,
  /** Corps des nombres et des libellés de lignes, en px. */
  cell: 8.5,
  /** Corps des titres de groupes, en px. */
  group: 9,
  /** Corps des en-têtes de colonnes, en px. */
  header: 7.5,
  /** Titre « Relevé de Notes », en px. */
  title: 18,
  /** Valeurs d'identité (manuscrites), en px. */
  identity: 14,
  /** Libellés d'identité, en px. */
  identityLabel: 10,
  /** Pied de page, en px. */
  footer: 8.5,
  /** Cadre photo, en px (≈ 0.85 × 1.05 in). */
  photo: { width: 100, height: 100 },
  /** Espace entre les deux colonnes de tableaux, en px. */
  columnGap: 10,
  /** Largeur de la colonne des libellés, en part de la colonne. */
  labelColumn: '38%',
} as const
