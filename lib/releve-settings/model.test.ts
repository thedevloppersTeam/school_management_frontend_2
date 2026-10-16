/**
 * Paramétrage du relevé — modèle de l'écran (fonctions pures).
 * Données entièrement fictives.
 */
import {
  changedSectionSubjects,
  fromApiSubjects,
  hasChanges,
  moveItem,
  sectionsPayload,
  subjectsPayload,
  type SubjectSetting,
} from './model'

let pass = 0, fail = 0
const out: string[] = []
function check(l: string, got: unknown, want: unknown) {
  const g = String(got), w = String(want)
  if (g === w) { pass++; out.push(`  OK    ${l.padEnd(64)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${l.padEnd(64)} attendu ${w}, obtenu ${g}`) }
}

// ── Données fictives (forme de GET /api/subjects) ───────────────────────────

const NIVEAU = 'niveau-a'
const api = [
  { id: 's-b', name: 'Beta', code: 'B', classTypeId: NIVEAU, displayOrder: null, releveColumn: null, showOnReleve: true, sections: [] },
  { id: 's-a', name: 'Alpha', code: 'A', classTypeId: NIVEAU, displayOrder: null, releveColumn: 'LEFT', showOnReleve: true, sections: [] },
  {
    id: 's-c', name: 'Gamma', code: 'C', classTypeId: NIVEAU, displayOrder: 2, releveColumn: 'RIGHT', showOnReleve: false,
    sections: [
      { id: 'x-2', name: 'Deux', displayOrder: 2, showOnReleve: true, createdAt: '2024-01-01T00:00:00.000Z' },
      { id: 'x-1', name: 'Un', displayOrder: 1, showOnReleve: false, createdAt: '2024-01-02T00:00:00.000Z' },
      { id: 'x-0', name: 'Zéro', displayOrder: 2, showOnReleve: true, createdAt: '2023-12-31T00:00:00.000Z' },
    ],
  },
  { id: 's-d', name: 'Delta', code: 'D', classTypeId: NIVEAU, displayOrder: 1, releveColumn: null, showOnReleve: true, sections: [] },
  { id: 's-z', name: 'Autre niveau', code: 'Z', classTypeId: 'niveau-b', displayOrder: 1, sections: [] },
  // Ancien serveur : champs du relevé absents.
  { id: 's-e', name: 'Epsilon', code: 'E', classTypeId: NIVEAU, sections: [{ id: 'y-1', name: 'Seule', displayOrder: 1 }] },
]
const noms = (l: SubjectSetting[]) => l.map((s) => s.name).join(',')

// ── Tri initial ─────────────────────────────────────────────────────────────

const initial = fromApiSubjects(api, NIVEAU)
check('tri : niveau filtré, rang puis null en dernier, puis nom', noms(initial), 'Delta,Gamma,Alpha,Beta,Epsilon')
check('tri : sous-matières par rang, date, id', initial[1]?.sections.map((s) => s.name).join(','), 'Un,Zéro,Deux')
check('champs absents : valeurs par défaut', JSON.stringify([initial[4]?.releveColumn, initial[4]?.showOnReleve, initial[4]?.sections[0]?.showOnReleve]), '[null,true,true]')
check('valeurs lues', JSON.stringify([initial[1]?.releveColumn, initial[1]?.showOnReleve, initial[1]?.sections[0]?.showOnReleve]), '["RIGHT",false,false]')
check('niveau sans matière : liste vide', fromApiSubjects(api, 'niveau-vide').length, 0)
check('entrée non tableau : liste vide', fromApiSubjects(null, NIVEAU).length, 0)

// ── Déplacer haut / bas ─────────────────────────────────────────────────────

const abc = ['a', 'b', 'c']
check('monter le 2e', moveItem(abc, 1, -1).join(''), 'bac')
check('descendre le 2e', moveItem(abc, 1, 1).join(''), 'acb')
check('monter le 1er : inchangé (borne)', moveItem(abc, 0, -1).join(''), 'abc')
check('descendre le dernier : inchangé (borne)', moveItem(abc, 2, 1).join(''), 'abc')
check('index hors liste : inchangé', moveItem(abc, 7, -1).join(''), 'abc')
check('liste d’origine non modifiée', abc.join(''), 'abc')
check('nouvelle liste (pas la même référence)', moveItem(abc, 1, -1) !== abc, true)

// ── Charges utiles ──────────────────────────────────────────────────────────

const modifie = moveItem(initial, 4, -1).map((s) => (s.id === 's-b' ? { ...s, releveColumn: 'RIGHT' as const, showOnReleve: false } : s))
const p1 = subjectsPayload(NIVEAU, modifie)
check('matières : niveau', p1.classTypeId, NIVEAU)
check('matières : liste complète', p1.items.length, 5)
check('matières : rangs 1..n dans l’ordre affiché', p1.items.map((i) => `${i.id}:${i.displayOrder}`).join(','), 's-d:1,s-c:2,s-a:3,s-e:4,s-b:5')
check('matières : colonne et présence transmises', JSON.stringify(p1.items[4]), '{"id":"s-b","displayOrder":5,"releveColumn":"RIGHT","showOnReleve":false}')

// Repli neutre : sans implémentation, le contrôle échoue au lieu de planter.
const gamma: SubjectSetting = initial[1] ?? { id: '', name: '', code: '', displayOrder: null, releveColumn: null, showOnReleve: true, sections: [] }
const p2 = sectionsPayload({ ...gamma, sections: moveItem(gamma.sections, 2, -1) })
check('sous-matières : liste complète, rangs 1..n', p2.items.map((i) => `${i.id}:${i.displayOrder}`).join(','), 'x-1:1,x-2:2,x-0:3')
check('sous-matières : présence transmise', p2.items.map((i) => String(i.showOnReleve)).join(','), 'false,true,true')

// ── Détection des modifications ─────────────────────────────────────────────

check('aucune modification', hasChanges(initial, fromApiSubjects(api, NIVEAU)), false)
check('ordre des matières changé', hasChanges(initial, moveItem(initial, 0, 1)), true)
check('colonne changée', hasChanges(initial, initial.map((s, i) => (i === 0 ? { ...s, releveColumn: 'LEFT' as const } : s))), true)
check('présence changée', hasChanges(initial, initial.map((s, i) => (i === 0 ? { ...s, showOnReleve: false } : s))), true)
const sectionsBougees = initial.map((s) => (s.id === 's-c' ? { ...s, sections: moveItem(s.sections, 0, 1) } : s))
check('ordre des sous-matières changé : modification', hasChanges(initial, sectionsBougees), true)
check('matières dont les sous-matières ont changé', changedSectionSubjects(initial, sectionsBougees).join(','), 's-c')
const sectionMasquee = initial.map((s) => (s.id === 's-e' ? { ...s, sections: s.sections.map((x) => ({ ...x, showOnReleve: false })) } : s))
check('présence d’une sous-matière changée', changedSectionSubjects(initial, sectionMasquee).join(','), 's-e')
check('aucune sous-matière changée', changedSectionSubjects(initial, moveItem(initial, 0, 1)).length, 0)
check('aller-retour : plus de modification', hasChanges(initial, moveItem(moveItem(initial, 0, 1), 1, -1)), false)

console.log(out.join('\n'))
console.log(`\n${pass} OK, ${fail} ECHEC`)
if (fail > 0) process.exit(1)
