/**
 * Palette des jetons de catégorie du calendrier v2 (CAL-2).
 *
 * Fonctions PURES, sans React ni fetch.
 *
 * Seule table de correspondance « nom de jeton → couleur » du frontend
 * (DESIGN.md, « L'exception du calendrier »). La base stocke le NOM du jeton,
 * jamais la couleur. Les couleurs s'écrivent en classes de rampe de la charte
 * (tailwind.config.js), jamais en valeur hexadécimale.
 *
 * Règles :
 *  - un nom publié ne se retire jamais : un jeton nouveau s'ajoute EN FIN de
 *    liste, avec sa classe, dans la même livraison que le serveur ;
 *  - la table couvre tous les jetons CONNUS, pas seulement les sélectionnables ;
 *  - rendu neutre, jamais une erreur, pour deux cas rendus à l'identique : une
 *    ligne SANS jeton (valeur absente : `null` ou `undefined`, décision D-44
 *    sur C-28) et un jeton INCONNU (toute autre valeur hors de la table, chaîne
 *    vide comprise) ; il n'existe aucun nom de jeton « neutre » ;
 *  - aucun jeton n'est relié à une catégorie, à un code ni à un groupe : la
 *    couleur appartient à la ligne de légende de chaque année.
 *
 * Les clés seront typées par les noms générés du contrat quand CAL-2.3 sera
 * publié. D'ici là, la liste est celle confirmée par la décision D-44.
 *
 * tailwind.config.js scanne ce dossier (`content`) : sans cela, les classes
 * ci-dessous, absentes de app/ et components/, ne seraient pas générées.
 */

/** Noms exacts, dans l'ordre de la charte. Ne jamais retirer ni réordonner. */
export const JETONS_CALENDRIER = ['ardoise-profonde', 'primary-400', 'secondary-700'] as const

export type JetonCalendrier = (typeof JETONS_CALENDRIER)[number]

export interface CouleurJeton {
  /** Nom stocké en base et publié au contrat. */
  jeton: JetonCalendrier
  /** Nom montré au sélecteur. Le nom technique n'est jamais affiché. */
  nomAffiche: string
  /** Classe de la pastille pleine (rampe de tailwind.config.js). */
  classe: string
  /** Pas de rampe correspondant, pour la revue (clé `theme.colors`). */
  rampe: string
}

export const PALETTE_CALENDRIER: Readonly<Record<JetonCalendrier, CouleurJeton>> = {
  'ardoise-profonde': {
    jeton: 'ardoise-profonde',
    nomAffiche: 'Ardoise',
    classe: 'bg-primary-800',
    rampe: 'primary.800',
  },
  'primary-400': {
    jeton: 'primary-400',
    nomAffiche: 'Bleu clair',
    classe: 'bg-primary-400',
    rampe: 'primary.400',
  },
  'secondary-700': {
    jeton: 'secondary-700',
    nomAffiche: 'Bronze',
    classe: 'bg-secondary-700',
    rampe: 'secondary.700',
  },
}

/**
 * Rendu neutre (ligne sans jeton, ou jeton inconnu) : carré SANS remplissage,
 * bordé de 1 px en `muted-foreground`.
 * Il suit le thème parce qu'il passe par un rôle (variable CSS), pas par une
 * rampe fixe.
 */
export const REPLI_NEUTRE = {
  classe: 'border border-muted-foreground bg-transparent',
  variableCss: '--muted-foreground',
} as const

/**
 * `motif` ne sert qu'au typage et aux tests : l'affichage ne distingue pas une
 * ligne sans jeton d'un jeton inconnu (même classe, aucun message).
 */
export type RenduJeton =
  | { connu: true; jeton: JetonCalendrier; nomAffiche: string; classe: string }
  | { connu: false; motif: 'sans-jeton' | 'inconnu'; classe: string }

export function estJetonConnu(valeur: unknown): valeur is JetonCalendrier {
  return typeof valeur === 'string' && Object.prototype.hasOwnProperty.call(PALETTE_CALENDRIER, valeur)
}

/** Ligne sans jeton : valeur absente (`null` ou `undefined`). Une chaîne, même vide, est un jeton. */
export function estSansJeton(valeur: unknown): valeur is null | undefined {
  return valeur === null || valeur === undefined
}

/**
 * Rendu d'un jeton reçu du serveur. Valeur absente → rendu neutre (`sans-jeton`) ;
 * toute autre valeur hors de la table (nom inconnu, chaîne vide, autre type) →
 * même rendu neutre (`inconnu`). Correspondance exacte, sensible à la casse :
 * aucun nom n'est « corrigé ».
 */
export function renduJeton(valeur: unknown): RenduJeton {
  if (estJetonConnu(valeur)) {
    const c = PALETTE_CALENDRIER[valeur]
    return { connu: true, jeton: c.jeton, nomAffiche: c.nomAffiche, classe: c.classe }
  }
  return { connu: false, motif: estSansJeton(valeur) ? 'sans-jeton' : 'inconnu', classe: REPLI_NEUTRE.classe }
}
