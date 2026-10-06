import {
  gradeBand, gradeMention, gradeBandToneClass, gradeMentionLabel, GRADE_SCALE,
} from './grade-color'
import { getBulletinAppreciation } from '../bulletin-calculations'

let pass = 0, fail = 0
const results: string[] = []

function check(label: string, got: unknown, want: unknown) {
  const g = String(got), w = String(want)
  if (g === w) { pass++; results.push(`  OK    ${label.padEnd(58)} = ${g}`) }
  else { fail++; results.push(`  ECHEC ${label.padEnd(58)} attendu ${w}, obtenu ${g}`) }
}

// ────────────────────────────────────────────────────────────────────────────
// Bandes — copie de reference de `colorClass`
// (components/school/bulletin-printable.tsx:25-35).
//
// Ces tests existent pour une raison precise : le meme bareme etait implemente
// trois fois avec trois jeux de seuils, et la divergence [60 ; 69[ n'a ete vue
// qu'a l'audit. Si le gabarit imprime change de seuil, ces tests doivent
// echouer.
// ────────────────────────────────────────────────────────────────────────────
{
  results.push('\n── Bandes, aux bornes exactes ──')
  check('null                 -> neutre',      gradeBand(null), 'neutre')
  check('undefined            -> neutre',      gradeBand(undefined), 'neutre')
  check('NaN                  -> neutre',      gradeBand(NaN), 'neutre')
  check('0                    -> echec',       gradeBand(0), 'echec')
  check('49,99                -> echec',       gradeBand(49.99), 'echec')
  check('50,00 (borne <=)     -> echec',       gradeBand(50), 'echec')
  check('50,01                -> deficient',   gradeBand(50.01), 'deficient')
  check('59,99                -> deficient',   gradeBand(59.99), 'deficient')
  check('60,00 (borne <)      -> assez-bien',  gradeBand(60), 'assez-bien')
  check('68,99                -> assez-bien',  gradeBand(68.99), 'assez-bien')
  check('69,00 (borne <)      -> neutre',      gradeBand(69), 'neutre')
  check('100                  -> neutre',      gradeBand(100), 'neutre')
}

// ────────────────────────────────────────────────────────────────────────────
// Mentions, aux bornes de la legende imprimee.
// ────────────────────────────────────────────────────────────────────────────
{
  results.push('\n── Mentions MENFP ──')
  const cas: Array<[number, string]> = [
    [0, 'E'], [50, 'E'], [51, 'D'], [59, 'D'], [60, 'C'], [68, 'C'],
    [69, 'C+'], [74, 'C+'], [75, 'B'], [77, 'B'], [78, 'B+'], [84, 'B+'],
    [85, 'A'], [89, 'A'], [90, 'A+'], [100, 'A+'],
  ]
  for (const [pct, want] of cas) {
    check(`${String(pct).padStart(3)} -> ${want}`, gradeMention(pct), want)
  }
  check('null -> tiret', gradeMention(null), '—')
}

// ────────────────────────────────────────────────────────────────────────────
// LE TEST QUI MANQUAIT : valeurs NON ENTIERES.
//
// La premiere version du module derivait la bande de ses propres seuils et la
// mention de `getBulletinAppreciation`. Sur ]50 ; 51[ elle affichait une teinte
// orange et une mention « E » cote a cote. Les tests ne couvraient que des
// entiers et ne l'ont pas vu. Ils le couvrent maintenant.
// ────────────────────────────────────────────────────────────────────────────
{
  results.push('\n── Valeurs non entieres, dont l\'intervalle ]50 ; 51[ ──')
  // 20,25 / 40 = 50,625 % — atteignable au pas de 0,25.
  check('50,625 -> deficient', gradeBand(50.625), 'deficient')
  check('50,625 -> mention D', gradeMention(50.625), 'D')
  check('50,01  -> mention D', gradeMention(50.01), 'D')
  check('50,99  -> mention D', gradeMention(50.99), 'D')
  check('50,00  -> mention E', gradeMention(50), 'E')

  results.push('\n── Coherence bande / mention sur 4001 valeurs au quart de point ──')
  const attendu: Record<string, string> = {
    E: 'echec', D: 'deficient', C: 'assez-bien',
    'C+': 'neutre', B: 'neutre', 'B+': 'neutre', A: 'neutre', 'A+': 'neutre',
  }
  let divergences = 0
  for (let i = 0; i <= 4000; i++) {
    const pct = i / 40 // 0 -> 100 par pas de 0,025
    if (gradeBand(pct) !== attendu[gradeMention(pct)]) divergences++
  }
  check('divergences bande/mention', divergences, 0)
}

