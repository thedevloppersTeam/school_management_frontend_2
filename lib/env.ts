/**
 * lib/env.ts
 *
 * Validation centralisée des variables d'environnement (FF1).
 *
 * Avantages :
 *  - Validation au démarrage : si BACKEND_URL manque ou est invalide,
 *    `npm run dev` / `npm run build` plante avec un message clair.
 *  - Type-safety : env.BACKEND_URL est garanti string (pas string|undefined).
 *  - Séparation server/client : impossible d'exposer un secret server au navigateur.
 *
 * Pour ajouter une nouvelle variable :
 *  1. Ajouter au schema (server: ou client:)
 *  2. Ajouter dans runtimeEnv
 *  3. Importer depuis '@/lib/env' partout au lieu de process.env
 */

import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
  /**
   * Variables côté serveur uniquement.
   * JAMAIS exposées au navigateur. Si vous tentez de les utiliser
   * dans un Client Component, TypeScript refusera de compiler.
   */
  server: {
    BACKEND_URL: z
      .string()
      .url("BACKEND_URL doit être une URL valide")
      .startsWith("https://", "BACKEND_URL doit commencer par https:// (HTTP non autorisé)"),

    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  /**
   * Variables exposées au client (navigateur).
   * Doivent commencer par NEXT_PUBLIC_ par convention Next.js.
   * Vide pour l'instant — aucune variable client à valider.
   */
  client: {},

  /**
   * Mapping runtime — Next.js a besoin de cette indirection pour
   * que les variables soient remplacées au build pour le client.
   */
  runtimeEnv: {
    BACKEND_URL: process.env.BACKEND_URL,
    NODE_ENV: process.env.NODE_ENV,
  },

  /**
   * Optionnel : permet à `npm run build` de passer même si .env.local
   * n'existe pas (utile pour les builds CI). Mettre à false si vous
   * voulez que le build CI échoue sans .env.
   */
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",

  /**
   * Validation stricte des chaînes vides — Zod par défaut accepte ""
   * pour string(). On force le rejet ici (plus sûr).
   */
  emptyStringAsUndefined: true,
})