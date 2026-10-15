/**
 * Moyenne de classe du bulletin : plus d'ECHEC SILENCIEUX.
 *
 * Avant : une requete de notes en echec rendait `null`, et l'eleve sortait du
 * denominateur de la moyenne de classe, sans erreur ni trace. Deux impressions
 * du meme bulletin pouvaient porter deux moyennes de classe differentes.
 *
 * Les requetes passent par un `fetch` simule : aucune base, aucun serveur.
 * Donnees entierement fictives.
 */
import { buildBulletinData } from './bulletin'
import { calculateBulletinAverages, calculateClassAverages } from '@/lib/bulletin-calculations'
import { formatAverage } from '@/lib/bulletin/compute'
import { toSubjectInputs, rubricIndex } from '@/lib/bulletin/from-api'

let pass = 0, fail = 0
const out: string[] = []
function check(l: string, got: unknown, want: unknown) {
  const g = String(got), w = String(want)
  if (g === w) { pass++; out.push(`  OK    ${l.padEnd(62)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${l.padEnd(62)} attendu ${w}, obtenu ${g}`) }
}

// ── Salle fictive : 6 eleves, 3 matieres (R1 /20, R2 /20, R3 /10) ───────────

const STEP = 'etape-1'
const YEAR = 'annee-1'

const classSubjects = [
  { id: 'cs-fr', subject: { id: 's-fr', name: 'ESSAI Francais', maxScore: '20', coefficient: '1', hasSections: false, rubric: { id: 'r1', code: 'R1' }, sections: [] } },
  { id: 'cs-sc', subject: { id: 's-sc', name: 'ESSAI Sciences', maxScore: '20', coefficient: '1', hasSections: false, rubric: { id: 'r2', code: 'R2' }, sections: [] } },
  { id: 'cs-de', subject: { id: 's-de', name: 'ESSAI Dessin', maxScore: '10', coefficient: '1', hasSections: false, rubric: { id: 'r3', code: 'R3' }, sections: [] } },
].map((cs) => ({ ...cs, subjectId: cs.subject.id, classSessionId: 'x', coefficientOverride: null, maxScoreOverride: null, trackId: null }))

const g = (cs: string, score: string) => ({ classSubjectId: cs, sectionId: null, studentScore: score })

/** Notes de l'etape, par inscription. `e6` n'a AUCUNE note. */
const NOTES: Record<string, ReturnType<typeof g>[]> = {
  e1: [g('cs-fr', '16'), g('cs-sc', '14'), g('cs-de', '8')],
  e2: [g('cs-fr', '12.5'), g('cs-sc', '10'), g('cs-de', '6')],
  e3: [g('cs-fr', '19.75'), g('cs-sc', '18'), g('cs-de', '10')],
  e4: [g('cs-fr', '9'), g('cs-sc', '11.25'), g('cs-de', '5')],
  e5: [g('cs-fr', '15.25'), g('cs-sc', '13'), g('cs-de', '7.5')],
  e6: [],
}
const ELEVES = Object.keys(NOTES)

// ── fetch simule ────────────────────────────────────────────────────────────

/** Nombre d'echecs a produire, par inscription, avant de repondre (Infinity = toujours). */
let echecs: Record<string, number> = {}
/** Nombre de requetes de notes recues, par inscription. */
let appels: Record<string, number> = {}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input)
  const notes = url.match(/^\/api\/grades\/enrollment\/([^?]+)\?stepId=/)
  if (notes) {
    const id = notes[1]
    appels[id] = (appels[id] ?? 0) + 1
    if ((echecs[id] ?? 0) > 0) {
      echecs[id]--
      return json({ message: 'erreur simulee' }, 500)
    }
    return json(NOTES[id] ?? [])
  }
  if (url.startsWith('/api/enrollments?classSessionId=')) return json(ELEVES.map((id) => ({ id, trackId: null })))
  if (url.startsWith('/api/class-subjects?')) return json(classSubjects)
  if (url.startsWith('/api/students/')) return json({ user: { firstname: 'Alpha', lastname: 'ESSAI' }, nisu: '', studentCode: 'ESSAI-001' })
  if (url.startsWith('/api/enrollments/excluded-sections?')) return json([])
  return json({ message: 'absent' }, 404) // donnees accessoires : repli de safeFetch
}) as typeof fetch

// ── Reference, calculee SANS passer par le code teste ──────────────────────

const idx = rubricIndex([{ id: 'r1', code: 'R1' }, { id: 'r2', code: 'R2' }, { id: 'r3', code: 'R3' }])
function moyenneClasseDe(ids: string[]): string {
  const parEleve = ids.map((id) =>
    calculateBulletinAverages(
      toSubjectInputs({ classSubjects, grades: NOTES[id], rubricCodeById: idx, enrollmentId: id }).subjects,
    ),
  )
  return formatAverage(calculateClassAverages(parEleve).exact.moyenneClasseEtape)
}
const ATTENDUE_6 = moyenneClasseDe(ELEVES)
const SANS_E3 = moyenneClasseDe(ELEVES.filter((id) => id !== 'e3'))

