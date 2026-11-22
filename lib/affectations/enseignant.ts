/**
 * Colonne « Enseignant » de la configuration de l'année (lot ID-T-F-3, partie
 * frontend) : logique PURE, sans React ni DOM. Toute décision de la colonne vit
 * ici ; le composant ne fait qu'afficher et appeler le relais.
 *
 * Contrat : POST /api/class-subjects/teacher/:id (api.md du serveur, lot A) ;
 * `teacherId` désigne la FICHE (`teachers.id`), `null` retire l'enseignant.
 *
 * MINIMISATION (Q-2) : de GET /api/class-subjects, seul `teacherId` est lu ; le
 * nom vient de la liste des fiches (`lireFiches`, lib/enseignants/fiches.ts).
 * L'objet `teacher` de la réponse n'est jamais lu, et le relais le retire.
 */
import {
  comparerParNom,
  libelleEtatCompte,
  libelleEtatFiche,
  type Confirmation,
  type FicheLigne,
} from "@/lib/enseignants/fiches"

/** Valeur de l'option « Aucun enseignant » : non vide (une liste Radix refuse `value=""`), jamais un UUID. */
export const AUCUN_ENSEIGNANT = "aucun-enseignant"

export const LIBELLE_AUCUN_ENSEIGNANT = "Aucun enseignant"

/** Nature du geste, telle que la rend le serveur. */
export type GesteAffectation = "AFFECTATION" | "REMPLACEMENT" | "RETRAIT"

function objet(valeur: unknown): Record<string, unknown> | null {
  return valeur && typeof valeur === "object" && !Array.isArray(valeur)
    ? (valeur as Record<string, unknown>)
    : null
}

// ── Lecture des affectations ────────────────────────────────────────────────

/**
 * Projection du relais GET /api/class-subjects (Q-2) : chaque élément perd sa
 * clé `teacher` (la ligne `users` de l'enseignant) ; `teacherId` et le reste
 * sont gardés. Ce qui n'est pas un tableau (corps d'erreur) passe tel quel.
 * Ne modifie pas l'entrée.
 */
export function retirerEnseignantDetaille(brut: unknown): unknown {
  if (!Array.isArray(brut)) return brut
  return brut.map((element) => {
    const affectation = objet(element)
    if (!affectation) return element
    const sansEnseignant = { ...affectation }
    delete sansEnseignant.teacher
    return sansEnseignant
  })
}

/** Enseignant posé sur une affectation : `teacherId` seulement, jamais l'objet `teacher`. */
export function lireEnseignantAffecte(brut: unknown): string | null {
  const teacherId = objet(brut)?.teacherId
  return typeof teacherId === "string" && teacherId ? teacherId : null
}

// ── Options de la liste ─────────────────────────────────────────────────────

export interface OptionEnseignant {
  valeur: string
  libelle: string
}

/** Enseignant déjà affecté qui ne peut plus être choisi (A6) : affiché, jamais proposé. */
export interface EnseignantInactifEnPlace extends OptionEnseignant {
  /** État en mots : « Fiche inactive », « Compte désactivé » ou « Fiche introuvable ». */
  etat: string
}

export interface ChoixEnseignants {
  /** Fiches actives à compte actif (A2), triées par nom, prénom, identifiant. */
  actifs: OptionEnseignant[]
  /** L'enseignant en place, s'il n'est pas parmi les actifs ; sinon null. */
  inactifEnPlace: EnseignantInactifEnPlace | null
}

const peutRecevoir = (f: FicheLigne) => f.ficheActive && f.compteActif

const nomComplet = (f: Pick<FicheLigne, "lastname" | "firstname">) => `${f.lastname} ${f.firstname}`.trim()

/**
 * Options de la liste d'une ligne. Seules les fiches qui peuvent recevoir une
 * affectation sont proposées ; les autres fiches inactives sont masquées (Q-5),
 * sauf l'enseignant en place, gardé à part avec son état (A6). Deux homonymes
 * sont distingués par leur identifiant de connexion. Ne modifie pas l'entrée.
 */
export function optionsEnseignants(fiches: readonly FicheLigne[], teacherIdEnPlace: string | null): ChoixEnseignants {
  const retenues = fiches.filter(peutRecevoir).sort(comparerParNom)
  const occurrences = new Map<string, number>()
  for (const f of retenues) occurrences.set(nomComplet(f), (occurrences.get(nomComplet(f)) ?? 0) + 1)
  const actifs = retenues.map((f) => ({
    valeur: f.id,
    libelle: (occurrences.get(nomComplet(f)) ?? 0) > 1 ? `${nomComplet(f)} (${f.username})` : nomComplet(f),
  }))

  if (teacherIdEnPlace === null || actifs.some((o) => o.valeur === teacherIdEnPlace)) {
    return { actifs, inactifEnPlace: null }
  }
  const enPlace = fiches.find((f) => f.id === teacherIdEnPlace)
  const inactifEnPlace = enPlace
    ? {
        valeur: enPlace.id,
        libelle: nomComplet(enPlace),
        etat: enPlace.ficheActive ? libelleEtatCompte(false) : libelleEtatFiche(false),
      }
    : { valeur: teacherIdEnPlace, libelle: LIBELLE_ENSEIGNANT_INCONNU, etat: "Fiche introuvable" }
  return { actifs, inactifEnPlace }
}

