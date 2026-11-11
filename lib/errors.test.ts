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
import { messageForCode, toMessage } from './errors'
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

// ── (g) Validité annuelle des sous-matières (SPEC-VALIDITE-SOUS-MATIERES v1.1) ─
// Les six codes de validité passent par lib/validite-sous-matieres/messages.ts ;
// les autres familles gardent exactement leur message.
out.push('(g) codes de validite')
const MATIERE_EN_CLAIR =
  'Cette matière n’est plus enseignée cette année : aucune note ne peut y être ajoutée (aucune de ses sous-matières n’est en vigueur pour l’année de cette classe).'
check('MATIERE_HORS_VIGUEUR : message en clair', messageForCode({ code: 'MATIERE_HORS_VIGUEUR' }), MATIERE_EN_CLAIR)
check('MATIERE_HORS_VIGUEUR via toMessage, sans contexte ajouté',
  toMessage(new ApiError(400, '/api/grades/create', 'Note refusée : la matière « X » …', { code: 'MATIERE_HORS_VIGUEUR', message: 'Note refusée : la matière « X » …' }), "lors de l'enregistrement"),
  MATIERE_EN_CLAIR)
check('MATIERE_HORS_VIGUEUR en lot : nombre de saisies',
  messageForCode({ code: 'MATIERE_HORS_VIGUEUR', entries: [{ index: 0 }, { index: 2 }] }),
  'Lot refusé, aucune note enregistrée : 2 saisies portent sur une matière qui n’est plus enseignée cette année.')
check('SECTION_HORS_VIGUEUR (dispense) : message en clair',
  messageForCode({ code: 'SECTION_HORS_VIGUEUR', sectionIds: ['s-1'] }),
  'Dispense refusée : cette sous-matière n’est pas enseignée cette année (hors de sa période de vigueur). Sa période se règle dans Paramétrage → Établissement → Matières.')
check('VALIDITE_EXCLUT_NOTES (409) via toMessage',
  toMessage(new ApiError(409, '/x', 'Période refusée …', { code: 'VALIDITE_EXCLUT_NOTES' })),
  'Une période ne peut pas exclure des notes déjà saisies : des notes ou des dispenses existent sur cette sous-matière hors de la nouvelle période. Elles ne sont jamais supprimées : élargissez la période.')
check('ANNEE_INCONNUE', messageForCode({ code: 'ANNEE_INCONNUE' }),
  'Une année choisie pour la période n’existe plus : rechargez la page puis choisissez à nouveau.')
check('VALIDITE_PERIODE_INVERSEE', messageForCode({ code: 'VALIDITE_PERIODE_INVERSEE' }),
  'Période refusée : « En vigueur à partir de » est postérieure à « jusqu’à ». Choisissez une fin égale ou postérieure au début.')
check('VALIDITE_INVALIDE', messageForCode({ code: 'VALIDITE_INVALIDE' }),
  'Période refusée : une borne envoyée n’est pas une année scolaire. Rechargez la page puis choisissez à nouveau.')
// Autres familles : messages actuels, à l'identique.
check('NOTE_PAS_025 inchangé', messageForCode({ code: 'NOTE_PAS_025' }),
  'La note doit être un multiple de 0,25 (.00 / .25 / .50 / .75).')
check('LOT_ENTREES_INVALIDES inchangé',
  messageForCode({ code: 'LOT_ENTREES_INVALIDES', entries: [{ index: 0, code: 'NOTE_HORS_BAREME' }, { index: 1, code: 'NOTE_PAS_025' }] }),
  'Lot refusé, aucune note enregistrée : 2 saisies invalides. Première en cause : Note refusée : la note dépasse le barème de la case.')
check('CASE_MULTI_NOTES inchangé', messageForCode({ code: 'CASE_MULTI_NOTES', cases: [{}, {}, {}] }),
  '3 cases portent déjà plusieurs notes : saisie refusée, aucune note enregistrée. Supprimez les notes en trop avant de saisir à nouveau.')
check('SOUS_MATIERE_REFERENCEE inchangé', messageForCode({ code: 'SOUS_MATIERE_REFERENCEE' }),
  'Cette sous-matière est encore utilisée (notes, référentiel MENFP…) : suppression impossible.')
check('code inconnu : toujours null', messageForCode({ code: 'CODE_INCONNU' }), null)
check('sans code : toujours null', messageForCode({ message: 'x' }), null)

console.log(out.join('\n'))
console.log(`\n${pass} tests OK, ${fail} echec(s)`)
if (fail > 0) process.exit(1)
