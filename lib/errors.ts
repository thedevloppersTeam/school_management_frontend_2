/**
 * lib/errors.ts
 *
 * Helper de traduction des erreurs techniques en messages métier CPMSL.
 *
 * Problème résolu :
 *   Partout dans le code, on trouve :
 *     toast({ description: e.message })
 *     setError(e.message)
 *
 *   Ces messages exposent des textes techniques à l'Administrateur :
 *     - "HTTP 422 Unprocessable Entity"
 *     - "Invalid input: Expected number, received string"
 *     - "Unique constraint failed on the constraint: `User_email_key`"
 *     - "Network request failed"
 *
 *   Ces messages violent :
 *     - REQ-NF-004 (terminologie CPMSL)
 *     - Nielsen H9 (messages d'erreur compréhensibles et actionnables)
 *     - Le glossaire de CLAUDE.md §5
 *
 * Solution :
 *   Fonction toMessage(err, fallback?) qui retourne un message métier
 *   FR lisible par l'Administrateur. Classe les erreurs par catégorie
 *   (réseau, auth, validation, conflit, serveur) et applique des messages
 *   par défaut adaptés.
 *
 *   Supporte un override par contexte métier (ex: "lors de la clôture").
 *
 * Usage minimal :
 *   import { toMessage } from '@/lib/errors'
 *   try { ... }
 *   catch (e) {
 *     toast({ title: 'Erreur', description: toMessage(e), variant: 'destructive' })
 *   }
 *
 * Usage avec contexte :
 *   catch (e) {
 *     toast({
 *       title: 'Échec',
 *       description: toMessage(e, "lors de la clôture de la période"),
 *       variant: 'destructive'
 *     })
 *   }
 *
 * Bonus : toujours logguer la vraie erreur en console pour le debug dev :
 *   catch (e) {
 *     console.error('[close-period]', e)
 *     toast({ description: toMessage(e, "lors de la clôture") })
 *   }
 */

import { ApiError } from './client-fetch'

// ── Messages par code HTTP ─────────────────────────────────────────────
// Couvre les cas les plus fréquents. Les codes non listés tombent sur
// le message "Une erreur technique est survenue".

const HTTP_MESSAGES: Record<number, string> = {
  400: "Les données envoyées ne sont pas valides.",
  401: "Votre session a expiré. Reconnectez-vous.",
  403: "Vous n'avez pas les droits pour effectuer cette action.",
  404: "L'élément demandé n'existe pas ou a été supprimé.",
  409: "Ce changement entre en conflit avec une donnée existante.",
  422: "Les données saisies ne respectent pas les règles attendues.",
  429: "Trop de requêtes en peu de temps. Patientez quelques secondes.",
  500: "Le serveur a rencontré une erreur. Réessayez dans un instant.",
  502: "Le service est momentanément indisponible.",
  503: "Le service est en maintenance. Réessayez plus tard.",
  504: "Le serveur met trop de temps à répondre. Vérifiez votre connexion.",
}

// ── Mots-clés reconnus dans les messages backend ─────────────────────
// Permet de garder un message un peu plus précis quand le backend envoie
// quelque chose de compréhensible (ex: "NISU déjà utilisé").
// Priorité décroissante : premier match gagne.

