import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  corpsModificationProfil,
  etatInitialFormulaire,
  profilDepuisEleve,
  type SaisieProfil,
} from '@/lib/students/profil'
import { enregistrerProfil } from '@/lib/api/students'

// Données fictives uniquement (dépôt public, données de mineurs).
const NISU_A = 'ABCDE12345FGHIJ67890'
const NISU_B = 'ZYXWV98765UTSRQ43210'

const INITIAL: SaisieProfil = etatInitialFormulaire({
  lastname: 'Exemple',
  firstname: 'Camille',
  birthDate: '2012-03-04',
  email: 'eleve@exemple.test',
  nisu: NISU_A,
  address: '1 rue Fictive',
  motherName: 'Mère Fictive',
  fatherName: 'Père Fictif',
  phone1: '+50900000001',
  phone2: '+50900000002',
  parentsEmail: 'parents@exemple.test',
})

function saisie(modifs: Partial<SaisieProfil>): SaisieProfil {
  return { ...INITIAL, ...modifs }
}

function champsEnErreur(initial: SaisieProfil, s: SaisieProfil): string[] {
  return corpsModificationProfil(initial, s).erreurs.map((e) => e.champ)
}

describe('etatInitialFormulaire', () => {
  it('null et undefined deviennent ""', () => {
    const etat = etatInitialFormulaire({ lastname: null, firstname: undefined, email: null })
    expect(etat.lastname).toBe('')
    expect(etat.firstname).toBe('')
    expect(etat.email).toBe('')
    expect(etat.phone2).toBe('')
  })

  it('initialData null ou undefined donne un formulaire vide', () => {
    expect(Object.values(etatInitialFormulaire(null)).every((v) => v === '')).toBe(true)
    expect(Object.values(etatInitialFormulaire(undefined)).every((v) => v === '')).toBe(true)
  })

  it('les valeurs présentes sont conservées', () => {
    expect(INITIAL.lastname).toBe('Exemple')
    expect(INITIAL.nisu).toBe(NISU_A)
    expect(INITIAL.phone1).toBe('+50900000001')
  })

  it('une date ISO complète est ramenée à AAAA-MM-JJ', () => {
    expect(etatInitialFormulaire({ birthDate: '2012-03-04T00:00:00.000Z' }).birthDate).toBe('2012-03-04')
  })
})

