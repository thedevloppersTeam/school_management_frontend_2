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
  /** Réponse de /api/school-info quand elle n'est pas forcée en erreur. */
  ecole: Record<string, string | null>
  /** Transformation de la réponse nominale, par nom de route (lot 1c). */
  mutate: Partial<Record<string, (body: Record<string, unknown>) => unknown>>
  /** Corps BRUT renvoyé en 200, par route (« comportement:st1 » pour une étape). */
  raw: Record<string, string>
}
let sc: Scenario
function reset(over: Partial<Scenario> = {}) {
  sc = {
    trackId: 'filiere-smp', status: {}, photos: [], profilePhoto: null, letter: 'A',
    ecole: { name: 'École fictive', address: 'Adresse fictive', phone: '0000-0000', email: 'contact@exemple.test' },
    mutate: {},
    raw: {},
    ...over,
  }
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
    // Étape 3 : dispensée pour l'élève (U6), mais sa fiche compte en discipline.
    if (m[2] === 'st3') return { retards: 4, absences: 1, devoirsManques: null, leconsNonSues: null, respectUniforme: null }
    return { __status: 404 }
  }],
  ['photos', /^\/api\/promotion-photos\?studentId=(.+)$/, () => sc.photos],
  ['ecole', /^\/api\/school-info$/, () => sc.ecole],
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
    const rawKey = name === 'comportement' ? `comportement:${m[2]}` : name
    if (rawKey in sc.raw) return new Response(sc.raw[rawKey], { status: 200 })
    const nominal = body(m)
    const mutate = sc.mutate[name]
    const b = mutate && nominal && typeof nominal === 'object' ? mutate(nominal as Record<string, unknown>) : nominal
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
  check('ligne SMP notée à l’étape 1', find(d, 'ESSAI Gamma (SMP)')!.lines[0].cells[0].text, '12.00')

  // T19 — discipline en fin de colonne gauche ; T20 — fiche 404 → « - »
  const disc = d.left[d.left.length - 1]
  check('T19 Discipline en fin de colonne gauche', disc.kind, 'discipline')
  check('T20/U6 fiche 404 à l’étape 4, étape 3 dispensée comptée', disc.lines[0].cells.map((c) => c.text).join('|'), '2|1|4|-')
  check('T9/U6 retards : total des fiches, étape dispensée comprise', disc.lines[0].average.text, '7')
  check('U6 fiche de l’étape dispensée lue', appels.some((u) => u.includes('/api/behaviors?') && u.endsWith('stepId=st3')), true)
  check('U6 notes de l’étape dispensée : « - »', find(d, 'ESSAI Beta')!.lines[0].cells[2].text, '-')
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

  // ── U9 — school_info incomplète (C4, Q-D) ────────────────────────────────
  const ecole = (over: Record<string, string | null>) =>
    ({ name: 'École fictive', address: 'Adresse fictive', phone: '0000-0000', email: 'contact@exemple.test', ...over })
  reset({ ecole: ecole({ address: '' }) })
  r = await run()
  check('U9 adresse vide : refus « ecole-incomplete »', reason(r), 'ecole-incomplete')
  check('U9 message « informations de l’école incomplètes. »',
    r.error instanceof Error && r.error.message, 'Relevé de notes indisponible : informations de l’école incomplètes.')
  reset({ ecole: ecole({ address: null }) })
  check('U9 adresse absente (null) : refus', reason(await run()), 'ecole-incomplete')
  reset({ ecole: ecole({ phone: '' }) })
  check('U9 téléphone « » : refus', reason(await run()), 'ecole-incomplete')
  reset({ ecole: ecole({ phone: '  ' }) })
  check('U9 téléphone « ␠␠ » : refus', reason(await run()), 'ecole-incomplete')
  reset({ ecole: ecole({ email: '' }) })
  r = await run()
  check('U9 courriel vide : accepté', reason(r), 'aucune erreur')
  check('U9 courriel vide : rendu vide', r.data?.footer.courriel, '')
  reset({ ecole: ecole({ address: '' }), status: { ecole: 404 } })
  check('U9 404 : toujours « ecole-non-renseignee »', reason(await run()), 'ecole-non-renseignee')

  // ── Lot 1c — K1 / G-7 : fiche de comportement en 200 mal formée ──────────
  const fiches: Array<[string, string]> = [
    ['corps vide', ''],
    ['corps non JSON', 'pas du json'],
    ['tableau', '[]'],
    ['objet sans les 5 champs', '{}'],
    ['objet sans respectUniforme', JSON.stringify({ retards: 1, absences: 0, devoirsManques: 0, leconsNonSues: 0 })],
    ['champ texte', JSON.stringify({ retards: 'deux', absences: 0, devoirsManques: 0, leconsNonSues: 0, respectUniforme: 8 })],
    ['null', 'null'],
  ]
  for (const [cas, corps] of fiches) {
    reset({ raw: { 'comportement:st1': corps } })
    check(`K1/G-7 fiche 200 ${cas} : refus « indisponible »`, reason(await run()), 'indisponible')
  }
  reset({ raw: { 'comportement:st1': JSON.stringify({ retards: null, absences: null, devoirsManques: null, leconsNonSues: null, respectUniforme: null, remarque: null }) } })
  r = await run()
  check('K1 fiche 200 aux 5 champs null : admise', reason(r), 'aucune erreur')
  check('K1 champs null : « - » à l’étape 1', r.data?.left[r.data.left.length - 1].lines[0].cells[0].text, '-')

  // ── Colonne sans titre supprimée (décision du 2026-10-15) : X1 à X4 ───────
  const toutesLignes = (x: ReleveData) => [...x.left, ...x.right].flatMap((g) => g.lines)
  reset()
  r = await run()
  check('X1 aucune ligne (matière, globale, discipline) ne porte « blank »',
    r.data ? toutesLignes(r.data).filter((l) => 'blank' in l).length : 'refus', 0)
  check('X2 année à 4 étapes : 4 en-têtes = noms en base',
    r.data?.stepHeaders.join(' | '), 'Étape 1 | Étape 2 | Étape 3 | Étape 4 & 5')
  check('X2 année à 4 étapes : 4 cellules par ligne',
    r.data ? toutesLignes(r.data).every((l) => l.cells.length === 4) : 'refus', true)
  check('X4 4e étape « Étape 4 & 5 » : en-tête repris tel quel', r.data?.stepHeaders[3], 'Étape 4 & 5')
  reset({
    mutate: {
      annee: (b) => ({ ...b, steps: [...steps, { id: 'st5', name: 'Étape 5 (essai)', stepNumber: 5, isCurrent: false }] }),
    },
  })
  r = await run()
  check('X3 année à 5 étapes : pas d’erreur', reason(r), 'aucune erreur')
  check('X3 année à 5 étapes : 5 en-têtes = noms en base',
    r.data?.stepHeaders.join(' | '), 'Étape 1 | Étape 2 | Étape 3 | Étape 4 & 5 | Étape 5 (essai)')
  check('X3 année à 5 étapes : 5 cellules par ligne, discipline comprise',
    r.data ? toutesLignes(r.data).every((l) => l.cells.length === 5) : 'refus', true)
  check('X1 année à 5 étapes : aucune ligne ne porte « blank »',
    r.data ? toutesLignes(r.data).filter((l) => 'blank' in l).length : 'refus', 0)

  // ── Lot 1c — G-8 : année ACTIVE, étape 2 en cours ─────────────────────────
  const active = (current: string | null) => (b: Record<string, unknown>) => ({
    ...b, isCurrent: true, endDate: '2999-06-30T00:00:00.000Z',
    steps: steps.map((x) => ({ ...x, isCurrent: x.id === current })),
  })
  reset({ mutate: { annee: active('st2') } })
  const avant = appels.length
  r = await run()
  check('G-8 année active : pas d’erreur', reason(r), 'aucune erreur')
  check('G-8 année active : 4 en-têtes', r.data?.stepHeaders.length, 4)
  const lues = appels.slice(avant).filter((u) => u.startsWith('/api/grades/')).map((u) => u.split('stepId=')[1]).sort().join(',')
  check('G-8 notes lues pour les étapes retenues seules', lues, 'st1,st2')
  const fichesLues = appels.slice(avant).filter((u) => u.startsWith('/api/behaviors?')).length
  check('G-8 fiches lues pour les étapes retenues seules', fichesLues, 2)
  const betaActive = r.data ? find(r.data, 'ESSAI Beta')!.lines[0] : undefined
  check('G-8 Beta : étapes 3-4 « - »', betaActive?.cells.map((c) => c.text).join('|'), '48.75|30.00|-|-')
  check('G-8 Beta : Moy sur les étapes 1-2', betaActive?.average.text, '6.56')
  check('G-8 discipline : étapes 3-4 « - »', r.data?.left[r.data.left.length - 1].lines[0].cells.map((c) => c.text).join('|'), '2|1|-|-')

  reset({ mutate: { annee: active(null) } })
  const avant2 = appels.length
  check('G-8 année active sans étape en cours : refus', reason(await run()), 'aucune-etape-en-cours')
  check('G-8 refus avant les autres lectures', appels.slice(avant2).some((u) => u.startsWith('/api/class-subjects')), false)
  reset({ mutate: { annee: (b) => ({ ...b, endDate: '2999-06-30T00:00:00.000Z' }) } })
  check('G-8 année en préparation : refus', reason(await run()), 'annee-en-preparation')

  // ── Lot 1c — G-9 : inscription incohérente ou incomplète ─────────────────
  reset({ mutate: { inscription: (b) => ({ ...b, studentId: 'autre-eleve' }) } })
  check('G-9 inscription d’un autre élève : refus', reason(await run()), 'indisponible')
  reset({ mutate: { inscription: (b) => ({ ...b, classSessionId: undefined, classSession: { academicYearId: YEAR, class: { letter: 'A', classType: { name: 'NS9' } } } }) } })
  check('G-9 salle inconnue : refus', reason(await run()), 'indisponible')
  reset({ mutate: { inscription: (b) => ({ ...b, classSession: { id: SESSION, class: { letter: 'A', classType: { name: 'NS9' } } } }) } })
  check('G-9 année inconnue : refus', reason(await run()), 'indisponible')

  // ── Lot 1c — G-10 : autres statuts d'erreur ──────────────────────────────
  for (const status of [401, 403, 504]) {
    reset({ status: { matieres: status } })
    check(`G-10 matières en ${status} : refus « indisponible »`, reason(await run()), 'indisponible')
  }

  // ── Lot 1c — K5 : champs de contrat absents ──────────────────────────────
  const sans = (key: string) => (b: Record<string, unknown>) => {
    const copy = { ...b }
    delete copy[key]
    return copy
  }
  reset({ mutate: { inscription: sans('trackId') } })
  check('K5 trackId absent : refus', reason(await run()), 'indisponible')
  reset({ mutate: { inscription: (b) => ({ ...b, track: {} }) } })
  check('K5 track.code absent (trackId non nul) : refus', reason(await run()), 'indisponible')
  reset({ mutate: { inscription: sans('track') } })
  check('K5 track absent (trackId non nul) : refus', reason(await run()), 'indisponible')
  reset({ trackId: null, mutate: { inscription: sans('track') } })
  check('K5 trackId null, track absent : « pas de filière »', reason(await run()), 'aucune erreur')
  reset({ mutate: { inscription: (b) => ({ ...b, classSession: { id: SESSION, academicYearId: YEAR, class: { letter: 'A' } } }) } })
  check('K5 classType absent : refus', reason(await run()), 'indisponible')
  reset({ mutate: { annee: sans('yearString') } })
  check('K5 yearString absent : refus', reason(await run()), 'indisponible')
  const eleve = (user: Record<string, unknown> | undefined) => () => ({ id: STUDENT, ...(user ? { user } : {}) })
  reset({ mutate: { eleve: eleve({ firstname: 'Alpha', lastname: 'Essai', birthDate: null }) } })
  r = await run()
  check('K5 date de naissance null : refus dédié', reason(r), 'naissance-non-renseignee')
  check('K5 message date de naissance',
    r.error instanceof Error && r.error.message, 'Relevé de notes indisponible : date de naissance de l’élève non renseignée.')
  reset({ mutate: { eleve: eleve({ firstname: 'Alpha', lastname: 'Essai' }) } })
  check('K5 date de naissance absente : refus dédié', reason(await run()), 'naissance-non-renseignee')
  reset({ mutate: { eleve: eleve(undefined) } })
  check('K5 utilisateur absent : refus', reason(await run()), 'indisponible')

  // ── F1 — de bout en bout : matière masquée, colonne imposée, valeur invalide
  const changerMatieres = (f: (cs: Record<string, unknown>) => Record<string, unknown>) =>
    (b: Record<string, unknown>) => (b as unknown as Record<string, unknown>[]).map(f)
  reset({ mutate: { matieres: changerMatieres((cs) => {
    const s = cs.subject as Record<string, unknown>
    if (s.name === 'ESSAI Beta') return { ...cs, subject: { ...s, showOnReleve: false } }
    if (s.name === 'ESSAI Alpha') return { ...cs, subject: { ...s, releveColumn: 'RIGHT' } }
    return cs
  }) } })
  r = await run()
  check('T-O4 build : matière masquée absente', r.data ? subjectGroups(r.data).map((x) => x.title).join(' / ') : reason(r),
    'ESSAI Alpha / ESSAI Gamma / ESSAI Gamma (SMP)')
  check('T-O7 build : colonne imposée à droite', r.data?.right.map((x) => x.title).includes('ESSAI Alpha'), true)
  check('T-O7 build : Discipline en fin de gauche', r.data?.left[r.data.left.length - 1].kind, 'discipline')
  reset({ mutate: { matieres: changerMatieres((cs) => ({ ...cs, subject: { ...(cs.subject as object), releveColumn: 'MIDDLE' } })) } })
  check('T-O8 build : releveColumn invalide → indisponible', reason(await run()), 'indisponible')

  // ── accepteNotes (décision du serveur) : false → ligne absente du relevé ──
  reset({ mutate: { matieres: changerMatieres((cs) =>
    cs.id === 'cs-gamma-smp' ? { ...cs, accepteNotes: false } : { ...cs, accepteNotes: true }) } })
  r = await run()
  check('AN-1 build : affectation à accepteNotes false absente',
    r.data ? subjectGroups(r.data).map((x) => x.title).join(' / ') : reason(r),
    'ESSAI Alpha / ESSAI Beta / ESSAI Gamma')
  check('AN-1 build : sa note (12 à l’étape 1) n’apparaît nulle part',
    r.data ? subjectGroups(r.data).some((g) => g.lines.some((l) => l.cells.some((c) => c.text === '12.00'))) : reason(r), false)
  // Le cas nominal (champ absent) garde ESSAI Gamma (SMP) : voir T14/T15/T17.

  // ── Garde : n'appelle jamais getCurrentStep ni de route par défaut ──────
  check('aucune route non simulée appelée', appels.filter((u) => !ROUTES.some(([, re]) => re.test(u))).length, 0)

  console.log(out.join('\n'))
  console.log(`\n${pass} OK, ${fail} ECHEC`)
  if (fail > 0) process.exit(1)
}

void main()
