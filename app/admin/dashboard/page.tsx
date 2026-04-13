"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CalendarIcon,
  UsersIcon,
  SchoolIcon,
  BarChart3Icon,
  ClipboardEditIcon,
  FileTextIcon,
  UserPlusIcon,
  AlertTriangleIcon,
  InfoIcon,
  CheckCircle2Icon,
  ArrowRightIcon,
  TrendingUpIcon,
} from "lucide-react"
import {
  fetchActiveAcademicYear,
  fetchSteps,
  fetchClassSessions,
  fetchEnrollmentCount,
  getCurrentStep,
  getClassSessionName,
  type AcademicYear,
  type AcademicYearStep,
  type ClassSession,
} from "@/lib/api/dashboard"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/school/stat-card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface SessionStat {
  sessionId: string
  className: string
  studentCount: number
}

export default function AdminDashboardPage() {
  const router = useRouter()

  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null)
  const [steps, setSteps] = useState<AcademicYearStep[]>([])
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [sessionStats, setSessionStats] = useState<SessionStat[]>([])
  const [totalStudents, setTotalStudents] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const year = await fetchActiveAcademicYear()
        setActiveYear(year)

        if (!year) return

        const [stepsData, sessionsData] = await Promise.all([
          fetchSteps(year.id),
          fetchClassSessions(year.id),
        ])
        setSteps(stepsData)
        setSessions(sessionsData)

        const counts = await Promise.all(
          sessionsData.map(async (s) => ({
            sessionId: s.id,
            className: getClassSessionName(s),
            studentCount: await fetchEnrollmentCount(s.id),
          }))
        )
        setSessionStats(counts)
        setTotalStudents(counts.reduce((sum, c) => sum + c.studentCount, 0))
      } catch (err) {
        console.error("[dashboard] Erreur chargement:", err)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  const currentStep = getCurrentStep(steps)
  const currentStepIndex = currentStep ? steps.findIndex((s) => s.id === currentStep.id) : -1
  const stepProgress = steps.length > 0 ? ((currentStepIndex + 1) / steps.length) * 100 : 0

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="space-y-1">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[104px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-16 rounded-xl" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-xl lg:col-span-1" />
          <Skeleton className="h-64 rounded-xl lg:col-span-2" />
        </div>
      </div>
    )
  }

  const quickActions = [
    {
      label: "Saisir des notes",
      description: currentStep?.name ?? "Aucune étape",
      icon: ClipboardEditIcon,
      href: `/admin/academic-year/${activeYear?.id}/grades`,
      disabled: !activeYear,
    },
    {
      label: "Générer bulletins",
      description: currentStep?.name ?? "Aucune étape",
      icon: FileTextIcon,
      href: `/admin/academic-year/${activeYear?.id}/reports`,
      disabled: !activeYear,
    },
    {
      label: "Inscrire un élève",
      description: "Nouvelle inscription",
      icon: UserPlusIcon,
      href: `/admin/academic-year/${activeYear?.id}/students`,
      disabled: !activeYear,
    },
  ]

  return (
    <TooltipProvider>
      <div className="space-y-8">
        {/* ── Header ── */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Tableau de bord
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vue d&apos;ensemble de votre établissement
            {activeYear && (
              <>
                {" "}&middot;{" "}
                <Badge variant="secondary" className="ml-1 align-middle">
                  {activeYear.name}
                </Badge>
              </>
            )}
          </p>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Année active"
            value={activeYear?.name || "—"}
            icon={CalendarIcon}
            iconClassName="text-blue-600"
            iconBgClassName="bg-blue-50"
          />
          <StatCard
            label="Élèves inscrits"
            value={totalStudents}
            icon={UsersIcon}
            iconClassName="text-emerald-600"
            iconBgClassName="bg-emerald-50"
          />
          <StatCard
            label="Classes"
            value={sessions.length}
            icon={SchoolIcon}
            iconClassName="text-amber-600"
            iconBgClassName="bg-amber-50"
          />
          <StatCard
            label="Étape en cours"
            value={currentStep?.name || "—"}
            icon={BarChart3Icon}
            iconClassName="text-violet-600"
            iconBgClassName="bg-violet-50"
          />
        </div>

        {/* ── Step Progress ── */}
        {steps.length > 0 && (
          <Card className="border bg-card shadow-sm">
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-6">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50">
                  <TrendingUpIcon className="h-4 w-4 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Progression de l&apos;année
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {currentStep
                      ? `${currentStep.name} — étape ${currentStepIndex + 1} sur ${steps.length}`
                      : "Aucune étape active"}
                  </p>
                </div>
              </div>
              <div className="flex flex-1 items-center gap-3">
                <Progress
                  value={stepProgress}
                  className="h-2.5 flex-1 bg-violet-100 [&>div]:bg-violet-500"
                />
                <span className="text-sm font-semibold text-violet-600 tabular-nums">
                  {Math.round(stepProgress)}%
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Alerts ── */}
        {!activeYear && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <AlertTriangleIcon className="h-4 w-4 !text-amber-600" />
            <AlertTitle>Aucune année scolaire active</AlertTitle>
            <AlertDescription>
              Configurez une année scolaire pour commencer à utiliser le système.
              <Button
                variant="link"
                size="sm"
                className="ml-1 h-auto p-0 text-amber-700 underline"
                onClick={() => router.push("/admin/academic-years")}
              >
                Configurer maintenant
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {activeYear && !currentStep && (
          <Alert className="border-blue-200 bg-blue-50 text-blue-900">
            <InfoIcon className="h-4 w-4 !text-blue-600" />
            <AlertTitle>Aucune étape active</AlertTitle>
            <AlertDescription>
              Configurez les étapes de l&apos;année pour activer la saisie des notes.
            </AlertDescription>
          </Alert>
        )}
        {activeYear && currentStep && sessions.length === 0 && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <AlertTriangleIcon className="h-4 w-4 !text-amber-600" />
            <AlertTitle>Aucune classe configurée</AlertTitle>
            <AlertDescription>
              Ajoutez des classes pour cette année scolaire.
            </AlertDescription>
          </Alert>
        )}
        {activeYear && currentStep && sessions.length > 0 && (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
            <CheckCircle2Icon className="h-4 w-4 !text-emerald-600" />
            <AlertTitle>Système opérationnel</AlertTitle>
            <AlertDescription>
              {sessions.length} classe(s) &middot; {totalStudents} élève(s) &middot; Étape :{" "}
              {currentStep.name}
            </AlertDescription>
          </Alert>
        )}

        {/* ── Quick Actions + Class Overview ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Quick Actions */}
          <Card className="border bg-card shadow-sm lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Actions rapides
              </CardTitle>
              <CardDescription>Accédez aux fonctions courantes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickActions.map((action) => {
                const ActionIcon = action.icon
                return (
                  <button
                    key={action.label}
                    onClick={() => router.push(action.href)}
                    disabled={action.disabled}
                    className="group flex w-full items-center gap-3 rounded-lg border border-transparent bg-muted/50 p-3 text-left transition-all hover:border-border hover:bg-muted hover:shadow-sm disabled:pointer-events-none disabled:opacity-50"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background shadow-sm ring-1 ring-border">
                      <ActionIcon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {action.label}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {action.description}
                      </p>
                    </div>
                    <ArrowRightIcon className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                  </button>
                )
              })}
            </CardContent>
          </Card>

          {/* Class Overview */}
          <Card className="border bg-card shadow-sm lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Aperçu des classes
                  </CardTitle>
                  <CardDescription>
                    {activeYear
                      ? `Répartition des élèves — ${activeYear.name}`
                      : "Aucune donnée disponible"}
                  </CardDescription>
                </div>
                {sessions.length > 0 && (
                  <Badge variant="outline" className="tabular-nums">
                    {sessions.length} classe(s)
                  </Badge>
                )}
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="p-0">
              {sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                    <SchoolIcon className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-foreground">
                    Aucune donnée disponible
                  </h3>
                  <p className="mt-1 max-w-[280px] text-center text-sm text-muted-foreground">
                    Configurez l&apos;année scolaire pour voir les statistiques
                    des classes.
                  </p>
                  <Button
                    size="sm"
                    className="mt-5"
                    onClick={() => router.push("/admin/academic-years")}
                  >
                    Configurer l&apos;année
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-6 font-semibold">
                        Classe
                      </TableHead>
                      <TableHead className="font-semibold">Effectif</TableHead>
                      <TableHead className="hidden font-semibold sm:table-cell">
                        Répartition
                      </TableHead>
                      <TableHead className="pr-6 text-right font-semibold">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessionStats.map((stat) => {
                      const pct =
                        totalStudents > 0
                          ? Math.round(
                              (stat.studentCount / totalStudents) * 100
                            )
                          : 0
                      return (
                        <TableRow key={stat.sessionId}>
                          <TableCell className="pl-6 font-medium">
                            {stat.className}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="tabular-nums">
                                {stat.studentCount}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                élève(s)
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2">
                                  <Progress
                                    value={pct}
                                    className="h-2 w-24 bg-muted [&>div]:bg-primary"
                                  />
                                  <span className="text-xs tabular-nums text-muted-foreground">
                                    {pct}%
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {stat.studentCount} sur {totalStudents} élèves
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="pr-6 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() =>
                                router.push(
                                  `/admin/academic-year/${activeYear?.id}/grades`
                                )
                              }
                            >
                              Saisir notes
                              <ArrowRightIcon className="ml-1 h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  )
}
