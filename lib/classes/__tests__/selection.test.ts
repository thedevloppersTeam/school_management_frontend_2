/**
 * Sélection Classe → Salle des pages de notes (chantier W2, T1).
 * Données fictives : niveaux et lettres inventés, aucun identifiant réel.
 *
 * Ce que ces tests protègent :
 *   - l'ordre du cursus (`levelOrder`), puis les niveaux non ordonnés par nom (D2) ;
 *   - la salle unique préremplie en mode `selection` seulement (D1) ;
 *   - en mode `filtre`, « Toutes » vaut `null` et la salle n'est jamais préremplie ;
 *   - aucune sélection ne contient de chaîne vide (BACKLOG E25).
 */
import { describe, expect, it } from 'vitest'
import {
  SELECTION_VIDE,
  memeSelection,
  optionsClasses,
  optionsSalles,
  selectionAffichee,
  selectionApresChoixClasse,
  selectionApresChoixSession,
  selectionDepuisSession,
  type SelectionClasseSalle,
  type SessionClasseSalle,
} from '../selection'

const CT = {
  af1: { id: 'ct-af1', name: '1ère AF', levelOrder: 1 },
  af2: { id: 'ct-af2', name: '2ème AF', levelOrder: 2 },
  af10: { id: 'ct-af10', name: '10ème AF', levelOrder: 10 },
  ns4: { id: 'ct-ns4', name: 'NS4', levelOrder: 13 },
  libre2: { id: 'ct-libre2', name: 'Atelier 2', levelOrder: null },
  libre10: { id: 'ct-libre10', name: 'Atelier 10', levelOrder: undefined },
}

const S = (id: string, ct: SessionClasseSalle['class']['classType'], letter: string | null): SessionClasseSalle => ({
  id,
  class: { letter, classType: ct },
})

// Ordre volontairement mélangé : celui du serveur (`createdAt desc`) n'a pas de sens métier.
const SESSIONS: SessionClasseSalle[] = [
  S('s-ns4-a', CT.ns4, 'A'),
  S('s-libre10-a', CT.libre10, 'A'),
  S('s-af2-b', CT.af2, 'B'),
  S('s-af1-a', CT.af1, 'A'),
  S('s-af10-a', CT.af10, 'A'),
  S('s-libre2-a', CT.libre2, 'A'),
  S('s-af2-a', CT.af2, 'A'),
  S('s-af2-c10', CT.af2, 'C10'),
  S('s-af2-c2', CT.af2, 'C2'),
]

/** Aucune valeur de la sélection n'est une chaîne vide. */
function sansChaineVide(sel: SelectionClasseSalle) {
  expect(sel.classeId).not.toBe('')
  expect(sel.sessionId).not.toBe('')
}

