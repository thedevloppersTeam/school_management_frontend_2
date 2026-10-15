/**
 * Relevé de notes — présentation : nom du PDF, échelle d'aperçu, couleur de
 * bande, dépassement de la zone utile. Données entièrement fictives.
 */
import { USABLE_PX } from '@/components/releve/releve-layout'
import { bandClass, overflowsUsableArea, previewScale, releveFileName } from './present'

let pass = 0, fail = 0
const out: string[] = []
function check(l: string, got: unknown, want: unknown) {
  const g = String(got), w = String(want)
  if (g === w) { pass++; out.push(`  OK    ${l.padEnd(64)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${l.padEnd(64)} attendu ${w}, obtenu ${g}`) }
}

// ── P1 — nom de fichier ─────────────────────────────────────────────────────

check('P1 nom nominal', releveFileName('2024 - 2025', 'ESS001'), 'releve-2024-2025-ESS001.pdf')
check('P1 année déjà compacte', releveFileName('2024-2025', 'ESS001'), 'releve-2024-2025-ESS001.pdf')
check('P1 caractères interdits retirés du code', releveFileName('2024 - 2025', 'ES/S:0*0?1 "<>|\\'), 'releve-2024-2025-ESS001.pdf')
check('P1 tiret du code conservé', releveFileName('2024 - 2025', 'ESSAI-101'), 'releve-2024-2025-ESSAI-101.pdf')
{
  const nom = releveFileName('2024 - 2025', 'ESS001')
  check('P1 uniquement [A-Za-z0-9._-]', /^[A-Za-z0-9._-]+$/.test(nom), true)
  check('P1 aucun prénom ni nom (fictifs)', /Alpha|Essai-Fictif/i.test(nom), false)
}
check('P1 année illisible : « annee »', releveFileName('-', 'ESS001'), 'releve-annee-ESS001.pdf')
check('P1 code vide : « eleve »', releveFileName('2024 - 2025', '  '), 'releve-2024-2025-eleve.pdf')

// ── P2 — échelle d'aperçu ───────────────────────────────────────────────────

check('P2 largeur 408 px → 0.5', previewScale(408), 0.5)
check('P2 largeur 816 px → 1', previewScale(816), 1)
check('P2 largeur 2000 px → 1 (jamais > 1)', previewScale(2000), 1)
check('P2 largeur 0 → > 0', previewScale(0) > 0, true)
check('P2 largeur négative → > 0', previewScale(-50) > 0, true)
check('P2 largeur NaN → > 0 et ≤ 1', previewScale(Number.NaN) > 0 && previewScale(Number.NaN) <= 1, true)

// ── P3 — classe de couleur ──────────────────────────────────────────────────

check('P3 echec : classe colorée', bandClass('echec'), 'rlv-band-echec')
check('P3 deficient : classe colorée', bandClass('deficient'), 'rlv-band-deficient')
check('P3 assez-bien : classe colorée', bandClass('assez-bien'), 'rlv-band-assez-bien')
check('P3 neutre : aucune classe', bandClass('neutre'), '')
check('P3 null : aucune classe', bandClass(null), '')

// ── P4 — dépassement de la zone utile ───────────────────────────────────────

const ZONE = 1056 - (1.95 + 1.95) * 96
check('P4 zone utile = 1056 − (1.95 + 1.95) × 96', Math.abs(USABLE_PX.height - ZONE) < 1e-9, true)
check('P4 contenu = zone : pas de dépassement', overflowsUsableArea(ZONE), false)
check('P4 contenu < zone : pas de dépassement', overflowsUsableArea(ZONE - 100), false)
check('P4 contenu > zone : dépassement', overflowsUsableArea(ZONE + 1), true)
check('P4 hauteur illisible : dépassement (prudence)', overflowsUsableArea(Number.NaN), true)

console.log(out.join('\n'))
console.log(`\n${pass} OK, ${fail} ECHEC`)
if (fail > 0) process.exit(1)
