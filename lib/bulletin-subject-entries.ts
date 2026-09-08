export type BulletinSubjectSection = {
  id: string
  name: string
  maxScore: unknown
}

export type BulletinSubject = {
  name: string
  maxScore: unknown
  hasSections: boolean
  sections: BulletinSubjectSection[]
}

export type BulletinGradeBucket = {
  direct: number[]
  sections: Map<string, number[]>
}

export type BulletinRubriqueEntry = {
  name: string
  note?: number | null
  coeff?: number
  isParent: boolean
  warning?: string
}

export function decimalToNumber(raw: unknown, fallback = 0): number {
  if (raw == null) return fallback
  if (typeof raw === 'object' && 'd' in raw) {
    const digits = (raw as { d?: unknown }).d
    if (Array.isArray(digits) && digits.length > 0) return Number(digits[0])
  }
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

function avg(arr: number[]): number | null {
  return arr.length > 0 ? arr.reduce((sum, value) => sum + value, 0) / arr.length : null
}

function sumSectionMaxScores(sections: BulletinSubjectSection[]): number {
  return sections.reduce((sum, section) => sum + decimalToNumber(section.maxScore, 0), 0)
}

function maxScoreWarning(subjectMax: number, sectionsMax: number): string | undefined {
  if (subjectMax <= 0 || sectionsMax <= 0 || subjectMax === sectionsMax) return undefined
  return `Bareme a verifier : matiere /${subjectMax}, sections /${sectionsMax}`
}

export function appendWarning(current: string | undefined, next: string): string {
  return current ? `${current} - ${next}` : next
}

export function buildSubjectEntries(
  subject: BulletinSubject,
  bucket: BulletinGradeBucket | undefined,
): BulletinRubriqueEntry[] {
  const subjectMax = decimalToNumber(subject.maxScore, 0)

  if (!subject.hasSections || subject.sections.length === 0) {
    const note = avg(bucket?.direct ?? [])
    return [{ name: subject.name, note, coeff: note !== null ? subjectMax : undefined, isParent: false }]
  }

  const sectionsMax = sumSectionMaxScores(subject.sections)
  const warning = maxScoreWarning(subjectMax, sectionsMax)
  const entries: BulletinRubriqueEntry[] = [{ name: subject.name, isParent: true, warning }]
  const hasAnySectionGrade = Array.from(bucket?.sections.values() ?? []).some((scores) => scores.length > 0)
  const directNote = avg(bucket?.direct ?? [])

  if (!hasAnySectionGrade && directNote !== null) {
    entries.push({
      name: 'Note globale',
      note: directNote,
      coeff: subjectMax > 0 ? subjectMax : undefined,
      isParent: false,
    })
  }

  for (const section of subject.sections) {
    const scores = bucket?.sections.get(section.id) ?? []
    const maxScore = decimalToNumber(section.maxScore, 0)
    const note = avg(scores)
    entries.push({
      name: section.name,
      note,
      coeff: note !== null ? maxScore : undefined,
      isParent: false,
    })
  }

  return entries
}

