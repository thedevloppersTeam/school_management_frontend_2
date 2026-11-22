/**
 * Profil d'un élève dans le modal « Modifier l'élève ».
 *
 * Le modal n'envoie que ce qui a changé (MPE-2) : un champ absent du corps
 * reste inchangé côté serveur. C'est ce qui empêche un enregistrement d'effacer
 * un champ que l'écran n'avait pas chargé (défaut D-1 : le courriel de l'élève
 * effacé depuis « Tous les élèves »).
 *
 * Route POST /api/students/update/:id (lot serveur « profil élève », D-95) :
 * liste fermée de 12 champs ; un facultatif vidé est envoyé à null ; un
 * obligatoire vidé est refusé ici, avant l'envoi. Les bornes reprennent celles
 * du serveur pour le confort de saisie : le serveur reste l'autorité.
 *
 * Fonctions pures, sans React ni DOM, sans horloge : le jour civil est un paramètre.
 */
import { NISU_RULE_LABEL, NISU_REGEX, normalizeNisu } from '@/lib/nisu'
import { parseCivil } from '@/lib/calendar/dates'

/** Ordre du serveur (src/modules/inscriptions/domain/profilEleve.ts). */
export const CHAMPS_PROFIL = [
  'lastname', 'firstname', 'birthDate', 'gender', 'nisu', 'email',
  'address', 'motherName', 'fatherName', 'phone1', 'phone2', 'parentsEmail',
] as const

export type ChampProfil = (typeof CHAMPS_PROFIL)[number]

/** Valeurs du formulaire : toujours des chaînes ; sexe : "MALE", "FEMALE" ou "". */
export type SaisieProfil = Record<ChampProfil, string>

/** Profil tel qu'un écran le connaît, avec ses trous. */
export type ProfilInitial = Partial<Record<ChampProfil, string | null | undefined>>

/** Corps de POST /api/students/update/:id. null efface un champ facultatif. */
export type CorpsModificationProfil = Partial<Record<ChampProfil, string | null>>

export interface ErreurChamp {
  champ: ChampProfil
  message: string
}

export interface ResultatCorps {
  corps: CorpsModificationProfil
  erreurs: ErreurChamp[]
}

type Sorte = 'texte' | 'date' | 'courriel' | 'sexe' | 'nisu'

interface Regle {
  sorte: Sorte
  /** Message si le champ, renseigné au départ, est vidé ; absent : facultatif. */
  obligatoire?: string
  /** Longueur maximale, et le message qui la dit. */
  max?: number
  libelle: string
}

/** Bornes du serveur (D-95) : colonnes VarChar, adresse 255 (décision A6). */
export const REGLES_PROFIL: Record<ChampProfil, Regle> = {
  lastname: { sorte: 'texte', max: 100, libelle: 'Le nom', obligatoire: 'Le nom est obligatoire : il ne peut pas être vidé.' },
  firstname: { sorte: 'texte', max: 100, libelle: 'Le prénom', obligatoire: 'Le prénom est obligatoire : il ne peut pas être vidé.' },
  birthDate: { sorte: 'date', libelle: 'La date de naissance', obligatoire: 'La date de naissance est obligatoire : elle ne peut pas être vidée.' },
  gender: { sorte: 'sexe', libelle: 'Le sexe' },
  // Pas de max : un NISU collé trop long doit être refusé avec un message, pas coupé en silence.
  nisu: { sorte: 'nisu', libelle: 'Le NISU' },
  email: { sorte: 'courriel', max: 150, libelle: "Le courriel de l'élève" },
  address: { sorte: 'texte', max: 255, libelle: "L'adresse", obligatoire: "L'adresse est obligatoire : elle ne peut pas être vidée." },
  motherName: { sorte: 'texte', max: 200, libelle: 'Le nom de la mère' },
  fatherName: { sorte: 'texte', max: 200, libelle: 'Le nom du père' },
  phone1: { sorte: 'texte', max: 20, libelle: 'Le téléphone 1' },
  phone2: { sorte: 'texte', max: 20, libelle: 'Le téléphone 2' },
  parentsEmail: { sorte: 'courriel', max: 150, libelle: 'Le courriel des parents' },
}

