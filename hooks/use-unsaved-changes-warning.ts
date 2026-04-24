"use client"

import { useEffect } from "react"

/**
 * Empêche l'utilisateur de quitter la page tant qu'il a des
 * modifications non enregistrées.
 *
 * Couvre :
 *   - fermeture d'onglet / de navigateur
 *   - rechargement de la page (F5)
 *   - navigation vers une autre URL via la barre d'adresse
 *
 * Note : la navigation interne via next/link / router.push() doit être
 * interceptée séparément avec un NavigationGuard plus sophistiqué. En MVP,
 * le beforeunload couvre 95% des cas de perte de données accidentelle.
 *
 * @param hasUnsavedChanges — true si des modifications doivent être
 *                            sauvegardées avant de pouvoir quitter
 */
export function useUnsavedChangesWarning(hasUnsavedChanges: boolean) {
  useEffect(() => {
    if (!hasUnsavedChanges) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Chrome/Edge exigent preventDefault + returnValue
      e.preventDefault()
      // Le message est ignoré par les navigateurs modernes (ils affichent
      // leur propre message standardisé), mais le champ doit être non-vide
      // pour déclencher le prompt.
      e.returnValue = ""
      return ""
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [hasUnsavedChanges])
}
