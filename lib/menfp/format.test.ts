/**
 * Formatage d'affichage MENFP (lib/menfp/format.ts) : virgule décimale, deux
 * décimales complétées SANS arrondi ni troncature, dates JJ/MM/AAAA. Aucune
 * valeur n'est calculée (SPEC-MENFP M-36, T-28).
 */
import { dateAffichee, dateHeureAffichee, decimaleAffichee, decimaleBrute, nomDeFichier, seuilSaisi, TRAIT } from './format'

let pass = 0, fail = 0
const out: string[] = []
function check(l: string, got: unknown, want: unknown) {
  const g = String(got), w = String(want)
  if (g === w) { pass++; out.push(`  OK    ${l.padEnd(64)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${l.padEnd(64)} attendu ${w}, obtenu ${g}`) }
}

// decimaleAffichee : seuil, points, total, moyennes, écart
check('seuil « 0.1 » → 0,10 (T-19)', decimaleAffichee('0.1'), '0,10')
check('seuil « 0.20 » → 0,20', decimaleAffichee('0.20'), '0,20')
check('total « 346 » → 346,00 (T-01)', decimaleAffichee('346'), '346,00')
check('moyenne « 6.92 » → 6,92', decimaleAffichee('6.92'), '6,92')
check('écart négatif « -0.12 » → -0,12 (signe du serveur)', decimaleAffichee('-0.12'), '-0,12')
check('écart positif sans « + » ajouté (question 16)', decimaleAffichee('0.18'), '0,18')
check('trois décimales : affichées toutes, sans arrondi', decimaleAffichee('6.925'), '6,925')
check('« 6.995 » n’est PAS arrondi à 7,00 ici', decimaleAffichee('6.995'), '6,995')
check('null → trait', decimaleAffichee(null), TRAIT)
check('chaîne hors format rendue telle quelle', decimaleAffichee('n/a'), 'n/a')

// decimaleBrute : coefficients et détails de cellule
check('coefficient « 200 » → 200', decimaleBrute('200'), '200')
check('pourcentage « 0.65 » → 0,65', decimaleBrute('0.65'), '0,65')
check('pourcentage à 20 chiffres conservé', decimaleBrute('0.33333333333333333333'), '0,33333333333333333333')
check('null → trait', decimaleBrute(null), TRAIT)

// seuilSaisi : saisie → chaîne à point, jamais un nombre
check('« 0,15 » → « 0.15 »', seuilSaisi('0,15'), '0.15')
check('« 0.2 » → « 0.2 »', seuilSaisi('0.2'), '0.2')
check('espaces de bord ignorés', seuilSaisi(' 1,5 '), '1.5')
check('« 999,99 » accepté (borne jugée par le serveur)', seuilSaisi('999,99'), '999.99')
check('trois décimales refusées (M-22, sans arrondi)', seuilSaisi('0,125'), 'null')
check('négatif refusé', seuilSaisi('-0,1'), 'null')
check('vide refusé', seuilSaisi(''), 'null')
check('lettres refusées', seuilSaisi('abc'), 'null')
check('le résultat est une chaîne', typeof seuilSaisi('0,10'), 'string')

// dates
check('date ISO → JJ/MM/AAAA', dateAffichee('2011-02-03'), '03/02/2011')
check('date ISO avec heure → JJ/MM/AAAA', dateAffichee('2026-06-30T00:00:00.000Z'), '30/06/2026')
check('date déjà JJ/MM/AAAA rendue telle quelle', dateAffichee('03/02/2011'), '03/02/2011')
check('date absente → trait', dateAffichee(null), TRAIT)
check('date-heure : forme JJ/MM/AAAA HH:mm', /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/.test(dateHeureAffichee('2026-11-04T14:32:00.000Z')), true)
check('date-heure illisible rendue telle quelle', dateHeureAffichee('pas une date'), 'pas une date')

// nom de fichier de l'export (Content-Disposition du serveur)
check('filename* UTF-8 prioritaire', nomDeFichier(`attachment; filename="MENFP-2025-2026-7e-A-v1.xlsx"; filename*=UTF-8''MENFP-2025-2026-7e%20AF-A-v1.xlsx`), 'MENFP-2025-2026-7e AF-A-v1.xlsx')
check('filename seul', nomDeFichier('attachment; filename="MENFP-v2.xlsx"'), 'MENFP-v2.xlsx')
check('en-tête absent → null', nomDeFichier(null), 'null')

console.log(out.join('\n'))
console.log(`\n${pass} OK, ${fail} ECHEC`)
if (fail > 0) process.exit(1)
