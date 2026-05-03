/**
 * Rate limiter in-memory pour BFF Next.js — SEC-A07-001
 *
 * Stratégie : sliding window log (sans dépendance externe)
 *
 * Pour CPMSL (single instance VPS) :
 *  - Memory-only : Map<IP, timestamps[]>
 *  - Sliding window : on garde les N dernières timestamps par IP
 *  - GC automatique : les entrées vieilles >1h sont purgées toutes les 5 min
 *
 * Pourquoi pas Redis : single instance, école = budget limité, simple = mieux
 * Si scaling multi-instance plus tard → migrer vers @upstash/ratelimit ou rate-limiter-flexible
 *
 * Limitations connues :
 *  - Reset au redémarrage du serveur (acceptable pour anti-brute-force, pas pour quota)
 *  - Pas de partage entre instances (single instance OK)
 *  - DoS via mémoire : limité par MAX_TRACKED_IPS (10K IPs max)
 */

// ─── Configuration par défaut ────────────────────────────────────────

/** Nombre max d'IPs trackées simultanément (anti-DoS mémoire) */
const MAX_TRACKED_IPS = 10_000;

/** Intervalle de garbage collection (purge des vieilles entrées) */
const GC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** Âge max d'une entrée avant purge */
const MAX_ENTRY_AGE_MS = 60 * 60 * 1000; // 1 heure

// ─── State global (singleton in-memory) ──────────────────────────────

/**
 * Map<key, timestamps[]>
 * key = `${routeName}:${ip}` pour isoler les compteurs par route
 */
const buckets = new Map<string, number[]>();

/** Démarre le GC une seule fois au premier import du module */
let gcStarted = false;

function startGC() {
  if (gcStarted) return;
  gcStarted = true;

  // setInterval garde le process en vie en théorie ; .unref() = ne bloque pas l'arrêt
  const interval = setInterval(() => {
    const now = Date.now();
    const cutoff = now - MAX_ENTRY_AGE_MS;

    for (const [key, timestamps] of buckets.entries()) {
      const recent = timestamps.filter((t) => t > cutoff);
      if (recent.length === 0) {
        buckets.delete(key);
      } else if (recent.length !== timestamps.length) {
        buckets.set(key, recent);
      }
    }
  }, GC_INTERVAL_MS);

  // Permet au process Node de s'arrêter même si le GC tourne encore
  if (typeof interval.unref === "function") {
    interval.unref();
  }
}

// ─── API publique ────────────────────────────────────────────────────

export type RateLimitConfig = {
  /** Identifiant unique du rate limiter (ex: 'login', 'api') */
  name: string;
  /** Nombre max de requêtes autorisées dans la fenêtre */
  max: number;
  /** Durée de la fenêtre en millisecondes */
  windowMs: number;
};

export type RateLimitResult = {
  /** True si la requête est autorisée, false si bloquée */
  allowed: boolean;
  /** Nombre de requêtes restantes dans la fenêtre actuelle */
  remaining: number;
  /** Timestamp Unix (secondes) du moment où la limite se reset */
  resetAt: number;
  /** Durée en secondes avant de pouvoir réessayer (si bloqué) */
  retryAfterSec: number;
};

/**
 * Vérifie si une requête identifiée par `ip` peut passer pour la config donnée.
 *
 * Algo : sliding window log
 *  1. Récupère les timestamps des requêtes précédentes pour cette IP
 *  2. Filtre celles dans la fenêtre actuelle (now - windowMs)
 *  3. Si count >= max → bloque
 *  4. Sinon ajoute le timestamp actuel et autorise
 */
export function checkRateLimit(
  ip: string,
  config: RateLimitConfig,
): RateLimitResult {
  startGC();

  const now = Date.now();
  const windowStart = now - config.windowMs;
  const key = `${config.name}:${ip}`;

  // Anti-DoS mémoire : si on suit déjà MAX_TRACKED_IPS, refuse silencieusement
  // les nouvelles IPs (les existantes continuent à fonctionner)
  if (buckets.size >= MAX_TRACKED_IPS && !buckets.has(key)) {
    // En cas de saturation, on laisse passer (fail-open sur ce cas extrême)
    // car bloquer toutes les nouvelles IPs serait un DoS auto-infligé.
    // Le backend reste protégé par son propre rate limit.
    return {
      allowed: true,
      remaining: config.max,
      resetAt: Math.floor((now + config.windowMs) / 1000),
      retryAfterSec: 0,
    };
  }

  // Récupère les timestamps pour cette IP, filtre ceux dans la fenêtre
  const timestamps = buckets.get(key) ?? [];
  const inWindow = timestamps.filter((t) => t > windowStart);

  if (inWindow.length >= config.max) {
    // Bloqué : calcule combien de temps attendre
    const oldestInWindow = inWindow[0];
    const resetAt = Math.floor((oldestInWindow + config.windowMs) / 1000);
    const retryAfterSec = Math.max(1, resetAt - Math.floor(now / 1000));

    // Met à jour le bucket avec la fenêtre filtrée (purge auto)
    buckets.set(key, inWindow);

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfterSec,
    };
  }

  // Autorisé : ajoute le timestamp actuel
  inWindow.push(now);
  buckets.set(key, inWindow);

  // Calcule le reset : le plus vieux timestamp + windowMs
  const oldestTs = inWindow[0];
  const resetAt = Math.floor((oldestTs + config.windowMs) / 1000);

  return {
    allowed: true,
    remaining: config.max - inWindow.length,
    resetAt,
    retryAfterSec: 0,
  };
}

/**
 * Extrait l'IP du client à partir des headers (proxy-aware).
 *
 * Ordre de priorité :
 *  1. x-forwarded-for (premier IP, proxy/CDN)
 *  2. x-real-ip (Nginx)
 *  3. fallback "unknown" (ne devrait jamais arriver en prod)
 *
 * IMPORTANT : si tu es derrière Cloudflare/Vercel, vérifie que
 * x-forwarded-for est bien forwardé (sinon tout le monde a la même IP = celle du proxy)
 */
export function getClientIp(headers: Headers): string {
  // x-forwarded-for : "client, proxy1, proxy2" → premier = client réel
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  const xri = headers.get("x-real-ip");
  if (xri) return xri.trim();

  return "unknown";
}

/**
 * Helper qui construit les headers RFC 6585 pour une réponse 429.
 *
 * Standards :
 *  - Retry-After : nombre de secondes avant de réessayer
 *  - RateLimit-Limit : limite max de la fenêtre
 *  - RateLimit-Remaining : requêtes restantes (toujours 0 ici)
 *  - RateLimit-Reset : timestamp Unix du reset
 */
export function buildRateLimitHeaders(
  result: RateLimitResult,
  config: RateLimitConfig,
): Record<string, string> {
  return {
    "Retry-After": String(result.retryAfterSec),
    "RateLimit-Limit": String(config.max),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(result.resetAt),
  };
}

/**
 * Configurations prédéfinies pour CPMSL.
 *
 * Pourquoi ces valeurs :
 *  - login : 5 essais / 15 min / IP → laisse retry humain mais bloque brute-force
 *  - api   : 100 req / min / IP → autorise UI normale mais bloque scraping
 */
export const RATE_LIMITS = {
  login: {
    name: "login",
    max: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
  } satisfies RateLimitConfig,

  api: {
    name: "api",
    max: 100,
    windowMs: 60 * 1000, // 1 minute
  } satisfies RateLimitConfig,
} as const;
