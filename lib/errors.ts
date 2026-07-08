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

  // NISU invalide
  {
    match: /nisu.*(invalid|format|chiffre|digit)/i,
    message: "Le NISU doit contenir 12 chiffres.",
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