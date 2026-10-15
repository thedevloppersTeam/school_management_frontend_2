/**
 * Chargement du tableau de bord : l'orchestration des appels.
 *
 * Module PUR, sans React ni DOM : les appels sont injectés (`DashboardApi`),
 * ce qui permet de tester l'ordre, la concurrence et l'annulation avec des
 * promesses contrôlées.
 *
 * ── GRAPHE DE DÉPENDANCES ───────────────────────────────────────────────────
 *   année ─┬─ étapes ──────────────┐
 *          ├─ salles ─┬─ N effectifs ┤
 *          │          └─ N affectations ┤──► résultat
 *          ├─ matières ──────────────┤
 *          └─ archives ──────────────┘
 * Seuls les effectifs et les affectations attendent : ils ont besoin des
 * identifiants de salle. Tout le reste part dès que l'année est connue.
 * L'ancien enchaînement (page.tsx) attendait trois vagues successives, dont
 * deux sans raison, et lançait N + 2 appels à la fois.
 *
 * ── CONCURRENCE ─────────────────────────────────────────────────────────────
 * Tous les appels passent par un pool : au plus `maxInFlight` (6) en vol, quel
 * que soit le nombre de salles. File d'attente FIFO : les effectifs passent
 * avant les affectations, comme dans l'ancien ordre.
 *
 * ── RÈGLES CONSERVÉES ───────────────────────────────────────────────────────
 *  - Étapes ou salles en échec : le chargement échoue (la page passe en erreur).
 *  - Tout autre appel en échec : la donnée vaut `null`, JAMAIS 0, et une raison
 *    est ajoutée au bandeau « Données partielles », dans l'ordre d'origine.
 *  - Le total d'élèves passe par `sumEnrollmentCounts` (lot 1) : un comptage
 *    manquant le rend `null`.
 *  - Le résultat est identique à l'ancien pour un même jeu de réponses (testé).
 *
 * ── ANNULATION ──────────────────────────────────────────────────────────────
 * `signal` annulé : plus aucun appel n'est lancé, la promesse est rejetée par
 * une `AbortError`, et aucun résultat de l'ancienne année n'est rendu. Les
 * appels déjà en vol ne sont pas interrompus (le client HTTP n'accepte pas de
 * signal ici) : leur réponse est simplement ignorée.
 */
import { sumEnrollmentCounts, toEnrollmentCount } from './students-total'

export const MAX_IN_FLIGHT = 6

export interface AssignmentSummary {
  totalAssigned: number
  sessionsWithSubjects: number
  checkedSessions: number
}

export interface DashboardExtraData {
  subjectCount: number | null
  assignmentSummary: AssignmentSummary | null
  archiveCount: number | null
}

export interface DashboardApi<S extends { id: string }, St extends { stepNumber: number }> {
  fetchSteps(academicYearId: string): Promise<St[]>
  fetchClassSessions(academicYearId: string): Promise<S[]>
  fetchSubjects(): Promise<unknown>
  fetchArchives(academicYearId: string): Promise<unknown>
  fetchEnrollmentCount(classSessionId: string): Promise<unknown>
  fetchClassSubjects(classSessionId: string): Promise<unknown[]>
}

export interface DashboardLoadResult<S, St> {
  steps: St[]
  sessions: S[]
  totalStudents: number | null
  extra: DashboardExtraData
  partialReasons: string[]
}

export interface LoadOptions {
  /** Appels en vol au plus. Défaut : 6. */
  maxInFlight?: number
  /** Annulé au changement d'année ou au démontage. */
  signal?: AbortSignal
}

function abortError(): Error {
  const e = new Error('Chargement du tableau de bord annulé.')
  e.name = 'AbortError'
  return e
}