/** Nom d'une fiche, inactives comprises ; null si absente ou sans enseignant. */
export function nomEnseignant(fiches: readonly FicheLigne[], teacherId: string | null): string | null {
  if (teacherId === null) return null
  const f = fiches.find((x) => x.id === teacherId)
  return f ? nomComplet(f) || null : null
}

// ── Choix et corps envoyé ───────────────────────────────────────────────────

/** Valeur de la liste pour un enseignant (ou aucun). */
export function valeurDuChoix(teacherId: string | null): string {
  return teacherId ?? AUCUN_ENSEIGNANT
}

/** Enseignant choisi dans la liste ; null pour « Aucun enseignant ». */
export function teacherIdDuChoix(valeur: string): string | null {
  return valeur === AUCUN_ENSEIGNANT ? null : valeur
}

/** Corps de POST /api/class-subjects/teacher/:id : exactement une clé (corps strict). */
export function corpsAffectation(teacherId: string | null): { teacherId: string | null } {
  return { teacherId }
}

/** Faut-il envoyer quelque chose ? Rien quand le choix ne change pas l'enseignant. */
export function estUnChangement(avant: string | null, apres: string | null): boolean {
  return avant !== apres
}

/** Confirmation pour le retrait seulement (Q-3) ; un remplacement est nommé dans « Enregistré ». */
export function demandeConfirmation(avant: string | null, apres: string | null): boolean {
  return avant !== null && apres === null
}

// ── Textes ──────────────────────────────────────────────────────────────────

/** Libellé accessible de la liste d'une ligne (A4) : la filière distingue les lignes d'un groupe d'examen. */
export function libelleListe(matiere: string, trackCode: string | null): string {
  return trackCode ? `Enseignant de ${matiere}, filière ${trackCode}` : `Enseignant de ${matiere}`
}

/** Libellé d'un enseignant en place dont la fiche n'est pas dans la liste des fiches. */
export const LIBELLE_ENSEIGNANT_INCONNU = "Enseignant inconnu"

/**
 * Enseignant en place, en texte : son nom, « Aucun enseignant », ou « Enseignant inconnu ».
 * Sert à l'année archivée (A7, Q-7) : le nom en texte simple, sans liste.
 */
export function texteEnseignantEnPlace(fiches: readonly FicheLigne[], teacherId: string | null): string {
  if (teacherId === null) return LIBELLE_AUCUN_ENSEIGNANT
  return nomEnseignant(fiches, teacherId) ?? LIBELLE_ENSEIGNANT_INCONNU
}

export const MESSAGE_EN_COURS = "Enregistrement…"

/** Message « Enregistré » d'une ligne ; au remplacement, il nomme l'ancien et le nouvel enseignant (Q-3). */
export function messageEnregistre({
  geste,
  matiere,
  ancien,
  nouveau,
}: {
  geste: GesteAffectation
  matiere: string
  ancien: string | null
  nouveau: string | null
}): string {
  const debut = `${matiere} : enregistré.`
  if (geste === "RETRAIT") return `${debut} ${ancien ?? "L'enseignant"} est retiré.`
  if (geste === "REMPLACEMENT") {
    return `${debut} ${nouveau ?? "Un autre enseignant"} remplace ${ancien ?? "l'enseignant précédent"}.`
  }
  return `${debut} ${nouveau ?? "L'enseignant"} est affecté.`
}

/** Message d'échec d'une ligne, persistant jusqu'au geste suivant (A3). */
export function messageEchec(motif: string): string {
  return `Échec : ${motif}`
}

/** Fenêtre de confirmation du retrait (A5) : l'effet EXACT (D-82 : notes intactes, lecture perdue). */
export function confirmationRetrait({ nom, matiere, salle }: { nom: string; matiere: string; salle: string }): Confirmation {
  return {
    titre: `Retirer l'enseignant de ${matiere} ?`,
    effet: `${nom} n'enseignera plus ${matiere} dans la salle ${salle} et n'aura plus accès à ses notes. Les notes déjà saisies sont conservées.`,
    action: "Retirer l'enseignant",
  }
}
