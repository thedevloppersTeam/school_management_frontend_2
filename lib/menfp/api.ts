/**
 * lib/menfp/api.ts — appels du navigateur vers les route handlers MENFP
 * (app/api/menfp/**), jamais vers le serveur directement.
 *
 * Les réponses sont validées contre le contrat par le route handler
 * (backendFetchValide) ; ici, seuls les types déduits du contrat sont utilisés.
 * Une erreur lève ApiError (lib/client-fetch.ts), avec le corps complet du refus.
 */
import { ApiError, clientFetch } from "@/lib/client-fetch"
import { nomDeFichier } from "./format"
import type {
  Apercu,
  CreationReferentiel,
  IdGrille,
  MatieresEntree,
  Niveaux,
  Parametres,
  Purge,
  RapportGele,
  Referentiel,
  SourcesEntree,
  Versions,
} from "./types"

const seg = encodeURIComponent

function json(method: string, corps: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) }
}

export const lireParametres = () => clientFetch<Parametres>("/api/menfp/parametres")

export const modifierSeuil = (seuil: string) =>
  clientFetch<Parametres>("/api/menfp/parametres/seuil", json("PUT", { seuil }))

export function televerserLogoMinistere(fichier: File) {
  const form = new FormData()
  form.append("logo", fichier)
  return clientFetch<Parametres>("/api/menfp/parametres/logo-ministere", { method: "POST", body: form })
}

/** Adresse de l'image du logo ; l'empreinte force le rechargement après un remplacement. */
export const adresseLogoMinistere = (empreinte: string) =>
  `/api/menfp/parametres/logo-ministere?v=${seg(empreinte)}`

export const lireNiveaux = (academicYearId: string) =>
  clientFetch<Niveaux>(`/api/menfp/annees/${seg(academicYearId)}/niveaux`)

export const lireReferentiel = (academicYearId: string, classTypeId: string) =>
  clientFetch<Referentiel>(`/api/menfp/referentiels/${seg(academicYearId)}/${seg(classTypeId)}`)

export const creerReferentiel = (academicYearId: string, classTypeId: string, entree: CreationReferentiel) =>
  clientFetch<Referentiel>(`/api/menfp/referentiels/${seg(academicYearId)}/${seg(classTypeId)}`, json("POST", entree))

export const importerGrille = (referentielId: string, grille: IdGrille) =>
  clientFetch<Referentiel>(`/api/menfp/referentiels/${seg(referentielId)}/import-grille`, json("POST", { grille }))

export const enregistrerMatieres = (referentielId: string, entree: MatieresEntree) =>
  clientFetch<Referentiel>(`/api/menfp/referentiels/${seg(referentielId)}/matieres`, json("POST", entree))

export const classerSources = (referentielId: string, entree: SourcesEntree) =>
  clientFetch<Referentiel>(`/api/menfp/referentiels/${seg(referentielId)}/sources`, json("POST", entree))

export const lireApercu = (classSessionId: string) =>
  clientFetch<Apercu>(`/api/menfp/salles/${seg(classSessionId)}/apercu`)

export const lireVersions = (classSessionId: string) =>
  clientFetch<Versions>(`/api/menfp/salles/${seg(classSessionId)}/rapports`)

export const geler = (classSessionId: string, motif: string | null) =>
  clientFetch<RapportGele>(`/api/menfp/salles/${seg(classSessionId)}/rapports`, json("POST", { motif }))

export const purger = (classSessionId: string, motif: string) =>
  clientFetch<Purge>(`/api/menfp/salles/${seg(classSessionId)}/rapports`, json("DELETE", { motif }))

/**
 * Télécharge le fichier Excel d'une version gelée (plan, question 15 : fetch +
 * Blob, pour pouvoir afficher un refus sur la ligne). Le nom du fichier est
 * celui du serveur (Content-Disposition).
 */
export async function telechargerExport(rapportId: string): Promise<void> {
  const chemin = `/api/menfp/rapports/${seg(rapportId)}/export`
  const res = await fetch(chemin, { credentials: "include" })
  if (!res.ok) {
    const texte = await res.text().catch(() => "")
    let corps: unknown = null
    try {
      corps = texte ? JSON.parse(texte) : null
    } catch {
      corps = null
    }
    const message =
      corps && typeof corps === "object" && typeof (corps as { message?: unknown }).message === "string"
        ? (corps as { message: string }).message
        : `API error ${res.status}`
    throw new ApiError(res.status, chemin, message, corps)
  }
  const blob = await res.blob()
  const nom = nomDeFichier(res.headers.get("content-disposition")) ?? "liste-menfp.xlsx"
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nom
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
