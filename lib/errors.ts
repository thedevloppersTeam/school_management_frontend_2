/**
 * lib/errors.ts
 *
 * Helper centralisé de traduction des erreurs techniques en messages métier.
 *
 * Objectifs :
 *  - Ne jamais exposer directement les erreurs techniques à l’utilisateur.
 *  - Transformer les erreurs HTTP / backend / réseau en messages compréhensibles.
 *  - Garder un contexte métier propre : "lors de la clôture", "lors de l'inscription", etc.
 *  - Éviter les messages mal formés comme : "lors de lors de la clôture".
 *  - Éviter les logs techniques en console navigateur en production.
 */

import { ApiError } from "./client-fetch"
import { messageValidite } from "./validite-sous-matieres/messages"

// ── Messages par code HTTP ─────────────────────────────────────────────

const HTTP_MESSAGES: Record<number, string> = {
  400: "Les données envoyées ne sont pas valides.",
  401: "Votre session a expiré. Reconnectez-vous.",
  403: "Vous n'avez pas les droits pour effectuer cette action.",
  404: "L'élément demandé n'existe pas ou a été supprimé.",
  408: "La requête a pris trop de temps. Réessayez.",
  409: "Ce changement entre en conflit avec une donnée existante.",
  422: "Les données saisies ne respectent pas les règles attendues.",
  429: "Trop de requêtes en peu de temps. Patientez quelques secondes.",
  500: "Le serveur a rencontré une erreur. Réessayez dans un instant.",
  502: "Le service est momentanément indisponible.",
  503: "Le service est en maintenance. Réessayez plus tard.",
  504: "Le serveur met trop de temps à répondre. Vérifiez votre connexion.",
}

// ── Mots-clés reconnus dans les messages backend ─────────────────────
// Priorité décroissante : premier match gagne.

const KEYWORD_PATTERNS: Array<{ match: RegExp; message: string }> = [
  // Conflits d'unicité explicites
  {
    match: /nisu.*(unique|d[ée]j[àa]|exist|us[ée])/i,
    message: "Ce NISU est déjà utilisé par un autre élève.",
  },
  {
    match: /email.*(unique|d[ée]j[àa]|exist|us[ée])/i,
    message: "Cet email est déjà utilisé.",
  },
  {
    match: /(already exist|d[ée]j[àa] existant|duplicate|unique constraint)/i,
    message: "Cet élément existe déjà.",
  },

  // Période clôturée
  {
    match: /(period|p[ée]riode|step|[ée]tape).*(closed|cl[ôo]tur)/i,
    message: "La période est clôturée. Modification impossible.",
  },

  // NISU invalide — format acté le 2026-09-13 (lib/nisu.ts). Placée APRÈS la
  // règle d'unicité : « NISU already exists » reste un doublon. Le texte est
  // fixe : il ne reprend jamais la valeur contenue dans le message du serveur.
  {
    match: /nisu.*(invalid|format|chiffre|digit|caract|character|alphanum)/i,
    message: "Le NISU doit contenir exactement 20 caractères alphanumériques (lettres majuscules et chiffres).",
  },

  // Note invalide
  {
    match: /(score|note).*(0\.25|multiple|step|0,25)/i,
    message: "La note doit être un multiple de 0,25 (.00 / .25 / .50 / .75).",
  },

  // Matière non mappée
  {
    match: /(subject|mati[èe]re).*(rubric|rubrique).*(map|assign|mandatory)/i,
    message: "Cette matière doit d'abord être associée à une rubrique (R1, R2 ou R3).",
  },

  // Authentification / session
  {
    match: /(unauthorized|non autoris[ée]|session.*expired|session.*expir)/i,
    message: "Votre session a expiré. Reconnectez-vous.",
  },

  // Permissions
  {
    match: /(forbidden|permission|droit|access denied|acc[eè]s refus)/i,
    message: "Vous n'avez pas les droits pour effectuer cette action.",
  },

  // Réseau
  {
    match: /(failed to fetch|network|enet|timeout|aborted|econnrefused|econnreset)/i,
    message: "Connexion impossible. Vérifiez votre accès internet.",
  },
]

// ── Codes métier renvoyés par le serveur ─────────────────────────────
// Le serveur nomme la règle enfreinte dans `code` (corps JSON de l'erreur).
// Le code est plus sûr que le texte : plusieurs messages du serveur sont en
// anglais (portée de l'affectation) ou embarquent des index techniques
// (« grades[3] »). Libellés rédigés d'après le sens de chaque code côté
// serveur (src/controllers/grades.ts, src/modules/notation/domain/note.ts).
// Textes fixes : ils ne reprennent aucune valeur du message du serveur.

