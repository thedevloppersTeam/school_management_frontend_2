/**
 * lib/env.ts
 *
 * Validation centralisée des variables d'environnement.
 *
 * Politique sécurité :
 *  - Production : BACKEND_URL doit obligatoirement être en HTTPS.
 *  - Développement/Test : HTTP autorisé uniquement pour localhost / 127.0.0.1 / ::1.
 *  - Aucun backend HTTP distant n’est autorisé, même en développement.
 *
 * Exemples acceptés :
 *  - https://api.example.com
 *  - http://localhost:3001 en développement
 *  - http://127.0.0.1:3001 en développement
 *
 * Exemples refusés :
 *  - http://api.example.com
 *  - http://192.168.1.20:3001
 *  - http://dev-api.company.local
 */

import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

const LOCAL_HTTP_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
])

function isSecureBackendUrl(value: string): boolean {
  try {
    const url = new URL(value)

    if (url.protocol === "https:") {
      return true
    }

    const isLocalRuntime =
      process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === "test"

    const isLocalHttpBackend =
      url.protocol === "http:" &&
      LOCAL_HTTP_HOSTS.has(url.hostname)

    return isLocalRuntime && isLocalHttpBackend
  } catch {
    return false
  }
}

export const env = createEnv({
  /**
   * Variables côté serveur uniquement.
   * JAMAIS exposées au navigateur.
   */
  server: {
    BACKEND_URL: z
      .string()
      .url("BACKEND_URL doit être une URL valide")
      .refine(isSecureBackendUrl, {
        message:
          "BACKEND_URL doit être en HTTPS. HTTP est autorisé uniquement en développement/test sur localhost, 127.0.0.1 ou ::1.",
      }),

    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  /**
   * Variables exposées au client.
   * Aucune pour l’instant.
   */
  client: {},

  /**
   * Mapping runtime.
   */
  runtimeEnv: {
    BACKEND_URL: process.env.BACKEND_URL,
    NODE_ENV: process.env.NODE_ENV,
  },

  /**
   * À utiliser uniquement si nécessaire en CI.
   * Éviter de mettre SKIP_ENV_VALIDATION=true en production.
   */
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",

  /**
   * Rejette les chaînes vides.
   */
  emptyStringAsUndefined: true,
})