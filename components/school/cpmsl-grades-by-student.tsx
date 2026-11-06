"use client"

// Saisie des notes PAR ÉLÈVE : on choisit une classe/salle, la liste des élèves
// s'affiche, et chaque élève mène à sa page de saisie (toutes matières d'un coup).

import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { UserIcon, ClipboardListIcon } from "lucide-react"
import type { ApiClassSession } from "@/lib/api/students"
import type { ApiEnrollment } from "@/lib/api/grades"
import { hasEntrySteps } from "@/lib/departures/presence"
import { LeftBadge } from "@/components/school/left-badge"
import { ClasseSalleSelect } from "@/components/school/classe-salle-select"
import type { SelectionClasseSalle } from "@/lib/classes/selection"

interface Props {
  yearId:            string
  sessions:          ApiClassSession[]
  enrollments:       ApiEnrollment[]
  /** Classe et salle choisies, tenues par la page et partagées avec le mode Par matière. */
  selection:         SelectionClasseSalle
  loadingSession:    boolean
  onSelectionChange: (next: SelectionClasseSalle) => void
}

export function CPMSLGradesByStudent({
  yearId,
  sessions,
  enrollments,
  selection,
  loadingSession,
  onSelectionChange,
}: Props) {
  const router = useRouter()

  // ── Classe puis Salle ────────────────────────────────────────────────────
  // ClasseSalleSelect, sur la sélection tenue par la page (chantier W2). Elle
  // survit au passage Par matière ↔ Par élève, y compris une classe sans
  // salle. Changer de classe n'émet plus de salle vide (défaut 1 de l'audit) :
  // la sélection passe à `sessionId: null`, et la page ne charge rien.
  // Pas de garde ici : ce mode ne porte aucune saisie en cours.
  const classeChoisie = selection.classeId !== null
  const salleChoisie  = selection.sessionId !== null

  // D-22 : actifs, et partis au départ complété (saisie de leurs étapes suivies).
  const active = enrollments.filter(hasEntrySteps)
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

      <div className="grid grid-cols-1 gap-3 border-t px-4 py-3 sm:max-w-md sm:grid-cols-2">
        <ClasseSalleSelect
          sessions={sessions}
          value={selection}
          onChange={onSelectionChange}
          chargement={loadingSession}
        />
      </div>

      <CardContent className="p-0">
        {!classeChoisie ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            Sélectionnez une classe puis une salle pour afficher ses élèves.
          </p>
        ) : !salleChoisie ? (
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
                    <p className="flex items-center gap-1.5 truncate font-medium text-foreground">
                      <span className="truncate">{enr.student.user.lastname} {enr.student.user.firstname}</span>
                      {enr.status === "DROPPED" && <LeftBadge leftAt={enr.leftAt} />}
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
