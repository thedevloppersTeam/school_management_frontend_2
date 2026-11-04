/**
 * Validateurs générés du contrat (lib/api/menfp/contract.gen.ts) : mapping des
 * réponses du serveur, sur des fixtures FICTIVES.
 *
 *  - les trois cas difficiles du contrat (OpenAPI 3.1) : type ["string","null"],
 *    oneOf de variantes à const, anyOf avec null ;
 *  - lecteur tolérant (ADR-007) : un champ supplémentaire est accepté ;
 *  - un champ manquant ou d'un autre type est refusé (jamais de valeur partielle) ;
 *  - format uuid : un identifiant au motif du contrat mais non RFC est accepté ;
 *  - le fichier généré est celui de la copie épinglée (SHA-256 de PROVENANCE.md).
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as g from './contract.gen'

let pass = 0, fail = 0
const out: string[] = []
function check(l: string, got: unknown, want: unknown) {
  const s = String(got), w = String(want)
  if (s === w) { pass++; out.push(`  OK    ${l.padEnd(70)} = ${s}`) }
  else { fail++; out.push(`  ECHEC ${l.padEnd(70)} attendu ${w}, obtenu ${s}`) }
}
const ok = (schema: { safeParse: (x: unknown) => { success: boolean } }, v: unknown) => schema.safeParse(v).success

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

// ── Fixtures fictives ───────────────────────────────────────────────────────
const ligne = {
  enrollmentId: U(1), nom: 'EXEMPLE', prenom: 'Élève', sexe: 'F', dateNaissance: '03/02/2011', statut: 'ACTIVE',
  dateDepart: null, decisionFinale: 'Admis',
  matieres: [{ matiereId: U(2), horsTotal: null, sommeNotes: '65', sommeBaremes: '100', pourcentage: '0.65', points: '130' }],
  sigmaCoefficients: '500', total: '346', moyenneMenfp: '6.92', moyenneCpmsl: '7.10', ecart: '0.18', alerte: true,
}
const apercu = {
  entete: {
    ecole: { nom: 'École fictive' },
    annee: { academicYearId: U(3), yearString: '2025-2026' },
    salle: { classSessionId: U(4), classTypeId: U(5), niveau: '7e AF', lettre: 'A' },
  },
  colonnes: { matieres: [{ id: U(2), libelle: 'Art', coefficient: '200', ordre: 1 }], sommeCoefficients: '500' },
  seuil: '0.1', lignes: [ligne], signalements: [{ code: 'MENFP_SEXE_MANQUANT', message: 'm', enrollmentId: U(1) }],
  bandeau: null, blocages: [], modifieDepuisLeGel: null,
}
const A = g.GetApiMenfpSallesClassSessionIdApercu200Response

check('aperçu fictif valide', ok(A, apercu), true)
// Cas 1 : type ["string","null"]
check('bandeau chaîne', ok(A, { ...apercu, bandeau: 'Année non close' }), true)
check('bandeau nombre refusé', ok(A, { ...apercu, bandeau: 5 }), false)
const sansBandeau = Object.fromEntries(Object.entries(apercu).filter(([k]) => k !== 'bandeau'))
check('bandeau absent refusé (champ obligatoire)', ok(A, sansBandeau), false)
// Cas 3 : anyOf avec null
check('écart null accepté', ok(A, { ...apercu, lignes: [{ ...ligne, ecart: null, moyenneMenfp: null }] }), true)
check('écart en nombre refusé (chaîne décimale exacte)', ok(A, { ...apercu, lignes: [{ ...ligne, ecart: 0.18 }] }), false)
check('horsTotal hors énumération refusé', ok(A, { ...apercu, lignes: [{ ...ligne, matieres: [{ ...ligne.matieres[0], horsTotal: 'AUTRE' }] }] }), false)
// Cas 2 : oneOf de variantes à const (différences M-47)
const modif = {
  code: 'MENFP_MODIFIE_DEPUIS_LE_GEL', message: 'm', rapportId: U(9), version: 1,
  differences: [
    { nature: 'COEFFICIENT', matiereId: U(2), libelle: 'Art', avant: '200', apres: '300', message: 'm' },
    { nature: 'SEUIL', avant: '0.1', apres: '0.2', message: 'm' },
  ],
}
check('différences COEFFICIENT et SEUIL acceptées', ok(A, { ...apercu, modifieDepuisLeGel: modif }), true)
check('différence de nature inconnue refusée', ok(A, { ...apercu, modifieDepuisLeGel: { ...modif, differences: [{ nature: 'AUTRE', message: 'm' }] } }), false)
// Lecteur tolérant
check('champ supplémentaire à la racine accepté', ok(A, { ...apercu, champFutur: 1 }), true)
check('champ supplémentaire dans une ligne accepté', ok(A, { ...apercu, lignes: [{ ...ligne, nouveau: 'x' }] }), true)
// format uuid : motif du contrat, pas RFC strict
check('identifiant au motif du contrat, non RFC, accepté', ok(A, { ...apercu, lignes: [{ ...ligne, enrollmentId: '11111111-1111-1111-1111-111111111111' }] }), true)
check('identifiant hors motif refusé', ok(A, { ...apercu, lignes: [{ ...ligne, enrollmentId: 'pas-un-uuid' }] }), false)

// Référentiel : signalements en oneOf à const
const R = g.GetApiMenfpReferentielsAcademicYearIdClassTypeId200Response
const ref = {
  id: U(6), academicYearId: U(3), classTypeId: U(5), copieDeId: null, grilleImportee: null, etat: 'incomplet',
  sommeCoefficients: '500', matieres: [{ id: U(2), libelle: 'Art', coefficient: '200', ordre: 1 }],
  sources: [{ subjectId: U(7), sectionId: null, nomMatiere: 'Art', nomSousMatiere: null, nom: 'Art', rubrique: 'R1', matiereId: U(2), ignoree: false, classee: true }],
  classementHorsUnivers: [], signalements: [] as unknown[],
}
check('référentiel fictif valide', ok(R, ref), true)
check('signalement MENFP_MODE_GLOBAL avec salle', ok(R, { ...ref, signalements: [{ code: 'MENFP_MODE_GLOBAL', message: 'm', classSessionId: U(4), salle: '7e AF A', matieresCpmsl: [] }] }), true)
check('signalement à code inconnu refusé', ok(R, { ...ref, signalements: [{ code: 'MENFP_INCONNU', message: 'm' }] }), false)
check('variante aux champs d’une autre refusée', ok(R, { ...ref, signalements: [{ code: 'MENFP_MATIERE_SANS_SOURCE', message: 'm', sources: [] }] }), false)
check('état hors M-61 refusé', ok(R, { ...ref, etat: 'partiel' }), false)

// Paramètres, versions, refus
check('paramètres sans logo', ok(g.GetApiMenfpParametres200Response, { seuil: '0.1', logoMinistere: null }), true)
check('paramètres : seuil en nombre refusé', ok(g.GetApiMenfpParametres200Response, { seuil: 0.1, logoMinistere: null }), false)
check('versions vides', ok(g.GetApiMenfpSallesClassSessionIdRapports200Response, { classSessionId: U(4), versions: [], modifieDepuisLeGel: null }), true)
const refus409 = { code: 'MENFP_SEXE_MANQUANT', message: 'm', refus: [{ code: 'MENFP_SEXE_MANQUANT', message: 'm', enrollmentIds: [U(1)] }, { code: 'MENFP_LISTE_VIDE', message: 'm' }] }
check('409 du gel : ErreurAvecRefus à plusieurs refus', ok(g.PostApiMenfpSallesClassSessionIdRapports409Response, refus409), true)
check('409 du gel : erreur simple { code, message }', ok(g.PostApiMenfpSallesClassSessionIdRapports409Response, { code: 'MENFP_GEL_CONCURRENT', message: 'm' }), true)

// Provenance : le fichier généré porte l'empreinte de la copie épinglée
const racine = join(__dirname, '..', '..', '..')
const empreinte = createHash('sha256').update(readFileSync(join(racine, 'contract', 'openapi.json'))).digest('hex')
const provenance = readFileSync(join(racine, 'contract', 'PROVENANCE.md'), 'utf8')
const genere = readFileSync(join(__dirname, 'contract.gen.ts'), 'utf8')
check('PROVENANCE.md déclare le SHA-256 de la copie', provenance.includes(empreinte), true)
check('contract.gen.ts généré depuis cette copie', genere.includes(`SHA-256 de la copie : ${empreinte}`), true)

console.log(out.join('\n'))
console.log(`\n${pass} OK, ${fail} ECHEC`)
if (fail > 0) process.exit(1)
