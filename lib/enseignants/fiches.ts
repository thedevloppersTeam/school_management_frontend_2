/**
 * Écran « Enseignants » (lot ID-T-F) : logique PURE, sans React ni DOM.
 *
 * Lecteurs TOLÉRANTS des réponses du serveur : un champ inconnu est ignoré, un
 * champ attendu absent ou mal typé prend une valeur neutre, jamais une
 * exception. MINIMISATION : seuls les champs que l'écran affiche ou envoie sont
 * gardés ; l'adresse, le téléphone et le courriel d'une fiche ne quittent
 * jamais la réponse brute.
 *
 * Contrat : api.md du serveur, lot ID-T (liste, création, état de la fiche) et
 * lot ID-T-C (comptes candidats, `address` et `phone` facultatifs).
 */

/** Une ligne de la liste des fiches : la fiche et ce que l'écran montre du compte. */
export interface FicheLigne {
  /** UUID de la fiche (`teachers.id`), cible de `fiche-status/:id`. */
  id: string
  /** UUID du compte rattaché : sert à masquer l'action sur sa propre fiche. */
  userId: string
  lastname: string
  firstname: string
  username: string
  /** État de la FICHE (`teachers.is_active`). */
  ficheActive: boolean
  /** État du COMPTE (`user.isActive`), affiché en lecture seule (D-TF4). */
  compteActif: boolean
}

/** Un compte candidat à une fiche (D-TC2) : exactement ces cinq champs. */
export interface Candidat {
  id: string
  firstname: string
  lastname: string
  username: string
  isActive: boolean
}

function objet(valeur: unknown): Record<string, unknown> | null {
  return valeur && typeof valeur === "object" && !Array.isArray(valeur)
    ? (valeur as Record<string, unknown>)
    : null
}

function texte(valeur: unknown): string {
  return typeof valeur === "string" ? valeur : ""
}

/**
 * Liste des fiches (`POST /api/teachers/`). Une entrée sans `id` ni `userId`
 * texte est écartée : l'écran ne saurait ni l'afficher ni agir dessus. Un état
 * absent ou mal typé vaut « inactif » : l'écran n'annonce jamais un accès qu'il
 * n'a pas lu.
 */
export function lireFiches(brut: unknown): FicheLigne[] {
  if (!Array.isArray(brut)) return []
  const lignes: FicheLigne[] = []
  for (const element of brut) {
    const fiche = objet(element)
    if (!fiche) continue
    const id = texte(fiche.id)
    const userId = texte(fiche.userId)
    if (!id || !userId) continue
    const compte = objet(fiche.user)
    lignes.push({
      id,
      userId,
      lastname: texte(compte?.lastname),
      firstname: texte(compte?.firstname),
      username: texte(compte?.username),
      ficheActive: fiche.isActive === true,
      compteActif: compte?.isActive === true,
    })
  }
  return lignes
}

/** Comptes candidats (`GET /api/teachers/candidats`) : les cinq champs, rien d'autre. */
export function lireCandidats(brut: unknown): Candidat[] {
  if (!Array.isArray(brut)) return []
  const candidats: Candidat[] = []
  for (const element of brut) {
    const compte = objet(element)
    if (!compte) continue
    const id = texte(compte.id)
    if (!id) continue
    candidats.push({
      id,
      firstname: texte(compte.firstname),
      lastname: texte(compte.lastname),
      username: texte(compte.username),
      isActive: compte.isActive === true,
    })
  }
  return candidats
}

// ── Libellés d'état (D-TF1 : en mots, jamais par la couleur seule) ──────────

export function libelleEtatFiche(active: boolean): string {
  return active ? "Fiche active" : "Fiche inactive"
}

export function libelleEtatCompte(actif: boolean): string {
  return actif ? "Compte actif" : "Compte désactivé"
}

/**
 * Pourquoi une fiche ACTIVE ne donne pas accès (D-TF4) : le compte est
 * désactivé, et un compte désactivé n'a aucun rôle. null quand il n'y a rien à
 * expliquer.
 */
export function motifSansAcces(ligne: Pick<FicheLigne, "ficheActive" | "compteActif">): string | null {
  return ligne.ficheActive && !ligne.compteActif
    ? "Sans accès enseignant tant que le compte est désactivé."
    : null
}

// ── Recherche et tri ────────────────────────────────────────────────────────

/** Minuscules, sans accents ni espaces de bord : « Élodie » se trouve par « elodie ». */
export function normaliser(valeur: string): string {
  return valeur.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("fr").trim()
}

const COMPARATEUR = new Intl.Collator("fr", { sensitivity: "base" })

/** Tri par nom, puis prénom, puis identifiant de connexion (ordre stable et lisible). */
export function comparerParNom(
  a: Pick<FicheLigne, "lastname" | "firstname" | "username">,
  b: Pick<FicheLigne, "lastname" | "firstname" | "username">,
): number {
  return (
    COMPARATEUR.compare(a.lastname, b.lastname) ||
    COMPARATEUR.compare(a.firstname, b.firstname) ||
    COMPARATEUR.compare(a.username, b.username)
  )
}

/**
 * Recherche texte sur le nom, le prénom et l'identifiant de connexion, sans la
 * casse ni les accents ; chaque mot de la recherche doit se trouver dans l'un
 * des trois champs. Résultat trié par nom (D-TF1). Ne modifie pas l'entrée.
 */
