/**
 * toMessage : traduction des erreurs en messages pour l'administrateur.
 *
 * Cas nouveau : ClassAverageUnavailableError porte un message deja redige pour
 * l'ecran. toMessage le laissait tomber au profit du texte generique, si bien
 * que l'administrateur lisait « Une erreur est survenue » au lieu de la raison.
 *
 * Les autres cas figent le comportement existant : ils passent avant et apres.
 * Donnees fictives uniquement.
 */
import { toMessage } from './errors'
import { ApiError } from './client-fetch'
import { ClassAverageUnavailableError } from './api/bulletin'

let pass = 0, fail = 0
const out: string[] = []
function check(l: string, got: unknown, want: unknown) {
  const g = String(got), w = String(want)
  if (g === w) { pass++; out.push(`  OK    ${l.padEnd(56)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${l.padEnd(56)} attendu ${w}, obtenu ${g}`) }
}

const GENERIQUE = 'Une erreur est survenue. Réessayez.'

// ── (a) ClassAverageUnavailableError : le message clair passe ────────────────
out.push('(a) ClassAverageUnavailableError')
const indispo = new ClassAverageUnavailableError(2)
check('la classe se nomme bien ainsi', indispo.name, 'ClassAverageUnavailableError')
check('toMessage rend le message de l\'erreur', toMessage(indispo), indispo.message)
check('il dit la moyenne de classe indisponible', toMessage(indispo).startsWith('Moyenne de classe indisponible'), true)
check('il porte le nombre d\'eleves', /\b2 élèves\b/.test(toMessage(indispo)), true)
check('ce n\'est pas le texte generique', toMessage(indispo) !== GENERIQUE, true)
check('avec un contexte : le message clair reste en tete',
  toMessage(indispo, 'lors de la génération du bulletin').startsWith('Moyenne de classe indisponible'), true)

// ── (b) Une Error ordinaire : texte generique, comme avant ───────────────────
out.push('(b) Error ordinaire')
check('Error sans mot-cle', toMessage(new Error('boom interne xyz')), GENERIQUE)
const deguisee = new Error('Moyenne de classe indisponible : imitation')
check('Error au meme texte mais autre nom : generique', toMessage(deguisee), GENERIQUE)

// ── (c) Les autres branches, inchangees ─────────────────────────────────────
out.push('(c) branches existantes')
check('ApiError + mot-cle (unicite NISU)', toMessage(new ApiError(409, '/x', 'NISU already exists')), 'Ce NISU est déjà utilisé par un autre élève.')
check('ApiError + statut connu (404)', toMessage(new ApiError(404, '/x', 'not found here')), "L'élément demandé n'existe pas ou a été supprimé.")
check('ApiError + statut inconnu (418)', toMessage(new ApiError(418, '/x', 'teapot')), 'Une erreur technique est survenue. Réessayez.')
check('Error + mot-cle (periode cloturee)', toMessage(new Error('step is closed')), 'La période est clôturée. Modification impossible.')
const typeError = new TypeError('Failed to fetch')
check('TypeError fetch', toMessage(typeError), 'Connexion impossible. Vérifiez votre accès internet.')
const abort = new Error('stop'); abort.name = 'AbortError'
check('AbortError', toMessage(abort), "L'opération a été interrompue.")
check('chaine + mot-cle', toMessage('duplicate key'), 'Cet élément existe déjà.')
check('chaine sans mot-cle', toMessage('quelque chose'), GENERIQUE)
check('objet { message } + mot-cle', toMessage({ message: 'forbidden' }), "Vous n'avez pas les droits pour effectuer cette action.")
check('objet { message } sans mot-cle', toMessage({ message: 'rien' }), 'Une erreur inconnue est survenue. Réessayez.')
check('valeur inconnue (null)', toMessage(null), 'Une erreur inconnue est survenue. Réessayez.')
check('contexte « lors de … »', toMessage('x', 'lors de la clôture'), 'Une erreur est survenue. Réessayez lors de la clôture.')
check('contexte « de la … »', toMessage('x', 'de la clôture'), 'Une erreur est survenue. Réessayez lors de la clôture.')
check('contexte « la … »', toMessage('x', 'la clôture'), 'Une erreur est survenue. Réessayez lors de la clôture.')
check('contexte « le … »', toMessage('x', 'le calcul'), 'Une erreur est survenue. Réessayez lors du calcul.')
check('contexte vide', toMessage('x', '  '), GENERIQUE)

// ── (d) Ni nom ni identifiant dans le message ───────────────────────────────
out.push('(d) minimisation')
const texte = toMessage(new ClassAverageUnavailableError(3))
check('aucun identifiant (uuid ou code)', /[0-9a-f]{8}-[0-9a-f]{4}|ESSAI|enrollment|\be\d\b/i.test(texte), false)
check('seul nombre present : le compte', (texte.match(/\d+/g) ?? []).join(','), '3')

// ── (e) Le contexte de l'ecran n'est jamais ajoute : le message est complet ─
out.push('(e) contexte ignore')
const complet = new ClassAverageUnavailableError(2)
check('avec « lors de la génération du bulletin » : message tel quel',
  toMessage(complet, 'lors de la génération du bulletin'), complet.message)

// ── (f) Meme resultat pour chaque forme de contexte ─────────────────────────
out.push('(f) toutes les formes de contexte')
for (const contexte of [undefined, 'lors de la clôture', 'de la clôture', 'la clôture', 'le calcul', '  ']) {
  check(`contexte ${JSON.stringify(contexte)}`, toMessage(complet, contexte), complet.message)
}

console.log(out.join('\n'))
console.log(`\n${pass} tests OK, ${fail} echec(s)`)
if (fail > 0) process.exit(1)
