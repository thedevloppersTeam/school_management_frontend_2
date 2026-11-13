import { describe, expect, it } from 'vitest'
import {
  DISPENSES_VIDES,
  MESSAGE_DISPENSES_INDISPONIBLES,
  MESSAGE_DISPENSES_INDISPONIBLES_SAISIE,
  avecSousMatieres,
  corpsDispensesSousMatieres,
  dispensesDeLEleve,
  dispensesDeLaMatiere,
  elevesAttendus,
  etatDispensesDeLaMatiere,
  lireDispenses,
  sousMatieresDispensees,
  valeurSousMatiere,
  type LigneDispense,
} from '../exclusions-view'

// Lot A (E30) — lecture des dispenses par les écrans de saisie.
// Identifiants inventés, sans rapport avec des données réelles.
const CS = 'cs-maths'
const AUTRE_CS = 'cs-francais'

const ligne = (enrollmentId: string, classSubjectId: string | null, sectionId: string | null): LigneDispense => ({
  enrollmentId,
  classSubjectId,
  sectionId,
})

describe('dispensesDeLaMatiere', () => {
  it('dispense de la matière entière seule', () => {
    const vue = dispensesDeLaMatiere([ligne('e1', CS, null)], CS)
    expect([...vue.matiereEntiere]).toEqual(['e1'])
    expect(sousMatieresDispensees(vue, 'e1').size).toBe(0)
  })

  it('matière entière ET sous-matières : les deux sont rendues, sans null dans les sous-matières', () => {
    const vue = dispensesDeLaMatiere([ligne('e1', CS, null), ligne('e1', CS, 's1'), ligne('e1', CS, 's2')], CS)
    expect(vue.matiereEntiere.has('e1')).toBe(true)
    expect([...sousMatieresDispensees(vue, 'e1')].sort()).toEqual(['s1', 's2'])
    expect([...sousMatieresDispensees(vue, 'e1')].includes(null as unknown as string)).toBe(false)
  })

  it('un autre élève n’est pas touché', () => {
    const vue = dispensesDeLaMatiere([ligne('e1', CS, null), ligne('e2', CS, 's1')], CS)
    expect(vue.matiereEntiere.has('e2')).toBe(false)
    expect(sousMatieresDispensees(vue, 'e1').size).toBe(0)
    expect([...sousMatieresDispensees(vue, 'e2')]).toEqual(['s1'])
  })

  it('une autre matière n’est pas touchée : classSubjectId d’une autre matière ignoré', () => {
    const vue = dispensesDeLaMatiere([ligne('e1', AUTRE_CS, null), ligne('e1', AUTRE_CS, 's9')], CS)
    expect(vue.matiereEntiere.size).toBe(0)
    expect(vue.sousMatieres.size).toBe(0)
  })

  it('ancienne ligne à classSubjectId NULL : ignorée', () => {
    const vue = dispensesDeLaMatiere([ligne('e1', null, 's1')], CS)
    expect(vue.sousMatieres.size).toBe(0)
  })

  it('liste vide', () => {
    const vue = dispensesDeLaMatiere([], CS)
    expect(vue.matiereEntiere.size).toBe(0)
    expect(vue.sousMatieres.size).toBe(0)
    expect(sousMatieresDispensees(DISPENSES_VIDES, 'e1').size).toBe(0)
  })
})

describe('compteur « X / Y » : élèves attendus', () => {
  it('un élève dispensé de la matière entière sort du compteur', () => {
    const vue = dispensesDeLaMatiere([ligne('e2', CS, null), ligne('e3', CS, 's1')], CS)
    const attendus = elevesAttendus([{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }], vue.matiereEntiere)
    expect(attendus.map((e) => e.id)).toEqual(['e1', 'e3'])
  })
})

describe('fenêtre des sous-matières : corps envoyé', () => {
  it('aucun null dans sectionIds, pas de wholeSubject', () => {
    const corps = corpsDispensesSousMatieres(CS, 'st-2', new Set<string | null>(['s1', null, 's2', 's1', '']))
    expect(corps).toEqual({ classSubjectId: CS, stepId: 'st-2', sectionIds: ['s1', 's2'] })
    expect('wholeSubject' in corps).toBe(false)
    expect(JSON.stringify(corps)).not.toContain('null')
  })

  it('après enregistrement : la dispense de matière entière est conservée', () => {
    const avant = dispensesDeLaMatiere([ligne('e1', CS, null), ligne('e1', CS, 's1')], CS)
    const apres = avecSousMatieres(avant, 'e1', ['s2'])
    expect(apres.matiereEntiere.has('e1')).toBe(true)
    expect([...sousMatieresDispensees(apres, 'e1')]).toEqual(['s2'])
    expect([...sousMatieresDispensees(avant, 'e1')]).toEqual(['s1']) // pas de mutation
  })
})

