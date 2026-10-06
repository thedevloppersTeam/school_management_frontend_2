// lib/grades/score-input.test.ts
//
// Lancement : npx tsx lib/grades/score-input.test.ts
// Convention reprise de lib/bulletin/compute.test.ts — script autonome, pas de
// framework. Chaque cas de refus ci-dessous a été reproduit sur le code
// d'origine avant d'etre corrige.

import Decimal from 'decimal.js'
import {
  normalizeScoreText,
  parseScoreToDecimal,
  parseScore,
  validateScoreInput,
  assertStorableScore,
} from './score-input'

let pass = 0, fail = 0
const results: string[] = []

function check(label: string, got: unknown, want: unknown) {
  const g = got instanceof Decimal ? got.toFixed(4) : String(got)
  const w = want instanceof Decimal ? want.toFixed(4) : String(want)
  if (g === w) { pass++; results.push(`  OK    ${label.padEnd(58)} = ${g}`) }
  else { fail++; results.push(`  ECHEC ${label.padEnd(58)} attendu ${w}, obtenu ${g}`) }
}

// Le verdict seul, pour lire les cas plus vite.
const verdict = (v: string, max = 20) => {
  const r = validateScoreInput(v, max)
  return r.isValid ? 'valide' : `refus: ${r.error}`
}

console.log('=== NORMALISATION ===')
{
  check('virgule -> point', normalizeScoreText('15,25'), '15.25')
  check('espaces de bord retires', normalizeScoreText('  15,75  '), '15.75')
  check('insecable de bord retiree', normalizeScoreText(' 15,5 '), '15.5')
  check('espace INTERIEUR conserve', normalizeScoreText('1 5,25'), '1 5.25')
  check('deja normalise', normalizeScoreText('15.25'), '15.25')
}

console.log('=== LE PIEGE DE LA VIRGULE (DR-004) ===')
{
  // parseFloat('15,25') vaut 15 : la note fausse passait la validation.
  check('parseFloat, pour memoire', parseFloat('15,25'), 15)
  check('15,25 lu correctement', parseScoreToDecimal('15,25'), new Decimal('15.25'))
  check('15,25 accepte', verdict('15,25'), 'valide')
  check('15.25 accepte', verdict('15.25'), 'valide')
  check('15,5 accepte', verdict('15,5'), 'valide')
  check('0,25 accepte', verdict('0,25'), 'valide')
  check('19,75 accepte', verdict('19,75'), 'valide')
}

console.log('=== SAISIES REFUSEES ===')
{
  check('15,10 hors du pas', verdict('15,10'), 'refus: Multiples de 0,25 uniquement')
  check('15.10 hors du pas', verdict('15.10'), 'refus: Multiples de 0,25 uniquement')
  check('0,125 hors du pas', verdict('0,125'), 'refus: Multiples de 0,25 uniquement')
  check('12abc refuse', verdict('12abc'), 'refus: Valeur invalide')
  check('1e2 refuse', verdict('1e2'), 'refus: Valeur invalide')
  check('0x10 refuse', verdict('0x10'), 'refus: Valeur invalide')
  check('negatif refuse', verdict('-5'), 'refus: Valeur invalide')
  check('espace interieur refuse', verdict('1 5,25'), 'refus: Valeur invalide')
  check('virgule seule refusee', verdict(','), 'refus: Valeur invalide')
  check('point final refuse', verdict('15.'), 'refus: Valeur invalide')
}

console.log('=== BORNES ===')
{
  check('20 sur 20 accepte', verdict('20', 20), 'valide')
  check('20,25 sur 20 refuse', verdict('20,25', 20), 'refus: Entre 0 et 20')
  check('999 sur 20 refuse', verdict('999', 20), 'refus: Entre 0 et 20')
  check('0 accepte', verdict('0', 20), 'valide')
  check('barreme decimal respecte', verdict('7,5', 7.5), 'valide')
  check('au-dela du bareme decimal', verdict('7,75', 7.5), 'refus: Entre 0 et 7.5')
  check('bareme en Decimal accepte', validateScoreInput('15,25', new Decimal('20')).isValid, true)
}

console.log('=== VIDE = PAS DE NOTE, PAS UNE ERREUR ===')
{
  check('chaine vide valide', verdict(''), 'valide')
  check('espaces seuls valides', verdict('   '), 'valide')
  check('vide -> pas de valeur', parseScoreToDecimal(''), null)
}

console.log('=== FRONTIERE RESEAU (number) ===')
{
  check('parseScore rend un number', parseScore('15,25'), 15.25)
  check('parseScore sur saisie invalide', parseScore('12abc'), null)
  check('parseScore preserve le quart', parseScore('0,75'), 0.75)
}

console.log('=== FILET AVANT RESEAU (bareme inconnu a ce niveau) ===')
{
  const guard = (n: number) => {
    try { assertStorableScore(n, 'test'); return 'accepte' }
    catch { return 'refuse' }
  }
  check('15,25 accepte', guard(15.25), 'accepte')
  check('0 accepte', guard(0), 'accepte')
  check('999 accepte : borne haute inconnue ici', guard(999), 'accepte')
  check('15,10 refuse', guard(15.1), 'refuse')
  check('negatif refuse', guard(-5), 'refuse')
  check('NaN refuse', guard(NaN), 'refuse')
  check('Infinity refuse', guard(Infinity), 'refuse')
}

console.log(results.join('\n'))
console.log('\n' + '='.repeat(78))
console.log(`  ${pass} tests OK, ${fail} echec(s)`)
console.log('='.repeat(78))
process.exit(fail === 0 ? 0 : 1)
