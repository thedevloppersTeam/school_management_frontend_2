"use client"

// Départs à compléter (SPEC-RESULTATS v0.3 RS-12, D-20) : inscriptions DROPPED
// ou TRANSFERRED de l'année sans dernière étape suivie. Tant qu'un départ n'est
// pas complété, l'élève n'entre dans AUCUNE moyenne de classe et sa moyenne
// générale n'est pas bornée (il garde ses résultats individuels, D-17).
//
// « Compléter » (POST /api/enrollments/:id/departure/complete) : date, dernière
// étape suivie, motif, commentaire, confirmation ; statut → DROPPED. Complété,
// l'élève entre dans les moyennes de classe de sa salle pour les étapes suivies
// (RS-10) : la colonne « Notes » et la confirmation le rendent visible.

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CheckCircle2Icon, InfoIcon } from "lucide-react"
import { clientFetch } from "@/lib/client-fetch"
import { toMessage } from "@/lib/errors"
import type { AcademicYear } from "@/lib/api/dashboard"
import { DeclareDepartureModal } from "@/components/school/departure-modals"

interface IncompleteDeparture {
  enrollmentId: string
  studentId: string
  status: "DROPPED" | "TRANSFERRED"
  leftAt: string | null
  studentCode: string | null
  firstname: string | null
  lastname: string | null
  className: string
  yearString: string
  completable: boolean
  gradeCount: number
}

export default function IncompleteDeparturesPage() {
  const params = useParams()
  const yearId = params.yearId as string
  const [year, setYear] = useState<AcademicYear | null>(null)
  const [rows, setRows] = useState<IncompleteDeparture[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completing, setCompleting] = useState<IncompleteDeparture | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [y, data] = await Promise.all([
        clientFetch<AcademicYear>(`/api/academic-years/${yearId}`).catch(() => null),
        clientFetch<{ count: number; departures: IncompleteDeparture[] }>(
          `/api/enrollments/departures/incomplete?academicYearId=${encodeURIComponent(yearId)}`,
        ),
      ])
      setYear(y)
      setRows(data.departures)
    } catch (err) {
      setError(toMessage(err, "lors du chargement des départs à compléter"))
    } finally {
      setLoading(false)
    }
  }, [yearId])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  const fullName = (r: IncompleteDeparture) => `${r.firstname ?? ""} ${r.lastname ?? ""}`.trim() || "Élève"

  return (
    <div className="space-y-8">
      <div>
        <h1 className="heading-1 text-foreground">Départs à compléter</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Élèves partis sans dernière étape suivie
          {year && (
            <>
              {" "}&middot;{" "}
              <Badge variant="secondary" className="ml-1 align-middle">
                {year.name}
              </Badge>
            </>
          )}
        </p>
      </div>

      <div className="flex gap-3 rounded-lg border border-info-border bg-info-soft px-4 py-3 text-sm text-info-ink">
        <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="max-w-prose">
          Tant que sa dernière étape suivie n&apos;est pas renseignée, un élève parti n&apos;entre dans
          aucune moyenne de classe, et sa moyenne générale compte encore les étapes qui ont suivi son
          départ. « Compléter » renseigne la date, la dernière étape suivie et le motif ; l&apos;élève
          compte alors dans les moyennes de classe de sa salle pour les étapes qu&apos;il a suivies.
        </p>
      </div>

      <Card className="border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>Départs à compléter</CardTitle>
          <CardDescription>
            Inscriptions « Désactivé » ou « Transféré » sans dernière étape suivie.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 px-6 pb-6">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : error ? (
            <p className="px-6 pb-6 text-sm text-destructive">{error}</p>
          ) : rows.length === 0 ? (
            <div className="flex items-center gap-2 px-6 pb-6 text-sm text-muted-foreground">
              <CheckCircle2Icon className="h-4 w-4 text-success" />
              Aucun départ à compléter pour cette année.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-6 font-semibold">Code</TableHead>
                  <TableHead className="font-semibold">Nom</TableHead>
                  <TableHead className="font-semibold">Classe</TableHead>
                  <TableHead className="font-semibold">Statut</TableHead>
                  <TableHead className="font-semibold">Notes</TableHead>
                  <TableHead className="pr-6 text-right font-semibold">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.enrollmentId}>
                    <TableCell className="pl-6">
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                        {r.studentCode || "—"}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{r.lastname || "—"}</span>
                        <span className="text-xs text-muted-foreground">{r.firstname}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground">{r.className}</TableCell>
                    <TableCell>
                      {r.status === "DROPPED" ? (
                        <Badge variant="secondary">Désactivé</Badge>
                      ) : (
                        <Badge className="border-info-border bg-info-soft text-info-ink hover:bg-info-soft">Transféré</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.gradeCount === 0 ? (
                        <span className="text-xs font-medium text-warning-ink">Aucune note</span>
                      ) : (
                        <span className="tabular-nums text-foreground">{r.gradeCount}</span>
                      )}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      {r.completable && (
                        <Button size="sm" variant="outline" onClick={() => setCompleting(r)} disabled={!year}>
                          Compléter
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div>
        <Button asChild variant="outline">
          <Link href={`/admin/academic-year/${yearId}/students`}>Aller à l&apos;écran Élèves</Link>
        </Button>
      </div>

      {completing && (
        <DeclareDepartureModal
          mode="complete"
          open={!!completing}
          onOpenChange={(open) => !open && setCompleting(null)}
          enrollmentId={completing.enrollmentId}
          studentName={fullName(completing)}
          steps={year?.steps ?? []}
          year={year}
          gradeCount={completing.gradeCount}
          onDone={load}
        />
      )}
    </div>
  )
}