// Chaque scenario a sa propre salle : le cache de module est cle par salle.
let salle = 0
async function bulletin(): Promise<{ moyenneClasse?: string; erreur?: Error }> {
  salle++
  try {
    const data = await buildBulletinData({
      enrollmentId: 'e1', studentId: 'st1', classSessionId: `salle-${salle}`,
      stepId: STEP, stepName: 'Etape 1', className: '1ere AF A', yearId: YEAR,
    })
    return { moyenneClasse: data.moyenneClasse }
  } catch (e) {
    return { erreur: e as Error }
  }
}
function scenario(plan: Record<string, number>) {
  echecs = { ...plan }
  appels = {}
}

async function main() {
  out.push('Reference (calcul direct, sans fetch)')
  check('moyenne de classe des 6 eleves', ATTENDUE_6, ATTENDUE_6)
  check('le jeu discrimine : sans e3, le chiffre change', SANS_E3 !== ATTENDUE_6, true)
  out.push(`  (6 eleves : ${ATTENDUE_6} ; 5 eleves, sans e3 : ${SANS_E3})`)

  // (a) Non-regression : aucun echec, chiffre inchange.
  out.push('(a) aucun echec')
  scenario({})
  let r = await bulletin()
  check('pas d\'erreur', r.erreur?.name ?? 'aucune', 'aucune')
  check('moyenne de classe = les 6', r.moyenneClasse, ATTENDUE_6)
  check('une seule requete de notes par eleve de la salle', appels.e2, 1)

  // (e) Un eleve sans aucune note n'est pas un echec : il reste compte.
  out.push('(e) un eleve sans note (e6)')
  check('e6 n\'a aucune note dans le jeu', NOTES.e6.length, 0)
  check('e6 compte : moyenne != moyenne sans e6',
    moyenneClasseDe(ELEVES.filter((id) => id !== 'e6')) !== r.moyenneClasse, true)
  check('e6 compte : moyenne = les 6', r.moyenneClasse, ATTENDUE_6)

  // (b) Un echec, puis succes au second essai : chiffre complet.
  out.push('(b) e3 echoue une fois, puis repond')
  scenario({ e3: 1 })
  r = await bulletin()
  check('pas d\'erreur', r.erreur?.name ?? 'aucune', 'aucune')
  check('moyenne de classe = les 6 (et non les 5)', r.moyenneClasse, ATTENDUE_6)
  check('requetes de notes pour e3 : 2 (un essai, une reprise)', appels.e3, 2)

  // (c) Un echec persistant : erreur typee, avec le bon nombre.
  out.push('(c) e3 echoue toujours')
  scenario({ e3: Infinity })
  r = await bulletin()
  check('erreur typee ClassAverageUnavailableError', r.erreur?.name, 'ClassAverageUnavailableError')
  check('nombre d\'eleves en echec', (r.erreur as { failedCount?: number } | undefined)?.failedCount, 1)
  check('aucune moyenne de classe renvoyee', r.moyenneClasse ?? 'aucune', 'aucune')
  check('requetes de notes pour e3 : 2 (une seule reprise)', appels.e3, 2)
  check('le message ne nomme pas l\'eleve', /e3|ESSAI|Alpha/.test(r.erreur?.message ?? ''), false)

  // (d) Deux echecs persistants : le nombre vaut 2.
  out.push('(d) e2 et e5 echouent toujours')
  scenario({ e2: Infinity, e5: Infinity })
  r = await bulletin()
  check('erreur typee ClassAverageUnavailableError', r.erreur?.name, 'ClassAverageUnavailableError')
  check('nombre d\'eleves en echec', (r.erreur as { failedCount?: number } | undefined)?.failedCount, 2)
  check('le message ne nomme aucun eleve', /e2|e5|ESSAI|Alpha/.test(r.erreur?.message ?? ''), false)

  // (f) Un echec n'est pas memorise : la meme salle se recalcule ensuite.
  out.push('(f) meme salle, nouvel essai apres un echec persistant')
  scenario({ e4: Infinity })
  r = await bulletin()
  check('premier essai : erreur typee', r.erreur?.name, 'ClassAverageUnavailableError')
  salle-- // meme salle, meme cle de cache
  scenario({})
  r = await bulletin()
  check('second essai : pas d\'erreur', r.erreur?.name ?? 'aucune', 'aucune')
  check('second essai : moyenne = les 6', r.moyenneClasse, ATTENDUE_6)

  console.log(out.join('\n'))
  console.log(`\n${pass} OK, ${fail} ECHEC`)
  if (fail > 0) process.exit(1)
}

void main()
