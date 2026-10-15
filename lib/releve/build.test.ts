/**
 * Relevé de notes — lecture des données et assemblage (R-REL-7, G8, G10).
 *
 * Les requêtes passent par un `fetch` simulé, comme lib/api/bulletin.test.ts :
 * aucune base, aucun serveur. Données entièrement fictives.
 */
import { buildReleveData } from './build'
import { ReleveUnavailableError, type ReleveData, type ReleveGroup } from './types'

let pass = 0, fail = 0
const out: string[] = []
function check(l: string, got: unknown, want: unknown) {
  const g = String(got), w = String(want)
  if (g === w) { pass++; out.push(`  OK    ${l.padEnd(64)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${l.padEnd(64)} attendu ${w}, obtenu ${g}`) }
}

// ── Données fictives ────────────────────────────────────────────────────────

const STUDENT = 'eleve-1'
const ENROLLMENT = 'insc-1'
const YEAR = 'annee-1'
const SESSION = 'salle-1'

const steps = [
  { id: 'st1', name: 'Étape 1', stepNumber: 1, isCurrent: false },
  { id: 'st2', name: 'Étape 2', stepNumber: 2, isCurrent: false },
  { id: 'st3', name: 'Étape 3', stepNumber: 3, isCurrent: false },
  { id: 'st4', name: 'Étape 4 & 5', stepNumber: 4, isCurrent: false },
]

const subject = (id: string, name: string, maxScore: string, sections: unknown[] = []) =>
  ({ id, name, maxScore, rubric: { id: 'r1', code: 'R1' }, sections })

const classSubjects = [
  {
    id: 'cs-alpha', trackId: null, maxScoreOverride: null,
    subject: subject('s-alpha', 'ESSAI Alpha', '20', [
      { id: 'sec-b', name: 'ESSAI Alpha B', maxScore: '10', displayOrder: 2 },
      { id: 'sec-a', name: 'ESSAI Alpha A', maxScore: '10', displayOrder: 1 },
    ]),
  },
  { id: 'cs-beta', trackId: null, maxScoreOverride: null, subject: subject('s-beta', 'ESSAI Beta', '60') },
  { id: 'cs-gamma', trackId: null, maxScoreOverride: null, subject: subject('s-gamma', 'ESSAI Gamma', '20') },
  { id: 'cs-gamma-smp', trackId: 'filiere-smp', maxScoreOverride: null, subject: subject('s-gamma', 'ESSAI Gamma', '20') },
  { id: 'cs-delta-lla', trackId: 'filiere-lla', maxScoreOverride: null, subject: subject('s-delta', 'ESSAI Delta', '20') },
]

const grade = (cs: string, score: string, sectionId: string | null = null) => ({ classSubjectId: cs, sectionId, studentScore: score })

const GRADES: Record<string, unknown[]> = {
  st1: [grade('cs-alpha', '8.5', 'sec-a'), grade('cs-alpha', '8.75', 'sec-a'), grade('cs-beta', '48.75'), grade('cs-gamma-smp', '12')],
  st2: [grade('cs-beta', '30'), grade('cs-delta-lla', '20')],
  st3: [],
  st4: [],
}

