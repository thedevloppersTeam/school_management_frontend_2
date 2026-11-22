/**
 * Colonne « Enseignant » de la configuration de l'année (lot ID-T-F-3, partie
 * frontend) : logique pure de lib/affectations/enseignant.ts. Fiches et noms
 * FICTIFS, identifiants 00000000-….
 */
import { describe, expect, it } from 'vitest'
import type { FicheLigne } from '@/lib/enseignants/fiches'
import {
  AUCUN_ENSEIGNANT,
  confirmationRetrait,
  corpsAffectation,
  demandeConfirmation,
  estUnChangement,
  libelleListe,
  lireEnseignantAffecte,
  messageEnregistre,
  nomEnseignant,
  optionsEnseignants,
  retirerEnseignantDetaille,
  teacherIdDuChoix,
  texteEnseignantEnPlace,
  valeurDuChoix,
} from '@/lib/affectations/enseignant'

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`

const fiche = (n: number, lastname: string, firstname: string, etat: Partial<FicheLigne> = {}): FicheLigne => ({
  id: id(n),
  userId: id(100 + n),
  lastname,
  firstname,
  username: `${firstname.toLowerCase()}.${lastname.toLowerCase()}`,
  ficheActive: true,
  compteActif: true,
  ...etat,
})

const FICHES: FicheLigne[] = [
  fiche(1, 'Zéphyr', 'Alba'),
  fiche(2, 'Essai', 'Bruno'),
  fiche(3, 'Inactif', 'Carla', { ficheActive: false }),
  fiche(4, 'Sanscompte', 'Dora', { compteActif: false }),
  fiche(5, 'Élan', 'Émile'),
]

describe('lecture des affectations', () => {
  it("lireEnseignantAffecte ne lit que teacherId (jamais l'objet teacher)", () => {
    expect(lireEnseignantAffecte({ teacherId: id(1), teacher: { id: id(9) } })).toBe(id(1))
    expect(lireEnseignantAffecte({ teacherId: null })).toBeNull()
    expect(lireEnseignantAffecte({ teacherId: '' })).toBeNull()
    expect(lireEnseignantAffecte({ teacher: { id: id(9) } })).toBeNull()
    expect(lireEnseignantAffecte(null)).toBeNull()
  })

  it('retirerEnseignantDetaille retire la clé teacher de chaque élément, sans toucher au reste', () => {
    const brut = [
      { id: id(10), teacherId: id(1), teacher: { user: { email: 'x@exemple.test' } }, isExam: true },
      { id: id(11), teacherId: null, teacher: null },
      'inattendu',
    ]
    expect(retirerEnseignantDetaille(brut)).toEqual([
      { id: id(10), teacherId: id(1), isExam: true },
      { id: id(11), teacherId: null },
      'inattendu',
    ])
    expect(brut[0]).toHaveProperty('teacher')
  })

  it("retirerEnseignantDetaille laisse passer ce qui n'est pas un tableau", () => {
    const erreur = { message: 'refus' }
    expect(retirerEnseignantDetaille(erreur)).toBe(erreur)
    expect(retirerEnseignantDetaille(null)).toBeNull()
  })
})

describe('options de la liste', () => {
  it('ne propose que les fiches actives à compte actif, triées par nom', () => {
    const { actifs, inactifEnPlace } = optionsEnseignants(FICHES, null)
    expect(actifs.map((o) => o.libelle)).toEqual(['Élan Émile', 'Essai Bruno', 'Zéphyr Alba'])
    expect(actifs.map((o) => o.valeur)).toEqual([id(5), id(2), id(1)])
    expect(inactifEnPlace).toBeNull()
  })

  it("un enseignant actif en place ne crée pas d'option à part", () => {
    expect(optionsEnseignants(FICHES, id(2)).inactifEnPlace).toBeNull()
  })

  it('fiche inactive déjà affectée : seule option inactive, avec son état en mots (A6)', () => {
    const { actifs, inactifEnPlace } = optionsEnseignants(FICHES, id(3))
    expect(actifs.map((o) => o.valeur)).not.toContain(id(3))
    expect(inactifEnPlace).toEqual({ valeur: id(3), libelle: 'Inactif Carla', etat: 'Fiche inactive' })
  })

  it('compte désactivé déjà affecté : état « Compte désactivé »', () => {
    expect(optionsEnseignants(FICHES, id(4)).inactifEnPlace).toEqual({
      valeur: id(4),
      libelle: 'Sanscompte Dora',
      etat: 'Compte désactivé',
    })
  })

  it('les autres fiches inactives sont masquées (Q-5)', () => {
    const { actifs, inactifEnPlace } = optionsEnseignants(FICHES, id(3))
    expect(actifs.map((o) => o.valeur)).not.toContain(id(4))
    expect(inactifEnPlace?.valeur).toBe(id(3))
  })

  it('enseignant en place absent de la liste des fiches : gardé, état « Fiche introuvable »', () => {
    expect(optionsEnseignants(FICHES, id(99)).inactifEnPlace).toEqual({
      valeur: id(99),
      libelle: 'Enseignant inconnu',
      etat: 'Fiche introuvable',
    })
  })

  it("homonymes : l'identifiant de connexion les distingue", () => {
    const homonymes = [fiche(6, 'Essai', 'Bruno', { username: 'b.essai1' }), fiche(7, 'Essai', 'Bruno', { username: 'b.essai2' })]
    expect(optionsEnseignants(homonymes, null).actifs.map((o) => o.libelle)).toEqual([
      'Essai Bruno (b.essai1)',
      'Essai Bruno (b.essai2)',
    ])
  })

  it("ne modifie pas l'entrée", () => {
    const copie = structuredClone(FICHES)
    optionsEnseignants(FICHES, id(3))
    expect(FICHES).toEqual(copie)
  })
})

describe('choix et corps envoyé', () => {
  it('« Aucun enseignant » a une valeur sentinelle non vide, qui devient null', () => {
    expect(AUCUN_ENSEIGNANT).not.toBe('')
    expect(valeurDuChoix(null)).toBe(AUCUN_ENSEIGNANT)
    expect(valeurDuChoix(id(1))).toBe(id(1))
    expect(teacherIdDuChoix(AUCUN_ENSEIGNANT)).toBeNull()
    expect(teacherIdDuChoix(id(1))).toBe(id(1))
  })

  it('corps à une seule clé, teacherId', () => {
    expect(corpsAffectation(id(1))).toEqual({ teacherId: id(1) })
    expect(corpsAffectation(null)).toEqual({ teacherId: null })
    expect(Object.keys(corpsAffectation(null))).toEqual(['teacherId'])
  })

  it('aucun envoi sans changement', () => {
    expect(estUnChangement(id(1), id(1))).toBe(false)
    expect(estUnChangement(null, null)).toBe(false)
    expect(estUnChangement(null, id(1))).toBe(true)
    expect(estUnChangement(id(1), id(2))).toBe(true)
    expect(estUnChangement(id(1), null)).toBe(true)
  })

  it('confirmation pour le retrait seulement (Q-3)', () => {
    expect(demandeConfirmation(id(1), null)).toBe(true)
    expect(demandeConfirmation(null, id(1))).toBe(false)
    expect(demandeConfirmation(id(1), id(2))).toBe(false)
    expect(demandeConfirmation(null, null)).toBe(false)
  })
})

describe('textes', () => {
  it('nomEnseignant lit toutes les fiches, inactives comprises', () => {
    expect(nomEnseignant(FICHES, id(3))).toBe('Inactif Carla')
    expect(nomEnseignant(FICHES, null)).toBeNull()
    expect(nomEnseignant(FICHES, id(99))).toBeNull()
  })

  it('libellé accessible : matière, puis filière quand elle existe (A4)', () => {
    expect(libelleListe('Mathématiques', null)).toBe('Enseignant de Mathématiques')
    expect(libelleListe('Physique', 'SMP')).toBe('Enseignant de Physique, filière SMP')
  })

  it('année archivée (A7) : texte de l’enseignant en place, inactives comprises ; fiche absente dite « inconnu »', () => {
    expect(texteEnseignantEnPlace(FICHES, id(3))).toBe('Inactif Carla')
    expect(texteEnseignantEnPlace(FICHES, null)).toBe('Aucun enseignant')
    expect(texteEnseignantEnPlace(FICHES, id(99))).toBe('Enseignant inconnu')
  })

  it("« Enregistré » nomme l'ancien et le nouvel enseignant au remplacement (Q-3)", () => {
    expect(messageEnregistre({ geste: 'REMPLACEMENT', matiere: 'Mathématiques', ancien: 'Essai Bruno', nouveau: 'Zéphyr Alba' })).toBe(
      'Mathématiques : enregistré. Zéphyr Alba remplace Essai Bruno.',
    )
    expect(messageEnregistre({ geste: 'AFFECTATION', matiere: 'Mathématiques', ancien: null, nouveau: 'Zéphyr Alba' })).toBe(
      'Mathématiques : enregistré. Zéphyr Alba est affecté.',
    )
    expect(messageEnregistre({ geste: 'RETRAIT', matiere: 'Mathématiques', ancien: 'Essai Bruno', nouveau: null })).toBe(
      'Mathématiques : enregistré. Essai Bruno est retiré.',
    )
  })

  it("nom manquant : le message reste lisible, sans identifiant", () => {
    const m = messageEnregistre({ geste: 'REMPLACEMENT', matiere: 'Chimie', ancien: null, nouveau: null })
    expect(m).toBe("Chimie : enregistré. Un autre enseignant remplace l'enseignant précédent.")
  })

  it("confirmation du retrait : l'effet exact, action non ambiguë", () => {
    expect(confirmationRetrait({ nom: 'Essai Bruno', matiere: 'Mathématiques', salle: '7e AF A' })).toEqual({
      titre: "Retirer l'enseignant de Mathématiques ?",
      effet:
        "Essai Bruno n'enseignera plus Mathématiques dans la salle 7e AF A et n'aura plus accès à ses notes. Les notes déjà saisies sont conservées.",
      action: "Retirer l'enseignant",
    })
  })
})
