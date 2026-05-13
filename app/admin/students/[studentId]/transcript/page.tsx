"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  ArrowLeftIcon,
  CalendarIcon,
  GraduationCapIcon,
  MailIcon,
  PhoneIcon,
  UserIcon,
  PrinterIcon,
} from "lucide-react"
import { clientFetch as apiFetch } from "@/lib/client-fetch"
import { parseDecimal } from "@/lib/decimal"
import { toMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface StudentDetail {
  id: string
  studentCode: string
  nisu: string
  address?: string
  motherName?: string
  fatherName?: string
  phone1?: string
  phone2?: string
  parentsEmail?: string
  registrationDate?: string
  user: {
    id: string
    firstname: string
    lastname: string
    birthDate?: string
    profilePhoto?: string | null
    email?: string | null
  }
}

interface ApiEnrollment {
  id: string
  studentId: string
  classSessionId: string
  status: "ACTIVE" | "TRANSFERRED" | "DROPPED" | "GRADUATED"
  enrollmentDate: string
  notes?: string | null
  track?: { id: string; name: string; code: string } | null
  classSession: {
    id: string
    class: {
      id: string
      letter: string
      classType: { id: string; name: string }
    }
    academicYear: {
      id: string
      name: string
      yearString: string
      startDate: string
      endDate: string
      isCurrent: boolean
    }
  }
}

interface ApiGrade {
  id: string
  classSubjectId: string
  sectionId: string | null
  stepId: string
  studentScore: unknown
  gradeType: string
  comment: string | null
  gradedAt: string
  classSubject: {
    id: string
    coefficientOverride: unknown
    subject: {
      id: string
      name: string
      code: string
      maxScore: unknown
      coefficient: unknown
      hasSections: boolean
      sections: Array<{ id: string; name: string; code: string; maxScore: unknown }>
    }
  }
  section: { id: string; name: string; code: string; maxScore: unknown } | null
  step: { id: string; name: string; stepNumber: number }
}

interface SubjectTotals {
  subjectId: string
  subjectName: string
  subjectCode: string
  maxScore: number
  coefficient: number
  perStep: Map<string, { raw: number; max: number }>
}

interface StepSummary {
  stepId: string
  stepName: string
  stepNumber: number
  average: number | null
}

interface EnrollmentSummary {
  enrollment: ApiEnrollment
  grades: ApiGrade[]
  subjects: SubjectTotals[]
  steps: StepSummary[]
  generalAverage: number | null
}

function statusBadge(status: ApiEnrollment["status"]) {
  switch (status) {
    case "ACTIVE":
      return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Actif</Badge>
    case "DROPPED":
      return <Badge variant="secondary">Désactivé</Badge>
    case "TRANSFERRED":
      return <Badge className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">Transféré</Badge>
    case "GRADUATED":
      return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Diplômé</Badge>
  }
}

function classDisplayName(e: ApiEnrollment): string {
  const trackSuffix = e.track ? ` — ${e.track.code}` : ""
  return `${e.classSession.class.classType.name} ${e.classSession.class.letter}${trackSuffix}`
}

function buildEnrollmentSummary(enrollment: ApiEnrollment, grades: ApiGrade[]): EnrollmentSummary {
  const subjectsMap = new Map<string, SubjectTotals>()
  const stepsMap = new Map<string, { stepName: string; stepNumber: number }>()

  for (const g of grades) {
    stepsMap.set(g.step.id, { stepName: g.step.name, stepNumber: g.step.stepNumber })

    const subjectId = g.classSubject.subject.id
    if (!subjectsMap.has(subjectId)) {
      const subjMax = parseDecimal(g.classSubject.subject.maxScore) ?? 0
      const override = parseDecimal(g.classSubject.coefficientOverride)
      const baseCoef = parseDecimal(g.classSubject.subject.coefficient) ?? 1
      subjectsMap.set(subjectId, {
        subjectId,
        subjectName: g.classSubject.subject.name,
        subjectCode: g.classSubject.subject.code,
        maxScore: subjMax,
        coefficient: override ?? baseCoef,
        perStep: new Map(),
      })
    }
    const entry = subjectsMap.get(subjectId)!

    const prev = entry.perStep.get(g.step.id) ?? { raw: 0, max: 0 }
    const score = parseDecimal(g.studentScore) ?? 0

    if (g.sectionId && g.section) {
      const secMax = parseDecimal(g.section.maxScore) ?? 0
      entry.perStep.set(g.step.id, { raw: prev.raw + score, max: prev.max + secMax })
    } else {
      entry.perStep.set(g.step.id, { raw: score, max: entry.maxScore })
    }
  }

  const steps: StepSummary[] = Array.from(stepsMap.entries())
    .map(([stepId, info]) => {
      let weightedSum = 0
      let totalCoef = 0
      for (const subj of subjectsMap.values()) {
        const stepEntry = subj.perStep.get(stepId)
        if (!stepEntry || stepEntry.max <= 0) continue
        const normalized = (stepEntry.raw / stepEntry.max) * 100
        weightedSum += normalized * subj.coefficient
        totalCoef += subj.coefficient
      }
      return {
        stepId,
        stepName: info.stepName,
        stepNumber: info.stepNumber,
        average: totalCoef > 0 ? weightedSum / totalCoef : null,
      }
    })
    .sort((a, b) => a.stepNumber - b.stepNumber)

  const validStepAvgs = steps.filter((s): s is StepSummary & { average: number } => s.average !== null)
  const generalAverage = validStepAvgs.length > 0
    ? validStepAvgs.reduce((sum, s) => sum + s.average, 0) / validStepAvgs.length
    : null

  return {
    enrollment,
    grades,
    subjects: Array.from(subjectsMap.values()).sort((a, b) => a.subjectName.localeCompare(b.subjectName)),
    steps,
    generalAverage,
  }
}

function averageColor(avg: number | null): string {
  if (avg == null) return "text-muted-foreground"
  if (avg >= 70) return "text-emerald-700"
  if (avg >= 50) return "text-amber-700"
  return "text-destructive"
}

function formatDate(value?: string): string {
  if (!value) return "—"
  const d = new Date(value)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StudentTranscriptPage() {
  const params = useParams()
  const studentId = params.studentId as string
  const { toast } = useToast()

  const [student, setStudent] = useState<StudentDetail | null>(null)
  const [summaries, setSummaries] = useState<EnrollmentSummary[]>([])
  const [photosByYear, setPhotosByYear] = useState<Map<string, string>>(new Map())
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setNotFound(false)
    try {
      const studentData = await apiFetch<StudentDetail>(`/api/students/${studentId}`)
      setStudent(studentData)

      const [enrollments, photos] = await Promise.all([
        apiFetch<ApiEnrollment[]>(`/api/enrollments?studentId=${studentId}`),
        apiFetch<Array<{ academicYearId: string; photoUrl: string }>>(
          `/api/promotion-photos?studentId=${studentId}`
        ).catch(() => [] as Array<{ academicYearId: string; photoUrl: string }>),
      ])

      setPhotosByYear(new Map(photos.map((p) => [p.academicYearId, p.photoUrl])))

      const gradesPerEnrollment = await Promise.all(
        enrollments.map(async (e) => {
          try {
            const grades = await apiFetch<ApiGrade[]>(`/api/grades/enrollment/${e.id}`)
            return { enrollment: e, grades }
          } catch {
            return { enrollment: e, grades: [] as ApiGrade[] }
          }
        })
      )

      const built = gradesPerEnrollment.map(({ enrollment, grades }) =>
        buildEnrollmentSummary(enrollment, grades)
      )

      built.sort((a, b) =>
        b.enrollment.classSession.academicYear.yearString.localeCompare(
          a.enrollment.classSession.academicYear.yearString
        )
      )

      setSummaries(built)
      setExpandedItems(built.map((s) => s.enrollment.id))
    } catch (err) {
      if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 404) {
        setNotFound(true)
      } else {
        toast({
          title: "Erreur",
          description: toMessage(err, "lors du chargement du relevé de notes"),
          variant: "destructive",
        })
      }
    } finally {
      setLoading(false)
    }
  }, [studentId, toast])

  useEffect(() => {
    load()
  }, [load])

  const overall = useMemo(() => {
    const valid = summaries.filter((s) => s.generalAverage !== null) as Array<
      EnrollmentSummary & { generalAverage: number }
    >
    if (valid.length === 0) return null
    return valid.reduce((sum, s) => sum + s.generalAverage, 0) / valid.length
  }, [summaries])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }

  if (notFound || !student) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/students"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Élèves
        </Link>
        <Card className="border-destructive/40">
          <CardContent className="py-12 text-center text-sm text-destructive">
            Élève introuvable.
          </CardContent>
        </Card>
      </div>
    )
  }

  const fullName = `${student.user.firstname} ${student.user.lastname}`.trim()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/admin/students"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Élèves
        </Link>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <PrinterIcon className="mr-2 h-4 w-4" />
          Imprimer
        </Button>
      </div>

      {/* Profile card */}
      <Card>
        <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start">
          <Avatar className="h-24 w-24 shrink-0">
            <AvatarImage src={student.user.profilePhoto ?? undefined} />
            <AvatarFallback className="bg-muted text-muted-foreground">
              <UserIcon className="h-10 w-10" />
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{fullName}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{student.studentCode}</code>
                {student.nisu && (
                  <>
                    <span>&middot;</span>
                    <span className="tabular-nums">NISU {student.nisu}</span>
                  </>
                )}
                {student.user.birthDate && (
                  <>
                    <span>&middot;</span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {formatDate(student.user.birthDate)}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              {(student.motherName || student.fatherName) && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Parents</p>
                  <p className="text-foreground">
                    {[student.motherName, student.fatherName].filter(Boolean).join(" / ") || "—"}
                  </p>
                </div>
              )}
              {student.address && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Adresse</p>
                  <p className="text-foreground">{student.address}</p>
                </div>
              )}
              {(student.phone1 || student.phone2) && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Téléphone</p>
                  <p className="inline-flex items-center gap-1 text-foreground">
                    <PhoneIcon className="h-3.5 w-3.5" />
                    {[student.phone1, student.phone2].filter(Boolean).join(" / ") || "—"}
                  </p>
                </div>
              )}
              {student.parentsEmail && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email parents</p>
                  <p className="inline-flex items-center gap-1 text-foreground">
                    <MailIcon className="h-3.5 w-3.5" />
                    {student.parentsEmail}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 sm:min-w-[140px]">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Moyenne globale
            </p>
            <p className={cn("text-3xl font-bold tabular-nums", averageColor(overall))}>
              {overall !== null ? overall.toFixed(2) : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground">/ 100</p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {summaries.length} année{summaries.length > 1 ? "s" : ""} d&apos;inscription
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Transcripts */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <GraduationCapIcon className="h-5 w-5 text-[#2C4A6E]" />
                <CardTitle className="text-base font-semibold">Relevé de notes</CardTitle>
              </div>
              <CardDescription className="mt-1">
                Historique académique complet de l&apos;élève, classé par année scolaire.
              </CardDescription>
            </div>
            {summaries.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setExpandedItems(
                    expandedItems.length === summaries.length
                      ? []
                      : summaries.map((s) => s.enrollment.id)
                  )
                }
              >
                {expandedItems.length === summaries.length ? "Tout replier" : "Tout déplier"}
              </Button>
            )}
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {summaries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <GraduationCapIcon className="h-10 w-10 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium text-foreground">Aucune inscription</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cet élève n&apos;a aucun historique académique dans le système.
              </p>
            </div>
          ) : (
            <Accordion
              type="multiple"
              value={expandedItems}
              onValueChange={setExpandedItems}
              className="px-2 py-2"
            >
              {summaries.map((summary) => {
                const e = summary.enrollment
                const className = classDisplayName(e)
                const yearPhoto = photosByYear.get(e.classSession.academicYear.id)
                return (
                  <AccordionItem key={e.id} value={e.id} className="border-b last:border-b-0">
                    <AccordionTrigger className="px-3 py-3 hover:no-underline">
                      <div className="flex w-full items-center justify-between gap-3 pr-2">
                        <div className="flex items-center gap-3 text-left">
                          <Avatar className="h-10 w-10 shrink-0 ring-1 ring-border">
                            <AvatarImage src={yearPhoto ?? undefined} />
                            <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
                              {e.classSession.academicYear.yearString.slice(2, 4)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="font-mono text-[11px]">
                              {e.classSession.academicYear.yearString}
                            </Badge>
                            <span className="font-medium text-foreground">{className}</span>
                            {statusBadge(e.status)}
                            {e.classSession.academicYear.isCurrent && (
                              <Badge className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700 hover:bg-emerald-50">
                                Année courante
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-baseline gap-2">
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Moy. générale
                          </span>
                          <span className={cn("text-lg font-bold tabular-nums", averageColor(summary.generalAverage))}>
                            {summary.generalAverage !== null ? summary.generalAverage.toFixed(2) : "—"}
                          </span>
                          <span className="text-[11px] text-muted-foreground">/ 100</span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-4">
                      {/* Promotion photo + step summary */}
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start">
                        <div className="shrink-0">
                          {yearPhoto ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={yearPhoto}
                              alt={`Photo de promotion ${e.classSession.academicYear.yearString}`}
                              className="h-28 w-28 rounded-md object-cover ring-1 ring-border"
                            />
                          ) : (
                            <div className="flex h-28 w-28 flex-col items-center justify-center rounded-md border border-dashed bg-muted/30 text-[10px] text-muted-foreground">
                              <UserIcon className="mb-1 h-6 w-6 opacity-60" />
                              <span>Aucune photo</span>
                            </div>
                          )}
                          <p className="mt-1 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
                            Promotion {e.classSession.academicYear.yearString}
                          </p>
                        </div>

                        <div className="flex-1">
                          {summary.steps.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              {summary.steps.map((s) => (
                                <div
                                  key={s.stepId}
                                  className="rounded-md border bg-muted/20 px-3 py-2"
                                >
                                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    {s.stepName}
                                  </p>
                                  <p className={cn("mt-0.5 text-lg font-semibold tabular-nums", averageColor(s.average))}>
                                    {s.average !== null ? s.average.toFixed(2) : "—"}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Aucune étape avec des notes pour cette année.
                            </p>
                          )}
                        </div>
                      </div>

                      {summary.subjects.length === 0 ? (
                        <div className="rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
                          Aucune note saisie pour cette année.
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent">
                                <TableHead className="pl-3 font-semibold">Matière</TableHead>
                                <TableHead className="text-right font-semibold">Coef.</TableHead>
                                {summary.steps.map((s) => (
                                  <TableHead key={s.stepId} className="text-right font-semibold">
                                    {s.stepName}
                                  </TableHead>
                                ))}
                                <TableHead className="pr-3 text-right font-semibold">Moyenne</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {summary.subjects.map((subj) => {
                                let weighted = 0
                                let count = 0
                                summary.steps.forEach((step) => {
                                  const entry = subj.perStep.get(step.stepId)
                                  if (!entry || entry.max <= 0) return
                                  weighted += (entry.raw / entry.max) * 100
                                  count++
                                })
                                const subjAvg = count > 0 ? weighted / count : null
                                return (
                                  <TableRow key={subj.subjectId}>
                                    <TableCell className="pl-3">
                                      <div className="flex flex-col">
                                        <span className="font-medium text-foreground">{subj.subjectName}</span>
                                        <code className="font-mono text-[10px] text-muted-foreground">
                                          {subj.subjectCode}
                                        </code>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                                      {subj.coefficient}
                                    </TableCell>
                                    {summary.steps.map((step) => {
                                      const entry = subj.perStep.get(step.stepId)
                                      if (!entry || entry.max <= 0) {
                                        return (
                                          <TableCell key={step.stepId} className="text-right text-muted-foreground">
                                            —
                                          </TableCell>
                                        )
                                      }
                                      return (
                                        <TableCell key={step.stepId} className="text-right tabular-nums">
                                          <span className="text-foreground">{entry.raw.toFixed(2)}</span>
                                          <span className="text-muted-foreground"> / {entry.max}</span>
                                        </TableCell>
                                      )
                                    })}
                                    <TableCell className="pr-3 text-right">
                                      <span className={cn("font-semibold tabular-nums", averageColor(subjAvg))}>
                                        {subjAvg !== null ? subjAvg.toFixed(2) : "—"}
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {e.notes && (
                        <p className="mt-3 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">Note&nbsp;:</span> {e.notes}
                        </p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
