/**
 * lib/backend-url.mjs
 *
 * Adresse du backend utilisée par next.config.mjs (CSP, rewrite /uploads).
 * Fichier .mjs sans dépendance : next.config.mjs l'importe avant toute
 * compilation TypeScript.
 *
 * Priorité :
 * 1. NEXT_PUBLIC_BACKEND_URL
 * 2. BACKEND_URL
 *
 * Aucune valeur par défaut : si aucune des deux n'est posée (ou si elles
 * sont vides), on lève une erreur. Le dépôt est public, il ne contient
 * aucune adresse réelle de serveur (A11).
 */

export const BACKEND_URL_MANQUANTE =
  "Adresse du backend absente : posez la variable d'environnement BACKEND_URL " +
  "(ou NEXT_PUBLIC_BACKEND_URL). Aucune adresse par défaut n'est fournie. " +
  "Voir le README, section « Variables d'environnement ».";

/**
 * @param {Record<string, string | undefined>} env
 * @returns {string} l'adresse, sans barre oblique finale
 */
export function resolveBackendUrl(env) {
  for (const name of ["NEXT_PUBLIC_BACKEND_URL", "BACKEND_URL"]) {
    const value = (env[name] ?? "").trim();
    if (value !== "") return value.replace(/\/+$/, "");
  }
  throw new Error(BACKEND_URL_MANQUANTE);
}
