/**
 * Relevé de notes — polices LIBRES de remplacement (next/font/google).
 *
 * Elles ne servent que si la police du scan n'est pas installée sur le poste
 * (piles dans releve-layout.ts, FONT_STACKS). Exposées en variables CSS, posées
 * sur la feuille seule : `preload: false`, aucune autre route ne les charge.
 */
import { Caveat, Pinyon_Script } from 'next/font/google'

/** Remplacement de « Segoe Print » (valeurs d'identité). */
const caveat = Caveat({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-releve-identite',
  preload: false,
})

/** Remplacement de « French Script MT » (remarque). */
const pinyon = Pinyon_Script({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-releve-remarque',
  preload: false,
})

/** Classes à poser sur la racine de la feuille. */
export const releveFontVariables = `${caveat.variable} ${pinyon.variable}`