interface Scenario {
  trackId: string | null
  /** Statut HTTP à renvoyer, par nom de route. */
  status: Record<string, number>
  photos: Array<{ academicYearId: string; photoUrl: string }>
  profilePhoto: string | null
  letter: string
}
let sc: Scenario
function reset(over: Partial<Scenario> = {}) {
  sc = { trackId: 'filiere-smp', status: {}, photos: [], profilePhoto: null, letter: 'A', ...over }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** Routes simulées : nom, motif d'URL, réponse nominale. */
const ROUTES: Array<[string, RegExp, (m: RegExpMatchArray) => unknown]> = [
  ['eleve', /^\/api\/students\/([^/?]+)$/, () => ({
    id: STUDENT,
    user: { firstname: 'Alpha', lastname: 'Essai-Fictif', birthDate: '2010-12-31T00:00:00.000Z', profilePhoto: sc.profilePhoto },
  })],
  ['dispenses-etape', /^\/api\/enrollments\/([^/?]+)\/step-exemptions$/, () => [{ stepId: 'st3' }]],
  ['exclusions', /^\/api\/enrollments\/excluded-sections\?classSessionId=([^&]+)&stepId=(.+)$/, (m) =>
    m[2] === 'st1'
      ? [{ enrollmentId: ENROLLMENT, classSubjectId: 'cs-alpha', sectionId: 'sec-b', stepId: 'st1' },
         { enrollmentId: 'autre-insc', classSubjectId: 'cs-alpha', sectionId: 'sec-a', stepId: 'st1' }]
      : []],
  ['inscription', /^\/api\/enrollments\/([^/?]+)$/, () => ({
    id: ENROLLMENT,
    studentId: STUDENT,
    trackId: sc.trackId,
    track: sc.trackId ? { code: 'SMP' } : null,
    classSessionId: SESSION,
    classSession: { id: SESSION, academicYearId: YEAR, class: { letter: sc.letter, classType: { name: 'NS9' } } },
  })],
  ['annee', /^\/api\/academic-years\/([^/?]+)$/, () => ({
    id: YEAR, yearString: '2000-2001', isCurrent: false, endDate: '2001-06-30T00:00:00.000Z', steps,
  })],
  ['matieres', /^\/api\/class-subjects\?classSessionId=(.+)$/, () => classSubjects],
  ['notes', /^\/api\/grades\/enrollment\/([^?]+)\?stepId=(.+)$/, (m) => GRADES[m[2]] ?? []],
  ['comportement', /^\/api\/behaviors\?enrollmentId=([^&]+)&stepId=(.+)$/, (m) => {
    if (m[2] === 'st1') return { retards: 2, absences: 0, devoirsManques: null, leconsNonSues: 1, respectUniforme: 8 }
    if (m[2] === 'st2') return { retards: 1, absences: 0, devoirsManques: null, leconsNonSues: 0, respectUniforme: 7 }
    return { __status: 404 }
  }],
  ['photos', /^\/api\/promotion-photos\?studentId=(.+)$/, () => sc.photos],
  ['ecole', /^\/api\/school-info$/, () => ({ name: 'École fictive', address: 'Adresse fictive', phone: '0000-0000', email: 'contact@exemple.test' })],
]

const appels: string[] = []
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input)
  appels.push(url)
  for (const [name, re, body] of ROUTES) {
    const m = url.match(re)
    if (!m) continue
    const forced = sc.status[name]
    if (forced) return json({ message: 'erreur simulée' }, forced)
    const b = body(m)
    if (b && typeof b === 'object' && '__status' in b) return json({ message: 'absent' }, (b as { __status: number }).__status)
    return json(b)
  }
  return json({ message: `route non simulée : ${url}` }, 599)
}) as typeof fetch

async function run(): Promise<{ data?: ReleveData; error?: unknown }> {
  try {
    return { data: await buildReleveData(STUDENT, ENROLLMENT) }
  } catch (error) {
    return { error }
  }
}
const reason = (r: { error?: unknown }) =>
  r.error instanceof ReleveUnavailableError ? r.error.reason : r.error ? `autre : ${String(r.error)}` : 'aucune erreur'
const subjectGroups = (d: ReleveData): ReleveGroup[] => [...d.left, ...d.right].filter((x) => x.kind === 'matiere')
const find = (d: ReleveData, title: string) => subjectGroups(d).find((x) => x.title === title)

