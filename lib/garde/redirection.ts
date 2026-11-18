/**
 * Application, dans le navigateur, d'une décision de garde (lib/garde/espace.ts).
 * Ne rejette jamais : la déconnexion est au mieux, la redirection a toujours lieu
 * (les coques l'appellent avec `void`, SonarCloud S9383).
 */
import { logout } from "@/lib/data/auth-data"

export async function appliquerRedirection(vers: string, fermerLaSession: boolean): Promise<void> {
  if (fermerLaSession) {
    try {
      await logout()
    } catch {
      // Au mieux : sans réponse du serveur, la redirection a lieu quand même.
    }
  }
  // replace : le retour arrière ne ramène pas sur la coque refusée.
  window.location.replace(vers)
}
