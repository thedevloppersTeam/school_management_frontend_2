/**
 * Logger structuré hybride server/client — SEC-A09-001 / SEC-A09-002
 *
 * ARCHITECTURE
 * ────────────
 * - Côté SERVER (BFF routes, Server Components, lib/) :
 *     → Utilise Pino : JSON structuré, redaction automatique des PII,
 *       format compatible avec ingestion future (Loki, Datadog, etc.)
 *
 * - Côté CLIENT (composants 'use client', hooks) :
 *     → DEV : downgrade vers console.* (visible en DevTools)
 *     → PROD : silencieux par défaut (no-op), sauf .error qui passe
 *
 * Une seule API publique : `logger.info(...)`, `logger.warn(...)`, `logger.error(...)`
 *
 * REDACTION (server only)
 * ───────────────────────
 * Les champs suivants sont automatiquement remplacés par "[REDACTED]" :
 *   - password, passwd, pwd
 *   - token, accessToken, refreshToken, sessionToken
 *   - authorization (header)
 *   - cookie, connect.sid
 *   - nisu (PII identifiant national élève)
 *   - email (PII)
 *   - phone, telephone (PII)
 *   - ssn, identityNumber (PII)
 *
 * USAGE
 * ─────
 * import { logger } from '@/lib/logger'
 *
 * logger.info({ event: 'user_login', userId: '123' }, 'User connected')
 * logger.warn({ ip: '1.2.3.4' }, 'rate_limit_exceeded')
 * logger.error({ err }, 'Backend timeout')
 *
 * IMPORTANT
 * ─────────
 * Toujours passer un OBJET en premier argument (contexte structuré),
 * et un STRING en second (message lisible). C'est la convention Pino.
 *
 * NE JAMAIS faire :
 *   logger.info(`User ${name} did X`)  ← anti-pattern, perd la structure
 *
 * FAIRE :
 *   logger.info({ user: name, action: 'X' }, 'user_action')
 */

// ─── Détection environnement ───────────────────────────────────────
const isServer = typeof window === "undefined";
const isDev = process.env.NODE_ENV !== "production";

// ─── Champs à rediger (PII + secrets) ──────────────────────────────
const REDACT_PATHS = [
  // Authentication / secrets
  "password",
  "passwd",
  "pwd",
  "*.password",
  "*.passwd",
  "*.pwd",
  "token",
  "accessToken",
  "refreshToken",
  "sessionToken",
  "*.token",
  "*.accessToken",
  "*.refreshToken",
  "*.sessionToken",
  "authorization",
  "headers.authorization",
  "headers.cookie",
  "cookie",
  "*.cookie",

  // PII (RGPD)
  "nisu",
  "*.nisu",
  "email",
  "*.email",
  "phone",
  "telephone",
  "*.phone",
  "*.telephone",
  "ssn",
  "identityNumber",
  "*.ssn",
  "*.identityNumber",
];

// ─── Type de l'API publique ─────────────────────────────────────────
type LogContext = Record<string, unknown> | Error;

export interface Logger {
  info(ctx: LogContext, msg?: string): void;
  warn(ctx: LogContext, msg?: string): void;
  error(ctx: LogContext, msg?: string): void;
  debug(ctx: LogContext, msg?: string): void;
  child(bindings: Record<string, unknown>): Logger;
}

// ─── Implementation SERVER (Pino) ──────────────────────────────────
function createServerLogger(): Logger {
  // Import dynamique pour éviter d'embarquer Pino dans le bundle client
  // (Next.js élimine ce code côté client par tree-shaking + isServer check)

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pino = require("pino");

  const pinoLogger = pino({
    level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),

    // Format ISO timestamps (utile pour ingestion Loki/Datadog)
    timestamp: pino.stdTimeFunctions.isoTime,

    // Redaction des PII / secrets
    redact: {
      paths: REDACT_PATHS,
      censor: "[REDACTED]",
    },

    // Base : champs ajoutés à TOUS les logs
    base: {
      service: "cpmsl-frontend",
      env: process.env.NODE_ENV || "development",
    },

    // En dev : pretty print pour lisibilité
    // En prod : JSON pur pour ingestion
    transport: isDev
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss.l",
            ignore: "pid,hostname,service,env",
          },
        }
      : undefined,
  });

  return pinoLogger as Logger;
}

// ─── Implementation CLIENT (console downgrade) ────────────────────
function createClientLogger(): Logger {
  // En PROD côté client : silencieux pour info/warn/debug
  // .error reste actif (visible en DevTools, capturé par Sentry plus tard)

  const noop = () => {};

  const formatArgs = (ctx: LogContext, msg?: string): unknown[] => {
    if (msg) {
      return [`[${msg}]`, ctx];
    }
    return [ctx];
  };

  if (isDev) {
    // DEV : tout est visible en console
    return {
      info: (ctx, msg) => console.info(...formatArgs(ctx, msg)),
      warn: (ctx, msg) => console.warn(...formatArgs(ctx, msg)),
      error: (ctx, msg) => console.error(...formatArgs(ctx, msg)),
      debug: (ctx, msg) => console.debug(...formatArgs(ctx, msg)),
      child: () => createClientLogger(),
    };
  }

  // PROD : silencieux sauf error
  return {
    info: noop,
    warn: noop,
    debug: noop,
    error: (ctx, msg) => {
      // En prod côté client : on garde uniquement les erreurs
      // Visible en DevTools si user signale un bug
      // Sera capturé par Sentry quand on l'installera
      console.error(...formatArgs(ctx, msg));
    },
    child: () => createClientLogger(),
  };
}

// ─── Export singleton ──────────────────────────────────────────────
export const logger: Logger = isServer
  ? createServerLogger()
  : createClientLogger();
