/**
 * Codes d'erreur de saisie du serveur (lib/errors.ts, messageForCode et
 * toMessage) : chaque code connu rend un libellé français, jamais le code brut
 * ni le message anglais ou technique du serveur. Données fictives.
 */
import { describe, it, expect } from 'vitest'
import { messageForCode, toMessage } from '@/lib/errors'
import { ApiError } from '@/lib/client-fetch'

const CODES = [
  'LOT_CASE_EN_DOUBLE', 'LOT_ENTREES_INVALIDES', 'LOT_AFFECTATION_HORS_PORTEE',
  'CASE_MULTI_NOTES', 'AFFECTATION_AUTRE_SALLE', 'AFFECTATION_AUTRE_FILIERE',
  'AFFECTATION_INTROUVABLE', 'SOUS_MATIERE_INTROUVABLE', 'SOUS_MATIERE_HORS_MATIERE',
  'NOTE_NEGATIVE', 'NOTE_HORS_BAREME', 'NOTE_PAS_025', 'NOTE_NON_NUMERIQUE',
]

describe('messageForCode', () => {
  it.each(CODES)('%s a un libellé qui ne contient pas le code', (code) => {
    const m = messageForCode({ code, message: 'Class subject does not belong' })
    expect(m).toBeTruthy()
    expect(m).not.toContain(code)
    expect(m).not.toMatch(/class subject|grades\[/i)
  })

  it('code inconnu ou absent : null', () => {
    expect(messageForCode({ code: 'AUTRE_CODE', message: 'x' })).toBeNull()
    expect(messageForCode({ message: 'x' })).toBeNull()
    expect(messageForCode(null)).toBeNull()
  })

  it('lot invalide : nombre de saisies et motif de la première', () => {
    const m = messageForCode({
      code: 'LOT_ENTREES_INVALIDES',
      entries: [{ index: 2, code: 'NOTE_HORS_BAREME' }, { index: 5, code: 'NOTE_PAS_025' }],
    })
    expect(m).toBe('Lot refusé, aucune note enregistrée : 2 saisies invalides. Première en cause : Note refusée : la note dépasse le barème de la case.')
  })

  it('lot hors portée, une seule saisie : singulier', () => {
    const m = messageForCode({ code: 'LOT_AFFECTATION_HORS_PORTEE', entries: [{ index: 0, code: 'AFFECTATION_AUTRE_FILIERE' }] })
    expect(m).toBe("Lot refusé, aucune note enregistrée : 1 saisie hors de la portée de l'élève. Première en cause : Cette matière relève d'une autre filière que celle de l'élève : note refusée.")
  })

  it('plusieurs cases multi-notes : pluriel', () => {
    expect(messageForCode({ code: 'CASE_MULTI_NOTES', cases: [{}, {}, {}] }))
      .toMatch(/^3 cases portent déjà plusieurs notes/)
  })
})

describe('toMessage avec une ApiError qui porte un code', () => {
  it("rend le libellé tel quel, sans le contexte de l'écran", () => {
    const err = new ApiError(400, '/api/grades/bulk-create', 'grades[0] et grades[1] visent la même case', {
      code: 'LOT_CASE_EN_DOUBLE', message: 'grades[0] et grades[1] visent la même case',
    })
    expect(toMessage(err, "lors de l'enregistrement")).toBe(messageForCode({ code: 'LOT_CASE_EN_DOUBLE' }))
  })

  it('sans code : comportement inchangé (statut HTTP)', () => {
    const err = new ApiError(400, '/api/grades/bulk-create', 'message sans mot-clé', { message: 'message sans mot-clé' })
    expect(toMessage(err)).toBe('Les données envoyées ne sont pas valides.')
  })
})
