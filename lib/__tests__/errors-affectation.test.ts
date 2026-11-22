/**
 * Codes de POST /api/class-subjects/teacher/:id (lot A serveur, api.md) traduits
 * en français (lib/errors.ts). Textes fixes, lisibles par un non-technicien :
 * aucune valeur reprise du message du serveur, aucun nom ni identifiant.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/client-fetch'
import { toMessage } from '@/lib/errors'

const AFF = '00000000-0000-0000-0000-000000000001'

const refus = (status: number, code: string) =>
  new ApiError(status, `/api/class-subjects/teacher/${AFF}`, 'message du serveur', { code, message: 'Some server text' })

const ATTENDUS: Array<[number, string, string]> = [
  [400, 'PROGRAMME_ENTREE_INVALIDE', "Demande refusée : l'enseignant choisi n'a pas le format attendu. Rechargez la page, puis réessayez."],
  [404, 'PROGRAMME_AFFECTATION_INTROUVABLE', "Cette matière n'est plus assignée à cette salle : rechargez la page."],
  [404, 'PROGRAMME_ENSEIGNANT_INTROUVABLE', "Cette fiche enseignant n'existe plus : rechargez la page."],
  [
    409,
    'PROGRAMME_FICHE_INACTIVE',
    "La fiche de cet enseignant a été désactivée entre-temps : il ne peut pas recevoir cette matière. Rechargez la page.",
  ],
  [
    409,
    'PROGRAMME_COMPTE_INACTIF',
    "Le compte de cet enseignant a été désactivé entre-temps : il ne peut pas recevoir cette matière. Rechargez la page.",
  ],
  [409, 'PROGRAMME_ANNEE_CLOSE', "Cette année est archivée : l'enseignant d'une matière ne se change plus. Rechargez la page."],
]

describe("refus de l'affectation d'un enseignant", () => {
  it.each(ATTENDUS)('%i %s', (status, code, texte) => {
    expect(toMessage(refus(status, code), "lors de l'enregistrement de l'enseignant")).toBe(texte)
  })

  it('aucun libellé ne contient un identifiant ni le texte du serveur', () => {
    for (const [status, code] of ATTENDUS) {
      const m = toMessage(refus(status, code))
      expect(m).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i)
      expect(m).not.toContain('Some server text')
      expect(m).not.toContain(code)
    }
  })
})
