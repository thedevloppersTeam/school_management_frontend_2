/**
 * Écran « Enseignants » (lot ID-T-F) : logique pure de lib/enseignants/fiches.ts.
 * Valeurs fictives uniquement : aucun nom, identifiant ou UUID réel.
 */
import { describe, expect, it } from 'vitest'
import {
  LONGUEUR_MAX,
  SAISIE_VIDE,
  adresseDesCandidats,
  confirmationEtatFiche,
  corpsDeCreation,
  estAdministrateur,
  filtrerEtTrier,
  libelleEtatCompte,
  libelleEtatFiche,
  lireCandidats,
  lireFiches,
  motifSansAcces,
  peutChangerLEtat,
  saisieRecevable,
  type FicheLigne,
} from '@/lib/enseignants/fiches'

const fiche = (n: number, extra: Record<string, unknown> = {}, compte: Record<string, unknown> = {}) => ({
  id: `fiche-${n}`,
  userId: `compte-${n}`,
  address: '1, rue Fictive',
  phone: '0000-0000',
  email: 'enseignant@exemple.test',
  isActive: true,
  user: { id: `compte-${n}`, lastname: `Essai${n}`, firstname: 'Alpha', username: `essai${n}`, isActive: true, email: 'x@exemple.test', ...compte },
  ...extra,
})

const ligne = (p: Partial<FicheLigne>): FicheLigne => ({
  id: 'f', userId: 'u', lastname: '', firstname: '', username: '', ficheActive: true, compteActif: true, ...p,
})

describe('lireFiches — lecteur tolérant et minimisation', () => {
  it("garde l'état de la FICHE et celui du COMPTE, séparément", () => {
    const [a, b] = lireFiches([fiche(1, { isActive: false }), fiche(2, {}, { isActive: false })])
    expect(a).toMatchObject({ ficheActive: false, compteActif: true })
    expect(b).toMatchObject({ ficheActive: true, compteActif: false })
  })

  it("ne garde ni l'adresse, ni le téléphone, ni le courriel", () => {
    const [a] = lireFiches([fiche(1)])
    expect(Object.keys(a).sort()).toEqual(['compteActif', 'ficheActive', 'firstname', 'id', 'lastname', 'userId', 'username'])
  })

  it('ignore les champs inconnus ; état absent ou mal typé → inactif', () => {
    const [a] = lireFiches([{ id: 'f', userId: 'u', nouveau: 1, isActive: 'oui', user: { isActive: 1 } }])
    expect(a).toEqual(ligne({ id: 'f', userId: 'u', ficheActive: false, compteActif: false }))
  })

  it('écarte une entrée sans id ou sans userId, et toute réponse qui n’est pas un tableau', () => {
    expect(lireFiches([{ userId: 'u' }, { id: 'f' }, null, 'x'])).toEqual([])
    expect(lireFiches({ fiches: [] })).toEqual([])
    expect(lireFiches(null)).toEqual([])
  })
})

describe('lireCandidats — exactement cinq champs (D-TC2)', () => {
  it('garde id, firstname, lastname, username, isActive, et rien d’autre', () => {
    const [c] = lireCandidats([{ id: 'c1', firstname: 'Alpha', lastname: 'Essai', username: 'aessai', isActive: false, email: 'x@exemple.test', phone: '0' }])
    expect(c).toEqual({ id: 'c1', firstname: 'Alpha', lastname: 'Essai', username: 'aessai', isActive: false })
  })

  it('écarte une entrée sans id ; réponse hors tableau → liste vide', () => {
    expect(lireCandidats([{ firstname: 'Alpha' }])).toEqual([])
    expect(lireCandidats({})).toEqual([])
  })
})

describe('libellés d’état, en mots (D-TF1)', () => {
  it('fiche', () => {
    expect(libelleEtatFiche(true)).toBe('Fiche active')
    expect(libelleEtatFiche(false)).toBe('Fiche inactive')
  })
  it('compte', () => {
    expect(libelleEtatCompte(true)).toBe('Compte actif')
    expect(libelleEtatCompte(false)).toBe('Compte désactivé')
  })
  it('fiche active sur compte désactivé : le motif sans accès est dit (D-TF4)', () => {
    expect(motifSansAcces({ ficheActive: true, compteActif: false })).toMatch(/compte est désactivé/)
    expect(motifSansAcces({ ficheActive: true, compteActif: true })).toBeNull()
    expect(motifSansAcces({ ficheActive: false, compteActif: false })).toBeNull()
  })
})

