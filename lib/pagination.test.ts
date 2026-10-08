/**
 * Découpage en pages — les bornes, surtout.
 *
 * Ce que ces tests figent, ce ne sont pas les cas nominaux mais les trois qui
 * cassent une grille à l'écran : le tableau vide, la dernière page partielle,
 * et la page hors plage après un changement de jeu de données.
 */
import { paginate } from './pagination'

let pass = 0, fail = 0
const out: string[] = []
function check(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; out.push(`  OK    ${label.padEnd(58)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${label.padEnd(58)} attendu ${w}, obtenu ${g}`) }
}
/** 1..n */
const liste = (n: number) => Array.from({ length: n }, (_, i) => i + 1)

// ── Cas nominal : 15 par page ───────────────────────────────────────────────
{
  const r = paginate(liste(40), 2, 15)
  check('page 2 de 40 : 15 elements', r.items.length, 15)
  check('page 2 : premier element', r.items[0], 16)
  check('page 2 : dernier element', r.items[14], 30)
  check('pageCount', r.pageCount, 3)
  check('rangeStart (0-based)', r.rangeStart, 15)
  check('rangeEnd (1-based)', r.rangeEnd, 30)
  check('total', r.total, 40)
}

// ── EXACTEMENT une page pleine : pas de seconde page ────────────────────────
{
  const r = paginate(liste(15), 1, 15)
  check('15 elements : 1 seule page', r.pageCount, 1)
  check('15 elements : tous affiches', r.items.length, 15)
  // `table-pagination` masque ses controles quand pageCount <= 1 : c'est ce
  // qui fait disparaitre la pagination a 15 annees, sans condition a ecrire.
}

// ── Dernière page PARTIELLE — une seule carte sur la 2e page ────────────────
{
  const r = paginate(liste(16), 2, 15)
  check('16 elements : 2 pages', r.pageCount, 2)
  check('page 2 : une seule carte', r.items, [16])
  check('page 2 : rangeStart', r.rangeStart, 15)
  check('page 2 : rangeEnd = total', r.rangeEnd, 16)
}

// ── Tableau VIDE ────────────────────────────────────────────────────────────
{
  const r = paginate([], 1, 15)
  check('vide : aucun element', r.items, [])
  check('vide : pageCount vaut 1, pas 0', r.pageCount, 1)
  check('vide : page vaut 1', r.page, 1)
  check('vide : rangeEnd vaut 0', r.rangeEnd, 0)
  check('vide : total vaut 0', r.total, 0)
}

// ── PAGE HORS PLAGE — le cas qui laisse une grille vide ─────────────────────
{
  // Scenario reel : on est page 3, un filtre reduit la liste a 5 elements.
  // Sans bornage, la tranche serait vide et l'ecran afficherait une grille
  // blanche sans rien dire.
  const r = paginate(liste(5), 3, 15)
  check('page 3 sur 1 page : ramenee a 1', r.page, 1)
  check('page 3 sur 1 page : elements rendus', r.items.length, 5)

  check('page 0 : ramenee a 1', paginate(liste(40), 0, 15).page, 1)
  check('page -7 : ramenee a 1', paginate(liste(40), -7, 15).page, 1)
  check('page 99 : ramenee a la derniere', paginate(liste(40), 99, 15).page, 3)
  check('page fractionnaire : tronquee', paginate(liste(40), 2.9, 15).page, 2)
  check('page NaN : ramenee a 1', paginate(liste(40), Number.NaN, 15).page, 1)
}

// ── perPage invalide : refus explicite ──────────────────────────────────────
{
  let leve = 0
  for (const p of [0, -1, 2.5, Number.NaN]) {
    try { paginate(liste(10), 1, p) } catch { leve++ }
  }
  check('perPage 0, -1, 2.5, NaN sont refuses', leve, 4)
}

// ── La pagination ne perd ni ne duplique aucun element ──────────────────────
{
  const source = liste(37)
  const { pageCount } = paginate(source, 1, 15)
  const recolte: number[] = []
  for (let p = 1; p <= pageCount; p++) recolte.push(...paginate(source, p, 15).items)
  check('parcourir toutes les pages redonne la liste', recolte, source)
}

console.log(out.join('\n'))
console.log('\n' + '='.repeat(74))
console.log(`  ${pass} tests OK, ${fail} echec(s)`)
console.log('='.repeat(74))
process.exit(fail === 0 ? 0 : 1)