const CODE_MESSAGES: Record<string, string> = {
  // Saisie en lot (bulk-create) : tout ou rien
  LOT_CASE_EN_DOUBLE:
    "Deux saisies visent la même case : lot refusé, aucune note enregistrée. Rechargez la grille puis saisissez à nouveau.",
  LOT_ENTREES_INVALIDES:
    "Lot refusé, aucune note enregistrée : au moins une saisie est invalide.",
  LOT_AFFECTATION_HORS_PORTEE:
    "Lot refusé, aucune note enregistrée : au moins une matière n'est pas dans la portée de l'élève.",
  // Une note par case (ADR-009 § 5)
  CASE_MULTI_NOTES:
    "Cette case porte déjà plusieurs notes : saisie refusée, aucune note enregistrée. Supprimez les notes en trop avant de saisir à nouveau.",
  // Portée de l'affectation (salle, filière)
  AFFECTATION_AUTRE_SALLE:
    "Cette matière n'est pas affectée à la salle de l'élève : note refusée.",
  AFFECTATION_AUTRE_FILIERE:
    "Cette matière relève d'une autre filière que celle de l'élève : note refusée.",
  AFFECTATION_INTROUVABLE:
    "La matière visée n'existe plus : rechargez la grille.",
  SOUS_MATIERE_INTROUVABLE:
    "La sous-matière visée n'existe plus : rechargez la grille.",
  SOUS_MATIERE_HORS_MATIERE:
    "La sous-matière visée n'appartient pas à cette matière : rechargez la grille.",
  // Valeur de la note (objet-valeur Note)
  NOTE_NEGATIVE:
    "Note refusée : une note ne peut pas être négative.",
  NOTE_HORS_BAREME:
    "Note refusée : la note dépasse le barème de la case.",
  NOTE_PAS_025:
    "La note doit être un multiple de 0,25 (.00 / .25 / .50 / .75).",
  NOTE_NON_NUMERIQUE:
    "Note refusée : la valeur saisie n'est pas un nombre décimal.",

  // ── Module MENFP (liste de fin d'année, SPEC-MENFP) ──
  // Libellés d'après le sens de chaque code côté serveur (src/modules/menfp).
  // Paramètres et logo du ministère
  MENFP_ENTREE_INVALIDE: "Demande refusée : une donnée envoyée n'a pas le format attendu.",
  MENFP_SEUIL_INVALIDE:
    "Seuil refusé : saisissez un nombre positif à deux décimales au plus (999,99 au maximum), sans arrondi.",
  MENFP_FICHIER_ABSENT: "Aucun fichier reçu : choisissez une image PNG ou JPEG.",
  MENFP_LOGO_MINISTERE_ABSENT: "Aucun logo du ministère n'est enregistré : le gel est impossible.",
  // Référentiel (matières et coefficients)
  MENFP_CLASSE_EXAMEN: "Classe d'examen : elle n'a pas de liste MENFP de fin d'année.",
  MENFP_NIVEAU_INCONNU: "Ce niveau n'a aucune salle cette année : créez d'abord les salles de ce niveau.",
  MENFP_REFERENTIEL_ABSENT:
    "Aucun référentiel MENFP pour ce niveau et cette année : créez-le dans Paramètres › MENFP.",
  MENFP_REFERENTIEL_VIDE:
    "Le référentiel MENFP de ce niveau n'a aucune matière : ajoutez-en dans Paramètres › MENFP.",
  MENFP_REFERENTIEL_EXISTANT: "Un référentiel MENFP existe déjà pour cette année et ce niveau.",
  MENFP_REFERENTIEL_INCONNU: "Ce référentiel MENFP n'existe plus : rechargez la page.",
  MENFP_REFERENTIEL_NON_VIDE:
    "Le référentiel contient déjà des matières : la copie et l'import d'une grille sont réservés à un référentiel vide.",
  MENFP_ORIGINE_ABSENTE:
    "Copie impossible : l'année précédente n'existe pas ou n'a pas de référentiel MENFP pour ce niveau.",
  MENFP_GRILLE_INCONNUE: "Grille officielle inconnue : choisissez 1re–6e AF, 7e–8e AF ou NS1–NS3.",
  MENFP_MATIERE_INVALIDE:
    "Matière refusée : libellé obligatoire (150 caractères au plus), coefficient entier de 1 à 99 999, ordre de 1 à 999.",
  MENFP_MATIERE_EN_DOUBLE: "Une même matière figure deux fois dans la demande : rechargez la page.",
  MENFP_MATIERE_INCONNUE: "Une matière ministère visée n'existe plus dans ce référentiel : rechargez la page.",
  MENFP_LIBELLE_EN_DOUBLE: "Deux matières ministère portent le même libellé.",
  MENFP_ORDRE_EN_DOUBLE: "Deux matières ministère portent le même ordre.",
  MENFP_MODIFICATION_CONCURRENTE:
    "Le référentiel a été modifié en même temps ailleurs : rechargez la page puis recommencez.",
  // Correspondances (classement des sources)
  MENFP_CLASSEMENT_INVALIDE:
    "Classement refusé : une source figure deux fois, ou est à la fois associée et ignorée.",
  MENFP_SOURCE_HORS_UNIVERS: "Cette source n'appartient pas aux matières des salles de ce niveau : rechargez la page.",
  MENFP_MATIERE_SANS_RUBRIQUE:
    "Matière sans rubrique R1, R2 ou R3 : ses sources ne peuvent être qu'ignorées. Corrigez d'abord la rubrique de la matière.",
  MENFP_ASSOCIATION_SANS_RUBRIQUE:
    "Des sources sont associées à une matière qui n'a plus de rubrique : corrigez la rubrique ou ignorez ces sources.",
  MENFP_SOURCES_NON_CLASSEES:
    "Des sources ne sont pas classées : associez chacune à une matière ministère, ou ignorez-la.",
  MENFP_MATIERE_SANS_SOURCE: "Une matière ministère n'a aucune source : associez-lui au moins une source.",
  MENFP_MODE_GLOBAL:
    "Une matière à sous-matières est notée en note globale : saisissez les notes par sous-matière.",
  // Aperçu, gel, versions, purge, export
  MENFP_SALLE_INCONNUE: "Cette salle n'existe plus : choisissez une autre salle.",
  MENFP_BAREME_NUL:
    "Le total des barèmes d'une matière est nul : une source n'est pas affectée à la salle ou a un barème de 0.",
  MENFP_MOTIF_OBLIGATOIRE: "Le motif est obligatoire.",
  MENFP_LISTE_VIDE: "Gel impossible : la salle ne compte aucun élève retenu.",
  MENFP_SEXE_MANQUANT: "Gel impossible : le sexe d'au moins un élève n'est pas renseigné.",
  MENFP_DEPART_A_COMPLETER: "Gel impossible : au moins un départ est à compléter ou n'a pas de date.",
  MENFP_DELIBERATION_ABSENTE: "Gel impossible : au moins un élève n'a pas de décision de fin d'année.",
  MENFP_ANNEE_NON_CLOSE: "Gel impossible : toutes les étapes de l'année ne sont pas closes.",
  MENFP_ECOLE_ABSENTE: "Les informations de l'école sont absentes : le gel est impossible.",
  MENFP_MOYENNE_IMPOSSIBLE:
    "Gel impossible : au moins un élève n'a pas de moyenne MENFP (toutes ses matières sont hors total).",
  MENFP_LOGO_ECOLE_OMIS: "Le logo de l'école sera omis de l'en-tête du fichier exporté.",
  MENFP_MATIERE_AFFECTEE_DEUX_FOIS:
    "Une matière est affectée deux fois en tronc commun à la salle : ses notes sont additionnées, comme au bulletin.",
  MENFP_MODIFIE_DEPUIS_LE_GEL: "Le référentiel ou les paramètres ont changé depuis la dernière version gelée.",
  MENFP_GEL_CONCURRENT:
    "Une autre version de cette salle a été gelée en même temps : rechargez la liste des versions puis recommencez.",
  MENFP_AUCUN_RAPPORT: "Cette salle n'a aucune version gelée : rien à purger.",
  MENFP_PURGE_CONCURRENTE: "Une version a été gelée pendant la purge : rechargez la page puis recommencez.",
  MENFP_RAPPORT_INCONNU: "Cette version gelée n'existe plus (elle a peut-être été purgée) : rechargez la page.",
  MENFP_EMPREINTE_INVALIDE:
    "Export refusé : la version gelée ne correspond plus à son empreinte enregistrée. Prévenez l'administrateur système.",
  // Téléversement d'une image (contrôles partagés du serveur)
  IMAGE_TYPE_REFUSE: "Format d'image refusé : choisissez un fichier PNG ou JPEG.",
  IMAGE_TROP_VOLUMINEUSE: "Image trop volumineuse : 2 Mo au maximum.",
  IMAGE_PLUSIEURS_FICHIERS: "Envoyez un seul fichier à la fois.",
  IMAGE_CHAMP_INATTENDU: "Envoi refusé : le fichier n'est pas dans le champ attendu.",
  IMAGE_ENVOI_REFUSE: "Envoi de l'image refusé.",
  // Gestes existants refusés à cause d'un rapport MENFP gelé (lot 4B)
  STUDENT_IN_FROZEN_MENFP_REPORT:
    "Suppression refusée : l'élève figure dans un rapport MENFP gelé. Purgez d'abord les rapports MENFP de sa salle (écran de préparation de la liste MENFP).",
  SALLE_REFERENCEE: "Cette salle est encore utilisée (rapport MENFP gelé…) : suppression impossible.",
  SOUS_MATIERE_REFERENCEE:
    "Cette sous-matière est encore utilisée (notes, référentiel MENFP…) : suppression impossible.",
  // ── Calendrier scolaire v2 (SPEC-CAL-2 C-45) ──
  // Codes de CAL-2.1 à CAL-2.3. Ceux de CAL-2.6 (copie d'une année) viendront
  // avec elle. CAL_HORS_ANNEE n'existe pas : les dates hors de l'année sont
  // acceptées, avec un avertissement à la saisie (lib/calendar-v2/hors-bornes.ts).
  CAL_ENTREE_INVALIDE:
    "Demande refusée : une donnée envoyée n'a pas le format attendu (champ manquant, trop long ou inconnu).",
  CAL_DATE_INVALIDE: "Date refusée : elle n'existe pas au calendrier ou n'est pas lisible.",
  CAL_PERIODE_INVERSEE: "La date de fin est antérieure à la date de début : corrigez la période.",
  CAL_DATE_FIXE_PERIODE:
    "« Même date chaque année » ne vaut que pour un seul jour : pour une période, choisissez « Date à revoir chaque année ».",
  CAL_COULEUR_INCONNUE: "Cette couleur ne fait pas partie de la palette : choisissez-en une autre.",
  CAL_ANNEE_INTROUVABLE: "Cette année scolaire n'existe pas ou a été supprimée.",
  CAL_CATEGORIE_INTROUVABLE: "Cette catégorie n'existe plus : rechargez la page.",
  CAL_LEGENDE_INTROUVABLE:
    "Cette catégorie ne figure pas dans la légende de cette année : rechargez la page.",
  CAL_ENTREE_INTROUVABLE: "Cette entrée du calendrier n'existe plus : rechargez la page.",
  CAL_CATEGORIE_UTILISEE:
    "Suppression impossible : cette catégorie figure dans la légende d'au moins une année. Désactivez-la plutôt.",
  CAL_CATEGORIE_DESACTIVEE:
    "Cette catégorie est désactivée : elle ne peut plus entrer dans une légende ni servir à une nouvelle entrée. Réactivez-la dans le catalogue si besoin.",
  CAL_LEGENDE_UTILISEE:
    "Retrait impossible : des entrées de cette année utilisent cette catégorie. Modifiez-les ou supprimez-les d'abord.",
  CAL_LEGENDE_EN_DOUBLE: "Cette catégorie figure déjà dans la légende de cette année.",
  CAL_LIBELLE_EN_DOUBLE: "Une autre catégorie de la légende de cette année porte déjà ce libellé.",
  CAL_ENTREE_EN_DOUBLE: "Cette entrée existe déjà : même catégorie, même titre et mêmes dates.",
  CAL_CATEGORIE_EN_DOUBLE: "Une catégorie du catalogue porte déjà ce libellé interne.",
  CAL_EN_DOUBLE:
    "Enregistrement refusé : une autre saisie faite au même moment entre en conflit avec celle-ci. Rechargez la page, puis vérifiez.",
  // Relais : réponse du serveur hors contrat (lib/backend.ts, backendFetchValide)
  CONTRAT_REPONSE_INVALIDE:
    "La réponse du serveur ne correspond pas au format attendu : l'application et le serveur ne sont probablement pas à la même version. Rechargez la page ; si le problème persiste, prévenez l'administrateur.",
}