const KEYWORD_PATTERNS: Array<{ match: RegExp; message: string }> = [
  // Conflits d'unicité explicites
  { match: /nisu.*(unique|d[ée]j[àa]|exist|us[ée])/i,
    message: "Ce NISU est déjà utilisé par un autre élève." },
  { match: /email.*(unique|d[ée]j[àa]|exist|us[ée])/i,
    message: "Cet email est déjà utilisé." },
  { match: /(already exist|d[ée]j[àa] existant|duplicate|unique constraint)/i,
    message: "Cet élément existe déjà." },

  // Période clôturée (REQ-F-004)
  { match: /(period|p[ée]riode|step|[ée]tape).*(closed|cl[ôo]tur)/i,
    message: "La période est clôturée. Modification impossible." },

  // NISU invalide (DR-001)
  { match: /nisu.*(invalid|format|chiffre|digit)/i,
    message: "Le NISU doit contenir 12 chiffres." },

  // Note invalide (DR-004)
  { match: /(score|note).*(0\.25|multiple|step|0,25)/i,
    message: "La note doit être un multiple de 0,25 (.00 / .25 / .50 / .75)." },

  // Matière non mappée (DR-003)
  { match: /(subject|mati[èe]re).*(rubric|rubrique).*(map|assign|mandatory)/i,
    message: "Cette matière doit d'abord être associée à une rubrique (R1, R2 ou R3)." },

  // Réseau
  { match: /(failed to fetch|network|enet|timeout|aborted)/i,
    message: "Connexion impossible. Vérifiez votre accès internet." },
]

// ── Fonction principale ──────────────────────────────────────────────

/**
 * Traduit une erreur en message métier FR.
 *
 * @param err      — L'erreur attrapée (peut être n'importe quel type).
 * @param context  — Optionnel : contexte métier ajouté au message
 *                   (ex: "lors de la clôture"). Rendu comme : "<msg> lors de la clôture."
 * @returns        — Un message FR lisible par l'Administrateur, jamais vide,
 *                   jamais technique.
 */
export function toMessage(err: unknown, context?: string): string {
  const base = resolveBaseMessage(err)
  if (!context) return base

  // Ajoute le contexte métier. On retire le point final du base
  // pour éviter "..déjà utilisé.. lors de la clôture."
  const baseTrimmed = base.replace(/[.!?]+$/, '')
  return `${baseTrimmed} lors de ${context}.`
}

// ── Logique interne ──────────────────────────────────────────────────

function resolveBaseMessage(err: unknown): string {
  // 1. ApiError : on a un status + un message backend
  if (err instanceof ApiError) {
    // D'abord, essai de match par mots-clés sur le message backend
    const kw = matchKeyword(err.message)
    if (kw) return kw

    // Sinon, on tombe sur le message par code HTTP
    const httpMsg = HTTP_MESSAGES[err.status]
    if (httpMsg) return httpMsg

    return "Une erreur technique est survenue. Réessayez."
  }

  // 2. Error standard
  if (err instanceof Error) {
    const kw = matchKeyword(err.message)
    if (kw) return kw

    // Type d'erreur JS connu
    if (err.name === 'TypeError' && /fetch/i.test(err.message)) {
      return "Connexion impossible. Vérifiez votre accès internet."
    }
    if (err.name === 'AbortError') {
      return "L'opération a été interrompue."
    }

    return "Une erreur est survenue. Réessayez."
  }

  // 3. String brute
  if (typeof err === 'string' && err.trim()) {
    const kw = matchKeyword(err)
    if (kw) return kw
    return "Une erreur est survenue. Réessayez."
  }

  // 4. Objet avec .message
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message: unknown }).message
    if (typeof m === 'string' && m.trim()) {
      const kw = matchKeyword(m)
      if (kw) return kw
    }
  }

  // 5. Dernier recours
  return "Une erreur inconnue est survenue. Réessayez."
}

function matchKeyword(msg: string): string | null {
  for (const { match, message } of KEYWORD_PATTERNS) {
    if (match.test(msg)) return message
  }
  return null
}

// ── Helper bonus : logger + message ──────────────────────────────────

/**
 * Combine console.error pour le dev et toMessage pour l'utilisateur.
 * Évite d'oublier le log en production.
 *
 * Usage :
 *   catch (e) {
 *     const msg = logAndMessage('close-period', e, 'lors de la clôture')
 *     toast({ title: 'Erreur', description: msg, variant: 'destructive' })
 *   }
 */
export function logAndMessage(
  tag: string,
  err: unknown,
  context?: string
): string {
  // Log technique pour le dev, sous un préfixe clair
  console.error(`[${tag}]`, err)
  return toMessage(err, context)
}
