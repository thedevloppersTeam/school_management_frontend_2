// lib/grades/score-input.ts
//
// Lecture d'une note TAPÉE PAR UN HUMAIN, et rien d'autre.
//
// Deux responsabilités, et une seule qui appartient à ce module :
//   1. transformer une chaîne d'interface en nombre — c'est ici ;
//   2. dire si ce nombre est une note valide — c'est `isValidGrade()` de
//      `lib/bulletin/compute.ts`, en `Decimal`, couvert par ses propres tests.
//
// DR-004 n'est donc PAS réécrite ici. Elle l'était trois fois dans le dépôt,
// en flottant, avec trois messages différents ; ce module existe pour que la
// saisie s'adosse à la même règle que le bulletin.
//
// Le piège que tout ça ferme : le pavé numérique d'un poste francophone produit
// une VIRGULE, et `parseFloat` la traite comme un terminateur.
// `parseFloat('15,25')` vaut 15 — sans erreur, sans avertissement, et 15 est un
// multiple de 0,25, donc la valeur fausse passait la validation et partait en
// base. Sur un bulletin opposable au MENFP, un quart de point disparu ne se
// rattrape pas.

import Decimal from 'decimal.js'
import { isValidGrade } from '@/lib/bulletin/compute'

/**
 * Seuls les espaces de BORD sont retirés — y compris l'insécable et
 * l'insécable étroite que collent Excel et LibreOffice. Un espace à
 * l'intérieur reste une faute de frappe : « 1 5,25 » doit être refusé, pas
 * silencieusement lu comme 15,25.
 */
export function normalizeScoreText(value: string): string {
  return value
    .replace(/^[\s  ]+|[\s  ]+$/g, '')
    .replace(',', '.')
}

/**
 * Une note est une suite de chiffres, éventuellement suivie d'une partie
 * décimale. Volontairement strict : `parseFloat` rendait 12 sur `'12abc'`,
 * 100 sur `'1e2'` et 0 sur `'0x10'` — trois façons d'accepter en silence le
 * collage d'une cellule mal formée.
 */
const SCORE_PATTERN = /^\d+(\.\d+)?$/

/** La note saisie, ou `null` si la saisie n'en est pas une. */
export function parseScoreToDecimal(value: string): Decimal | null {
  const normalized = normalizeScoreText(value)
  if (!SCORE_PATTERN.test(normalized)) return null
  const dec = new Decimal(normalized)
  return dec.isFinite() ? dec : null
}

/**
 * Même lecture, ramenée en `number` pour la frontière réseau : les charges
 * utiles de `lib/api/grades.ts` sont typées `number`. Le `Decimal` reste la
 * vérité ; ce convertisseur n'existe que pour le format de transport.
 */
export function parseScore(value: string): number | null {
  return parseScoreToDecimal(value)?.toNumber() ?? null
}

export interface ScoreValidation {
  isValid: boolean
  error?: string
}

/**
 * Valide une note saisie contre son barème.
 *
 * Une chaîne vide est VALIDE : elle signifie « pas de note », pas « note
 * fausse ». C'est au code appelant de décider ce qu'une absence de note
 * déclenche — à la saisie elle retire la note, et au bulletin elle compte 0
 * avec son barème conservé (cf. docs/CALCUL-BULLETIN.md).
 *
 * Le VERDICT vient de `isValidGrade()`. Les tests ci-dessous ne servent qu'à
 * choisir le message : dupliquer la règle pour l'expliquer serait rouvrir la
 * porte qu'on vient de fermer.
 */
export function validateScoreInput(
  value: string,
  max: number | Decimal,
): ScoreValidation {
  if (!value || value.trim() === '') return { isValid: true }

  const score = parseScoreToDecimal(value)
  if (score === null) return { isValid: false, error: 'Valeur invalide' }

  const maxDec = max instanceof Decimal ? max : new Decimal(max)
  if (isValidGrade(score, maxDec)) return { isValid: true }

  // Le motif du refus, pour l'utilisatrice. `SCORE_PATTERN` ayant déjà écarté
  // le signe moins, seules deux causes restent possibles.
  if (score.greaterThan(maxDec)) {
    return { isValid: false, error: `Entre 0 et ${maxDec.toString()}` }
  }
  return { isValid: false, error: 'Multiples de 0,25 uniquement' }
}

/**
 * Dernier filet avant le reseau, pose dans `lib/api/grades.ts`.
 *
 * Il ne connait PAS le bareme de la note qu'on lui passe : les charges utiles
 * ne le transportent pas, et `updateGrade` ne recoit qu'un identifiant. Il
 * verifie donc ce qui ne depend pas du bareme — fini, non negatif, multiple de
 * 0,25 — en passant par `isValidGrade` avec une borne haute explicitement
 * absente, plutot qu'en redisant la regle une quatrieme fois.
 *
 * La borne haute reste verifiee la ou le bareme est connu : `validateScoreInput`,
 * a la saisie.
 *
 * Ce filet n'existe que parce que le backend ne valide rien (backlog E8) :
 * ni le pas, ni la borne basse, ni meme le plafond sur `bulkCreateGrades`.
 * Tant que E8 est ouvert, l'interface est le seul garde-fou de DR-004.
 */
export function assertStorableScore(score: number, context: string): void {
  if (!Number.isFinite(score)) {
    throw new Error(`${context} : valeur non numerique refusee avant envoi.`)
  }
  const NO_UPPER_BOUND = new Decimal(Infinity)
  if (!isValidGrade(new Decimal(score), NO_UPPER_BOUND)) {
    throw new Error(
      `${context} : ${score} n'est pas une note valide (DR-004 — multiple de 0,25, jamais negative).`,
    )
  }
}