describe('optionsClasses — ordre et doublons (D2)', () => {
  it('trie par levelOrder, puis les niveaux sans levelOrder par nom, en numérique', () => {
    expect(optionsClasses(SESSIONS).map((c) => c.nom)).toEqual([
      '1ère AF', '2ème AF', '10ème AF', 'NS4', 'Atelier 2', 'Atelier 10',
    ])
  })

  it('ne garde qu\'une option par classe, quel que soit le nombre de salles', () => {
    const ids = optionsClasses(SESSIONS).map((c) => c.id)
    expect(ids.filter((id) => id === CT.af2.id)).toHaveLength(1)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ignore une session sans classe exploitable au lieu d\'échouer', () => {
    const casse = [...SESSIONS, { id: 's-casse', class: { letter: 'A', classType: { id: '', name: 'X' } } }]
    expect(optionsClasses(casse).map((c) => c.id)).not.toContain('')
  })

  it('rend une liste vide sans session', () => {
    expect(optionsClasses([])).toEqual([])
  })
})

describe('optionsSalles — salles d\'une classe', () => {
  it('ne rend que les salles de la classe, par lettre en numérique', () => {
    expect(optionsSalles(SESSIONS, CT.af2.id).map((s) => s.lettre)).toEqual(['A', 'B', 'C2', 'C10'])
  })

  it('rend la session, pas la lettre, comme identifiant', () => {
    expect(optionsSalles(SESSIONS, CT.af1.id)).toEqual([{ sessionId: 's-af1-a', lettre: 'A' }])
  })

  it('rend une lettre vide (jamais « null » ni un tiret) pour une salle sans lettre', () => {
    const sans = [S('s-x', CT.af1, null), S('s-y', CT.af1, '  ')]
    expect(optionsSalles(sans, CT.af1.id).map((s) => s.lettre)).toEqual(['', ''])
  })

  it('rend une liste vide sans classe ou pour une classe inconnue', () => {
    expect(optionsSalles(SESSIONS, null)).toEqual([])
    expect(optionsSalles(SESSIONS, 'ct-inconnue')).toEqual([])
  })
})

describe('selectionDepuisSession et selectionAffichee', () => {
  it('retrouve la classe d\'une session', () => {
    expect(selectionDepuisSession(SESSIONS, 's-af2-b')).toEqual({ classeId: CT.af2.id, sessionId: 's-af2-b' })
  })

  it('rend la sélection vide pour une session inconnue ou nulle', () => {
    expect(selectionDepuisSession(SESSIONS, 's-inconnue')).toEqual(SELECTION_VIDE)
    expect(selectionDepuisSession(SESSIONS, null)).toEqual(SELECTION_VIDE)
  })

  it('montre vide une session pas encore chargée, sans erreur', () => {
    expect(selectionAffichee([], { classeId: CT.af2.id, sessionId: 's-af2-b' })).toEqual(SELECTION_VIDE)
  })

  it('laisse la session imposer sa classe quand la valeur est incohérente', () => {
    expect(selectionAffichee(SESSIONS, { classeId: CT.af1.id, sessionId: 's-af2-b' }))
      .toEqual({ classeId: CT.af2.id, sessionId: 's-af2-b' })
  })

  it('garde une classe connue sans salle', () => {
    expect(selectionAffichee(SESSIONS, { classeId: CT.af2.id, sessionId: null }))
      .toEqual({ classeId: CT.af2.id, sessionId: null })
  })
})

describe('mode selection — choix de la classe (D1)', () => {
  it('préremplit la salle quand la classe n\'en a qu\'une', () => {
    const sel = selectionApresChoixClasse(SESSIONS, SELECTION_VIDE, CT.af1.id, 'selection')
    expect(sel).toEqual({ classeId: CT.af1.id, sessionId: 's-af1-a' })
  })

  it('laisse la salle vide quand la classe en a plusieurs', () => {
    const sel = selectionApresChoixClasse(SESSIONS, SELECTION_VIDE, CT.af2.id)
    expect(sel).toEqual({ classeId: CT.af2.id, sessionId: null })
  })

  it('vide la salle quand on change de classe', () => {
    const avant = { classeId: CT.af1.id, sessionId: 's-af1-a' }
    expect(selectionApresChoixClasse(SESSIONS, avant, CT.af2.id)).toEqual({ classeId: CT.af2.id, sessionId: null })
  })

  it('ne change rien quand on rechoisit la même classe', () => {
    const avant = { classeId: CT.af2.id, sessionId: 's-af2-b' }
    expect(selectionApresChoixClasse(SESSIONS, avant, CT.af2.id)).toBe(avant)
  })
})

describe('mode filtre — « Toutes » et pas de préremplissage', () => {
  it('ne préremplit jamais la salle unique', () => {
    const sel = selectionApresChoixClasse(SESSIONS, SELECTION_VIDE, CT.af1.id, 'filtre')
    expect(sel).toEqual({ classeId: CT.af1.id, sessionId: null })
  })

  it('remet la salle à « Toutes les salles » (null) quand on change de classe', () => {
    const avant = { classeId: CT.af2.id, sessionId: 's-af2-b' }
    expect(selectionApresChoixClasse(SESSIONS, avant, CT.af1.id, 'filtre')).toEqual({ classeId: CT.af1.id, sessionId: null })
  })

  it('classe « Toutes » (null) remet aussi la salle à « Toutes » (null)', () => {
    const avant = { classeId: CT.af2.id, sessionId: 's-af2-b' }
    expect(selectionApresChoixClasse(SESSIONS, avant, null, 'filtre')).toEqual(SELECTION_VIDE)
  })

  it('accepte « Toutes les salles » (null) dans une classe choisie', () => {
    const avant = { classeId: CT.af2.id, sessionId: 's-af2-b' }
    expect(selectionApresChoixSession(SESSIONS, avant, null)).toEqual({ classeId: CT.af2.id, sessionId: null })
  })
})

describe('choix de la salle', () => {
  it('retient une salle de la classe choisie', () => {
    const avant = { classeId: CT.af2.id, sessionId: null }
    expect(selectionApresChoixSession(SESSIONS, avant, 's-af2-c2')).toEqual({ classeId: CT.af2.id, sessionId: 's-af2-c2' })
  })

  it('ignore une salle d\'une autre classe', () => {
    const avant = { classeId: CT.af2.id, sessionId: 's-af2-a' }
    expect(selectionApresChoixSession(SESSIONS, avant, 's-af1-a')).toBe(avant)
  })

  it('ne choisit rien sans classe', () => {
    expect(selectionApresChoixSession(SESSIONS, SELECTION_VIDE, 's-af1-a')).toBe(SELECTION_VIDE)
  })
})

describe('aucune chaîne vide, jamais (BACKLOG E25)', () => {
  it('sur tous les chemins de choix, dans les deux modes', () => {
    for (const mode of ['selection', 'filtre'] as const) {
      for (const c of [null, ...optionsClasses(SESSIONS).map((o) => o.id)]) {
        const apresClasse = selectionApresChoixClasse(SESSIONS, SELECTION_VIDE, c, mode)
        sansChaineVide(apresClasse)
        for (const s of [null, ...optionsSalles(SESSIONS, c).map((o) => o.sessionId)]) {
          sansChaineVide(selectionApresChoixSession(SESSIONS, apresClasse, s))
        }
      }
    }
  })
})

describe('memeSelection', () => {
  it('compare les deux champs', () => {
    expect(memeSelection(SELECTION_VIDE, { classeId: null, sessionId: null })).toBe(true)
    expect(memeSelection({ classeId: 'a', sessionId: null }, { classeId: 'a', sessionId: 's' })).toBe(false)
  })
})