/** Codes de lot dont le corps liste les saisies en cause dans `entries[]`. */
const LOT_ENTRY_CODES: Record<string, { singular: string; plural: string }> = {
  LOT_ENTREES_INVALIDES: { singular: "saisie invalide", plural: "saisies invalides" },
  LOT_AFFECTATION_HORS_PORTEE: {
    singular: "saisie hors de la portée de l'élève",
    plural: "saisies hors de la portée de l'élève",
  },
}

function readCode(value: unknown): string | null {
  if (!value || typeof value !== "object") return null
  const code = (value as { code?: unknown }).code
  return typeof code === "string" && code ? code : null
}

/**
 * Message lisible pour un corps d'erreur du serveur qui porte un `code` connu,
 * sinon null (le code inconnu retombe sur la traduction par mots-clés).
 *
 * Lots (`entries[]`) : nombre de saisies en cause, tel que le serveur les liste,
 * et motif de la première. CASE_MULTI_NOTES : `cases[]` quand plusieurs cases
 * sont en cause.
 *
 * Validité annuelle des sous-matières (SECTION_HORS_VIGUEUR, MATIERE_HORS_VIGUEUR,
 * ANNEE_INCONNUE, VALIDITE_PERIODE_INVERSEE, VALIDITE_INVALIDE, VALIDITE_EXCLUT_NOTES) :
 * libellés de lib/validite-sous-matieres/messages.ts ; null pour tout autre code.
 */
