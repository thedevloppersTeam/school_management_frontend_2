/**
 * Lecture des refus MENFP (lib/menfp/refus.ts), liens de correction
 * (lib/menfp/liens.ts) et traduction des codes (lib/errors.ts).
 *
 * Plan d'écrans D : une réponse 400 ou 409 porte { code, message, refus: [...] } ;
 * TOUS les refus sont rendus, dans l'ordre reçu. Identifiants et noms fictifs.
 */
import { ApiError } from '../client-fetch'
import { messageForCode } from '../errors'
import { adresseListeMenfp, adresseParametresMenfp, lienCorrection } from './liens'
import { lireRefus } from './refus'

let pass = 0, fail = 0
const out: string[] = []
function check(l: string, got: unknown, want: unknown) {
  const g = typeof got === 'string' ? got : JSON.stringify(got), w = typeof want === 'string' ? want : JSON.stringify(want)
  if (g === w) { pass++; out.push(`  OK    ${l.padEnd(66)} = ${g.slice(0, 70)}`) }
  else { fail++; out.push(`  ECHEC ${l.padEnd(66)} attendu ${w}, obtenu ${g}`) }
}

const E1 = '00000000-0000-4000-8000-000000000001'
const E2 = '00000000-0000-4000-8000-000000000002'

// ── Tous les refus, dans l'ordre ────────────────────────────────────────────
const gel409 = new ApiError(409, '/api/menfp/salles/x/rapports', 'Gel impossible : …', {
  code: 'MENFP_SEXE_MANQUANT',
  message: 'Gel impossible : sexe non renseigné pour 1 élève(s). Sexe non renseigné : EXEMPLE Élève.',
  refus: [
    { code: 'MENFP_SEXE_MANQUANT', message: 'Gel impossible : sexe non renseigné pour 1 élève(s).', enrollmentIds: [E1] },
    { code: 'MENFP_SOURCES_NON_CLASSEES', message: 'Gel impossible : Sources non classées : « Lecture ».', sources: [] },
    { code: 'MENFP_DELIBERATION_ABSENTE', message: 'Gel impossible : Délibération absente.', enrollmentIds: [E1, E2] },
    { code: 'MENFP_ANNEE_NON_CLOSE', message: 'Gel impossible : étape 3 non close.' },
  ],
})
const lu = lireRefus(gel409)
check('409 : statut', lu.status, 409)
check('409 : titre', lu.titre, "Action impossible dans l'état actuel")
check('409 : QUATRE refus rendus, pas seulement le premier', lu.elements.length, 4)
check('ordre du serveur conservé', lu.elements.map((e) => e.code), ['MENFP_SEXE_MANQUANT', 'MENFP_SOURCES_NON_CLASSEES', 'MENFP_DELIBERATION_ABSENTE', 'MENFP_ANNEE_NON_CLOSE'])
check('libellé traduit du code', lu.elements[0].libelle, messageForCode({ code: 'MENFP_SEXE_MANQUANT' }))
check('détail : message du serveur conservé', lu.elements[0].detail, 'Gel impossible : sexe non renseigné pour 1 élève(s).')
check('élèves en cause transmis', lu.elements[2].enrollmentIds, [E1, E2])

// ── 400 : motif obligatoire (refus d'entrée) ────────────────────────────────
const motif400 = lireRefus(new ApiError(400, '/x', 'm', {
  code: 'MENFP_MOTIF_OBLIGATOIRE', message: 'Une version gelée existe déjà (version 1) : le motif de la correction est obligatoire.',
  refus: [{ code: 'MENFP_MOTIF_OBLIGATOIRE', message: 'Une version gelée existe déjà (version 1) : le motif de la correction est obligatoire.' }],
}))
check('400 : titre', motif400.titre, 'Demande refusée')
check('400 : un refus', motif400.elements.length, 1)

// ── Erreur simple { code, message } ─────────────────────────────────────────
const simple = lireRefus(new ApiError(404, '/x', 'Cette salle n\'a aucune version gelée : rien à purger.', {
  code: 'MENFP_AUCUN_RAPPORT', message: "Cette salle n'a aucune version gelée : rien à purger.",
}))
check('erreur simple : un élément', simple.elements.length, 1)
check('erreur simple : titre 404', simple.titre, 'Introuvable')
check('erreur simple : libellé traduit', simple.elements[0].libelle, messageForCode({ code: 'MENFP_AUCUN_RAPPORT' }))
check('détail identique au libellé : pas de doublon', simple.elements[0].detail, null)

// ── Code inconnu : message du serveur ───────────────────────────────────────
const inconnu = lireRefus(new ApiError(409, '/x', 'm', { code: 'MENFP_NOUVEAU', message: 'Message du serveur.' }))
check('code inconnu : message du serveur en libellé', inconnu.elements[0].libelle, 'Message du serveur.')

// ── 403 et réponse hors contrat ─────────────────────────────────────────────
const interdit = lireRefus(new ApiError(403, '/x', 'Accès refusé', { message: 'Accès refusé' }))
check('403 : titre neutre', interdit.titre, 'Accès refusé')
check('403 : message de permission MENFP', interdit.elements[0].libelle.includes('permission MENFP'), true)
const contrat = lireRefus(new ApiError(502, '/x', 'm', { code: 'CONTRAT_REPONSE_INVALIDE', message: 'm' }))
check('502 hors contrat : libellé traduit', contrat.elements[0].libelle, messageForCode({ code: 'CONTRAT_REPONSE_INVALIDE' }))
check('erreur non ApiError : un élément', lireRefus(new Error('réseau')).elements.length, 1)

