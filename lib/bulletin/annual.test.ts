/**
 * Chemin annuel normatif : stepAverageOrNull + computeAnnualAverage.
 *
 * Verrouille les deux points sur lesquels le chemin precedent divergeait :
 *   1. une etape sans rien d'exploitable est ECARTEE, pas comptee zero ;
 *   2. la moyenne des etapes reste en Decimal jusqu'au formatage.
 *
 * Le cas 2 n'est pas theorique : le bulletin de la 2e etape moyenne exactement
 * deux etapes, et c'est un document remis aux familles.
 */
import Decimal from 'decimal.js'
import {
  computeStep,
  computeAnnualAverage,
  stepAverageOrNull,
  formatAverage,
  type SubjectInput,
  type RubriqueCode,
  type StepResult,
} from './compute'

const D = (v: string | number) => new Decimal(v)
let pass = 0, fail = 0
const out: string[] = []
function check(label: string, got: unknown, want: unknown) {
  const g = got instanceof Decimal ? got.toFixed(4) : String(got)
  const w = want instanceof Decimal ? want.toFixed(4) : String(want)
  if (g === w) { pass++; out.push(`  OK    ${label.padEnd(58)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${label.padEnd(58)} attendu ${w}, obtenu ${g}`) }
}

const subj = (
  name: string, r: RubriqueCode, max: number, scores: number[] = [],
): SubjectInput => ({
  classSubjectId: `cs-${name}`, name, rubrique: r, maxScore: D(max),
  maxScoreOverride: null, sections: [], globalScores: scores.map(D), exempted: false,
})

/** Etape dont les trois rubriques valent exactement r1, r2, r3 sur 10. */
const etape = (r1: number | null, r2: number | null, r3: number | null): StepResult => {
  const s: SubjectInput[] = []
  if (r1 !== null) s.push(subj('R1', 'R1', 10, [r1]))
  if (r2 !== null) s.push(subj('R2', 'R2', 10, [r2]))
  if (r3 !== null) s.push(subj('R3', 'R3', 10, [r3]))
  return computeStep(s)
}

// ── L'etape vide : ecartee, jamais comptee zero ────────────────────────────
{
  const vide = etape(null, null, null)
  check('etape vide : computeStep renvoie quand meme un chiffre', vide.average, D(0))
  check('etape vide : stepAverageOrNull -> null', String(stepAverageOrNull(vide)), 'null')

  const notee = etape(7.5, 7.5, 7.5)
  check('etape notee : stepAverageOrNull -> sa moyenne', stepAverageOrNull(notee)!, D('7.5'))

  // Le piege : si l'etape vide comptait 0, la moyenne tomberait a 3,75.
  check('une etape notee + une vide -> 7,50', computeAnnualAverage([notee, vide])!, D('7.5'))
  check('aucune etape', String(computeAnnualAverage([])), 'null')
  check('que des etapes vides', String(computeAnnualAverage([vide, vide])), 'null')
}

// ── Une rubrique absente compte ZERO : pas de renormalisation ──────────────
{
  // R2 jamais notee. 7,50 x 0,70 + 0 x 0,25 + 7,00 x 0,05 = 5,60
  const e = etape(7.5, null, 7)
  check('R2 absente : l etape vaut 5,60, pas 7,47', e.average, D('5.6'))
  check('R2 absente : l etape compte quand meme', stepAverageOrNull(e)!, D('5.6'))
  check('moyenne annuelle sur cette seule etape', computeAnnualAverage([e])!, D('5.6'))
}

// ── Decimal contre flottant : le demi-centieme ─────────────────────────────
{
  // T1 = 7,00 · T2 = 7,01 -> moyenne exacte 7,005
  const t1 = etape(7, 7, 7)
  const t2 = etape(7, 7, 7.2)
  check('T1 exacte', t1.average, D('7'))
  check('T2 exacte', t2.average, D('7.01'))

  const annuelle = computeAnnualAverage([t1, t2])!
  check('moyenne annuelle exacte', annuelle, D('7.005'))
  check('imprimee (Decimal, demi vers le haut)', formatAverage(annuelle), '7.01')

  // Ce que faisait le chemin precedent : chaque etape en flottant, puis
  // moyenne en flottant. Le double tombe un cheveu SOUS 7,005.
  const flottant =
    [t1.average.toNumber(), t2.average.toNumber()].reduce((a, b) => a + b, 0) / 2
  check('le chemin flottant imprimait 7,00', flottant.toFixed(2), '7.00')
  // Pourquoi il imprimait 7,00 : le double n'EST pas 7,005, il tombe juste en
  // dessous. Deux pieges rendent ce constat difficile a ecrire —
  // `flottant < 7.005` est faux (le litteral est le meme double), et
  // `new Decimal(flottant)` relit la chaine courte « 7.005 ». Seul le
  // developpement a 20 chiffres montre la valeur reelle.
  check(
    'le double tombe sous la valeur exacte',
    String(D(flottant.toPrecision(20)).lessThan(D('7.005'))),
    'true',
  )
}

// ── Les valeurs qui ne bougent pas : la regle n'a pas change ───────────────
{
  const quatre = [etape(8, 7, 6), etape(8, 7, 6), etape(8, 7, 6), etape(8, 7, 6)]
  check('4 etapes identiques -> la meme moyenne', formatAverage(computeAnnualAverage(quatre)), '7.65')

  // Fractions non finies : Decimal et flottant s'accordent a l'affichage.
  const tiers = [etape(10 / 3, null, null), etape(20 / 3, null, null)]
  const dec = computeAnnualAverage(tiers)!
  const flo = tiers.map(s => s.average.toNumber()).reduce((a, b) => a + b, 0) / 2
  check('fractions non finies : meme affichage', formatAverage(dec), flo.toFixed(2))
}

// ── Dispense d'etape : elle se retire AVANT l'appel ────────────────────────
{
  // Une etape dispensee ne figure pas dans la liste : ce n'est pas au calcul
  // de la reconnaitre, c'est a l'appelant de ne pas la fournir.
  const notees = [etape(6, 6, 6), etape(8, 8, 8)]
  check('deux etapes retenues -> 7,00', computeAnnualAverage(notees)!, D('7'))
  check('une seule fournie -> elle seule compte', computeAnnualAverage([notees[1]])!, D('8'))
}

console.log(out.join('\n'))
console.log('\n' + '='.repeat(74))
console.log(`  ${pass} tests OK, ${fail} echec(s)`)
console.log('='.repeat(74))
process.exit(fail === 0 ? 0 : 1)