describe('dispensesDeLEleve (saisie par élève)', () => {
  it('sépare matières entières et sous-matières, pour cet élève seulement', () => {
    const rows = [
      ligne('e1', CS, null),
      ligne('e1', AUTRE_CS, 's9'),
      ligne('e2', AUTRE_CS, null),
    ]
    const d = dispensesDeLEleve(rows, 'e1')
    expect([...d.matieresEntieres]).toEqual([CS])
    expect([...d.sousMatieres]).toEqual(['s9'])
  })

  it('liste vide', () => {
    const d = dispensesDeLEleve([], 'e1')
    expect(d.matieresEntieres.size).toBe(0)
    expect(d.sousMatieres.size).toBe(0)
  })
})

describe('valeurSousMatiere', () => {
  it('matière dispensée entière : la note reste visible', () => {
    expect(valeurSousMatiere('12', true, false)).toBe('12')
    expect(valeurSousMatiere('12', true, true)).toBe('12')
  })
  it('sous-matière dispensée seule : champ vide, comme avant', () => {
    expect(valeurSousMatiere('12', false, true)).toBe('')
  })
  it('sans dispense : la saisie', () => {
    expect(valeurSousMatiere('12', false, false)).toBe('12')
    expect(valeurSousMatiere(undefined, false, false)).toBe('')
  })
})

describe('lireDispenses : une lecture échouée n’est pas « aucune dispense »', () => {
  it('succès : les lignes, même vides', async () => {
    expect(await lireDispenses(async () => [])).toEqual({ ok: true, rows: [] })
    const rows = [ligne('e1', CS, null)]
    expect(await lireDispenses(async () => rows)).toEqual({ ok: true, rows })
  })

  it('échec réseau ou statut non 2xx : ok false, aucune ligne', async () => {
    const res = await lireDispenses<LigneDispense>(async () => { throw new Error('excluded-sections 500') })
    expect(res).toEqual({ ok: false })
  })

  it('réponse qui n’est pas un tableau : traitée comme un échec', async () => {
    const res = await lireDispenses<LigneDispense>(async () => ({}) as unknown as LigneDispense[])
    expect(res.ok).toBe(false)
  })

  it('message affiché (rapport de classe, Consultation)', () => {
    expect(MESSAGE_DISPENSES_INDISPONIBLES).toBe(
      "Les dispenses n'ont pas pu être chargées : moyennes non calculées. Réessayez.",
    )
  })

  it('message affiché (grille de saisie)', () => {
    expect(MESSAGE_DISPENSES_INDISPONIBLES_SAISIE).toBe(
      "Les dispenses n'ont pas pu être chargées : saisie bloquée pour éviter une erreur. Réessayez.",
    )
  })
})

describe('etatDispensesDeLaMatiere : grille par matière après la lecture', () => {
  it('lecture réussie : dispenses de la matière, saisie permise', () => {
    const etat = etatDispensesDeLaMatiere({ ok: true, rows: [ligne('e1', CS, null)] }, CS)
    expect(etat.saisieBloquee).toBe(false)
    expect(etat.dispenses.matiereEntiere.has('e1')).toBe(true)
  })

  it('lecture réussie et vide : aucune dispense, saisie permise', () => {
    const etat = etatDispensesDeLaMatiere({ ok: true, rows: [] }, CS)
    expect(etat.saisieBloquee).toBe(false)
    expect(etat.dispenses.matiereEntiere.size).toBe(0)
  })

  it('lecture échouée : saisie bloquée (dispenses inconnues, pas « aucune dispense »)', () => {
    const etat = etatDispensesDeLaMatiere({ ok: false }, CS)
    expect(etat.saisieBloquee).toBe(true)
    expect(etat.dispenses.matiereEntiere.size).toBe(0)
    expect(etat.dispenses.sousMatieres.size).toBe(0)
  })
})
