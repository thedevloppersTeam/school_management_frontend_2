/**
 * Validité annuelle des sous-matières — traduction des refus du serveur
 * (SPEC-VALIDITE-SOUS-MATIERES v1.1 § 6 et § 8). Corps d'erreur fictifs, de la
 * forme renvoyée par le serveur ; aucune donnée d'élève.
 */
import { MESSAGES_VALIDITE, messageValidite } from './messages'

let pass = 0, fail = 0
const out: string[] = []
function check(l: string, got: unknown, want: unknown) {
  const g = String(got), w = String(want)
  if (g === w) { pass++; out.push(`  OK    ${l.padEnd(64)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${l.padEnd(64)} attendu ${w}, obtenu ${g}`) }
}

// ── 1) Chaque code du contrat a un libellé ───────────────────────────────────
out.push('1) codes couverts')
for (const code of [
  'SECTION_HORS_VIGUEUR', 'MATIERE_HORS_VIGUEUR', 'ANNEE_INCONNUE',
  'VALIDITE_PERIODE_INVERSEE', 'VALIDITE_INVALIDE', 'VALIDITE_EXCLUT_NOTES',
]) {
  check(`${code} : libellé présent`, typeof MESSAGES_VALIDITE[code] === 'string' && MESSAGES_VALIDITE[code].length > 0, true)
}

// ── 2) Saisie des notes ──────────────────────────────────────────────────────
out.push('2) saisie des notes')
check('matière masquée, note unitaire', messageValidite({ code: 'MATIERE_HORS_VIGUEUR', message: 'Note refusée : la matière « X » …' }),
  'Cette matière n’est plus enseignée cette année : aucune note ne peut y être ajoutée (aucune de ses sous-matières n’est en vigueur pour l’année de cette classe).')
check('matière masquée, lot de 2', messageValidite({
  code: 'MATIERE_HORS_VIGUEUR',
  message: 'Lot refusé … grades[1] …',
  entries: [{ index: 1, code: 'MATIERE_HORS_VIGUEUR' }, { index: 3, code: 'MATIERE_HORS_VIGUEUR' }],
}), 'Lot refusé, aucune note enregistrée : 2 saisies portent sur une matière qui n’est plus enseignée cette année.')
check('matière masquée, lot de 1', messageValidite({
  code: 'MATIERE_HORS_VIGUEUR', entries: [{ index: 0, code: 'MATIERE_HORS_VIGUEUR' }],
}), 'Lot refusé, aucune note enregistrée : 1 saisie porte sur une matière qui n’est plus enseignée cette année.')
check('sous-matière hors vigueur, note unitaire', messageValidite({ code: 'SECTION_HORS_VIGUEUR', message: 'Note refusée …' }),
  'Cette sous-matière n’est pas enseignée cette année (hors de sa période de vigueur) : aucune note ni dispense ne peut y être ajoutée. Sa période se règle dans Paramétrage → Établissement → Matières.')
check('sous-matière hors vigueur, lot de 3', messageValidite({
  code: 'SECTION_HORS_VIGUEUR', entries: [{ index: 0 }, { index: 1 }, { index: 2 }],
}), 'Lot refusé, aucune note enregistrée : 3 saisies portent sur une sous-matière qui n’est pas enseignée cette année.')

// ── 3) Dispenses ─────────────────────────────────────────────────────────────
out.push('3) dispenses')
check('dispense sur sous-matière hors vigueur', messageValidite({
  code: 'SECTION_HORS_VIGUEUR', message: 'Dispense refusée : « Y » hors vigueur …', sectionIds: ['s-1'],
}), 'Dispense refusée : cette sous-matière n’est pas enseignée cette année (hors de sa période de vigueur). Sa période se règle dans Paramétrage → Établissement → Matières.')
check('dispense sur 2 sous-matières', messageValidite({
  code: 'SECTION_HORS_VIGUEUR', sectionIds: ['s-1', 's-2'],
}), 'Dispense refusée : 2 sous-matières ne sont pas enseignées cette année (hors de leur période de vigueur). Leur période se règle dans Paramétrage → Établissement → Matières.')

// ── 4) Catalogue (fenêtre de la sous-matière) ────────────────────────────────
out.push('4) catalogue')
check('période inversée', messageValidite({ code: 'VALIDITE_PERIODE_INVERSEE' }),
  'Période refusée : « En vigueur à partir de » est postérieure à « jusqu’à ». Choisissez une fin égale ou postérieure au début.')
check('borne invalide', messageValidite({ code: 'VALIDITE_INVALIDE' }),
  'Période refusée : une borne envoyée n’est pas une année scolaire. Rechargez la page puis choisissez à nouveau.')
check('année inconnue', messageValidite({ code: 'ANNEE_INCONNUE', academicYearIds: ['zz'] }),
  'Une année choisie pour la période n’existe plus : rechargez la page puis choisissez à nouveau.')
check('période qui exclurait des notes, années listées', messageValidite({
  code: 'VALIDITE_EXCLUT_NOTES',
  message: '… (2024-2025, 2025-2026) …',
  annees: [
    { academicYearId: 'a-24', yearString: '2024-2025', notes: 12, dispenses: 0 },
    { academicYearId: 'a-25', yearString: '2025-2026', notes: 0, dispenses: 1 },
  ],
}), 'Une période ne peut pas exclure des notes déjà saisies : des notes ou des dispenses existent sur cette sous-matière en 2024-2025, 2025-2026. Elles ne sont jamais supprimées : élargissez la période pour inclure ces années.')
check('période qui exclurait des notes, sans liste', messageValidite({ code: 'VALIDITE_EXCLUT_NOTES' }),
  'Une période ne peut pas exclure des notes déjà saisies : des notes ou des dispenses existent sur cette sous-matière hors de la nouvelle période. Elles ne sont jamais supprimées : élargissez la période.')
check('année mal formée : jamais recopiée', messageValidite({
  code: 'VALIDITE_EXCLUT_NOTES', annees: [{ yearString: '<b>x</b>' }],
}), 'Une période ne peut pas exclure des notes déjà saisies : des notes ou des dispenses existent sur cette sous-matière hors de la nouvelle période. Elles ne sont jamais supprimées : élargissez la période.')

// ── 5) Hors contrat ──────────────────────────────────────────────────────────
out.push('5) hors contrat')
check('autre code → null', messageValidite({ code: 'NOTE_PAS_025' }), null)
check('sans code → null', messageValidite({ message: 'x' }), null)
check('pas un objet → null', messageValidite('VALIDITE_INVALIDE'), null)
check('null → null', messageValidite(null), null)

console.log(out.join('\n'))
console.log(`\n${pass} OK, ${fail} ECHEC`)
if (fail > 0) process.exit(1)
