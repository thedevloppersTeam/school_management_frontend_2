/**
 * hooks/use-unsaved-changes-warning.ts
 *
 * Hook qui active l'alerte native du navigateur "Êtes-vous sûr de vouloir quitter
 * cette page ?" quand un formulaire a des modifications non sauvegardées.
 *
 * Évite les pertes de données accidentelles quand l'utilisateur :
 *   - ferme l'onglet
 *   - actualise la page (F5)
 *   - tape une nouvelle URL dans la barre d'adresse
 *   - clique sur un lien externe
 *
 * Note : ce hook ne couvre PAS la navigation interne Next.js (router.push).
 * Pour ça, il faudrait utiliser usePathname + un état de confirmation custom.
 *
 * Usage :
 *   const [dirty, setDirty] = useState(false)
 *   useUnsavedChangesWarning(dirty)
 *
 *   // Quand l'utilisateur modifie un champ → setDirty(true)
 *   // Après save → setDirty(false)
 *
 * @param hasUnsavedChanges  true = activer l'alerte, false = désactiver
 */
import { useEffect } from "react";

export function useUnsavedChangesWarning(hasUnsavedChanges: boolean): void {
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Standard moderne : preventDefault suffit pour déclencher l'alerte
      event.preventDefault();
      // Ancien standard (Chrome < 51, Safari < 13) : retourner une string
      // (le texte est ignoré par les navigateurs modernes pour éviter le phishing)
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);
}