export function filtrerEtTrier(lignes: readonly FicheLigne[], recherche: string): FicheLigne[] {
  const mots = normaliser(recherche).split(/\s+/).filter(Boolean)
  const retenues = mots.length === 0
    ? [...lignes]
    : lignes.filter((ligne) => {
        const champs = [ligne.lastname, ligne.firstname, ligne.username].map(normaliser)
        return mots.every((mot) => champs.some((champ) => champ.includes(mot)))
      })
  return retenues.sort(comparerParNom)
}

// ── Droits de l'écran ───────────────────────────────────────────────────────

/** Rôles de l'administration : seuls admis sur la page (D-TF1). */
const ROLES_ADMIN = new Set(["ADMIN", "SYSTEM_ADMIN"])

/**
 * Le compte connecté (`GET /api/users/me`) a-t-il un rôle d'administration ?
 * `roles` (depuis le lot 2) fait foi ; à défaut, `type`, le rôle le plus fort.
 * Un ADMIN qui est aussi enseignant a `type` ADMIN : il est admis. Masquer la
 * page n'est pas une sécurité : le serveur refuse lui-même (403).
 */
export function estAdministrateur(moi: unknown): boolean {
  const compte = objet(moi)
  if (!compte) return false
  if (Array.isArray(compte.roles)) {
    return compte.roles.some((role) => typeof role === "string" && ROLES_ADMIN.has(role))
  }
  return typeof compte.type === "string" && ROLES_ADMIN.has(compte.type)
}

/**
 * Peut-on agir sur cette fiche ? Non sur la sienne : le serveur répond 403
 * IDENTITE_ROLE_DE_SOI, le bouton est donc masqué (D-TF3). Sans compte connecté
 * connu, aucune action n'est proposée.
 */
export function peutChangerLEtat(ligne: Pick<FicheLigne, "userId">, moiId: string | null | undefined): boolean {
  return Boolean(moiId) && ligne.userId !== moiId
}

// ── Confirmation (D-TF3) ────────────────────────────────────────────────────

export interface Confirmation {
  titre: string
  effet: string
  action: string
}

/** Texte de la fenêtre de confirmation : l'effet EXACT du geste demandé. */
export function confirmationEtatFiche(activer: boolean): Confirmation {
  return activer
    ? {
        titre: "Activer la fiche enseignant ?",
        effet:
          "Le compte reçoit le rôle enseignant à sa prochaine action, si le compte est actif. Ses affectations et les notes déjà saisies sont conservées.",
        action: "Activer la fiche",
      }
    : {
        titre: "Désactiver la fiche enseignant ?",
        effet:
          "Le compte perd le rôle enseignant à sa prochaine action. Ses affectations et les notes déjà saisies sont conservées.",
        action: "Désactiver la fiche",
      }
}

// ── Création d'une fiche (D-TF2) ────────────────────────────────────────────

/** Champs de la fenêtre de création, tels que saisis. */
export interface SaisieFiche {
  userId: string
  address: string
  phone: string
  email: string
  hireDate: string
  role: string
  description: string
}

export const SAISIE_VIDE: SaisieFiche = {
  userId: "",
  address: "",
  phone: "",
  email: "",
  hireDate: "",
  role: "",
  description: "",
}

/** Bornes du contrat serveur (`phone` 20 caractères, `role` 100, recherche `q` 100). */
export const LONGUEUR_MAX = { phone: 20, role: 100, recherche: 100 } as const

/**
 * Adresse du relais des candidats (`GET /api/teachers/candidats?q=`, lot ID-T-C). Le serveur
 * borne `q` à 100 caractères après `trim()` et répond 400 au-delà : on applique la même règle
 * ici, pour qu'une recherche trop longue ne devienne jamais une erreur. Recherche vide : pas de `q`.
 */
export function adresseDesCandidats(recherche: string): string {
  const q = recherche.trim().slice(0, LONGUEUR_MAX.recherche)
  return q ? `/api/teachers/candidats?q=${encodeURIComponent(q)}` : "/api/teachers/candidats"
}

/** Corps de `POST /api/teachers/create`. */
export type CorpsCreation = { userId: string } & Partial<Record<Exclude<keyof SaisieFiche, "userId">, string>>

const CHAMPS_FACULTATIFS = ["address", "phone", "email", "hireDate", "role", "description"] as const

/**
 * Corps envoyé au serveur : `userId` et les seuls champs facultatifs remplis,
 * sans leurs espaces de bord. Un champ vide est OMIS, jamais envoyé en `""`
 * (le serveur refuse la chaîne vide ; absent, il vaut `null`).
 */
export function corpsDeCreation(saisie: SaisieFiche): CorpsCreation {
  const corps: CorpsCreation = { userId: saisie.userId.trim() }
  for (const champ of CHAMPS_FACULTATIFS) {
    const valeur = saisie[champ].trim()
    if (valeur) corps[champ] = valeur
  }
  return corps
}

/** Le formulaire peut-il partir ? Un compte choisi, et des bornes respectées. */
export function saisieRecevable(saisie: SaisieFiche): boolean {
  return (
    saisie.userId.trim() !== "" &&
    saisie.phone.trim().length <= LONGUEUR_MAX.phone &&
    saisie.role.trim().length <= LONGUEUR_MAX.role
  )
}
