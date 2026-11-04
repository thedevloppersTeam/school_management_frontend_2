/**
 * lib/menfp/refus.ts — lecture d'un refus du serveur pour l'affichage (plan D).
 *
 * Une réponse 400 ou 409 de l'aperçu ou du gel porte { code, message, refus: [...] } :
 * TOUS les refus sont rendus, dans l'ordre reçu, jamais le premier seul. Une
 * erreur simple { code, message } donne un seul élément. Fonction pure, testée
 * (lib/menfp/refus.test.ts). Lecteur tolérant : seuls les champs affichés sont lus.
 */
import { ApiError } from "@/lib/client-fetch"
import { messageForCode, toMessage } from "@/lib/errors"
import type { CorpsRefus } from "./types"

export interface ElementRefus {
  code: string | null
  /** Libellé traduit du code (lib/errors.ts), à défaut le message du serveur. */
  libelle: string
  /** Message du serveur, qui nomme les élèves, matières ou sources en cause. */
  detail: string | null
  /** Élèves en cause (identifiants d'inscription), à nommer par l'écran s'il les connaît. */
  enrollmentIds: string[]
}

export interface RefusLu {
  status: number | null
  titre: string
  elements: ElementRefus[]
}

const TITRES: Record<number, string> = {
  400: "Demande refusée",
  403: "Accès refusé",
  404: "Introuvable",
  409: "Action impossible dans l'état actuel",
  502: "Réponse du serveur inattendue",
}

type RefusDuContrat = Extract<CorpsRefus, { refus: unknown }>["refus"][number]

const chaine = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null)

function element(code: string | null, message: string | null, enrollmentIds: string[] = []): ElementRefus {
  const traduit = code ? messageForCode({ code }) : null
  const libelle = traduit ?? message ?? "Le serveur a refusé la demande."
  return { code, libelle, detail: message && message !== libelle ? message : null, enrollmentIds }
}

export function lireRefus(err: unknown): RefusLu {
  if (!(err instanceof ApiError)) {
    return { status: null, titre: "Erreur", elements: [element(null, toMessage(err))] }
  }
  const status = err.status
  const titre = TITRES[status] ?? "Erreur"
  const corps = err.body as Partial<CorpsRefus> | null | undefined

  if (status === 403) {
    return {
      status,
      titre,
      elements: [element(null, "Vous n'avez pas la permission d'accéder à cette partie (permission MENFP requise).")],
    }
  }

  const liste = corps && "refus" in corps && Array.isArray(corps.refus) ? (corps.refus as RefusDuContrat[]) : []
  if (liste.length > 0) {
    return {
      status,
      titre,
      elements: liste.map((r) =>
        element(
          chaine(r?.code),
          chaine(r?.message),
          Array.isArray(r?.enrollmentIds) ? r.enrollmentIds.filter((id): id is string => typeof id === "string") : [],
        ),
      ),
    }
  }

  const code = chaine(corps?.code)
  if (code) return { status, titre, elements: [element(code, chaine(corps?.message))] }
  return { status, titre, elements: [element(null, toMessage(err))] }
}