export function messageForCode(body: unknown): string | null {
  const validite = messageValidite(body)
  if (validite) return validite

  const code = readCode(body)
  if (!code || !(code in CODE_MESSAGES)) return null

  const lot = LOT_ENTRY_CODES[code]
  if (lot) {
    const entries = (body as { entries?: unknown }).entries
    if (Array.isArray(entries) && entries.length > 0) {
      const n = entries.length
      const firstCode = readCode(entries[0])
      const firstLabel = firstCode ? CODE_MESSAGES[firstCode] : undefined
      const head = `Lot refusé, aucune note enregistrée : ${n} ${n > 1 ? lot.plural : lot.singular}.`
      return firstLabel ? `${head} Première en cause : ${firstLabel}` : head
    }
  }

  if (code === "CASE_MULTI_NOTES") {
    const cases = (body as { cases?: unknown }).cases
    if (Array.isArray(cases) && cases.length > 1) {
      return `${cases.length} cases portent déjà plusieurs notes : saisie refusée, aucune note enregistrée. Supprimez les notes en trop avant de saisir à nouveau.`
    }
  }

  return CODE_MESSAGES[code]
}

// ── Fonction principale ──────────────────────────────────────────────

/**
 * Traduit une erreur technique en message métier lisible.
 *
 * @param err      Erreur interceptée.
 * @param context  Contexte métier optionnel.
 *
 * Exemples acceptés :
 *  - toMessage(e)
 *  - toMessage(e, "lors de la clôture")
 *  - toMessage(e, "la clôture")
 *  - toMessage(e, "de l'inscription")
 */
