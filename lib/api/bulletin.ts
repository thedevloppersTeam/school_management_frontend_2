// lib/api/bulletin.ts
// Logique partagée de construction des données bulletin (individuel + lot)

import { fetchClassSubjects, type ApiClassSubject } from "@/lib/api/grades"
import { parseDecimal, formatDate } from "@/lib/decimal"
import type { BulletinData, RubriqueEntry, ComportementItem } from "@/components/BulletinScolaire"

// ── Types internes ────────────────────────────────────────────────────────────

type GradeBucket = { direct: number[]; sections: Map<string, number[]> }
type GradeIndex  = Map<string, GradeBucket>

type RubriqueSet = {
  r1: RubriqueEntry[]; r1Name: string
  r2: RubriqueEntry[]; r2Name: string
  r3: RubriqueEntry[]; r3Name: string
}

// ── Helpers math ──────────────────────────────────────────────────────────────

function avg(arr: number[]): number | null {
  return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null
}

function rubriqueAvg(entries: RubriqueEntry[]): number | null {
  let total = 0, totalCoeff = 0
  for (const e of entries) {
    if (!e.isParent && e.note !== null && e.note !== undefined && e.coeff) {
      total      += e.note * e.coeff
      totalCoeff += e.coeff
    }
  }
  return totalCoeff > 0 ? total / totalCoeff : null
}

function getAppreciation(m: number): string {
  if (m >= 9.0) return 'A+'
  if (m >= 8.5) return 'A'
  if (m >= 7.8) return 'B+'
  if (m >= 7.5) return 'B'
  if (m >= 6.9) return 'C+'
  if (m >= 6.0) return 'C'
  if (m >= 5.1) return 'D'
  return 'E'
}

// ── Helpers fetch ─────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error(`API ${res.status}: ${url}`)
  return res.json()
}

async function safeFetch<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) return fallback
    return res.json()
  } catch {
    return fallback
  }
}

// ── Étape 2 : normalisation behavior / attitudes ───────────────────────────────

function normalizeBehavior(raw: any): any {
  return Array.isArray(raw) ? raw[0] ?? null : raw
}

function normalizeAttitudes(raw: any): any[] {
  return Array.isArray(raw) ? raw : []
}

// ── Étape 3 : indexation des notes ────────────────────────────────────────────
// Extracted to kill the 4-level nesting in the original for-loop.

function addScoreToIndex(index: GradeIndex, grade: any, score: number): void {
  if (!index.has(grade.classSubjectId)) {
    index.set(grade.classSubjectId, { direct: [], sections: new Map() })
  }
  const bucket = index.get(grade.classSubjectId)!
  if (grade.sectionId) {
    if (!bucket.sections.has(grade.sectionId)) bucket.sections.set(grade.sectionId, [])
    bucket.sections.get(grade.sectionId)!.push(score)
  } else {
    bucket.direct.push(score)
  }
}

function buildGradeIndex(allGrades: any[]): GradeIndex {
  const index: GradeIndex = new Map()
  for (const grade of allGrades) {
    const score = parseDecimal(grade.studentScore)
    if (score !== null) addScoreToIndex(index, grade, score)  // +1 for, +1 if
  }
  return index
}

// ── Étape 4 : construction des rubriques ─────────────────────────────────────
// Split into three focused helpers to eliminate nested loops + branching.

function buildSubjectEntries(cs: ApiClassSubject, bucket: GradeBucket | undefined): RubriqueEntry[] {
  const subject = cs.subject
  const coeff = parseDecimal(
  cs.coefficientOverride !== null ? cs.coefficientOverride : subject.coefficient
) ?? 1
  if (!subject.hasSections || subject.sections.length === 0) {  // +1 if
    return [{ name: subject.name, note: avg(bucket?.direct ?? []), coeff, isParent: false }]
  }

  const entries: RubriqueEntry[] = [{ name: subject.name, isParent: true }]
  for (const sec of subject.sections) {                          // +1 for
    const scores = bucket?.sections.get(sec.id) ?? []
    entries.push({
      name:     sec.name,
      note:     avg(scores),
      coeff: parseDecimal(sec.maxScore) !== null && parseDecimal(sec.maxScore)! > 0
      ? coeff / subject.sections.length
      : 1,
      isParent: false,
    })
  }
  return entries
}

function pushToRubrique(set: RubriqueSet, code: string, entries: RubriqueEntry[]): void {
  if (code === 'R1') set.r1.push(...entries)       // +1 if
  else if (code === 'R2') set.r2.push(...entries)  // +1 else-if
  else if (code === 'R3') set.r3.push(...entries)  // +1 else-if
}

