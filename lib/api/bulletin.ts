// lib/api/bulletin.ts
// Logique partagée de construction des données bulletin (individuel + lot)

import { fetchClassSubjects, type ApiClassSubject } from "@/lib/api/grades"
import { parseDecimal, formatDate } from "@/lib/decimal"
import type { BulletinData, RubriqueEntry, ComportementItem } from "@/components/BulletinScolaire"

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const DEFAULT_COMPORTEMENT_ITEMS: ComportementItem[] = [
  { label: "Manque d'attention",   oui: null, col: 1 },
  { label: "Manque de respect",    oui: null, col: 1 },
  { label: "Indiscipline",         oui: null, col: 1 },
  { label: "Bavardage",            oui: null, col: 2 },
  { label: "Agressivité",          oui: null, col: 2 },
  { label: "Tricherie",            oui: null, col: 2 },
  { label: "Respect uniforme",     oui: null, col: 3 },
  { label: "Discipline générale",  oui: null, col: 3 },
  { label: "Participation active", oui: null, col: 3 },
]

// ── Fonction principale ───────────────────────────────────────────────────────

export async function buildBulletinData(params: {
  enrollmentId:   string
  studentId:      string
  classSessionId: string
  stepId:         string
  stepName:       string
  className:      string
  yearId:         string   // ← nécessaire pour charger les attitudes
}): Promise<BulletinData> {
  const { enrollmentId, studentId, classSessionId, stepId, stepName, className, yearId } = params

  // 1. Données en parallèle
  const [student, classSubjects, allGrades, behaviorRaw, attitudesRaw] = await Promise.all([
    apiFetch<any>(`/api/students/${studentId}`),
    fetchClassSubjects(classSessionId),
    apiFetch<any[]>(`/api/grades/enrollment/${enrollmentId}?stepId=${stepId}`),
    // Behavior de l'élève pour cette étape — peut être null ou tableau vide
    safeFetch<any>(`/api/behaviors?enrollmentId=${enrollmentId}&stepId=${stepId}`, null),
    // Attitudes configurées pour l'année
    safeFetch<any[]>(`/api/attitudes?academicYearId=${yearId}`, []),
  ])

  // 2. Extraire le behavior (l'API retourne un objet ou un tableau d'un élément)
  const behavior = Array.isArray(behaviorRaw) ? behaviorRaw[0] ?? null : behaviorRaw
  const attitudes: any[] = Array.isArray(attitudesRaw) ? attitudesRaw : []

  // 3. Index notes
  const gradeIndex = new Map<string, { direct: number[]; sections: Map<string, number[]> }>()
  for (const grade of allGrades) {
    const score = parseDecimal(grade.studentScore)
    if (score === null) continue
    if (!gradeIndex.has(grade.classSubjectId))
      gradeIndex.set(grade.classSubjectId, { direct: [], sections: new Map() })
    const bucket = gradeIndex.get(grade.classSubjectId)!
    if (grade.sectionId) {
      if (!bucket.sections.has(grade.sectionId)) bucket.sections.set(grade.sectionId, [])
      bucket.sections.get(grade.sectionId)!.push(score)
    } else {
      bucket.direct.push(score)
    }
  }

  // 4. Construction rubriques
  const r1: RubriqueEntry[] = []
  const r2: RubriqueEntry[] = []
  const r3: RubriqueEntry[] = []
  let r1Name = 'Rubrique 1', r2Name = 'Rubrique 2', r3Name = 'Rubrique 3'

  for (const cs of classSubjects) {
    const subject    = cs.subject
    const rubricCode = subject.rubric?.code ?? ''
    const rubricName = subject.rubric?.name ?? ''
    const coeff      = cs.coefficientOverride !== null ? cs.coefficientOverride : subject.coefficient
    const bucket     = gradeIndex.get(cs.id)
    const entries: RubriqueEntry[] = []

    if (rubricCode === 'R1' && rubricName) r1Name = rubricName
    if (rubricCode === 'R2' && rubricName) r2Name = rubricName
    if (rubricCode === 'R3' && rubricName) r3Name = rubricName

    if (subject.hasSections && subject.sections.length > 0) {
      entries.push({ name: subject.name, isParent: true })
      for (const sec of subject.sections) {
        const scores = bucket?.sections.get(sec.id) ?? []
        entries.push({
          name:     sec.name,
          note:     avg(scores),
          coeff:    Number(sec.maxScore) > 0 ? coeff / subject.sections.length : 1,
          isParent: false,
        })
      }
    } else {
      entries.push({ name: subject.name, note: avg(bucket?.direct ?? []), coeff, isParent: false })
    }

    if (rubricCode === 'R1') r1.push(...entries)
    else if (rubricCode === 'R2') r2.push(...entries)
    else if (rubricCode === 'R3') r3.push(...entries)
  }

  // 5. Moyennes BR-001
  const moyR1    = rubriqueAvg(r1)
  const moyR2    = rubriqueAvg(r2)
  const moyR3    = rubriqueAvg(r3)
  const finalAvg = ((moyR1 ?? 0) * 0.70) + ((moyR2 ?? 0) * 0.25) + ((moyR3 ?? 0) * 0.05)

  // 6. Construction bloc comportement
  //
  // Attitudes → ComportementItem[] répartis en 3 colonnes (col 1, 2, 3)
  // Si aucune attitude configurée → fallback sur DEFAULT_COMPORTEMENT_ITEMS
  let comportementItems: ComportementItem[]

  if (attitudes.length > 0) {
    comportementItems = attitudes.map((att: any, i: number) => {
      const response = behavior?.attitudeResponses?.find((r: any) => r.attitudeId === att.id)
      return {
        label: att.label,
        oui:   response != null ? response.value : null,
        col:   ((i % 3) + 1) as 1 | 2 | 3,
      }
    })
  } else {
    comportementItems = DEFAULT_COMPORTEMENT_ITEMS
  }

  const comportement = {
    absences:        behavior?.absences        != null ? String(behavior.absences)        : '—',
    retards:         behavior?.retards          != null ? String(behavior.retards)          : '—',
    devoirsNonRemis: behavior?.devoirsManques   != null ? String(behavior.devoirsManques)   : '—',
    leconsNonSues:   '—',   // non exposé par l'API actuelle
    items:           comportementItems,
    pointsForts:     behavior?.pointsForts  ?? '',
    defis:           behavior?.defis         ?? '',
    remarque:        behavior?.remarque      ?? '',
  }

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