// ────────────────────────────────────────────────────────────────────────────
// Accord avec `getBulletinAppreciation`, la fonction de reference du bulletin.
// Un seul ecart est admis et documente : l'intervalle ]50 ; 51[, ou la legende
// imprimee ne dit rien et ou l'on suit `colorClass` plutot que la borne 5,1.
// ────────────────────────────────────────────────────────────────────────────
{
  results.push('\n── Accord avec getBulletinAppreciation (hors ]50 ; 51[) ──')
  let ecarts = 0
  const exemples: string[] = []
  for (let i = 0; i <= 4000; i++) {
    const pct = i / 40
    if (pct > 50 && pct < 51) continue // seul ecart admis, documente dans le module
    const mien = gradeMention(pct)
    const reference = getBulletinAppreciation(pct / 10)
    if (mien !== reference) {
      ecarts++
      if (exemples.length < 3) exemples.push(`${pct} : ${mien} vs ${reference}`)
    }
  }
  check(`ecarts${exemples.length ? ' (' + exemples.join(', ') + ')' : ''}`, ecarts, 0)

  results.push('\n── L\'ecart admis est bien borne a ]50 ; 51[ ──')
  check('50,50 : module D, reference E', `${gradeMention(50.5)}/${getBulletinAppreciation(5.05)}`, 'D/E')
}

// ────────────────────────────────────────────────────────────────────────────
// Teintes d'ecran : jetons d'encre, jamais les hex du gabarit imprime
// (#d9a21b donne 2,30:1 sur fiche blanche, #318c53 4,19:1).
// ────────────────────────────────────────────────────────────────────────────
{
  results.push('\n── Teintes d\'ecran ──')
  check('echec      -> error-ink',   gradeBandToneClass('echec'), 'text-error-ink')
  check('deficient  -> warning-ink', gradeBandToneClass('deficient'), 'text-warning-ink')
  check('assez-bien -> success-ink', gradeBandToneClass('assez-bien'), 'text-success-ink')
  check('neutre     -> foreground',  gradeBandToneClass('neutre'), 'text-foreground')

  results.push('\n── Libelles et forme de la table ──')
  check('A+ -> Excellent',    gradeMentionLabel('A+'), 'Excellent')
  check('C  -> Assez bien',   gradeMentionLabel('C'), 'Assez bien')
  check('C+ -> Bien',         gradeMentionLabel('C+'), 'Bien')
  check('D  -> Deficient',    gradeMentionLabel('D'), 'Déficient')
  check('E  -> Echec',        gradeMentionLabel('E'), 'Échec')
  check('inconnu -> repli',   gradeMentionLabel('—'), 'non calculée')
  check('8 entrees de legende', GRADE_SCALE.length, 8)
  check('3 bandes colorees', GRADE_SCALE.filter((e) => e.band !== 'neutre').length, 3)
  check('chaque entree a sa plage /10', GRADE_SCALE.every((e) => e.rangeOn10.length > 0), true)
}

// ────────────────────────────────────────────────────────────────────────────
// Les moyennes s'affichent sur 10 ; la cle de lecture affichee a l'ecran est
// donc ecrite sur 10. Ces bornes sont celles que l'administratrice lit : si
// elles derivent des seuils reels, la legende redevient inapplicable — le
// defaut precis qui avait ete corrige.
// ────────────────────────────────────────────────────────────────────────────
{
  results.push('\n── Bornes /10 de la cle de lecture ──')
  const bornes: Array<[number, string]> = [
    [5.00, 'E'],   // borne haute de « ≤ 5,00 »
    [5.01, 'D'],   // borne basse de « 5,01 – 5,99 »
    [5.99, 'D'],
    [6.00, 'C'],   // borne basse de « 6,00 – 6,89 »
    [6.89, 'C'],
    [6.90, 'C+'],  // borne basse de « 6,90 – 7,49 »
    [7.49, 'C+'],
    [7.50, 'B'],
    [7.79, 'B'],
    [7.80, 'B+'],
    [8.49, 'B+'],
    [8.50, 'A'],
    [8.99, 'A'],
    [9.00, 'A+'],
    [10.00, 'A+'],
  ]
  for (const [sur10, want] of bornes) {
    check(`${sur10.toFixed(2)}/10 -> ${want}`, gradeMention(sur10 * 10), want)
  }

  results.push('\n── Seuil de promotion imprime au pied du bulletin ──')
  check('7,00/10 n\'est pas un echec', gradeBand(7.0 * 10), 'neutre')
  check('6,99/10 reste sous le seuil', gradeMention(6.99 * 10), 'C+')
}

// ────────────────────────────────────────────────────────────────────────────
console.log(results.join('\n'))
console.log('\n' + '='.repeat(78))
console.log(`  ${pass} tests OK, ${fail} echec(s)`)
console.log('='.repeat(78))
process.exit(fail === 0 ? 0 : 1)