describe('filtrerEtTrier — recherche et tri par nom', () => {
  const lignes = [
    ligne({ id: '1', lastname: 'Zéphyr', firstname: 'Alpha', username: 'zalpha' }),
    ligne({ id: '2', lastname: 'Essai', firstname: 'Bêta', username: 'ebeta' }),
    ligne({ id: '3', lastname: 'essai', firstname: 'Alpha', username: 'ealpha' }),
  ]

  it('tri par nom puis prénom, sans la casse', () => {
    expect(filtrerEtTrier(lignes, '').map((l) => l.id)).toEqual(['3', '2', '1'])
  })

  it('recherche sans la casse ni les accents, sur nom, prénom et identifiant', () => {
    expect(filtrerEtTrier(lignes, 'ZEPHYR').map((l) => l.id)).toEqual(['1'])
    expect(filtrerEtTrier(lignes, 'beta').map((l) => l.id)).toEqual(['2'])
    expect(filtrerEtTrier(lignes, 'ealp').map((l) => l.id)).toEqual(['3'])
  })

  it('plusieurs mots : chacun doit se trouver', () => {
    expect(filtrerEtTrier(lignes, 'essai alpha').map((l) => l.id)).toEqual(['3'])
  })

  it('ne modifie pas la liste reçue', () => {
    const copie = lignes.map((l) => l.id)
    filtrerEtTrier(lignes, '')
    expect(lignes.map((l) => l.id)).toEqual(copie)
  })
})

describe('droits de l’écran', () => {
  it('roles fait foi : ADMIN ou SYSTEM_ADMIN admis, TEACHER seul refusé', () => {
    expect(estAdministrateur({ type: 'ADMIN', roles: ['ADMIN', 'TEACHER'] })).toBe(true)
    expect(estAdministrateur({ type: 'SYSTEM_ADMIN', roles: ['SYSTEM_ADMIN'] })).toBe(true)
    expect(estAdministrateur({ type: 'TEACHER', roles: ['TEACHER'] })).toBe(false)
    expect(estAdministrateur({ type: 'ADMIN', roles: [] })).toBe(false)
  })
  it('sans roles : repli sur type', () => {
    expect(estAdministrateur({ type: 'ADMIN' })).toBe(true)
    expect(estAdministrateur({ type: 'TEACHER' })).toBe(false)
    expect(estAdministrateur(null)).toBe(false)
  })
  it('aucune action sur sa propre fiche, ni sans compte connecté connu (D-TF3)', () => {
    expect(peutChangerLEtat({ userId: 'u1' }, 'u1')).toBe(false)
    expect(peutChangerLEtat({ userId: 'u1' }, 'u2')).toBe(true)
    expect(peutChangerLEtat({ userId: 'u1' }, null)).toBe(false)
  })
})

describe('confirmation (D-TF3)', () => {
  it("la désactivation dit l'effet exact", () => {
    expect(confirmationEtatFiche(false).effet).toBe(
      'Le compte perd le rôle enseignant à sa prochaine action. Ses affectations et les notes déjà saisies sont conservées.',
    )
    expect(confirmationEtatFiche(false).action).toBe('Désactiver la fiche')
  })
  it("l'activation dit la condition du compte actif", () => {
    expect(confirmationEtatFiche(true).effet).toMatch(/si le compte est actif/)
    expect(confirmationEtatFiche(true).action).toBe('Activer la fiche')
  })
})

describe('corps de création (D-TF2, D-TC4)', () => {
  it('seul userId est envoyé quand rien d’autre n’est saisi : address et phone omis', () => {
    expect(corpsDeCreation({ ...SAISIE_VIDE, userId: ' c1 ' })).toEqual({ userId: 'c1' })
  })
  it('un champ vide ou fait d’espaces est omis, jamais envoyé en ""', () => {
    const corps = corpsDeCreation({ ...SAISIE_VIDE, userId: 'c1', phone: '   ', role: ' Titulaire ', hireDate: '2024-09-01' })
    expect(corps).toEqual({ userId: 'c1', role: 'Titulaire', hireDate: '2024-09-01' })
  })
  it('recevable : un compte choisi, téléphone ≤ 20 et fonction ≤ 100', () => {
    expect(saisieRecevable(SAISIE_VIDE)).toBe(false)
    expect(saisieRecevable({ ...SAISIE_VIDE, userId: 'c1' })).toBe(true)
    expect(saisieRecevable({ ...SAISIE_VIDE, userId: 'c1', phone: '0'.repeat(21) })).toBe(false)
    expect(saisieRecevable({ ...SAISIE_VIDE, userId: 'c1', role: 'x'.repeat(101) })).toBe(false)
  })
})

describe('adresseDesCandidats — recherche transmise au serveur (ID-T-C)', () => {
  it('recherche vide ou blanche : aucun paramètre q', () => {
    expect(adresseDesCandidats('')).toBe('/api/teachers/candidats')
    expect(adresseDesCandidats('   ')).toBe('/api/teachers/candidats')
  })

  it('q rogné et encodé : il ne sort jamais de la chaîne de requête', () => {
    expect(adresseDesCandidats('  Essai  ')).toBe('/api/teachers/candidats?q=Essai')
    expect(adresseDesCandidats('é&x=1#')).toBe('/api/teachers/candidats?q=%C3%A9%26x%3D1%23')
  })

  it('q borné à 100 caractères après trim, comme le serveur (au-delà : 400)', () => {
    expect(LONGUEUR_MAX.recherche).toBe(100)
    const q = new URL(adresseDesCandidats(`  ${'a'.repeat(150)}  `), 'https://exemple.test').searchParams.get('q')
    expect(q).toBe('a'.repeat(100))
    const juste = new URL(adresseDesCandidats('b'.repeat(100)), 'https://exemple.test').searchParams.get('q')
    expect(juste).toBe('b'.repeat(100))
  })
})