export const MESSAGE_NISU_EFFACE = 'Le NISU ne peut pas être effacé.'
export const MESSAGE_NISU_FORMAT = `Le NISU doit compter ${NISU_RULE_LABEL}.`
export const MESSAGE_DATE_INVALIDE = "La date de naissance n'existe pas au calendrier : vérifiez le jour, le mois et l'année."
export const MESSAGE_DATE_FUTURE = 'La date de naissance ne peut pas être dans le futur.'
export const MESSAGE_SEXE_INVALIDE = 'Choisissez Masculin, Féminin ou Non renseigné.'

/** Forme minimale d'une adresse, celle du serveur : partie locale, arobase, domaine avec un point, sans blanc. */
const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SEXES: readonly string[] = ['MALE', 'FEMALE']

// ── Sexe : liste à trois choix (Radix n'admet pas de valeur vide) ─────────────

/** Valeur de la liste pour « Non renseigné » ; jamais envoyée au serveur. */
export const SEXE_NON_RENSEIGNE = 'NON_RENSEIGNE'

export const OPTIONS_SEXE: ReadonlyArray<{ valeur: string; libelle: string }> = [
  { valeur: 'MALE', libelle: 'Masculin' },
  { valeur: 'FEMALE', libelle: 'Féminin' },
  { valeur: SEXE_NON_RENSEIGNE, libelle: 'Non renseigné' },
]

/** Sexe du formulaire → valeur de la liste. */
export function valeurSelectSexe(sexe: string): string {
  return SEXES.includes(sexe) ? sexe : SEXE_NON_RENSEIGNE
}

/** Valeur de la liste → sexe du formulaire ("" pour « Non renseigné »). */
export function sexeDepuisSelect(valeur: string): string {
  return valeur === SEXE_NON_RENSEIGNE ? '' : valeur
}

// ── État initial et corps ──────────────────────────────────────────────────

/** Date ISO complète (« 2012-03-04T00:00:00.000Z ») ramenée à AAAA-MM-JJ. */
export function normaliserDate(valeur: string): string {
  const v = valeur.trim()
  return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : v
}

export function etatInitialFormulaire(initial: ProfilInitial | null | undefined): SaisieProfil {
  const etat = {} as SaisieProfil
  for (const champ of CHAMPS_PROFIL) {
    const valeur = initial?.[champ] ?? ''
    if (champ === 'birthDate') etat[champ] = normaliserDate(valeur)
    else if (champ === 'gender') etat[champ] = SEXES.includes(valeur) ? valeur : ''
    else etat[champ] = valeur
  }
  return etat
}

function comparable(champ: ChampProfil, valeur: string): string {
  if (champ === 'nisu') return normalizeNisu(valeur)
  if (champ === 'birthDate') return normaliserDate(valeur)
  return valeur.trim()
}

/** Valeur à envoyer pour un champ renseigné, ou le message du refus. */
function controler(champ: ChampProfil, v: string, aujourdhui: string): { valeur: string } | { erreur: string } {
  const r = REGLES_PROFIL[champ]
  if (r.sorte === 'nisu') return NISU_REGEX.test(v) ? { valeur: v } : { erreur: MESSAGE_NISU_FORMAT }
  if (r.max !== undefined && v.length > r.max) return { erreur: `${r.libelle} ne peut pas dépasser ${r.max} caractères.` }
  switch (r.sorte) {
    case 'date':
      if (!parseCivil(v)) return { erreur: MESSAGE_DATE_INVALIDE }
      // AAAA-MM-JJ : l'ordre des chaînes est celui des jours.
      return v > aujourdhui ? { erreur: MESSAGE_DATE_FUTURE } : { valeur: v }
    case 'courriel': {
      const courriel = v.toLowerCase()
      return COURRIEL.test(courriel) ? { valeur: courriel } : { erreur: `${r.libelle} n'est pas une adresse valide.` }
    }
    case 'sexe':
      return SEXES.includes(v) ? { valeur: v } : { erreur: MESSAGE_SEXE_INVALIDE }
    default:
      return { valeur: v }
  }
}