describe('corpsModificationProfil', () => {
  it('aucun changement → {}', () => {
    const r = corpsModificationProfil(INITIAL, saisie({}))
    expect(r.corps).toEqual({})
    expect(r.erreurs).toEqual([])
  })

  it('seul le téléphone 1 modifié → { phone1 } et rien d’autre', () => {
    const r = corpsModificationProfil(INITIAL, saisie({ phone1: '+50911112222' }))
    expect(r.corps).toEqual({ phone1: '+50911112222' })
    expect(r.erreurs).toEqual([])
  })

  it('courriel inchangé → absent du corps (non-régression D-1)', () => {
    const r = corpsModificationProfil(INITIAL, saisie({ address: '2 rue Fictive' }))
    expect(r.corps).not.toHaveProperty('email')
    expect(r.corps).toEqual({ address: '2 rue Fictive' })
  })

  it('courriel de l’élève vidé → { email: "" } (transitoire, jamais null)', () => {
    const r = corpsModificationProfil(INITIAL, saisie({ email: '   ' }))
    expect(r.corps).toEqual({ email: '' })
    expect(r.erreurs).toEqual([])
  })

  it('nom du père vidé → absent, erreur « fatherName »', () => {
    const r = corpsModificationProfil(INITIAL, saisie({ fatherName: '' }))
    expect(r.corps).toEqual({})
    expect(champsEnErreur(INITIAL, saisie({ fatherName: '' }))).toEqual(['fatherName'])
    expect(r.erreurs[0].message).toBe('Ce champ ne peut pas encore être vidé.')
  })

  it('téléphone 1 vidé → absent, erreur « phone1 »', () => {
    const r = corpsModificationProfil(INITIAL, saisie({ phone1: '' }))
    expect(r.corps).toEqual({})
    expect(champsEnErreur(INITIAL, saisie({ phone1: '' }))).toEqual(['phone1'])
  })

  it('aucun champ n’est jamais envoyé à null', () => {
    const tout = saisie({
      email: '', motherName: '', fatherName: '', phone1: '', phone2: '', parentsEmail: '',
      lastname: '', firstname: '', birthDate: '', address: '', nisu: '',
    })
    const { corps } = corpsModificationProfil(INITIAL, tout)
    expect(Object.values(corps).some((v) => v === null)).toBe(false)
  })

  it('nom vidé → absent du corps, erreur « lastname »', () => {
    const r = corpsModificationProfil(INITIAL, saisie({ lastname: ' ' }))
    expect(r.corps).not.toHaveProperty('lastname')
    expect(champsEnErreur(INITIAL, saisie({ lastname: ' ' }))).toEqual(['lastname'])
  })

  it('adresse vidée → absente du corps, erreur « address »', () => {
    const r = corpsModificationProfil(INITIAL, saisie({ address: '' }))
    expect(r.corps).not.toHaveProperty('address')
    expect(champsEnErreur(INITIAL, saisie({ address: '' }))).toEqual(['address'])
  })

  it('NISU inchangé → absent', () => {
    expect(corpsModificationProfil(INITIAL, saisie({ nisu: NISU_A })).corps).not.toHaveProperty('nisu')
  })

  it('NISU modifié en minuscules avec espaces → majuscules, sans espaces autour', () => {
    const r = corpsModificationProfil(INITIAL, saisie({ nisu: `  ${NISU_B.toLowerCase()} ` }))
    expect(r.corps).toEqual({ nisu: NISU_B })
    expect(r.erreurs).toEqual([])
  })

  it('NISU absent au départ puis saisi → envoyé en majuscules', () => {
    const initial = { ...INITIAL, nisu: '' }
    const r = corpsModificationProfil(initial, { ...initial, nisu: NISU_B.toLowerCase() })
    expect(r.corps).toEqual({ nisu: NISU_B })
  })

  it('NISU renseigné puis vidé → absent, erreur « nisu »', () => {
    const r = corpsModificationProfil(INITIAL, saisie({ nisu: '  ' }))
    expect(r.corps).not.toHaveProperty('nisu')
    expect(champsEnErreur(INITIAL, saisie({ nisu: '  ' }))).toEqual(['nisu'])
  })

  it('NISU modifié au mauvais format → absent, erreur « nisu »', () => {
    const r = corpsModificationProfil(INITIAL, saisie({ nisu: 'ABC123' }))
    expect(r.corps).not.toHaveProperty('nisu')
    expect(champsEnErreur(INITIAL, saisie({ nisu: 'ABC123' }))).toEqual(['nisu'])
  })

  it('espaces seuls autour d’une valeur inchangée → considéré comme inchangé', () => {
    const r = corpsModificationProfil(INITIAL, saisie({ lastname: '  Exemple  ', phone2: ' +50900000002' }))
    expect(r.corps).toEqual({})
  })

  it('trim appliqué aussi à la valeur initiale', () => {
    const initial = { ...INITIAL, address: '  1 rue Fictive  ', motherName: 'Mère Fictive ' }
    const r = corpsModificationProfil(initial, saisie({ address: '1 rue Fictive', motherName: 'Mère Fictive' }))
    expect(r.corps).toEqual({})
  })

  it('date ISO complète en entrée (initiale ou saisie) → ramenée à AAAA-MM-JJ avant comparaison', () => {
    const initialIso = { ...INITIAL, birthDate: '2012-03-04T00:00:00.000Z' }
    expect(corpsModificationProfil(initialIso, saisie({ birthDate: '2012-03-04' })).corps).toEqual({})
    expect(corpsModificationProfil(INITIAL, saisie({ birthDate: '2012-03-04T00:00:00.000Z' })).corps).toEqual({})
    expect(corpsModificationProfil(INITIAL, saisie({ birthDate: '2012-05-06T00:00:00.000Z' })).corps)
      .toEqual({ birthDate: '2012-05-06' })
  })

  it('un champ obligatoire vide au départ et resté vide n’est pas une erreur', () => {
    const initial = { ...INITIAL, address: '' }
    expect(corpsModificationProfil(initial, { ...initial }).erreurs).toEqual([])
  })
})

describe('profilDepuisEleve (lecture tolérante de GET /api/students/:id)', () => {
  it('lit les champs de l’élève et de son compte, ignore le reste', () => {
    const profil = profilDepuisEleve({
      id: 'eleve-fictif',
      nisu: NISU_A,
      address: '1 rue Fictive',
      motherName: null,
      phone1: '+50900000001',
      champInconnu: 'ignoré',
      user: { lastname: 'Exemple', firstname: 'Camille', birthDate: '2012-03-04T00:00:00.000Z', email: null, username: 'x' },
    })
    expect(etatInitialFormulaire(profil)).toEqual({
      lastname: 'Exemple', firstname: 'Camille', birthDate: '2012-03-04', email: '',
      nisu: NISU_A, address: '1 rue Fictive', motherName: '', fatherName: '',
      phone1: '+50900000001', phone2: '', parentsEmail: '',
    })
  })

  it('une réponse illisible lève une erreur', () => {
    expect(() => profilDepuisEleve(null)).toThrow()
    expect(() => profilDepuisEleve('texte')).toThrow()
  })
})

describe('enregistrerProfil (lib/api/students.ts)', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('POST /api/students/update/{id encodé} avec le corps calculé', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: 'ok' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await enregistrerProfil('id/fictif ?', { phone1: '+50911112222' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/students/update/id%2Ffictif%20%3F')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ phone1: '+50911112222' })
  })

  it('une réponse non 2xx est rejetée (pas de succès annoncé)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'NISU already exists' }), { status: 409 })))
    await expect(enregistrerProfil('fictif', { nisu: NISU_B })).rejects.toMatchObject({ status: 409 })
  })
})
