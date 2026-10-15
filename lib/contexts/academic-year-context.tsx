"use client"

/**
 * Année scolaire active — source unique pour toute la zone /admin.
 *
 * ── LE DÉFAUT QU'IL CORRIGE ─────────────────────────────────────────────────
 * Six écrans appelaient `fetchActiveAcademicYear()` chacun de leur côté, au
 * montage. Aucun n'avait de moyen d'apprendre qu'un autre venait de changer
 * l'année active. Concrètement : activer une année depuis
 * `/admin/academic-years` rafraîchissait bien la liste, mais le badge du
 * bandeau — monté une seule fois, tout en haut — restait figé sur l'ancienne
 * valeur jusqu'au rechargement complet de la page.
 *
 * Le défaut préexistait à la réactivation d'année archivée : il touchait déjà
 * l'activation d'une année en préparation.
 *
 * ── CE QUE LE CONTEXTE GARANTIT, ET CE QU'IL NE GARANTIT PAS ────────────────
 * Il garantit UNE seule lecture de référence, et un point unique pour la
 * réactualiser (`refresh`). Il ne surveille rien : aucun sondage, aucun
 * événement serveur. Un changement fait dans un AUTRE onglet du navigateur ne
 * sera pas vu. C'est suffisant ici — l'application est mono-administratrice
 * (voir docs/SPEC-EXTRACT.md) — et il vaut mieux l'écrire que le laisser
 * découvrir.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { fetchActiveAcademicYear, type AcademicYear } from "@/lib/api/dashboard"

interface AcademicYearContextValue {
  /** Année active, ou `null` si aucune n'est définie côté serveur. */
  activeYear: AcademicYear | null
  /** `true` tant que la première lecture n'a pas abouti. */
  loading: boolean
  /**
   * Relit l'année active depuis le serveur et met à jour tous les
   * consommateurs. À appeler après tout geste qui change `isCurrent`.
   */
  refresh: () => Promise<void>
}

const AcademicYearContext = createContext<AcademicYearContextValue | null>(null)

export function AcademicYearProvider({ children }: { children: ReactNode }) {
  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setActiveYear(await fetchActiveAcademicYear())
    } catch {
      // `fetchActiveAcademicYear` rend déjà `null` sur 404 — « aucune année
      // active » est un état normal, pas une panne. Ce catch ne couvre que la
      // coupure réseau, et on garde alors la dernière valeur connue plutôt que
      // d'effacer le bandeau sur un incident passager.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo(
    () => ({ activeYear, loading, refresh }),
    [activeYear, loading, refresh],
  )

  return (
    <AcademicYearContext.Provider value={value}>
      {children}
    </AcademicYearContext.Provider>
  )
}

/**
 * Accès à l'année active.
 *
 * Jette hors provider, délibérément : un `undefined` silencieux se serait
 * manifesté comme un bandeau vide ou une page bloquée en chargement, loin de
 * sa cause. Le message nomme le montage manquant.
 */
export function useAcademicYearContext(): AcademicYearContextValue {
  const ctx = useContext(AcademicYearContext)
  if (!ctx) {
    throw new Error(
      "useAcademicYearContext doit être utilisé dans un <AcademicYearProvider>. " +
        "Le provider est monté dans app/admin/layout.tsx : cet écran est-il bien sous /admin ?",
    )
  }
  return ctx
}
