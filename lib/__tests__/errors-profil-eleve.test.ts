/**
 * Codes de POST /api/students/update/:id (lot serveur « profil élève », D-95,
 * § 8 du rapport serveur) traduits en français (lib/errors.ts). Textes fixes,
 * lisibles par un non-technicien : aucune valeur reprise du message du serveur,
 * aucun nom, aucune valeur saisie, aucun identifiant.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/client-fetch'
import { toMessage } from '@/lib/errors'

const ELEVE = '00000000-0000-4000-8000-000000000001'
// Valeurs fictives qu'un message du serveur pourrait porter : aucune ne doit ressortir.
const VALEURS_FICTIVES = ['Camille', 'Exemple', 'eleve@exemple.test', 'ABCDE12345FGHIJ67890', '2012-03-04']

const refus = (status: number, code: string) =>
  new ApiError(status, `/api/students/update/${ELEVE}`, 'message du serveur', {
    code,
    message: `Some server text ${VALEURS_FICTIVES.join(' ')}`,
  })

const CODES: Array<[number, string]> = [
  [400, 'ELEVE_PROFIL_ID_INVALIDE'],
  [400, 'ELEVE_PROFIL_ENTREE_INVALIDE'],
  [400, 'ELEVE_PROFIL_CHAMP_INCONNU'],
  [400, 'ELEVE_PROFIL_CHAMP_OBLIGATOIRE'],
  [400, 'ELEVE_PROFIL_TROP_LONG'],
  [400, 'ELEVE_PROFIL_DATE_INVALIDE'],
  [400, 'ELEVE_PROFIL_DATE_FUTURE'],
  [400, 'ELEVE_PROFIL_COURRIEL_INVALIDE'],
  [400, 'ELEVE_PROFIL_SEXE_INVALIDE'],
  [400, 'ELEVE_PROFIL_NISU_INVALIDE'],
  [400, 'ELEVE_PROFIL_NISU_NON_EFFACABLE'],
  [404, 'ELEVE_PROFIL_INTROUVABLE'],
  [409, 'ELEVE_PROFIL_NISU_PRIS'],
  [409, 'ELEVE_PROFIL_COURRIEL_PRIS'],
  [409, 'ELEVE_PROFIL_CONFLIT'],
  [500, 'ELEVE_PROFIL_ERREUR_INTERNE'],
]

const generique = (status: number) => toMessage(new ApiError(status, '/x', ''))

describe('refus de la modification du profil élève', () => {
  it('les 16 codes du § 8 sont couverts', () => {
    expect(new Set(CODES.map(([, c]) => c)).size).toBe(16)
  })

  it.each(CODES)('%i %s : libellé propre, pas le message générique du statut', (status, code) => {
    const m = toMessage(refus(status, code), 'lors de la modification du profil')
    expect(m.trim()).not.toBe('')
    expect(m).not.toBe(generique(status))
    expect(m.endsWith('.')).toBe(true)
  })

  it('aucun libellé ne contient un identifiant, le code, le texte du serveur ni une valeur saisie', () => {
    for (const [status, code] of CODES) {
      const m = toMessage(refus(status, code))
      expect(m).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i)
      expect(m).not.toContain(code)
      expect(m).not.toContain('Some server text')
      for (const v of VALEURS_FICTIVES) expect(m).not.toContain(v)
    }
  })

  it('deux codes distincts ne partagent pas un libellé', () => {
    const libelles = CODES.map(([status, code]) => toMessage(refus(status, code)))
    expect(new Set(libelles).size).toBe(libelles.length)
  })
})

describe('correspondances par mots-clés après le lot', () => {
  it('« NISU already exists » reste traduit : la création et l’inscription d’un élève l’emploient encore', () => {
    expect(toMessage(new ApiError(409, '/api/students/create', 'NISU already exists'))).toBe(
      'Ce NISU est déjà utilisé par un autre élève.',
    )
  })

  it('« Email already exists » n’a plus de traduction dédiée : plus aucune route ne l’emploie', () => {
    // Retombe sur la règle générale des doublons.
    expect(toMessage(new ApiError(409, '/x', 'Email already exists'))).toBe('Cet élément existe déjà.')
  })
})