async function main() {
  // ── Cas nominal ──────────────────────────────────────────────────────────
  reset()
  let r = await run()
  check('nominal : pas d’erreur', reason(r), 'aucune erreur')
  const d = r.data!
  check('identité : prénom', d.identity.prenom, 'Alpha')
  check('identité : NOM en majuscules', d.identity.nom, 'ESSAI-FICTIF')
  check('T24 identité : date sans décalage de fuseau', d.identity.dateNaissance, '31 Décembre 2010')
  check('identité : année « AAAA - AAAA »', d.identity.anneeScolaire, '2000 - 2001')
  check('T11 en-têtes = noms en base', d.stepHeaders.join(' | '), 'Étape 1 | Étape 2 | Étape 3 | Étape 4 & 5')
  check('pied : adresse', d.footer.adresse, 'Adresse fictive')
  check('pied : téléphone', d.footer.telephone, '0000-0000')
  check('pied : courriel', d.footer.courriel, 'contact@exemple.test')
  check('pied : remarque', d.footer.remarque, 'Toute surcharge et / ou rature rend nul le présent relevé de notes')
  check('pied : seuil', d.footer.seuil, '7.00')
  check('pied : légende 8 entrées', d.footer.legende.length, 8)

  // T14, T15, T17 — portée, suffixe, ordre
  check('T14/T15/T17 groupes (SMP, sans LLA, ordre API)', subjectGroups(d).map((x) => x.title).join(' / '),
    'ESSAI Alpha / ESSAI Beta / ESSAI Gamma / ESSAI Gamma (SMP)')
  check('T17 sous-matières triées par displayOrder', find(d, 'ESSAI Alpha')!.lines.map((l) => l.label).join(','), 'ESSAI Alpha A,ESSAI Alpha B')
  check('T16 matière sans sous-matière : une ligne', find(d, 'ESSAI Beta')!.lines.map((l) => l.label).join(','), 'ESSAI Beta')

  // T7, T8 — cellules et dispenses lues par le réseau
  const alphaA = find(d, 'ESSAI Alpha')!.lines[0]
  check('T7 cellule [8.5, 8.75] → 8.63', alphaA.cells[0].text, '8.63')
  const alphaB = find(d, 'ESSAI Alpha')!.lines[1]
  check('T8 sous-matière dispensée (étape 1) : « - »', alphaB.cells[0].text, '-')
  check('T8 dispense d’une autre inscription : sans effet', alphaA.cells[0].text, '8.63')
  const beta = find(d, 'ESSAI Beta')!.lines[0]
  check('T6 coeff barème 60', beta.coeff, '6')
  check('T8 étape 3 dispensée : « - »', beta.cells[2].text, '-')
  check('Moy Beta (48.75 + 30) / 2 / 60 × 10', beta.average.text, '6.56')
  check('colonne sans titre : « - »', beta.blank, '-')
  check('ligne SMP notée à l’étape 1', find(d, 'ESSAI Gamma (SMP)')!.lines[0].cells[0].text, '12.00')

  // T19 — discipline en fin de colonne gauche ; T20 — fiche 404 → « - »
  const disc = d.left[d.left.length - 1]
  check('T19 Discipline en fin de colonne gauche', disc.kind, 'discipline')
  check('T20 fiche 404 aux étapes 3-4 : cellules retards', disc.lines[0].cells.map((c) => c.text).join('|'), '2|1|-|-')
  check('T9 retards : total des fiches', disc.lines[0].average.text, '3')
  check('T9 devoirs : champs vides → « - »', disc.lines[2].average.text, '-')
  check('T9 uniforme : moyenne', disc.lines[4].average.text, '7.50')

  // T22, T23 — photo et niveau
  check('T22 photo d’une autre année seulement, pas de profil : null', d.identity.photoUrl, 'null')
  check('T23 niveau sans la salle', d.identity.niveau, 'NS9')

  reset({ photos: [{ academicYearId: YEAR, photoUrl: '/promo.jpg' }], profilePhoto: '/profil.jpg' })
  check('T22 photo de promotion de l’année : prise', (await run()).data?.identity.photoUrl, '/promo.jpg')
  reset({ photos: [{ academicYearId: 'autre-annee', photoUrl: '/autre.jpg' }], profilePhoto: '/profil.jpg' })
  check('T22 photo d’une autre année : profil', (await run()).data?.identity.photoUrl, '/profil.jpg')
  reset({ photos: [{ academicYearId: 'autre-annee', photoUrl: '/autre.jpg' }] })
  check('T22 photo d’une autre année, sans profil : null', (await run()).data?.identity.photoUrl, 'null')

  reset({ letter: 'AB' })
  r = await run()
  check('T23 salle à plusieurs lettres : niveau', r.data?.identity.niveau, 'NS9')
  check('T23 salle à plusieurs lettres : absente du niveau', String(r.data?.identity.niveau).includes('AB'), false)

  // T14 — élève sans filière
  reset({ trackId: null })
  r = await run()
  check('T14 élève sans filière : tronc commun seul', r.data ? subjectGroups(r.data).map((x) => x.title).join(' / ') : reason(r),
    'ESSAI Alpha / ESSAI Beta / ESSAI Gamma')

  // ── T20 — toute panne de lecture refuse le relevé ────────────────────────
  for (const route of ['eleve', 'inscription', 'annee', 'matieres', 'notes', 'exclusions', 'dispenses-etape', 'photos']) {
    for (const status of [500, 404]) {
      reset({ status: { [route]: status } })
      check(`T20 ${route} en ${status} : refus « indisponible »`, reason(await run()), 'indisponible')
    }
  }
  reset({ status: { comportement: 500 } })
  check('T20 fiche de comportement en 500 : refus « indisponible »', reason(await run()), 'indisponible')
  reset({ status: { ecole: 500 } })
  check('T20 school_info en 500 : refus « indisponible »', reason(await run()), 'indisponible')

  // ── T21 — school_info absente ────────────────────────────────────────────
  reset({ status: { ecole: 404 } })
  r = await run()
  check('T21 school_info 404 : refus dédié', reason(r), 'ecole-non-renseignee')
  check('T21 message « informations de l’école non renseignées »',
    r.error instanceof Error && r.error.message.includes('informations de l’école non renseignées'), true)

  // ── Garde : n'appelle jamais getCurrentStep ni de route par défaut ──────
  check('aucune route non simulée appelée', appels.filter((u) => !ROUTES.some(([, re]) => re.test(u))).length, 0)

  console.log(out.join('\n'))
  console.log(`\n${pass} OK, ${fail} ECHEC`)
  if (fail > 0) process.exit(1)
}

void main()
