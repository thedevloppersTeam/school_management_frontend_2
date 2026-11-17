/**
 * Codes du lot ID-T traduits en français (lib/errors.ts), un test par code 409
 * (mission ID-T-F, § 3). Textes fixes : aucune valeur reprise du message du
 * serveur. Aucune donnée réelle.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/client-fetch'
import { toMessage } from '@/lib/errors'

const refus = (status: number, code: string) =>
  new ApiError(status, '/api/teachers/create', 'message du serveur, en anglais ou non', { code, message: 'Some server text' })

describe('409 de la création et de l’activation d’une fiche', () => {
  it('IDENTITE_ENSEIGNANT_COMPTE_SYSTEM_ADMIN', () => {
    expect(toMessage(refus(409, 'IDENTITE_ENSEIGNANT_COMPTE_SYSTEM_ADMIN'))).toBe(
      "Fiche refusée : ce compte a le rôle d'administrateur système, qui ne se cumule pas avec l'enseignement.",
    )
  })
  it('IDENTITE_ENSEIGNANT_COMPTE_ELEVE', () => {
    expect(toMessage(refus(409, 'IDENTITE_ENSEIGNANT_COMPTE_ELEVE'))).toBe('Fiche refusée : ce compte est celui d\'un élève.')
  })
  it('IDENTITE_ENSEIGNANT_COMPTE_PARENT', () => {
    expect(toMessage(refus(409, 'IDENTITE_ENSEIGNANT_COMPTE_PARENT'))).toBe('Fiche refusée : ce compte est relié à un parent.')
  })
  it('IDENTITE_ENSEIGNANT_FICHE_EXISTANTE', () => {
    expect(toMessage(refus(409, 'IDENTITE_ENSEIGNANT_FICHE_EXISTANTE'))).toBe(
      'Ce compte a déjà une fiche enseignant : rechargez la liste.',
    )
  })
  it('IDENTITE_ENSEIGNANT_PERSONNES_DIFFERENTES', () => {
    expect(toMessage(refus(409, 'IDENTITE_ENSEIGNANT_PERSONNES_DIFFERENTES'))).toMatch(/ne désignent pas la même personne/)
  })
})

// Lot serveur ID-T-C2 : mêmes codes à la création et à l'activation de la fiche.
describe('409 du lot ID-T-C2 : adulte, ni ancien élève ni ancien parent', () => {
  it.each([
    [
      'IDENTITE_ENSEIGNANT_COMPTE_MINEUR',
      "Fiche refusée : ce compte est celui d'une personne mineure ; il ne peut pas recevoir de fiche enseignant.",
    ],
    [
      'IDENTITE_ENSEIGNANT_COMPTE_SANS_DATE_NAISSANCE',
      "Fiche refusée : ce compte n'a pas de date de naissance, son âge ne peut pas être vérifié ; il ne peut pas recevoir de fiche enseignant.",
    ],
    [
      'IDENTITE_ENSEIGNANT_ANCIEN_COMPTE_ELEVE',
      "Fiche refusée : ce compte est un ancien compte d'élève ; il ne peut pas recevoir de fiche enseignant.",
    ],
    [
      'IDENTITE_ENSEIGNANT_ANCIEN_COMPTE_PARENT',
      "Fiche refusée : ce compte est un ancien compte de parent ; il ne peut pas recevoir de fiche enseignant.",
    ],
  ])('%s', (code, attendu) => {
    expect(toMessage(refus(409, code))).toBe(attendu)
  })

  it.each([
    'IDENTITE_ENSEIGNANT_COMPTE_MINEUR',
    'IDENTITE_ENSEIGNANT_COMPTE_SANS_DATE_NAISSANCE',
    'IDENTITE_ENSEIGNANT_ANCIEN_COMPTE_ELEVE',
    'IDENTITE_ENSEIGNANT_ANCIEN_COMPTE_PARENT',
  ])('%s : même message à l’activation (fiche-status), sans le texte du serveur', (code) => {
    const activation = new ApiError(409, '/api/teachers/fiche-status/00000000-0000-0000-0000-000000000000', 'refus', {
      code,
      message: 'Some server text',
    })
    expect(toMessage(activation)).toBe(toMessage(refus(409, code)))
    expect(toMessage(activation)).not.toMatch(/Some server text/)
  })
})

describe('autres refus des routes de fiche', () => {
  it.each([
    [403, 'IDENTITE_ROLE_DE_SOI', /votre propre fiche/],
    [404, 'IDENTITE_ENSEIGNANT_INTROUVABLE', /n'existe plus/],
    [404, 'IDENTITE_COMPTE_INTROUVABLE', /n'existe plus/],
    [400, 'IDENTITE_ENSEIGNANT_ENTREE_INVALIDE', /format attendu/],
    [400, 'IDENTITE_ETAT_ENTREE_INVALIDE', /format attendu/],
  ])('%i %s', (status, code, attendu) => {
    expect(toMessage(refus(status, code))).toMatch(attendu)
  })
})

describe('aucun détail personnel, aucun texte du serveur', () => {
  it('le libellé ne reprend pas le message du serveur et le contexte de l’écran ne s’y ajoute pas', () => {
    const m = toMessage(refus(409, 'IDENTITE_ENSEIGNANT_COMPTE_ELEVE'), 'lors de la création de la fiche')
    expect(m).not.toMatch(/Some server text|lors de la création/)
  })
})
