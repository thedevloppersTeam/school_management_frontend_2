/**
 * Nom de la prochaine année — et le cycle qui a révélé le défaut.
 *
 * Le test central est le dernier : créer une année puis rouvrir le modal doit
 * proposer un nom DIFFÉRENT. C'est exactement ce que l'ancienne dérivation ne
 * savait pas faire, puisqu'elle lisait l'année active — que la création ne
 * modifie pas.
 */
import { prochainNomAnnee, anneeDeDebut, libelleAnnee } from './next-name'

let pass = 0, fail = 0
const out: string[] = []
function check(label: string, got: unknown, want: unknown) {
  const g = String(got), w = String(want)
  if (g === w) { pass++; out.push(`  OK    ${label.padEnd(58)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${label.padEnd(58)} attendu ${w}, obtenu ${g}`) }
}

// ── Lecture d'un libellé ────────────────────────────────────────────────────
{
  check('libelle normal', anneeDeDebut('2026-2027'), 2026)
  check('espaces autour', anneeDeDebut('  2026-2027  '), 2026)
  check('libelle hors format ignore', String(anneeDeDebut('Rattrapage')), 'null')
  check('millesimes non consecutifs ignores', String(anneeDeDebut('2026-2030')), 'null')
  check('vide', String(anneeDeDebut('')), 'null')
  check('null', String(anneeDeDebut(null)), 'null')
  check('formatage', libelleAnnee(2026), '2026-2027')
}

// ── Le maximum, pas l'année active ──────────────────────────────────────────
{
  // Le cas réel de prod_replica : l'active est 2026-2027, mais 2027-2028
  // existe déjà. L'ancienne dérivation proposait 2027-2028 -> 409 perpétuel.
  const enBase = ['2025-2026', '2026-2027', '2027-2028']
  check('max + 1, pas active + 1', prochainNomAnnee(enBase), '2028-2029')

  check('ordre indifferent', prochainNomAnnee(['2027-2028', '2025-2026', '2026-2027']), '2028-2029')
  check('une seule annee', prochainNomAnnee(['2026-2027']), '2027-2028')
  check('les trous ne sont pas combles', prochainNomAnnee(['2024-2025', '2026-2027']), '2027-2028')
  check('libelles hors format ecartes', prochainNomAnnee(['Rattrapage', '2026-2027', null]), '2027-2028')
}

// ── Base vide : repli sur l'année scolaire en cours ─────────────────────────
{
  check('base vide, en septembre', prochainNomAnnee([], new Date('2026-09-18T00:00:00Z')), '2026-2027')
  check('base vide, en janvier', prochainNomAnnee([], new Date('2027-01-15T00:00:00Z')), '2026-2027')
  check('base vide, en aout', prochainNomAnnee([], new Date('2026-08-31T00:00:00Z')), '2025-2026')
  check('que des libelles illisibles', prochainNomAnnee(['x', 'y'], new Date('2026-09-18T00:00:00Z')), '2026-2027')
}

// ── LE CAS QUI A REVELE LE DEFAUT ───────────────────────────────────────────
// Cycle complet : on propose un nom, on crée l'année, on rouvre le modal.
{
  let enBase = ['2025-2026', '2026-2027']

  const premier = prochainNomAnnee(enBase)
  check('1re ouverture du modal', premier, '2027-2028')

  // Création : l'année entre en base. Elle n'est PAS courante — le contrôleur
  // pose isCurrent: false, et c'est ce qui piégeait l'ancienne dérivation.
  enBase = [...enBase, premier]

  const second = prochainNomAnnee(enBase)
  check('2e ouverture : nom DIFFERENT du precedent', String(second !== premier), 'true')
  check('2e ouverture : valeur', second, '2028-2029')

  // Et le cycle continue, indéfiniment.
  enBase = [...enBase, second]
  const troisieme = prochainNomAnnee(enBase)
  check('3e ouverture : encore different', String(troisieme !== second), 'true')
  check('3e ouverture : valeur', troisieme, '2029-2030')

  // Preuve par l'absurde : l'ancienne regle, sur le meme jeu de donnees.
  const active = '2026-2027' // ne bouge jamais, la creation ne l'active pas
  const ancienneRegle = () => libelleAnnee(anneeDeDebut(active)! + 1)
  check('ancienne regle : 1re ouverture', ancienneRegle(), '2027-2028')
  check('ancienne regle : 2e ouverture, MEME nom', ancienneRegle(), '2027-2028')
  check('ancienne regle : le nom est deja pris', String(enBase.includes(ancienneRegle())), 'true')
}

console.log(out.join('\n'))
console.log('\n' + '='.repeat(74))
console.log(`  ${pass} tests OK, ${fail} echec(s)`)
console.log('='.repeat(74))
process.exit(fail === 0 ? 0 : 1)
