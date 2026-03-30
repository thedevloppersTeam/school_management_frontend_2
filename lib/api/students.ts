export interface ApiClassSession {
  id: string
  class: {
    id: string
    letter: string
    classType: { id: string; name: string; isTerminal: boolean }
    track?: { id: string; name: string; code: string } | null
  }
  academicYear: { id: string; name: string }
  displayName?: string
}
