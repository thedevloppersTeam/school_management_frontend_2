/**
 * Chargement du tableau de bord — l'orchestration des appels.
 *
 * Appels simulés par des promesses contrôlées : chaque appel attend qu'on le
 * résolve ou le rejette, ce qui permet d'observer ce qui est en vol à chaque
 * instant. Données fictives uniquement.
 */
import { loadDashboardData, type DashboardApi, type DashboardLoadResult } from './load-dashboard'
import { sumEnrollmentCounts, toEnrollmentCount } from './students-total'

let pass = 0, fail = 0
const out: string[] = []
function check(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; out.push(`  OK    ${label.padEnd(60)} = ${g}`) }
  else { fail++; out.push(`  ECHEC ${label.padEnd(60)} attendu ${w}, obtenu ${g}`) }
}

// -- Appels simulés ----------------------------------------------------------

interface Appel { nom: string; resoudre: (v: unknown) => void; rejeter: (e: unknown) => void; fini: boolean }

function simulateur() {
  const appels: Appel[] = []
  let enVol = 0
  let maxEnVol = 0
  const appeler = <T,>(nom: string) =>
    new Promise<T>((resolve, reject) => {
      enVol++
      maxEnVol = Math.max(maxEnVol, enVol)
      const a: Appel = {
        nom,
        fini: false,
        resoudre: (v) => { if (!a.fini) { a.fini = true; enVol--; resolve(v as T) } },
        rejeter: (e) => { if (!a.fini) { a.fini = true; enVol--; reject(e) } },
      }
      appels.push(a)
    })
  const api: DashboardApi<{ id: string }, { stepNumber: number }> = {
    fetchSteps: (y) => appeler(`steps:${y}`),
    fetchClassSessions: (y) => appeler(`sessions:${y}`),
    fetchSubjects: () => appeler('subjects'),
    fetchArchives: (y) => appeler(`archives:${y}`),
    fetchEnrollmentCount: (s) => appeler(`count:${s}`),
    fetchClassSubjects: (s) => appeler(`cs:${s}`),
  }
  const trouver = (nom: string) => appels.find((a) => a.nom === nom && !a.fini)
  return {
    api,
    appels,
    noms: () => appels.map((a) => a.nom),
    enVol: () => enVol,
    maxEnVol: () => maxEnVol,
    resoudre: (nom: string, v: unknown) => trouver(nom)?.resoudre(v),
    rejeter: (nom: string) => trouver(nom)?.rejeter(new Error(`échec simulé ${nom}`)),
    /** Résout tout ce qui est en vol avec la réponse donnée par `reponse`. */
    resoudreTout: (reponse: (nom: string) => unknown) => {
      for (const a of appels) if (!a.fini) a.resoudre(reponse(a.nom))
    },
  }
}

