/**
 * Profil d'un élève dans le modal « Modifier l'élève ».
 *
 * Le modal n'envoie que ce qui a changé (MPE-2) : un champ absent du corps
 * reste inchangé côté serveur. C'est ce qui empêche un enregistrement d'effacer
 * un champ que l'écran n'avait pas chargé (défaut D-1 : le courriel de l'élève
 * effacé depuis « Tous les élèves »).
 *
 * Le sexe n'est pas ici : le serveur ne l'accepte pas avant le lot S-1 (MPE-4).
 *
 * Fonctions pures, sans React ni DOM.
 */
import { isNisuValid, normalizeNisu, NISU_RULE_LABEL } from '@/lib/nisu'

export const CHAMPS_PROFIL = [
  'lastname', 'firstname', 'birthDate', 'email',
  'nisu',
  'address', 'motherName', 'fatherName', 'phone1', 'phone2', 'parentsEmail',
] as const

export type ChampProfil = (typeof CHAMPS_PROFIL)[number]

/** Valeurs du formulaire : toujours des chaînes, jamais null. */
export type SaisieProfil = Record<ChampProfil, string>

/** Profil tel qu'un écran le connaît, avec ses trous. */
export type ProfilInitial = Partial<Record<ChampProfil, string | null | undefined>>

/** Corps de POST /api/students/update/:id. Aucune valeur n'y vaut null. */
export type CorpsModificationProfil = Partial<Record<ChampProfil, string>>

export interface ErreurChamp {
  champ: ChampProfil
  message: string
}

export interface ResultatCorps {
  corps: CorpsModificationProfil
  erreurs: ErreurChamp[]
}

const CHAMPS_OBLIGATOIRES: Partial<Record<ChampProfil, string>> = {
  lastname: 'Le nom est obligatoire.',
  firstname: 'Le prénom est obligatoire.',
  birthDate: 'La date de naissance est obligatoire.',
  address: "L'adresse est obligatoire.",
}

const CHAMPS_NON_EFFACABLES: readonly ChampProfil[] = [
  'motherName', 'fatherName', 'phone1', 'phone2', 'parentsEmail',
]

export const MESSAGE_NON_EFFACABLE = 'Ce champ ne peut pas encore être vidé.'
export const MESSAGE_NISU_EFFACE = 'Le NISU ne peut pas être effacé.'
export const MESSAGE_NISU_FORMAT = `Le NISU doit compter ${NISU_RULE_LABEL}.`

/** Date ISO complète (« 2012-03-04T00:00:00.000Z ») ramenée à AAAA-MM-JJ. */
export function normaliserDate(valeur: string): string {
  const v = valeur.trim()
  return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : v
}

export function etatInitialFormulaire(initial: ProfilInitial | null | undefined): SaisieProfil {
  const etat = {} as SaisieProfil
  for (const champ of CHAMPS_PROFIL) {
    const valeur = initial?.[champ] ?? ''
    etat[champ] = champ === 'birthDate' ? normaliserDate(valeur) : valeur
  }
  return etat
}

function comparable(champ: ChampProfil, valeur: string): string {
  if (champ === 'nisu') return normalizeNisu(valeur)
  if (champ === 'birthDate') return normaliserDate(valeur)
  return valeur.trim()
}

export function corpsModificationProfil(initial: SaisieProfil, saisie: SaisieProfil): ResultatCorps {
  const corps: CorpsModificationProfil = {}
  const erreurs: ErreurChamp[] = []

  for (const champ of CHAMPS_PROFIL) {
    const avant = comparable(champ, initial[champ])
    const apres = comparable(champ, saisie[champ])
    if (avant === apres) continue

    if (apres === '') {
      const obligatoire = CHAMPS_OBLIGATOIRES[champ]
      if (obligatoire) {
        erreurs.push({ champ, message: obligatoire })
      } else if (champ === 'nisu') {
        // MPE-10 : effacement refusé tant que BACKLOG S2 est ouvert.
        erreurs.push({ champ, message: MESSAGE_NISU_EFFACE })
      } else if (CHAMPS_NON_EFFACABLES.includes(champ)) {
        // Transitoire : MPE-2 (null) au lot F-1b après S-1.
        erreurs.push({ champ, message: MESSAGE_NON_EFFACABLE })
      } else {
        // Courriel de l'élève : le serveur actuel efface sur "" (students.ts:243).
        corps[champ] = ''
      }
      continue
    }

    if (champ === 'nisu' && !isNisuValid(apres, false)) {
      erreurs.push({ champ, message: MESSAGE_NISU_FORMAT })
      continue
    }

    corps[champ] = apres
  }

  return { corps, erreurs }
}

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
