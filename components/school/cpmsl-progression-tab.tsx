"use client"

import { clientFetch as apiFetch } from '@/lib/client-fetch'
import { useState, useEffect, useCallback } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatCard } from "@/components/school/stat-card"
import {
  CheckCircleIcon,
  AlertCircleIcon,
  ClockIcon,
  SearchIcon,
  ArrowRightIcon,
  InboxIcon,
  TrendingUpIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
} from "lucide-react"
import type { AcademicYearStep, ClassSession } from "@/lib/api/dashboard"
import { fetchClassSubjects, fetchEnrollments } from "@/lib/api/grades"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClassProgress {
  sessionId: string
  className: string
  totalExpected: number   // enrollments × class-subjects
  totalEntered: number    // grades effectivement saisies
  pct: number             // 0-100
  status: 'complete' | 'in-progress' | 'not-started'
}

interface CPMSLProgressionTabProps {
  yearId: string
  sessions: ClassSession[]
  steps: AcademicYearStep[]
  onNavigateToSaisie?: (sessionId: string, stepId: string) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sessionLabel(s: ClassSession): string {
  const { classType, letter, track } = s.class
  const base = `${classType.name} ${letter}`
  return track ? `${base} — ${track.code}` : base
}


// ── Composant ─────────────────────────────────────────────────────────────────

export function CPMSLProgressionTab({
  yearId,
  sessions,
  steps,
  onNavigateToSaisie,
}: CPMSLProgressionTabProps) {
  const [selectedStep, setSelectedStep]         = useState("")
  const [classProgress, setClassProgress]       = useState<ClassProgress[]>([])
  const [loading, setLoading]                   = useState(false)
  const [searchQuery, setSearchQuery]           = useState("")

  // ── Chargement ───────────────────────────────────────────────────────────────
  const loadProgress = useCallback(async (stepId: string) => {
    if (!stepId || sessions.length === 0) return
    setLoading(true)
    setClassProgress([])

    try {
      const results = await Promise.all(
        sessions.map(async (session): Promise<ClassProgress> => {
          try {
            // 1. Matières assignées + inscriptions en parallèle
            const [classSubjects, enrollments] = await Promise.all([
              fetchClassSubjects(session.id),
              fetchEnrollments(session.id),
            ])

            if (classSubjects.length === 0 || enrollments.length === 0) {
              return {
                sessionId: session.id,
                className: sessionLabel(session),
                totalExpected: 0,
                totalEntered: 0,
                pct: 0,
                status: 'not-started',
              }
            }

            // 2. Compter les notes saisies pour chaque matière
            const gradesCounts = await Promise.all(
              classSubjects.map(async (cs) => {
                try {
                  const grades = await apiFetch<Array<{ id: string }>>(
                    `/api/grades/class-subject/${cs.id}/step/${stepId}`
                  )
                  return grades.length
                } catch {
                  return 0
                }
              })
            )

            const totalEntered  = gradesCounts.reduce((s, v) => s + v, 0)
            const totalExpected = classSubjects.length * enrollments.length
            const pct = totalExpected > 0
              ? Math.round((totalEntered / totalExpected) * 100)
              : 0

            const status: ClassProgress['status'] =
              pct === 100 ? 'complete' :
              pct > 0     ? 'in-progress' :
              'not-started'

            return {
              sessionId:     session.id,
              className:     sessionLabel(session),
              totalExpected,
              totalEntered,
              pct,
              status,
            }
          } catch {
            return {
              sessionId: session.id,
              className: sessionLabel(session),
              totalExpected: 0,
              totalEntered:  0,
              pct:           0,
              status:        'not-started',
            }
          }
        })
      )

      // Trier : complètes en bas, non-commencées en haut
      results.sort((a, b) => {
        const order = { 'not-started': 0, 'in-progress': 1, 'complete': 2 }
        return order[a.status] - order[b.status]
      })

      setClassProgress(results)
    } catch (err) {
      console.error('[progression] erreur:', err)
    } finally {
      setLoading(false)
    }
  }, [sessions])

  useEffect(() => {
    if (selectedStep) loadProgress(selectedStep)
    else setClassProgress([])
  }, [selectedStep, loadProgress])

  // ── KPIs globaux ─────────────────────────────────────────────────────────────
  const totalExpected = classProgress.reduce((s, c) => s + c.totalExpected, 0)
  const totalEntered  = classProgress.reduce((s, c) => s + c.totalEntered,  0)
  const globalPct     = totalExpected > 0 ? Math.round((totalEntered / totalExpected) * 100) : 0
  const complete      = classProgress.filter(c => c.status === 'complete').length
  const inProgress    = classProgress.filter(c => c.status === 'in-progress').length
  const notStarted    = classProgress.filter(c => c.status === 'not-started').length

  // ── Semantic progress color class ─────────────────────────────────────────
  const progressTextClass = (pct: number) =>
    pct === 100 ? 'text-emerald-600' : pct > 0 ? 'text-blue-600' : 'text-muted-foreground'

  const progressBarClass = (pct: number) =>
    pct === 100
      ? '[&>div]:bg-emerald-500'
      : pct > 0
        ? '[&>div]:bg-blue-500'
        : '[&>div]:bg-muted-foreground/30'

  const renderStatusBadge = (status: ClassProgress['status']) => {
    if (status === 'complete') {
      return (
        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
          <CheckCircleIcon className="mr-1 h-3 w-3" />
          Complet
        </Badge>
      )
    }
    if (status === 'in-progress') {
      return (
        <Badge className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">
          <ClockIcon className="mr-1 h-3 w-3" />
          En cours
        </Badge>
      )
    }
    return (
      <Badge variant="secondary">
        <AlertCircleIcon className="mr-1 h-3 w-3" />
        Non commencé
      </Badge>
    )
  }

  // ── Filtered classes (search) ─────────────────────────────────────────────
  const filteredProgress = useMemo(() => {
    if (!searchQuery.trim()) return classProgress
    const q = searchQuery.toLowerCase()
    return classProgress.filter(c => c.className.toLowerCase().includes(q))
  }, [classProgress, searchQuery])

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Sélecteur étape */}
      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Sélection d&apos;une étape</CardTitle>
          <CardDescription>Voir l&apos;avancement de la saisie pour une étape donnée</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="p-4">
          <Select value={selectedStep} onValueChange={setSelectedStep}>
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Choisir une étape" />
            </SelectTrigger>
            <SelectContent>
              {steps.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Empty state */}
      {!selectedStep && (
        <Card className="border bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <InboxIcon className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              Aucune étape sélectionnée
            </h3>
            <p className="mt-1 max-w-[320px] text-center text-sm text-muted-foreground">
              Sélectionnez une étape pour voir l&apos;avancement de la saisie des notes par classe.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {selectedStep && loading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[104px] rounded-xl" />)}
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      )}

      {/* Contenu */}
      {selectedStep && !loading && classProgress.length > 0 && (
        <>
          {/* Barre globale */}
          <Card className="border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50">
                    <TrendingUpIcon className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Avancement global — {steps.find(s => s.id === selectedStep)?.name}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {totalEntered} / {totalExpected} notes saisies
                    </p>
                  </div>
                </div>
                <span className={cn("text-3xl font-bold tabular-nums", progressTextClass(globalPct))}>
                  {globalPct}%
                </span>
              </div>
              <Progress
                value={globalPct}
                className={cn("mt-4 h-3", progressBarClass(globalPct))}
              />
            </CardContent>
          </Card>

          {/* KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Classes complètes"
              value={`${complete} / ${classProgress.length}`}
              icon={CheckCircle2Icon}
              iconClassName="text-emerald-600"
              iconBgClassName="bg-emerald-50"
            />
            <StatCard
              label="Classes en cours"
              value={`${inProgress} / ${classProgress.length}`}
              icon={ClockIcon}
              iconClassName="text-blue-600"
              iconBgClassName="bg-blue-50"
            />
            <StatCard
              label="Classes non commencées"
              value={`${notStarted} / ${classProgress.length}`}
              icon={CircleDashedIcon}
              iconClassName="text-slate-600"
              iconBgClassName="bg-slate-100"
            />
          </div>

          {/* Table par classe */}
          <Card className="border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Détail par classe</CardTitle>
                  <CardDescription>
                    {filteredProgress.length} classe{filteredProgress.length > 1 ? 's' : ''}
                    {searchQuery && ` — recherche : "${searchQuery}"`}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <Separator />

            {/* Search toolbar */}
            <div className="p-4">
              <div className="relative max-w-md">
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher une classe..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <Separator />

            <CardContent className="p-0">
              {filteredProgress.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                    <InboxIcon className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-foreground">
                    Aucune classe trouvée
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Modifiez vos critères de recherche.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-6 font-semibold">Classe</TableHead>
                      <TableHead className="min-w-[220px] font-semibold">Progression</TableHead>
                      <TableHead className="font-semibold">%</TableHead>
                      <TableHead className="font-semibold">Notes</TableHead>
                      <TableHead className="font-semibold">Statut</TableHead>
                      <TableHead className="pr-6 text-right font-semibold">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProgress.map(cp => (
                      <TableRow key={cp.sessionId}>
                        <TableCell className="pl-6 font-medium text-foreground">
                          {cp.className}
                        </TableCell>
                        <TableCell>
                          <Progress
                            value={cp.pct}
                            className={cn("h-2 w-full max-w-[220px]", progressBarClass(cp.pct))}
                          />
                        </TableCell>
                        <TableCell>
                          <span className={cn("text-sm font-bold tabular-nums", progressTextClass(cp.pct))}>
                            {cp.pct}%
                          </span>
                        </TableCell>
                        <TableCell className="text-sm tabular-nums text-muted-foreground">
                          {cp.totalEntered} / {cp.totalExpected}
                        </TableCell>
                        <TableCell>
                          {renderStatusBadge(cp.status)}
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          {cp.status !== 'complete' && onNavigateToSaisie && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => onNavigateToSaisie(cp.sessionId, selectedStep)}
                            >
                              Saisir
                              <ArrowRightIcon className="ml-1 h-3 w-3" />
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
        </>
      )}
    </div>
  )
}