const laisserTourner = () => new Promise((r) => setTimeout(r, 0))
const salles = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i + 1}` }))

/** Réponse simulée par défaut, selon le nom de l'appel. */
function reponseDefaut(n: number) {
  return (nom: string): unknown => {
    if (nom.startsWith('steps')) return [{ stepNumber: 2 }, { stepNumber: 1 }]
    if (nom.startsWith('sessions')) return salles(n)
    if (nom === 'subjects') return [{}, {}, {}]
    if (nom.startsWith('archives')) return [{}]
    if (nom.startsWith('count')) return 10
    if (nom.startsWith('cs')) return [{}, {}]
    return null
  }
}

/** Fait avancer le chargement jusqu'au bout en résolvant tout ce qui est en vol. */
async function drainer(sim: ReturnType<typeof simulateur>, reponse: (nom: string) => unknown) {
  for (let i = 0; i < 200; i++) {
    await laisserTourner()
    if (sim.enVol() === 0) { await laisserTourner(); if (sim.enVol() === 0) return }
    sim.resoudreTout(reponse)
  }
}

async function main(): Promise<void> {
// -- 1. Dépendances ----------------------------------------------------------
{
  const sim = simulateur()
  const p = loadDashboardData('A', sim.api)
  await laisserTourner()
  const vague1 = sim.noms().slice().sort()
  check('vague 1 : etapes, salles, matieres, archives ensemble', vague1, ['archives:A', 'sessions:A', 'steps:A', 'subjects'])
  check('aucun effectif avant la reponse des salles', sim.noms().some((n) => n.startsWith('count')), false)
  sim.resoudre('sessions:A', salles(2))
  await laisserTourner()
  check('effectifs lances des les salles, sans attendre les etapes',
    sim.noms().filter((n) => n.startsWith('count')).length, 2)
  await drainer(sim, reponseDefaut(2))
  const r = await p
  check('etapes triees par numero', r.steps.map((s) => s.stepNumber), [1, 2])
}

// -- 2. Jamais plus de 6 en vol ----------------------------------------------
{
  const sim = simulateur()
  const p = loadDashboardData('A', sim.api)
  await drainer(sim, reponseDefaut(20))
  const r = await p
  check('20 salles : jamais plus de 6 appels en vol', sim.maxEnVol() <= 6, true)
  check('20 salles : tous les appels faits (2N + 4)', sim.appels.length, 44)
  check('20 salles : total d eleves', r.totalStudents, 200)
}

// -- 3. Un échec n'annule pas les autres, et n'est jamais un 0 ---------------
{
  const sim = simulateur()
  const p = loadDashboardData('A', sim.api)
  await laisserTourner()
  sim.rejeter('subjects')
  sim.resoudre('sessions:A', salles(3))
  await laisserTourner()
  sim.rejeter('count:s2')
  await drainer(sim, reponseDefaut(3))
  const r = await p
  check('un effectif en echec : total null, jamais 0 ni sous-total', r.totalStudents, null)
  check('matieres en echec : null, jamais 0', r.extra.subjectCount, null)
  check('les autres donnees arrivent quand meme', [r.extra.archiveCount, r.extra.assignmentSummary?.checkedSessions], [1, 3])
  check('raisons, dans l ordre d origine', r.partialReasons, ['les effectifs de 1 classe(s)', 'le compteur des matières'])
  check('les 3 effectifs ont ete demandes', sim.noms().filter((n) => n.startsWith('count')).length, 3)
}

// -- 4. Zéro salle -----------------------------------------------------------
{
  const sim = simulateur()
  const p = loadDashboardData('A', sim.api)
  await drainer(sim, reponseDefaut(0))
  const r = await p
  check('zero salle : total 0, legitime', r.totalStudents, 0)
  check('zero salle : affectations comptees vides', r.extra.assignmentSummary, { totalAssigned: 0, sessionsWithSubjects: 0, checkedSessions: 0 })
  check('zero salle : aucun appel par salle', sim.noms().filter((n) => n.startsWith('count') || n.startsWith('cs')).length, 0)
}

// -- 5. Étapes ou salles en échec : le chargement échoue (comme avant) ------
{
  const sim = simulateur()
  const p = loadDashboardData('A', sim.api).then(() => 'resolu', () => 'rejete')
  await laisserTourner()
  sim.rejeter('steps:A')
  await drainer(sim, reponseDefaut(2))
  check('etapes en echec : chargement rejete', await p, 'rejete')
}

// -- 6. Changement d'année : l'ancienne n'écrit jamais -----------------------
{
  const sim = simulateur()
  const ctrl = new AbortController()
  const p = loadDashboardData('A', sim.api, { signal: ctrl.signal }).then(() => 'resolu', (e: Error) => e.name)
  await laisserTourner()
  sim.resoudre('sessions:A', salles(20))
  await laisserTourner()
  const lancesAvant = sim.appels.length
  ctrl.abort()
  await drainer(sim, reponseDefaut(20))
  check('annulation : le resultat tardif est ignore', await p, 'AbortError')
  check('annulation : plus aucun appel lance apres', sim.appels.length, lancesAvant)
}

// -- 7. Résultat identique à l'ancien chargement -----------------------------
// L'ancien enchaînement de page.tsx, recopié tel quel : vague 1, puis
// effectifs, puis matières + archives + affectations.
async function ancienChargement(api: DashboardApi<{ id: string }, { stepNumber: number }>, yearId: string): Promise<DashboardLoadResult<{ id: string }, { stepNumber: number }>> {
  const [stepsData, sessionsData] = await Promise.all([api.fetchSteps(yearId), api.fetchClassSessions(yearId)])
  const counts = await Promise.allSettled(sessionsData.map((s) => api.fetchEnrollmentCount(s.id)))
  const perSession = counts.map((c) => (c.status === 'fulfilled' ? toEnrollmentCount(c.value) : null))
  const reasons: string[] = []
  const missing = perSession.filter((c) => c === null).length
  if (missing > 0) reasons.push(`les effectifs de ${missing} classe(s)`)
  const [sub, arc, cs] = await Promise.allSettled([
    api.fetchSubjects(), api.fetchArchives(yearId),
    Promise.allSettled(sessionsData.map((s) => api.fetchClassSubjects(s.id))),
  ])
  const subjectCount = sub.status === 'fulfilled' && Array.isArray(sub.value) ? sub.value.length : null
  const archiveCount = arc.status === 'fulfilled' && Array.isArray(arc.value) ? arc.value.length : null
  let assignmentSummary = null
  if (cs.status === 'fulfilled') {
    const ok = cs.value.filter((r): r is PromiseFulfilledResult<unknown[]> => r.status === 'fulfilled')
    if (ok.length > 0 || sessionsData.length === 0) {
      assignmentSummary = {
        totalAssigned: ok.reduce((n, r) => n + r.value.length, 0),
        sessionsWithSubjects: ok.filter((r) => r.value.length > 0).length,
        checkedSessions: ok.length,
      }
    }
  }
  if (subjectCount === null) reasons.push('le compteur des matières')
  if (assignmentSummary === null) reasons.push('les affectations matières / classes')
  if (archiveCount === null) reasons.push('le compteur des bulletins archivés')
  return {
    steps: [...stepsData].sort((a, b) => a.stepNumber - b.stepNumber),
    sessions: sessionsData,
    totalStudents: sumEnrollmentCounts(perSession),
    extra: { subjectCount, archiveCount, assignmentSummary },
    partialReasons: reasons,
  }
}

/** API simulée qui répond tout de suite, avec des échecs choisis par nom. */
function apiImmediate(n: number, echecs: string[]): DashboardApi<{ id: string }, { stepNumber: number }> {
  const rep = reponseDefaut(n)
  const repondre = <T,>(nom: string) =>
    echecs.includes(nom) ? Promise.reject(new Error(nom)) : Promise.resolve(rep(nom) as T)
  return {
    fetchSteps: (y) => repondre(`steps:${y}`),
    fetchClassSessions: (y) => repondre(`sessions:${y}`),
    fetchSubjects: () => repondre('subjects'),
    fetchArchives: (y) => repondre(`archives:${y}`),
    // s3 a zéro élève : un 0 légitime doit rester 0.
    fetchEnrollmentCount: (s) => (echecs.includes(`count:${s}`) ? Promise.reject(new Error(s)) : Promise.resolve(s === 's3' ? 0 : 10)),
    // s2 n'a aucune matière affectée.
    fetchClassSubjects: (s) => (echecs.includes(`cs:${s}`) ? Promise.reject(new Error(s)) : Promise.resolve(s === 's2' ? [] : [{}, {}])),
  }
}

for (const [cas, n, echecs] of [
  ['nominal, 4 salles', 4, []],
  ['effectif et archives en echec', 4, ['count:s1', 'archives:A']],
  ['toutes les affectations en echec', 3, ['cs:s1', 'cs:s2', 'cs:s3', 'subjects']],
  ['zero salle', 0, []],
] as [string, number, string[]][]) {
  const ancien = await ancienChargement(apiImmediate(n, echecs), 'A')
  const nouveau = await loadDashboardData('A', apiImmediate(n, echecs))
  check(`identique a l ancien : ${cas}`, nouveau, ancien)
}
}

main().then(() => {
  console.log(out.join('\n'))
  console.log(`\n${pass} tests OK, ${fail} echec(s)`)
  if (fail > 0) process.exit(1)
}, (e) => {
  console.error('ECHEC inattendu :', e)
  process.exit(1)
})
