/**
 * Libellés des codes CAL_* du calendrier v2 (SPEC-CAL-2 C-45). Textes fixes :
 * aucune valeur reprise du message du serveur. Aucune donnée réelle.
 */
import { describe, expect, it } from 'vitest'
import { messageForCode } from '@/lib/errors'

const CODES_C45 = [
  'CAL_ENTREE_INVALIDE',
  'CAL_DATE_INVALIDE',
  'CAL_PERIODE_INVERSEE',
  'CAL_DATE_FIXE_PERIODE',
  'CAL_COULEUR_INCONNUE',
  'CAL_ANNEE_INTROUVABLE',
  'CAL_CATEGORIE_INTROUVABLE',
  'CAL_LEGENDE_INTROUVABLE',
  'CAL_ENTREE_INTROUVABLE',
  'CAL_CATEGORIE_UTILISEE',
  'CAL_CATEGORIE_DESACTIVEE',
  'CAL_LEGENDE_UTILISEE',
  'CAL_LEGENDE_EN_DOUBLE',
  'CAL_LIBELLE_EN_DOUBLE',
  'CAL_ENTREE_EN_DOUBLE',
  'CAL_CATEGORIE_EN_DOUBLE',
  'CAL_EN_DOUBLE',
]

describe('libellés CAL_*', () => {
  it('la liste de C-45 compte 17 codes', () => {
    expect(new Set(CODES_C45).size).toBe(17)
  })

  it.each(CODES_C45)('%s a un libellé fixe, sans gabarit ni identifiant', (code) => {
    const m = messageForCode({ code, message: 'texte du serveur 123e4567-e89b-12d3-a456-426614174000' })
    expect(m).toBeTruthy()
    expect(m).not.toContain('{')
    expect(m).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i)
    expect(m).not.toContain('texte du serveur')
    expect(m).not.toMatch(/colorToken|startDate|endDate|yearCategoryId|_id\b/)
  })

  it.each(['CAL_HORS_ANNEE', 'CAL_ORIGINE_ABSENTE', 'CAL_CIBLE_NON_VIDE', 'CAL_APERCU_PERIME', 'CAL_DATES_MANQUANTES'])(
    '%s n\'a pas de libellé (retiré ou CAL-2.6)',
    (code) => {
      expect(messageForCode({ code })).toBeNull()
    },
  )

  it('deux codes distincts ne partagent pas le même libellé', () => {
    const libelles = CODES_C45.map((code) => messageForCode({ code }))
    expect(new Set(libelles).size).toBe(CODES_C45.length)
  })
})