/** Pool FIFO : au plus `limit` tâches en cours ; plus rien ne part une fois annulé. */
function createPool(limit: number, signal?: AbortSignal) {
  let active = 0
  let cancelled = false
  const queue: { task: () => Promise<unknown>; resolve: (v: unknown) => void; reject: (e: unknown) => void }[] = []

  const stopped = () => cancelled || signal?.aborted === true

  const pump = () => {
    if (stopped()) {
      for (const job of queue.splice(0)) job.reject(abortError())
      return
    }
    while (active < limit && queue.length > 0) {
      const job = queue.shift()!
      active++
      Promise.resolve()
        .then(job.task)
        .then(job.resolve, job.reject)
        .finally(() => {
          active--
          pump()
        })
    }
  }

  signal?.addEventListener('abort', pump)

  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        queue.push({ task, resolve: resolve as (v: unknown) => void, reject })
        pump()
      })
    },
    cancel() {
      cancelled = true
      pump()
    },
    dispose() {
      signal?.removeEventListener('abort', pump)
    },
  }
}

type Settled<T> = { ok: true; value: T } | { ok: false }
const settle = <T>(p: Promise<T>): Promise<Settled<T>> =>
  p.then((value) => ({ ok: true as const, value }), () => ({ ok: false as const }))

export async function loadDashboardData<S extends { id: string }, St extends { stepNumber: number }>(
  academicYearId: string,
  api: DashboardApi<S, St>,
  options: LoadOptions = {},
): Promise<DashboardLoadResult<S, St>> {
  const { signal } = options
  if (signal?.aborted) throw abortError()
  const pool = createPool(options.maxInFlight ?? MAX_IN_FLIGHT, signal)

  try {
    // ── Vague 1 : tout ce qui ne dépend que de l'année ──────────────────────
    const stepsP = pool.run(() => api.fetchSteps(academicYearId))
    const sessionsP = pool.run(() => api.fetchClassSessions(academicYearId))
    const subjectsP = settle(pool.run(() => api.fetchSubjects()))
    const archivesP = settle(pool.run(() => api.fetchArchives(academicYearId)))

    // Étapes ou salles en échec = chargement en échec, comme avant. On cesse
    // alors de lancer quoi que ce soit.
    const essentials = Promise.all([stepsP, sessionsP])
    essentials.catch(() => pool.cancel())

    // ── Vague 2 : dès les salles, sans attendre les étapes ──────────────────
    const sessions = await sessionsP
    const countsP = sessions.map((s) => settle(pool.run(() => api.fetchEnrollmentCount(s.id))))
    const assignmentsP = sessions.map((s) => settle(pool.run(() => api.fetchClassSubjects(s.id))))

    const [stepsData] = await essentials
    const [counts, assignments, subjects, archives] = await Promise.all([
      Promise.all(countsP),
      Promise.all(assignmentsP),
      subjectsP,
      archivesP,
    ])
    // Une réponse arrivée après l'annulation n'est jamais rendue.
    if (signal?.aborted) throw abortError()

    // ── Calculs : identiques à l'ancien page.tsx ────────────────────────────
    const perSession = counts.map((c) => (c.ok ? toEnrollmentCount(c.value) : null))
    const reasons: string[] = []
    const missing = perSession.filter((c) => c === null).length
    if (missing > 0) reasons.push(`les effectifs de ${missing} classe(s)`)

    const subjectCount = subjects.ok && Array.isArray(subjects.value) ? subjects.value.length : null
    const archiveCount = archives.ok && Array.isArray(archives.value) ? archives.value.length : null

    let assignmentSummary: AssignmentSummary | null = null
    const fulfilled = assignments.flatMap((a) => (a.ok ? [a.value] : []))
    if (fulfilled.length > 0 || sessions.length === 0) {
      assignmentSummary = {
        totalAssigned: fulfilled.reduce((n, rows) => n + rows.length, 0),
        sessionsWithSubjects: fulfilled.filter((rows) => rows.length > 0).length,
        checkedSessions: fulfilled.length,
      }
    }

    if (subjectCount === null) reasons.push('le compteur des matières')
    if (assignmentSummary === null) reasons.push('les affectations matières / classes')
    if (archiveCount === null) reasons.push('le compteur des bulletins archivés')

    return {
      steps: [...stepsData].sort((a, b) => a.stepNumber - b.stepNumber),
      sessions,
      totalStudents: sumEnrollmentCounts(perSession),
      extra: { subjectCount, archiveCount, assignmentSummary },
      partialReasons: reasons,
    }
  } catch (err) {
    if (signal?.aborted) throw abortError()
    throw err
  } finally {
    pool.dispose()
  }
}
