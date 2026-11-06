/**
 * Onglet Avancement : recherche, filtre et tri (chantier W2, PR 4). Données fictives.
 *
 * Ce que ces tests protègent :
 *   - la recherche compare la classe et la salle séparément, sans libellé fusionné ;
 *   - un seul caractère ne compare que la salle (« A » ne trouve pas « AF ») ;
 *   - « Toutes » (null) ne filtre rien ;
 *   - l'ordre : statut, puis cursus (levelOrder), puis salle.
 */
import { describe, expect, it } from 'vitest'
import {
  comparerLignesAvancement,
  filtrerParClasseSalle,
  ligneCorrespondRecherche,
  normaliserRecherche,
  type IdentiteLigneAvancement,
} from '../avancement'
import { SELECTION_VIDE } from '../selection'

const L = (
  sessionId: string,
  classeId: string,
  classe: string,
  salle: string,
  levelOrder: number | null,
  status: IdentiteLigneAvancement['status'] = 'in-progress',
): IdentiteLigneAvancement => ({ sessionId, classeId, classe, salle, levelOrder, status })

const AF1_A = L('s-1a', 'ct-1', '1ère AF', 'A', 1)
const AF1_B = L('s-1b', 'ct-1', '1ère AF', 'B', 1)
const AF2_A = L('s-2a', 'ct-2', '2ème AF', 'A', 2)
const NS4_C = L('s-ns4c', 'ct-ns4', 'NS4', 'C', 13)
const LIGNES = [AF1_A, AF1_B, AF2_A, NS4_C]

const cherche = (q: string) => LIGNES.filter((l) => ligneCorrespondRecherche(q, l)).map((l) => l.sessionId)

describe('normaliserRecherche', () => {
  it('minuscules, accents retirés, espaces réduits', () => {
    expect(normaliserRecherche('  1ère   AF ')).toBe('1ere af')
  })
})

describe('ligneCorrespondRecherche — sans libellé fusionné', () => {
  it('recherche vide : toutes les lignes', () => {
    expect(cherche('')).toEqual(['s-1a', 's-1b', 's-2a', 's-ns4c'])
    expect(cherche('   ')).toHaveLength(4)
  })

  it('« A » (un seul caractère) : les salles A seulement, aucune classe « AF » par son nom', () => {
    expect(cherche('A')).toEqual(['s-1a', 's-2a'])
    expect(cherche('a')).toEqual(['s-1a', 's-2a'])
  })

  it('« B » : la seule salle B', () => {
    expect(cherche('B')).toEqual(['s-1b'])
  })

  it('« af » (plus d\'un caractère) : les classes contenant « af »', () => {
    expect(cherche('af')).toEqual(['s-1a', 's-1b', 's-2a'])
  })

  it('« 1ère AF » : la classe, toutes ses salles', () => {
    expect(cherche('1ère AF')).toEqual(['s-1a', 's-1b'])
  })

  it('« 1ere af » sans accent : même résultat', () => {
    expect(cherche('1ere af')).toEqual(['s-1a', 's-1b'])
  })

  it('« 1ère AF A » : classe ET salle', () => {
    expect(cherche('1ère AF A')).toEqual(['s-1a'])
  })

  it('« NS4 C » et « ns4 » : la classe sans « AF »', () => {
    expect(cherche('NS4 C')).toEqual(['s-ns4c'])
    expect(cherche('ns4')).toEqual(['s-ns4c'])
  })

  it('classe juste mais salle fausse : aucune ligne', () => {
    expect(cherche('1ère AF Z')).toEqual([])
  })

  it('texte sans rapport : aucune ligne', () => {
    expect(cherche('xyz')).toEqual([])
  })

  it('salle sans lettre : un seul caractère ne la trouve pas', () => {
    expect(ligneCorrespondRecherche('A', { classe: '3ème AF', salle: '' })).toBe(false)
  })
})

describe('filtrerParClasseSalle — « Toutes » vaut null', () => {
  it('« Toutes les classes » : aucune ligne retirée', () => {
    expect(filtrerParClasseSalle(LIGNES, SELECTION_VIDE)).toHaveLength(4)
  })

  it('une classe, « Toutes les salles » : toutes les salles de la classe', () => {
    expect(filtrerParClasseSalle(LIGNES, { classeId: 'ct-1', sessionId: null }).map((l) => l.sessionId))
      .toEqual(['s-1a', 's-1b'])
  })

  it('une classe et une salle : une seule ligne', () => {
    expect(filtrerParClasseSalle(LIGNES, { classeId: 'ct-1', sessionId: 's-1b' }).map((l) => l.sessionId))
      .toEqual(['s-1b'])
  })

  it('filtre et recherche se combinent', () => {
    const filtrees = filtrerParClasseSalle(LIGNES, { classeId: 'ct-1', sessionId: null })
    expect(filtrees.filter((l) => ligneCorrespondRecherche('A', l)).map((l) => l.sessionId)).toEqual(['s-1a'])
  })
})

describe('comparerLignesAvancement — statut, puis cursus, puis salle', () => {
  it('statut d\'abord : non commencé, en cours, complet', () => {
    const lignes = [
      L('s-x', 'ct-1', '1ère AF', 'A', 1, 'complete'),
      L('s-y', 'ct-2', '2ème AF', 'A', 2, 'not-started'),
      L('s-z', 'ct-1', '1ère AF', 'B', 1, 'in-progress'),
    ]
    expect([...lignes].sort(comparerLignesAvancement).map((l) => l.sessionId)).toEqual(['s-y', 's-z', 's-x'])
  })

  it('à statut égal : ordre du cursus, puis salle', () => {
    const lignes = [NS4_C, AF2_A, AF1_B, AF1_A]
    expect([...lignes].sort(comparerLignesAvancement).map((l) => l.sessionId)).toEqual(['s-1a', 's-1b', 's-2a', 's-ns4c'])
  })

  it('niveaux sans rang à la fin, par nom en numérique', () => {
    const lignes = [
      L('s-l10', 'ct-l10', 'Atelier 10', 'A', null),
      L('s-l2', 'ct-l2', 'Atelier 2', 'A', null),
      NS4_C,
    ]
    expect([...lignes].sort(comparerLignesAvancement).map((l) => l.sessionId)).toEqual(['s-ns4c', 's-l2', 's-l10'])
  })

  it('salles en numérique : C2 avant C10', () => {
    const lignes = [L('s-c10', 'ct-1', '1ère AF', 'C10', 1), L('s-c2', 'ct-1', '1ère AF', 'C2', 1)]
    expect([...lignes].sort(comparerLignesAvancement).map((l) => l.sessionId)).toEqual(['s-c2', 's-c10'])
  })

  it('l\'ordre ne dépend pas de l\'ordre d\'arrivée', () => {
    const a = [...LIGNES].sort(comparerLignesAvancement).map((l) => l.sessionId)
    const b = [...LIGNES].reverse().sort(comparerLignesAvancement).map((l) => l.sessionId)
    expect(b).toEqual(a)
  })
})
