import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  actionsLigneEleve,
  CHAMPS_PROFIL,
  corpsModificationProfil,
  etatInitialFormulaire,
  OPTIONS_SEXE,
  profilDepuisEleve,
  SEXE_NON_RENSEIGNE,
  sexeDepuisSelect,
  valeurSelectSexe,
  type SaisieProfil,
} from '@/lib/students/profil'
import { enregistrerProfil } from '@/lib/api/students'
import { PostApiStudentsUpdateIdBody } from '@/lib/api/menfp/contract.gen'

// Données fictives uniquement (dépôt public, données de mineurs).
const NISU_A = 'ABCDE12345FGHIJ67890'
const NISU_B = 'ZYXWV98765UTSRQ43210'
/** Jour civil passé en paramètre : la règle n'a pas d'horloge. */
const AUJOURDHUI = '2026-11-22'

const INITIAL: SaisieProfil = etatInitialFormulaire({
  lastname: 'Exemple',
  firstname: 'Camille',
  birthDate: '2012-03-04',
  gender: 'FEMALE',
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

function calcul(s: SaisieProfil, initial: SaisieProfil = INITIAL) {
  return corpsModificationProfil(initial, s, AUJOURDHUI)
}

function champsEnErreur(s: SaisieProfil, initial: SaisieProfil = INITIAL): string[] {
  return calcul(s, initial).erreurs.map((e) => e.champ)
}

describe('liste fermée des champs', () => {
  it('12 champs, ceux du corps de POST /api/students/update/{id} au contrat épinglé', () => {
    expect(CHAMPS_PROFIL).toHaveLength(12)
    expect([...CHAMPS_PROFIL].sort()).toEqual(Object.keys(PostApiStudentsUpdateIdBody.shape).sort())
  })
})

describe('etatInitialFormulaire', () => {
  it('null et undefined deviennent ""', () => {
    const etat = etatInitialFormulaire({ lastname: null, firstname: undefined, email: null, gender: null })
    expect(etat.lastname).toBe('')
    expect(etat.firstname).toBe('')
    expect(etat.email).toBe('')
    expect(etat.gender).toBe('')
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
    expect(INITIAL.gender).toBe('FEMALE')
  })

  it('une date ISO complète est ramenée à AAAA-MM-JJ', () => {
    expect(etatInitialFormulaire({ birthDate: '2012-03-04T00:00:00.000Z' }).birthDate).toBe('2012-03-04')
  })

  it('un sexe hors de MALE et FEMALE est lu comme non renseigné', () => {
    expect(etatInitialFormulaire({ gender: 'AUTRE' }).gender).toBe('')
  })
})

describe('corpsModificationProfil — sémantique PATCH', () => {
  it('aucun changement → {}', () => {
    const r = calcul(saisie({}))
    expect(r.corps).toEqual({})
    expect(r.erreurs).toEqual([])
  })

  it('seul le téléphone 1 modifié → { phone1 } et rien d’autre', () => {
    const r = calcul(saisie({ phone1: '+50911112222' }))
    expect(r.corps).toEqual({ phone1: '+50911112222' })
    expect(r.erreurs).toEqual([])
  })

  it('courriel inchangé → absent du corps (non-régression D-1)', () => {
    const r = calcul(saisie({ address: '2 rue Fictive' }))
    expect(r.corps).not.toHaveProperty('email')
    expect(r.corps).toEqual({ address: '2 rue Fictive' })
  })

  it('espaces seuls autour d’une valeur inchangée → considéré comme inchangé', () => {
    expect(calcul(saisie({ lastname: '  Exemple  ', phone2: ' +50900000002' })).corps).toEqual({})
  })

  it('trim appliqué aussi à la valeur initiale', () => {
    const initial = { ...INITIAL, address: '  1 rue Fictive  ', motherName: 'Mère Fictive ' }
    expect(calcul(saisie({ address: '1 rue Fictive', motherName: 'Mère Fictive' }), initial).corps).toEqual({})
  })

  it('date ISO complète en entrée (initiale ou saisie) → ramenée à AAAA-MM-JJ avant comparaison', () => {
    const initialIso = { ...INITIAL, birthDate: '2012-03-04T00:00:00.000Z' }
    expect(calcul(saisie({ birthDate: '2012-03-04' }), initialIso).corps).toEqual({})
    expect(calcul(saisie({ birthDate: '2012-03-04T00:00:00.000Z' })).corps).toEqual({})
    expect(calcul(saisie({ birthDate: '2012-05-06T00:00:00.000Z' })).corps).toEqual({ birthDate: '2012-05-06' })
  })

  it('un champ obligatoire vide au départ et resté vide n’est pas une erreur', () => {
    const initial = { ...INITIAL, address: '' }
    expect(calcul({ ...initial }, initial).erreurs).toEqual([])
  })
})

describe('corpsModificationProfil — facultatif vidé → null (MPE-2, fin de MPE-16)', () => {
  const FACULTATIFS = ['motherName', 'fatherName', 'phone1', 'phone2', 'parentsEmail', 'email', 'gender'] as const

  it.each(FACULTATIFS)('%s vidé → envoyé à null, sans erreur', (champ) => {
    const r = calcul(saisie({ [champ]: '' }))
    expect(r.corps).toEqual({ [champ]: null })
    expect(r.erreurs).toEqual([])
  })

  it('un facultatif fait de blancs vaut vidé → null', () => {
    expect(calcul(saisie({ fatherName: '   ' })).corps).toEqual({ fatherName: null })
  })

  it('jamais la chaîne vide dans le corps', () => {
    const tout = saisie({ email: '', motherName: '', fatherName: '', phone1: '', phone2: '', parentsEmail: '', gender: '' })
    const { corps, erreurs } = calcul(tout)
    expect(erreurs).toEqual([])
    expect(Object.values(corps).some((v) => v === '')).toBe(false)
    expect(Object.keys(corps).sort()).toEqual([...FACULTATIFS].sort())
  })

  it('un facultatif vide au départ et resté vide n’est pas envoyé', () => {
    const initial = { ...INITIAL, phone2: '' }
    expect(calcul({ ...initial }, initial).corps).toEqual({})
  })
})

describe('corpsModificationProfil — obligatoire vidé refusé avant l’envoi', () => {
  it.each([
    ['lastname', 'Le nom est obligatoire : il ne peut pas être vidé.'],
    ['firstname', 'Le prénom est obligatoire : il ne peut pas être vidé.'],
    ['birthDate', 'La date de naissance est obligatoire : elle ne peut pas être vidée.'],
    ['address', "L'adresse est obligatoire : elle ne peut pas être vidée."],
  ] as const)('%s vidé → absent du corps, message en mots', (champ, message) => {
    const r = calcul(saisie({ [champ]: '  ' }))
    expect(r.corps).not.toHaveProperty(champ)
    expect(r.erreurs).toEqual([{ champ, message }])
  })

  it('NISU renseigné puis vidé → absent, erreur « nisu » (MPE-10)', () => {
    const r = calcul(saisie({ nisu: '  ' }))
    expect(r.corps).not.toHaveProperty('nisu')
    expect(champsEnErreur(saisie({ nisu: '  ' }))).toEqual(['nisu'])
  })
})

describe('corpsModificationProfil — bornes de saisie', () => {
  const x = (n: number) => 'x'.repeat(n)
  const BORNES: Array<[keyof SaisieProfil, number]> = [
    ['lastname', 100], ['firstname', 100], ['address', 255],
    ['motherName', 200], ['fatherName', 200], ['phone1', 20], ['phone2', 20],
  ]

  it.each(BORNES)('%s : %i caractères admis, un de plus refusé', (champ, max) => {
    expect(calcul(saisie({ [champ]: x(max) })).corps).toEqual({ [champ]: x(max) })
    const r = calcul(saisie({ [champ]: x(max + 1) }))
    expect(r.corps).not.toHaveProperty(champ)
    expect(r.erreurs.map((e) => e.champ)).toEqual([champ])
    expect(r.erreurs[0].message).toContain(String(max))
  })

  it.each(['email', 'parentsEmail'] as const)('%s : 150 caractères admis, 151 refusés', (champ) => {
    const courriel = (n: number) => `${'a'.repeat(n - '@exemple.test'.length)}@exemple.test`
    expect(calcul(saisie({ [champ]: courriel(150) })).corps).toEqual({ [champ]: courriel(150) })
    expect(champsEnErreur(saisie({ [champ]: courriel(151) }))).toEqual([champ])
  })

  it.each(['pas-un-courriel', 'a@b', 'a b@exemple.test', '@exemple.test'])('courriel mal formé « %s » refusé', (v) => {
    expect(champsEnErreur(saisie({ email: v }))).toEqual(['email'])
    expect(champsEnErreur(saisie({ parentsEmail: v }))).toEqual(['parentsEmail'])
  })

  it('courriels envoyés en minuscules, sans blancs de bord', () => {
    const r = calcul(saisie({ email: '  Eleve.Neuf@Exemple.TEST ', parentsEmail: 'Parents.Neufs@Exemple.test' }))
    expect(r.corps).toEqual({ email: 'eleve.neuf@exemple.test', parentsEmail: 'parents.neufs@exemple.test' })
  })

  it.each(['2010-13-01', '2010-00-10', '2010-01-00', '2010-02-30', '2011-02-29', '2010-04-31', '12/03/2010'])(
    'date inexistante ou illisible « %s » refusée',
    (v) => {
      expect(champsEnErreur(saisie({ birthDate: v }))).toEqual(['birthDate'])
    },
  )

  it('29 février d’une année bissextile admis', () => {
    expect(calcul(saisie({ birthDate: '2012-02-29' })).corps).toEqual({ birthDate: '2012-02-29' })
  })

  it('date future refusée, le jour même admis', () => {
    expect(calcul(saisie({ birthDate: AUJOURDHUI })).corps).toEqual({ birthDate: AUJOURDHUI })
    const r = calcul(saisie({ birthDate: '2026-11-23' }))
    expect(r.corps).toEqual({})
    expect(r.erreurs).toEqual([{ champ: 'birthDate', message: 'La date de naissance ne peut pas être dans le futur.' }])
  })

  it('NISU inchangé → absent', () => {
    expect(calcul(saisie({ nisu: NISU_A })).corps).not.toHaveProperty('nisu')
  })

  it('NISU modifié en minuscules avec espaces → majuscules, sans espaces autour', () => {
    const r = calcul(saisie({ nisu: `  ${NISU_B.toLowerCase()} ` }))
    expect(r.corps).toEqual({ nisu: NISU_B })
    expect(r.erreurs).toEqual([])
  })

  it('NISU absent au départ puis saisi → envoyé en majuscules', () => {
    const initial = { ...INITIAL, nisu: '' }
    expect(calcul({ ...initial, nisu: NISU_B.toLowerCase() }, initial).corps).toEqual({ nisu: NISU_B })
  })

  it.each(['ABC123', `${NISU_B}1`, 'ABCDE12345FGHIJ6789-'])('NISU « %s » refusé (20 alphanumériques)', (v) => {
    expect(champsEnErreur(saisie({ nisu: v }))).toEqual(['nisu'])
  })

  it('une valeur longue déjà en base, non touchée, n’est ni envoyée ni refusée', () => {
    const initial = { ...INITIAL, address: x(300) }
    expect(calcul({ ...initial }, initial)).toEqual({ corps: {}, erreurs: [] })
  })
})

describe('sexe (F-1b, MPE-4)', () => {
  it('trois options : Masculin, Féminin, Non renseigné, avec une valeur non vide pour « Non renseigné »', () => {
    expect(OPTIONS_SEXE.map((o) => o.libelle)).toEqual(['Masculin', 'Féminin', 'Non renseigné'])
    expect(OPTIONS_SEXE.map((o) => o.valeur)).toEqual(['MALE', 'FEMALE', SEXE_NON_RENSEIGNE])
    expect(SEXE_NON_RENSEIGNE).not.toBe('')
  })

  it('pré-remplissage : le sexe lu devient la valeur de la liste', () => {
    expect(valeurSelectSexe(etatInitialFormulaire({ gender: 'MALE' }).gender)).toBe('MALE')
    expect(valeurSelectSexe(etatInitialFormulaire({ gender: 'FEMALE' }).gender)).toBe('FEMALE')
    expect(valeurSelectSexe(etatInitialFormulaire({ gender: null }).gender)).toBe(SEXE_NON_RENSEIGNE)
  })

  it('le choix de la liste revient à la saisie ; « Non renseigné » vaut vide', () => {
    expect(sexeDepuisSelect('MALE')).toBe('MALE')
    expect(sexeDepuisSelect(SEXE_NON_RENSEIGNE)).toBe('')
  })

  it('sexe inchangé → absent', () => {
    expect(calcul(saisie({ gender: 'FEMALE' })).corps).toEqual({})
  })

  it('changement → envoyé', () => {
    expect(calcul(saisie({ gender: sexeDepuisSelect('MALE') })).corps).toEqual({ gender: 'MALE' })
  })

  it('effacement (« Non renseigné ») → { gender: null }', () => {
    expect(calcul(saisie({ gender: sexeDepuisSelect(SEXE_NON_RENSEIGNE) })).corps).toEqual({ gender: null })
  })

  it('non renseigné au départ puis choisi → envoyé', () => {
    const initial = { ...INITIAL, gender: '' }
    expect(calcul({ ...initial, gender: 'FEMALE' }, initial).corps).toEqual({ gender: 'FEMALE' })
  })

  it('une valeur hors liste est refusée, jamais envoyée', () => {
    const r = calcul(saisie({ gender: 'AUTRE' }))
    expect(r.corps).toEqual({})
    expect(r.erreurs.map((e) => e.champ)).toEqual(['gender'])
  })
})

describe('actionsLigneEleve (F-3, MPE-5)', () => {
  it.each([
    [false, 'ACTIVE'], [false, 'DROPPED'], [false, 'TRANSFERRED'], [false, 'GRADUATED'],
    [true, 'ACTIVE'], [true, 'DROPPED'], [true, 'TRANSFERRED'], [true, 'GRADUATED'],
  ] as const)('année archivée %s, statut %s → « Modifier le profil » disponible', (anneeArchivee, statut) => {
    expect(actionsLigneEleve({ anneeArchivee, statut }).modifierProfil).toBe(true)
  })

  it('année ouverte, élève actif : gestes d’inscription, pas d’annulation de départ', () => {
    expect(actionsLigneEleve({ anneeArchivee: false, statut: 'ACTIVE' })).toEqual({
      modifierProfil: true, gestesInscription: true, annulerDepart: false, aucunGesteInscription: false,
    })
  })

  it('année ouverte, élève parti : annulation du départ seulement', () => {
    expect(actionsLigneEleve({ anneeArchivee: false, statut: 'DROPPED' })).toEqual({
      modifierProfil: true, gestesInscription: false, annulerDepart: true, aucunGesteInscription: false,
    })
  })

  it('année ouverte, inscription transférée ou diplômée : aucun geste d’inscription', () => {
    for (const statut of ['TRANSFERRED', 'GRADUATED'] as const) {
      expect(actionsLigneEleve({ anneeArchivee: false, statut })).toEqual({
        modifierProfil: true, gestesInscription: false, annulerDepart: false, aucunGesteInscription: true,
      })
    }
  })

  it('année archivée : le profil seul, aucun geste d’inscription', () => {
    for (const statut of ['ACTIVE', 'DROPPED', 'TRANSFERRED', 'GRADUATED'] as const) {
      expect(actionsLigneEleve({ anneeArchivee: true, statut })).toEqual({
        modifierProfil: true, gestesInscription: false, annulerDepart: false, aucunGesteInscription: false,
      })
    }
  })
})

describe('profilDepuisEleve (lecture tolérante de GET /api/students/:id)', () => {
  it('lit les champs de l’élève et de son compte, sexe compris, ignore le reste', () => {
    const profil = profilDepuisEleve({
      id: '00000000-0000-4000-8000-000000000001',
      nisu: NISU_A,
      address: '1 rue Fictive',
      motherName: null,
      phone1: '+50900000001',
      champInconnu: 'ignoré',
      user: { lastname: 'Exemple', firstname: 'Camille', birthDate: '2012-03-04T00:00:00.000Z', email: null, gender: 'MALE', username: 'x' },
    })
    expect(etatInitialFormulaire(profil)).toEqual({
      lastname: 'Exemple', firstname: 'Camille', birthDate: '2012-03-04', gender: 'MALE', email: '',
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

  it('POST /api/students/update/{id encodé} avec le corps calculé, null compris', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: 'ok' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await enregistrerProfil('id/fictif ?', { phone1: '+50911112222', fatherName: null })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/students/update/id%2Ffictif%20%3F')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ phone1: '+50911112222', fatherName: null })
  })

  it('une réponse non 2xx est rejetée (pas de succès annoncé)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ code: 'ELEVE_PROFIL_NISU_PRIS', message: 'texte du serveur' }),
      { status: 409 },
    )))
    await expect(enregistrerProfil('fictif', { nisu: NISU_B })).rejects.toMatchObject({ status: 409 })
  })
})