function buildRubriques(classSubjects: ApiClassSubject[], gradeIndex: GradeIndex): RubriqueSet {
  const set: RubriqueSet = {
    r1: [], r1Name: 'Rubrique 1',
    r2: [], r2Name: 'Rubrique 2',
    r3: [], r3Name: 'Rubrique 3',
  }

  for (const cs of classSubjects) {                             // +1 for
    const { rubric } = cs.subject
    const code = rubric?.code ?? ''
    const name = rubric?.name ?? ''

    if (code === 'R1' && name) set.r1Name = name               // +1 if
    if (code === 'R2' && name) set.r2Name = name               // +1 if
    if (code === 'R3' && name) set.r3Name = name               // +1 if

    const entries = buildSubjectEntries(cs, gradeIndex.get(cs.id))
    pushToRubrique(set, code, entries)
  }
  return set
}

// ── Étape 6 : bloc comportement ───────────────────────────────────────────────

function resolveAttitudeOui(behavior: any, attitudeId: string): boolean | null {
  const response = behavior?.attitudeResponses?.find((r: any) => r.attitudeId === attitudeId)
  return response != null ? response.value : null
}

function buildComportementItems(attitudes: any[], behavior: any): ComportementItem[] {
  return attitudes.map((att: any, i: number) => ({  // +1 map (implicit for)
    label: att.label,
    oui:   resolveAttitudeOui(behavior, att.id),
    col:   ((i % 3) + 1) as 1 | 2 | 3,
  }))
}

function buildComportement(behavior: any, attitudes: any[]) {
  return {
    absences:        behavior?.absences       != null ? String(behavior.absences)       : '—',
    retards:         behavior?.retards         != null ? String(behavior.retards)         : '—',
    devoirsNonRemis: behavior?.devoirsManques  != null ? String(behavior.devoirsManques)  : '—',
    leconsNonSues:   '—',
    items:           buildComportementItems(attitudes, behavior),
    pointsForts:     behavior?.pointsForts ?? '',
    defis:           behavior?.defis        ?? '',
    remarque:        behavior?.remarque     ?? '',
  }
}

// ── Fonction principale ───────────────────────────────────────────────────────
// Cognitive complexity is now ≤ 5 : only the Promise.all orchestration remains.

export async function buildBulletinData(params: {
  enrollmentId:   string
  studentId:      string
  classSessionId: string
  stepId:         string
  stepName:       string
  className:      string
  yearId:         string
}): Promise<BulletinData> {
  const { enrollmentId, studentId, classSessionId, stepId, stepName, className, yearId } = params

  // 1. Fetch all data in parallel
  const [student, classSubjects, allGrades, behaviorRaw, attitudesRaw] = await Promise.all([
    apiFetch<any>(`/api/students/${studentId}`),
    fetchClassSubjects(classSessionId),
    apiFetch<any[]>(`/api/grades/enrollment/${enrollmentId}?stepId=${stepId}`),
    safeFetch<any>(`/api/behaviors?enrollmentId=${enrollmentId}&stepId=${stepId}`, null),
    safeFetch<any[]>(`/api/attitudes?academicYearId=${yearId}`, []),
  ])

  // 2. Normalize
  const behavior  = normalizeBehavior(behaviorRaw)
  const attitudes = normalizeAttitudes(attitudesRaw)

  // 3. Build grade index
  const gradeIndex = buildGradeIndex(allGrades)

  // 4. Build rubriques
  const { r1, r1Name, r2, r2Name, r3, r3Name } = buildRubriques(classSubjects, gradeIndex)

  // 5. Compute averages (BR-001 weights)
  const moyR1    = rubriqueAvg(r1)
  const moyR2    = rubriqueAvg(r2)
  const moyR3    = rubriqueAvg(r3)
  const finalAvg = ((moyR1 ?? 0) * 0.70) + ((moyR2 ?? 0) * 0.25) + ((moyR3 ?? 0) * 0.05)

  // 6. Build comportement block
  const comportement = buildComportement(behavior, attitudes)

  return {
    prenoms:       student?.user?.firstname ?? '',
    nom:           student?.user?.lastname  ?? '',
    sexe:          student?.user?.gender    ?? '—',
    niveau:        className,
    filiere:       student?.filiere         ?? '—',
    dateNaissance: formatDate(student?.user?.birth_date ?? student?.user?.birthDate ?? ''),
    anneeScolaire: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    periode:       stepName,
    code:          student?.studentCode ?? '',
    nisu:          student?.nisu        ?? '',
    photoUrl:      student?.user?.profilePhoto ?? undefined,

    rubrique1Name:  r1Name,
    rubrique1Poids: '70%',
    rubrique1:      r1,
    moyR1,

    rubrique2Name:  r2Name,
    rubrique2Poids: '25%',
    rubrique2:      r2,
    moyR2,

    rubrique3Name:  r3Name,
    rubrique3Poids: '5%',
    rubrique3:      r3,
    moyR3,

    moyenneEtape:  finalAvg.toFixed(2),
    appreciation:  getAppreciation(finalAvg),
    moyenneClasse: '—',

    comportement,

    etablissement: {
      nomLigne1: 'Cours Privé Mixte',
      nomLigne2: 'SAINT LÉONARD',
      adresse:   'Delmas, Angle 47 & 41 #10',
      telephone: '2813-1205 / 2264-2081 / 4893-3367',
      email:     'information@stleonard.ht',
      logoUrl:   '/test.jpeg',
    },
  }
}