/**
 * Corps PATCH et erreurs de saisie. Seuls les champs modifiés sont contrôlés et
 * envoyés : une valeur déjà en base, non touchée, n'est jamais refusée.
 * `aujourdhui` : jour civil AAAA-MM-JJ (date de naissance non future).
 */
export function corpsModificationProfil(initial: SaisieProfil, saisie: SaisieProfil, aujourdhui: string): ResultatCorps {
  const corps: CorpsModificationProfil = {}
  const erreurs: ErreurChamp[] = []

  for (const champ of CHAMPS_PROFIL) {
    const avant = comparable(champ, initial[champ])
    const apres = comparable(champ, saisie[champ])
    if (avant === apres) continue

    if (apres === '') {
      const obligatoire = REGLES_PROFIL[champ].obligatoire
      if (obligatoire) erreurs.push({ champ, message: obligatoire })
      // MPE-10 : effacement refusé tant que BACKLOG S2 est ouvert.
      else if (champ === 'nisu') erreurs.push({ champ, message: MESSAGE_NISU_EFFACE })
      else corps[champ] = null
      continue
    }

    const controle = controler(champ, apres, aujourdhui)
    if ('erreur' in controle) erreurs.push({ champ, message: controle.erreur })
    else corps[champ] = controle.valeur
  }

  return { corps, erreurs }
}

// ── Actions d'une ligne d'élève (F-3) ─────────────────────────────────────

export type StatutInscription = 'ACTIVE' | 'TRANSFERRED' | 'DROPPED' | 'GRADUATED'

export interface ActionsLigneEleve {
  /** MPE-5 : l'identité appartient à l'élève, pas à l'année ; toujours permis. */
  modifierProfil: boolean
  /** Corriger l'affectation, filière, dispense, déclarer un départ. */
  gestesInscription: boolean
  annulerDepart: boolean
  /** Inscription transférée ou diplômée d'une année ouverte : rien à faire sur elle. */
  aucunGesteInscription: boolean
}

/**
 * Actions offertes sur la ligne d'un élève de la page d'une année. Les gestes
 * d'inscription suivent l'année (rien sur une année archivée) et le statut ; la
 * modification du profil, jamais (MPE-5).
 */
export function actionsLigneEleve({ anneeArchivee, statut }: { anneeArchivee: boolean; statut: StatutInscription }): ActionsLigneEleve {
  const ouverte = !anneeArchivee
  return {
    modifierProfil: true,
    gestesInscription: ouverte && statut === 'ACTIVE',
    annulerDepart: ouverte && statut === 'DROPPED',
    aucunGesteInscription: ouverte && (statut === 'TRANSFERRED' || statut === 'GRADUATED'),
  }
}

// ── Lecture ─────────────────────────────────────────────────────────────────

/** Lecture du profil à l'ouverture du modal (MPE-12), partagée par les deux pages. */
export type ProfilEdition =
  | { studentId: string; statut: 'chargement' }
  | { studentId: string; statut: 'pret'; profil: ProfilInitial }
  | { studentId: string; statut: 'erreur'; message: string }

function texte(valeur: unknown): string | null {
  return typeof valeur === 'string' ? valeur : null
}

/**
 * Lecteur tolérant de GET /api/students/:id (élève + compte `user`) : strict
 * sur la forme de l'objet, tolérant sur les champs en plus (ADR-007 § 2).
 */
export function profilDepuisEleve(brut: unknown): ProfilInitial {
  if (!brut || typeof brut !== 'object') {
    throw new Error("Réponse illisible pour le profil de l'élève.")
  }
  const eleve = brut as Record<string, unknown>
  const compte = (eleve.user && typeof eleve.user === 'object' ? eleve.user : {}) as Record<string, unknown>
  return {
    lastname: texte(compte.lastname),
    firstname: texte(compte.firstname),
    birthDate: texte(compte.birthDate),
    gender: texte(compte.gender),
    email: texte(compte.email),
    nisu: texte(eleve.nisu),
    address: texte(eleve.address),
    motherName: texte(eleve.motherName),
    fatherName: texte(eleve.fatherName),
    phone1: texte(eleve.phone1),
    phone2: texte(eleve.phone2),
    parentsEmail: texte(eleve.parentsEmail),
  }
}