// ── Traduction : tous les codes MENFP renvoyés par le serveur ───────────────
// Liste relevée dans le code du serveur (src/modules/menfp, origin/develop 29814e0),
// le contrat ne les énumère pas (question 10 du plan, BACKLOG).
const CODES = [
  'MENFP_ENTREE_INVALIDE', 'MENFP_SEUIL_INVALIDE', 'MENFP_FICHIER_ABSENT', 'MENFP_LOGO_MINISTERE_ABSENT',
  'MENFP_CLASSE_EXAMEN', 'MENFP_NIVEAU_INCONNU', 'MENFP_REFERENTIEL_ABSENT', 'MENFP_REFERENTIEL_VIDE',
  'MENFP_REFERENTIEL_EXISTANT', 'MENFP_REFERENTIEL_INCONNU', 'MENFP_REFERENTIEL_NON_VIDE', 'MENFP_ORIGINE_ABSENTE',
  'MENFP_GRILLE_INCONNUE', 'MENFP_MATIERE_INVALIDE', 'MENFP_MATIERE_EN_DOUBLE', 'MENFP_MATIERE_INCONNUE',
  'MENFP_LIBELLE_EN_DOUBLE', 'MENFP_ORDRE_EN_DOUBLE', 'MENFP_MODIFICATION_CONCURRENTE', 'MENFP_CLASSEMENT_INVALIDE',
  'MENFP_SOURCE_HORS_UNIVERS', 'MENFP_MATIERE_SANS_RUBRIQUE', 'MENFP_ASSOCIATION_SANS_RUBRIQUE',
  'MENFP_SOURCES_NON_CLASSEES', 'MENFP_MATIERE_SANS_SOURCE', 'MENFP_MODE_GLOBAL', 'MENFP_SALLE_INCONNUE',
  'MENFP_BAREME_NUL', 'MENFP_MOTIF_OBLIGATOIRE', 'MENFP_LISTE_VIDE', 'MENFP_SEXE_MANQUANT',
  'MENFP_DEPART_A_COMPLETER', 'MENFP_DELIBERATION_ABSENTE', 'MENFP_ANNEE_NON_CLOSE', 'MENFP_ECOLE_ABSENTE',
  'MENFP_MOYENNE_IMPOSSIBLE', 'MENFP_LOGO_ECOLE_OMIS', 'MENFP_MATIERE_AFFECTEE_DEUX_FOIS',
  'MENFP_MODIFIE_DEPUIS_LE_GEL', 'MENFP_GEL_CONCURRENT', 'MENFP_AUCUN_RAPPORT', 'MENFP_PURGE_CONCURRENTE',
  'MENFP_RAPPORT_INCONNU', 'MENFP_EMPREINTE_INVALIDE',
  'IMAGE_TYPE_REFUSE', 'IMAGE_TROP_VOLUMINEUSE', 'IMAGE_PLUSIEURS_FICHIERS', 'IMAGE_CHAMP_INATTENDU', 'IMAGE_ENVOI_REFUSE',
  'STUDENT_IN_FROZEN_MENFP_REPORT', 'SALLE_REFERENCEE', 'SOUS_MATIERE_REFERENCEE', 'CONTRAT_REPONSE_INVALIDE',
]
const manquants = CODES.filter((c) => !messageForCode({ code: c }))
check(`${CODES.length} codes : tous traduits`, manquants, [])
// Mots entiers (\b de JavaScript coupe « notée » après « not » : « é » n'y est pas une lettre).
const MOTS_ANGLAIS = new Set(['the', 'is', 'not', 'invalid', 'error', 'failed', 'missing'])
const anglais = CODES.filter((c) =>
  (messageForCode({ code: c }) ?? '').toLowerCase().split(/[\s.,:;'()«»…–-]+/).some((m) => MOTS_ANGLAIS.has(m)),
)
check('aucun libellé en anglais', anglais, [])

// ── Liens de correction ─────────────────────────────────────────────────────
const ctx = { academicYearId: 'annee-1', classTypeId: 'niveau-7' }
check('sources non classées → Correspondances, année et niveau', lienCorrection('MENFP_SOURCES_NON_CLASSEES', ctx)?.href, adresseParametresMenfp('correspondances', ctx))
check('référentiel absent → Matières et coefficients', lienCorrection('MENFP_REFERENTIEL_ABSENT', ctx)?.href, '/admin/settings/menfp?onglet=matieres&annee=annee-1&niveau=niveau-7')
check('logo du ministère → Général', lienCorrection('MENFP_LOGO_MINISTERE_ABSENT', ctx)?.href, '/admin/settings/menfp?onglet=general&annee=annee-1&niveau=niveau-7')
check('départ à compléter → Départs de l’année', lienCorrection('MENFP_DEPART_A_COMPLETER', ctx)?.href, '/admin/academic-year/annee-1/departures')
check('délibération absente → Promotion', lienCorrection('MENFP_DELIBERATION_ABSENTE', ctx)?.href, '/admin/fin-annee/promotion')
check('année non close → Années scolaires', lienCorrection('MENFP_ANNEE_NON_CLOSE', ctx)?.href, '/admin/academic-years')
check('classe d’examen : aucun lien', lienCorrection('MENFP_CLASSE_EXAMEN', ctx), null)
check('libellé du lien en texte explicite', lienCorrection('MENFP_SEXE_MANQUANT', ctx)?.libelle, 'Ouvrir Élèves inscrits')
check('écran Liste MENFP, année et salle', adresseListeMenfp('a', 's'), '/admin/fin-annee/menfp?annee=a&salle=s')
check('écran Liste MENFP sans paramètre', adresseListeMenfp(), '/admin/fin-annee/menfp')

console.log(out.join('\n'))
console.log(`\n${pass} OK, ${fail} ECHEC`)
if (fail > 0) process.exit(1)