export function toMessage(err: unknown, context?: string): string {
  // Moyenne de classe incalculable (lib/api/bulletin.ts) : son message est
  // rédigé pour l'écran, complet, et ne contient qu'un nombre d'élèves. Il est
  // rendu tel quel, sans le contexte de l'écran, qui en casserait la dernière
  // phrase. Reconnue par son nom, pour ne pas importer lib/api/bulletin.ts ici.
  if (err instanceof Error && err.name === "ClassAverageUnavailableError") {
    return err.message
  }

  // Bulletin d'une étape postérieure au départ (lib/bulletin/from-results.ts,
  // RS-09) : message complet, rédigé pour l'écran, rendu tel quel.
  if (err instanceof Error && err.name === "StepAfterDepartureError") {
    return err.message
  }

  // Erreur du serveur qui nomme sa règle (`code` du corps JSON) : libellé
  // complet, rendu tel quel, sans le contexte de l'écran.
  if (err instanceof ApiError) {
    const codeMessage = messageForCode(err.body)
    if (codeMessage) {
      return codeMessage
    }
  }

  const base = resolveBaseMessage(err)

  if (!context?.trim()) {
    return base
  }

  const baseTrimmed = base.replace(/[.!?]+$/, "")
  const formattedContext = formatContext(context)

  return `${baseTrimmed} ${formattedContext}.`
}

