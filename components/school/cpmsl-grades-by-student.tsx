"use client"

// Saisie des notes PAR ÉLÈVE : on choisit une classe/salle, la liste des élèves
// s'affiche, et chaque élève mène à sa page de saisie (toutes matières d'un coup).

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { UserIcon, ClipboardListIcon } from "lucide-react"
import type { ApiClassSession } from "@/lib/api/students"
import type { ApiEnrollment } from "@/lib/api/grades"

interface Props {
  yearId:            string
  sessions:          ApiClassSession[]
  enrollments:       ApiEnrollment[]
  selectedSessionId: string
  loadingSession:    boolean
  onSessionChange:   (sessionId: string) => void
}

export function CPMSLGradesByStudent({
  yearId,
  sessions,
  enrollments,
  selectedSessionId,
  loadingSession,
  onSessionChange,
}: Props) {
  const router = useRouter()

  // ── Classe (niveau) puis Salle (lettre) — sélecteurs en cascade ──────────
  // Le niveau choisi explicitement prime ; sinon on le dérive de la salle déjà
  // sélectionnée (ex. héritée du mode "Par matière"). Pas de setState-in-effect.
  const [classTypeOverride, setClassTypeOverride] = useState<string | null>(null)
  const selectedClassTypeId =
    classTypeOverride ??
    (selectedSessionId
      ? sessions.find(s => s.id === selectedSessionId)?.class.classType.id ?? ""
      : "")

  const classTypes = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    sessions.forEach(s => {
      const ct = s.class.classType
      if (!map.has(ct.id)) map.set(ct.id, { id: ct.id, name: ct.name })
    })
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }))
  }, [sessions])

  const availableSalles = useMemo(() => {
    if (!selectedClassTypeId) return []
    return sessions
      .filter(s => s.class.classType.id === selectedClassTypeId)
      .map(s => ({
        sessionId: s.id,
        label: s.class.track ? `${s.class.letter} — ${s.class.track.code}` : s.class.letter,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr", { numeric: true }))
  }, [sessions, selectedClassTypeId])

  const handleClassTypeChange = (classTypeId: string) => {
    setClassTypeOverride(classTypeId)
    onSessionChange("") // reset la salle : on attend un nouveau choix
  }

  const active = enrollments.filter(e => e.status === "ACTIVE")
  const sortedStudents = [...active].sort((a, b) =>
    `${a.student.user.lastname} ${a.student.user.firstname}`.localeCompare(
      `${b.student.user.lastname} ${b.student.user.firstname}`, "fr",
    ),
  )

  const goToStudent = (enrollmentId: string) =>
    router.push(`/admin/academic-year/${yearId}/grades/${enrollmentId}`)

  return (
    <Card className="border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Saisie par élève</CardTitle>
        <CardDescription>
          Choisissez une classe et une salle, puis saisissez les notes de chaque élève (toutes ses matières d&apos;un coup).
        </CardDescription>
      </CardHeader>

      <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row">
        {/* Classe (niveau) */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Classe</label>
          <Select value={selectedClassTypeId} onValueChange={handleClassTypeChange}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Sélectionner une classe" />
            </SelectTrigger>
            <SelectContent>
              {classTypes.map(ct => (
                <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Salle (lettre) */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Salle</label>
          <Select
            value={selectedSessionId}
            onValueChange={onSessionChange}
            disabled={!selectedClassTypeId}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={selectedClassTypeId ? "Sélectionner une salle" : "Choisir une classe d'abord"} />
            </SelectTrigger>
            <SelectContent>
              {availableSalles.map(s => (
                <SelectItem key={s.sessionId} value={s.sessionId}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <CardContent className="p-0">
        {!selectedClassTypeId ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            Sélectionnez une classe puis une salle pour afficher ses élèves.
          </p>
        ) : !selectedSessionId ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            Sélectionnez une salle pour afficher ses élèves.
          </p>
        ) : loadingSession ? (
          <div className="space-y-2 p-6">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
          </div>
        ) : sortedStudents.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            Aucun élève actif dans cette salle.
          </p>
        ) : (
          <div className="divide-y">
            <div className="flex items-center justify-between px-6 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>{sortedStudents.length} élève{sortedStudents.length > 1 ? "s" : ""}</span>
            </div>
            {sortedStudents.map(enr => (
              <div key={enr.id} className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-muted/40">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-muted text-muted-foreground">
                      <UserIcon className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {enr.student.user.lastname} {enr.student.user.firstname}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="font-mono">{enr.student.studentCode}</span>
                      {enr.student.nisu ? ` · ${enr.student.nisu}` : ""}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => goToStudent(enr.id)}>
                  <ClipboardListIcon className="mr-2 h-4 w-4" />
                  Saisir les notes
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
