/**
 * Garde de rôle des coques /admin et /teacher (lot ID-T-F-1, D-TF1-1, D-TF1-2).
 *
 * Fonction PURE : aucune lecture réseau, aucun accès au navigateur. La coque lit
 * `GET /api/auth/me` (getMe, null si la session est invalide ou si le compte n'a
 * aucun rôle), passe la réponse ici, puis applique la décision.
 *
 * Cette garde ne protège pas les données : le serveur refuse lui-même (401, 403).
 * Elle empêche un compte d'arriver sur une coque qui n'est pas la sienne.
 *
 * Règles :
 *  - aucune réponse de /me → /login?expired=1 (proxy.ts purge alors le cookie mort,
 *    sans quoi /login renverrait vers /admin) ;
 *  - administrateur (ADMIN ou SYSTEM_ADMIN, enseignant ou non, D-TF1-4) → coque
 *    /admin ; sur /teacher : redirection vers /admin/dashboard ;
 *  - enseignant sans rôle d'administration → coque /teacher ; sur /admin :
 *    redirection vers /teacher/dashboard (E-2) ;
 *  - tout autre compte → /login, après fermeture de la session : avec le cookie
 *    encore présent, proxy.ts renverrait /login vers /admin/dashboard (boucle).
 */
import { estAdministrateur } from "@/lib/enseignants/fiches"

export type Espace = "admin" | "enseignant"

export const ACCUEIL_ADMIN = "/admin/dashboard"
export const ACCUEIL_ENSEIGNANT = "/teacher/dashboard"
export const CONNEXION_EXPIREE = "/login?expired=1"
export const CONNEXION = "/login"

export type DecisionDeGarde =
  | { readonly action: "afficher" }
  | { readonly action: "rediriger"; readonly vers: string; readonly fermerLaSession: boolean }

const objet = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null

/**
 * Le compte connecté a-t-il le rôle TEACHER ? `roles` (depuis le lot 2) fait foi ;
 * à défaut, `type`, le rôle le plus fort (même règle qu'estAdministrateur).
 */
export function estEnseignant(moi: unknown): boolean {
  const compte = objet(moi)
  if (!compte) return false
  if (Array.isArray(compte.roles)) return compte.roles.includes("TEACHER")
  return compte.type === "TEACHER"
}

const rediriger = (vers: string, fermerLaSession = false): DecisionDeGarde => ({
  action: "rediriger",
  vers,
  fermerLaSession,
})

/** Décision de la coque `espace` pour la réponse de /me (null : pas de session valide). */
export function decisionDeGarde(espace: Espace, moi: unknown): DecisionDeGarde {
  if (objet(moi) === null) return rediriger(CONNEXION_EXPIREE)
  if (estAdministrateur(moi)) {
    return espace === "admin" ? { action: "afficher" } : rediriger(ACCUEIL_ADMIN)
  }
  if (estEnseignant(moi)) {
    return espace === "enseignant" ? { action: "afficher" } : rediriger(ACCUEIL_ENSEIGNANT)
  }
  return rediriger(CONNEXION, true)
}

/** Libellé du rôle affiché dans la coque enseignant (« Mon compte »). */
export function libelleDuRole(moi: unknown): string {
  if (estAdministrateur(moi)) return "Administrateur"
  if (estEnseignant(moi)) return "Enseignant"
  return "Compte"
}