// ── Formatage du contexte ────────────────────────────────────────────

function formatContext(context: string): string {
  const normalized = context.trim().replace(/[.!?]+$/, "")

  if (!normalized) {
    return ""
  }

  /**
   * Cas déjà bien formulés :
   *  - "lors de la clôture"
   *  - "pendant l'inscription"
   *  - "durant la génération"
   *  - "au moment de la sauvegarde"
   *  - "en enregistrant les notes"
   *  - "dans le module bulletin"
   */
  if (
    /^(lors|pendant|durant|au moment|à l'occasion|a l'occasion|en|dans|pendant que)\b/i.test(
      normalized
    )
  ) {
    return normalized
  }

  /**
   * Cas partiels :
   *  - "de l'inscription" => "lors de l'inscription"
   *  - "de la clôture"    => "lors de la clôture"
   *  - "du calcul"        => "lors du calcul"
   *  - "des bulletins"    => "lors des bulletins"
   */
  if (/^(de l'|de la |du |des |d')/i.test(normalized)) {
    return `lors ${normalized}`
  }

  /**
   * Cas avec article défini :
   *  - "la clôture"       => "lors de la clôture"
   *  - "l'inscription"    => "lors de l'inscription"
   *  - "le calcul"        => "lors du calcul"
   *  - "les bulletins"    => "lors des bulletins"
   */
  if (/^la\s+/i.test(normalized)) {
    return `lors de ${normalized}`
  }

  if (/^l'/i.test(normalized)) {
    return `lors de ${normalized}`
  }

  if (/^le\s+/i.test(normalized)) {
    return `lors du ${normalized.replace(/^le\s+/i, "")}`
  }

  if (/^les\s+/i.test(normalized)) {
    return `lors des ${normalized.replace(/^les\s+/i, "")}`
  }

  /**
   * Cas générique :
   *  - "clôture"          => "lors de clôture"
   *  - "sauvegarde"       => "lors de sauvegarde"
   *
   * Ce n'est pas toujours grammaticalement parfait, mais cela reste sûr.
   * Pour de beaux messages, préférer passer un contexte complet :
   *  - "lors de la clôture"
   *  - "lors de la sauvegarde"
   */
  return `lors de ${normalized}`
}

// ── Résolution du message de base ────────────────────────────────────

function resolveBaseMessage(err: unknown): string {
  // 1. ApiError : status HTTP + message backend
  if (err instanceof ApiError) {
    const keywordMessage = matchKeyword(err.message)
    if (keywordMessage) {
      return keywordMessage
    }

    const httpMessage = HTTP_MESSAGES[err.status]
    if (httpMessage) {
      return httpMessage
    }

    return "Une erreur technique est survenue. Réessayez."
  }

  // 2. Error standard JavaScript
  if (err instanceof Error) {
    const keywordMessage = matchKeyword(err.message)
    if (keywordMessage) {
      return keywordMessage
    }

    if (err.name === "TypeError" && /fetch/i.test(err.message)) {
      return "Connexion impossible. Vérifiez votre accès internet."
    }

    if (err.name === "AbortError") {
      return "L'opération a été interrompue."
    }

    return "Une erreur est survenue. Réessayez."
  }

  // 3. String brute
  if (typeof err === "string" && err.trim()) {
    const keywordMessage = matchKeyword(err)
    if (keywordMessage) {
      return keywordMessage
    }

    return "Une erreur est survenue. Réessayez."
  }

  // 4. Objet avec propriété message
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message: unknown }).message

    if (typeof message === "string" && message.trim()) {
      const keywordMessage = matchKeyword(message)
      if (keywordMessage) {
        return keywordMessage
      }
    }
  }

  // 5. Dernier recours
  return "Une erreur inconnue est survenue. Réessayez."
}

function matchKeyword(message: string): string | null {
  for (const { match, message: userMessage } of KEYWORD_PATTERNS) {
    if (match.test(message)) {
      return userMessage
    }
  }

  return null
}

// ── Helper : log technique + message utilisateur ─────────────────────

/**
 * Combine un log technique en développement et un message propre pour l'utilisateur.
 *
 * En production, on évite de pousser des détails techniques dans la console navigateur.
 */
export function logAndMessage(
  tag: string,
  err: unknown,
  context?: string
): string {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[${tag}]`, err)
  }

  return toMessage(err, context)
}