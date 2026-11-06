/**
 * Garde du NIVEAU IMPRIMÉ sur le bulletin (chantier W2, T13).
 *
 * Le bulletin ne reçoit pas la classe en champ séparé : il reçoit la chaîne
 * fusionnée de `getClassSessionName` (`lib/api/dashboard.ts`), que
 * `normalizeBulletinLevel` (`lib/bulletin-calculations.ts`) redécoupe en
 * retirant la lettre finale (`lib/api/bulletin.ts`, champ `niveau`). Changer la
 * forme de la fusion changerait donc le niveau imprimé, sur un document
 * opposable au MENFP et aux familles (CLAUDE.md, règle 7).
 *
 * Ce test ne modifie aucune des deux fonctions : il fige leur sortie actuelle,
 * pour qu'une modification future se voie en CI. Le chantier W2 affiche classe
 * et salle avec `libelleClasseSalle` et ne touche à aucune de ces fonctions.
 * Données fictives.
 */
import { describe, expect, it } from 'vitest'
import { getClassSessionName, type ClassSession } from '@/lib/api/dashboard'
import { normalizeBulletinLevel } from '@/lib/bulletin-calculations'

/** Session minimale : seuls `class.classType.name` et `class.letter` sont lus. */
const session = (name: string, letter: string) =>
  ({
    id: `s-${name}-${letter}`,
    class: { id: `c-${name}-${letter}`, letter, classType: { id: `ct-${name}`, name, isTerminal: false, hasTrack: false } },
    academicYear: { id: 'a-fictive', name: 'Année fictive' },
  }) as ClassSession

const CAS: Array<{ niveau: string; lettre: string; fusion: string }> = [
  { niveau: '1ère AF', lettre: 'A', fusion: '1ère AF A' },
  { niveau: '9ème AF', lettre: 'B', fusion: '9ème AF B' },
  { niveau: 'NS1', lettre: 'A', fusion: 'NS1 A' },
  { niveau: 'NS4', lettre: 'C', fusion: 'NS4 C' },
]

describe('niveau imprimé sur le bulletin — sortie figée', () => {
  for (const { niveau, lettre, fusion } of CAS) {
    it(`« ${niveau} » + « ${lettre} » : fusion « ${fusion} », niveau imprimé « ${niveau} »`, () => {
      const nom = getClassSessionName(session(niveau, lettre))
      expect(nom).toBe(fusion)
      expect(normalizeBulletinLevel(nom)).toBe(niveau)
    })
  }

  it('la fusion est « niveau, une espace, lettre » : c\'est ce que le découpage attend', () => {
    expect(getClassSessionName(session('3ème AF', 'A'))).toMatch(/^3ème AF A$/)
  })
})
