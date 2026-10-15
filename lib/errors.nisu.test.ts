/**
 * toMessage : message affiche pour une erreur de format du NISU.
 *
 * Regle actee le 2026-09-13 : le NISU fait 20 caracteres alphanumeriques
 * exactement (lib/nisu.ts). Le serveur le dit ; le message traduit disait
 * « 12 chiffres », ou ne reconnaissait pas l'erreur du tout.
 *
 * Les erreurs sont construites comme clientFetch le fait : ApiError(statut,
 * chemin, message du serveur). Donnees fictives uniquement.
 */
import { toMessage } from './errors'
import { ApiError } from './client-fetch'

let pass = 0, fail = 0
const out: string[] = []
function check(l: string, got: unknown, want: unknown) {
  const g = String(got), w = String(want)
  if (g === w) { pass++; out.push(`  OK    ${l.padEnd(56)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${l.padEnd(56)} attendu ${w}, obtenu ${g}`) }
}

const VOULU = 'Le NISU doit contenir exactement 20 caractères alphanumériques (lettres majuscules et chiffres).'
const serveur = (status: number, message: string) => new ApiError(status, '/api/students/create', message)

// Messages du serveur (src/controllers/students.ts, depot serveur)
const ANGLAIS = 'NISU must be exactly 20 alphanumeric characters'
const FRANCAIS = 'NISU invalide (20 caractères alphanumériques exactement)'
const DOUBLON = 'NISU already exists'

const sorties: string[] = []
const t = (err: unknown, ctx?: string) => { const s = toMessage(err, ctx); sorties.push(s); return s }

out.push('(a) message anglais, HTTP 400')
check('texte voulu', t(serveur(400, ANGLAIS)), VOULU)

out.push('(b) message francais de l\'import en lot')
check('texte voulu (ApiError 400)', t(serveur(400, FRANCAIS)), VOULU)
check('texte voulu (message brut, ligne de resultat)', t(FRANCAIS), VOULU)

out.push('(c) doublon : inchange')
check('NISU already exists (409)', t(serveur(409, DOUBLON)), 'Ce NISU est déjà utilisé par un autre élève.')

out.push('(d) aucune sortie ne contient « 12 »')
check('toutes les sorties ci-dessus', sorties.some((s) => /12/.test(s)), false)

out.push('(e) messages sans rapport : traitement actuel')
check('statut 400 generique', toMessage(serveur(400, 'Bad payload')), 'Les données envoyées ne sont pas valides.')
check('email deja utilise', toMessage(serveur(409, 'email already exists')), 'Cet email est déjà utilisé.')
check('note au quart de point', toMessage(serveur(400, 'score must be a multiple of 0.25')), 'La note doit être un multiple de 0,25 (.00 / .25 / .50 / .75).')
check('NISU absent a l\'archivage : non attrape', toMessage(serveur(400, 'Student has no NISU - bulletin cannot be archived')), 'Les données envoyées ne sont pas valides.')

out.push('(f) la valeur du NISU n\'apparait jamais')
const valeur = 'ABC123XYZ789QWE456RT'
const r1 = toMessage(serveur(400, `NISU ${valeur} invalide`))
check('« NISU <valeur> invalide » : texte voulu', r1, VOULU)
check('la valeur est absente du resultat', r1.includes(valeur) || r1.includes('ABC123'), false)
const r2 = toMessage(serveur(400, `NISU invalide : ${valeur}`), 'lors de l\'import')
check('avec contexte : la valeur est absente', r2.includes(valeur) || r2.includes('ABC123'), false)

console.log(out.join('\n'))
console.log(`\n${pass} tests OK, ${fail} echec(s)`)
if (fail > 0) process.exit(1)
