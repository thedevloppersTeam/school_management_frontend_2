/**
 * Comportements modifiés et non enregistrés (BACKLOG W3). Données fictives.
 *
 * Ce que ces tests protègent :
 *   - l'unité est l'élève : plusieurs champs touchés sur une fiche comptent pour un ;
 *   - une valeur remise à l'origine ne compte plus (champ comme attitude) ;
 *   - une attitude absente vaut « non répondu » (`null`) ;
 *   - un enregistrement partiel ne remet à zéro que les fiches enregistrées.
 */
import { describe, expect, it } from 'vitest'
import {
  compterModifications,
  referencesApresEnregistrement,
  saisieModifiee,
  type SaisieComportement,
} from '../modifications'

const fiche = (p: Partial<SaisieComportement> = {}): SaisieComportement => ({
  absences: '',
  retards: '',
  devoirsManques: '',
  leconsNonSues: '',
  respectUniforme: '',
  discipline: '',
  pointsForts: '',
  defis: '',
  remarque: '',
  attitudeResponses: new Map(),
  ...p,
})

const carte = (entrees: Array<[string, SaisieComportement]>) => new Map(entrees)

describe('saisieModifiee', () => {
  it('fiche identique : non modifiée', () => {
    const a = fiche({ absences: '2', remarque: 'Attentif', attitudeResponses: new Map([['att-1', true]]) })
    const b = fiche({ absences: '2', remarque: 'Attentif', attitudeResponses: new Map([['att-1', true]]) })
    expect(saisieModifiee(a, b)).toBe(false)
  })

  it('un champ numérique modifié', () => {
    expect(saisieModifiee(fiche({ retards: '1' }), fiche({ retards: '3' }))).toBe(true)
  })

  it('un champ texte modifié', () => {
    expect(saisieModifiee(fiche({ defis: '' }), fiche({ defis: 'Ponctualité' }))).toBe(true)
  })

  it('valeur remise à l\'origine : non modifiée', () => {
    const origine = fiche({ discipline: '8' })
    const touchee = { ...origine, discipline: '9' }
    expect(saisieModifiee(origine, touchee)).toBe(true)
    expect(saisieModifiee(origine, { ...touchee, discipline: '8' })).toBe(false)
  })

  it('attitude absente et attitude à null : identiques (non répondu)', () => {
    expect(saisieModifiee(fiche(), fiche({ attitudeResponses: new Map([['att-1', null]]) }))).toBe(false)
  })

  it('attitude passée de non répondu à Non : modifiée', () => {
    expect(saisieModifiee(fiche(), fiche({ attitudeResponses: new Map([['att-1', false]]) }))).toBe(true)
  })

  it('attitude changée puis remise : non modifiée', () => {
    const origine = fiche({ attitudeResponses: new Map([['att-1', true]]) })
    const aller   = fiche({ attitudeResponses: new Map([['att-1', false]]) })
    const retour  = fiche({ attitudeResponses: new Map([['att-1', true]]) })
    expect(saisieModifiee(origine, aller)).toBe(true)
    expect(saisieModifiee(origine, retour)).toBe(false)
  })

  it('sans fiche initiale : comparée à une fiche vide', () => {
    expect(saisieModifiee(undefined, fiche())).toBe(false)
    expect(saisieModifiee(undefined, fiche({ absences: '1' }))).toBe(true)
  })
})

describe('compterModifications — une fiche modifiée compte pour un élève', () => {
  const initiales = carte([
    ['e1', fiche({ absences: '1' })],
    ['e2', fiche({ remarque: 'Bien' })],
    ['e3', fiche()],
  ])

  it('aucune modification : 0', () => {
    expect(compterModifications(initiales, new Map(initiales))).toBe(0)
  })

  it('plusieurs champs modifiés sur une même fiche : 1', () => {
    const courantes = new Map(initiales)
    courantes.set('e1', fiche({ absences: '2', retards: '1', defis: 'Calme' }))
    expect(compterModifications(initiales, courantes)).toBe(1)
  })

  it('deux fiches modifiées : 2', () => {
    const courantes = new Map(initiales)
    courantes.set('e1', fiche({ absences: '2' }))
    courantes.set('e3', fiche({ attitudeResponses: new Map([['att-1', true]]) }))
    expect(compterModifications(initiales, courantes)).toBe(2)
  })

  it('fiche modifiée puis remise : 0', () => {
    const courantes = new Map(initiales)
    courantes.set('e2', fiche({ remarque: 'Très bien' }))
    courantes.set('e2', fiche({ remarque: 'Bien' }))
    expect(compterModifications(initiales, courantes)).toBe(0)
  })

  it('listes vides : 0', () => {
    expect(compterModifications(new Map(), new Map())).toBe(0)
  })
})

describe('referencesApresEnregistrement — un échec ne remet pas à zéro', () => {
  const initiales = carte([
    ['e1', fiche()],
    ['e2', fiche()],
  ])
  const courantes = carte([
    ['e1', fiche({ absences: '1' })],
    ['e2', fiche({ absences: '2' })],
  ])

  it('enregistrement réussi pour tous : 0', () => {
    const refs = referencesApresEnregistrement(initiales, courantes)
    expect(compterModifications(refs, courantes)).toBe(0)
  })

  it('enregistrement partiel : seules les fiches en échec restent comptées', () => {
    const refs = referencesApresEnregistrement(initiales, carte([['e1', courantes.get('e1')!]]))
    expect(compterModifications(refs, courantes)).toBe(1)
    expect(saisieModifiee(refs.get('e2'), courantes.get('e2')!)).toBe(true)
  })

  it('enregistrement entièrement en échec : le compteur ne bouge pas', () => {
    const refs = referencesApresEnregistrement(initiales, new Map())
    expect(compterModifications(refs, courantes)).toBe(2)
  })

  it('ne modifie pas les références d\'origine', () => {
    referencesApresEnregistrement(initiales, courantes)
    expect(compterModifications(initiales, courantes)).toBe(2)
  })
})
