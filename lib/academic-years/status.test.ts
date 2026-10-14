/**
 * Statut d'une année scolaire — la règle consolidée.
 *
 * Le test qui compte est celui de la date illisible : c'est le seul point sur
 * lequel les cinq copies divergeaient, et quatre d'entre elles se trompaient.
 */
import { deriveAcademicYearStatus, estArchivee } from './status'

let pass = 0, fail = 0
const out: string[] = []
function check(label: string, got: unknown, want: unknown) {
  const g = String(got), w = String(want)
  if (g === w) { pass++; out.push(`  OK    ${label.padEnd(58)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${label.padEnd(58)} attendu ${w}, obtenu ${g}`) }
}

const MAINTENANT = new Date('2026-09-18T12:00:00.000Z')
const statut = (isCurrent: boolean, endDate: string | Date) =>
  deriveAcademicYearStatus({ isCurrent, endDate }, MAINTENANT)

// ── isCurrent prime TOUJOURS sur la date ────────────────────────────────────
{
  check('active, fin future', statut(true, '2027-06-30'), 'active')
  check('active, fin passee', statut(true, '2020-06-30'), 'active')
  check('active, fin aujourd hui', statut(true, '2026-09-18'), 'active')
  check('active, date illisible', statut(true, 'pas-une-date'), 'active')
  // Une annee close depuis un an mais toujours marquee courante reste active :
  // c'est l'administratrice qui bascule, pas le calendrier.
  check('active, fin depuis un an', statut(true, '2025-09-18'), 'active')
}

// ── Non courante, fin future → en preparation ───────────────────────────────
{
  check('fin dans un an', statut(false, '2027-06-30'), 'preparation')
  check('fin demain', statut(false, '2026-09-19'), 'preparation')
  check('fin dans une heure', statut(false, '2026-09-18T13:00:00.000Z'), 'preparation')
}

// ── Non courante, fin passee → archivee ─────────────────────────────────────
{
  check('fin il y a un an', statut(false, '2025-06-30'), 'archived')
  check('fin hier', statut(false, '2026-09-17'), 'archived')
  check('fin il y a une heure', statut(false, '2026-09-18T11:00:00.000Z'), 'archived')
  check('objet Date accepte', statut(false, new Date('2025-06-30T00:00:00.000Z')), 'archived')
}

// ── DATE ILLISIBLE — le cas qui separait les cinq copies ────────────────────
{
  // COMPORTEMENT DOCUMENTE : on ne plante pas, et on ne classe PAS en archive.
  // `NaN < x` etant toujours faux, les quatre copies sans garde retombaient
  // deja sur 'preparation' — mais par accident. Ici c'est deliberé, et le test
  // le fige : ne rien affirmer vaut mieux qu'affirmer a tort.
  check('date illisible -> preparation, sans planter', statut(false, 'pas-une-date'), 'preparation')
  check('chaine vide', statut(false, ''), 'preparation')
  check('date absurde', statut(false, '9999-99-99'), 'preparation')

  // Preuve que ca ne leve pas : si ca plantait, le test n'irait pas plus loin.
  let aLeve = false
  try { statut(false, 'n-importe-quoi') } catch { aLeve = true }
  check('aucune exception', String(aLeve), 'false')
}

// ── Le raccourci booleen ────────────────────────────────────────────────────
{
  check('estArchivee, archivee', estArchivee({ isCurrent: false, endDate: '2025-06-30' }, MAINTENANT), 'true')
  check('estArchivee, courante', estArchivee({ isCurrent: true, endDate: '2020-06-30' }, MAINTENANT), 'false')
  check('estArchivee, en preparation', estArchivee({ isCurrent: false, endDate: '2027-06-30' }, MAINTENANT), 'false')
}

// ── Les trois valeurs sont bien exclusives ──────────────────────────────────
{
  const cas: Array<[boolean, string]> = [
    [true, '2027-06-30'], [false, '2027-06-30'], [false, '2025-06-30'], [false, 'illisible'],
  ]
  const vus = new Set(cas.map(([c, d]) => statut(c, d)))
  check('les 3 valeurs sont atteignables', [...vus].sort().join(','), 'active,archived,preparation')
}

console.log(out.join('\n'))
console.log('\n' + '='.repeat(74))
console.log(`  ${pass} tests OK, ${fail} echec(s)`)
console.log('='.repeat(74))
process.exit(fail === 0 ? 0 : 1)
