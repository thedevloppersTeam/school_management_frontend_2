"use client"

import { clientFetch as apiFetch } from '@/lib/client-fetch'
import { useState, useEffect, useCallback, useMemo, useRef, useId } from "react"
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
import { type AcademicYearStep, type ClassSession } from "@/lib/api/dashboard"
import { libelleClasseSalle } from "@/lib/classes/labels"
import { SELECTION_VIDE, type SelectionClasseSalle } from "@/lib/classes/selection"
import {
  comparerLignesAvancement,
  filtrerParClasseSalle,
  ligneCorrespondRecherche,
  type IdentiteLigneAvancement,
} from "@/lib/classes/avancement"
import { ClasseSalleSelect } from "@/components/school/classe-salle-select"
import { fetchClassSubjects, fetchEnrollments } from "@/lib/api/grades"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClassProgress {
  sessionId: string
  classeId: string             // ClassType.id, pour le filtre Classe
  levelOrder: number | null    // rang dans le cursus, pour le tri
  classTypeName: string   // la CLASSE, ex. « 1e AF »
  salleLabel: string      // la SALLE, ex. « A » — jamais une filiere
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

/**
 * Les champs d'identite d'une ligne, en un seul point.
 *
 * Plus de chaine fusionnee « 1e AF A », meme comme cle de recherche : la
 * recherche compare la classe et la salle separement (lib/classes/avancement.ts ;
 * DESIGN.md, « Pages de notes »). Ce qui s'affiche, ce sont `classTypeName` et
 * `salleLabel`, deux colonnes distinctes.
 */
function identiteClasse(s: ClassSession) {
  const { classe, salle } = libelleClasseSalle(s)
  const rang = s.class.classType.levelOrder
  return {
    classeId: s.class.classType.id,
    levelOrder: typeof rang === "number" ? rang : null,
    classTypeName: classe,
    salleLabel: salle,
  }
}

/** Vue d'une ligne pour le filtre, la recherche et le tri (lib/classes/avancement.ts). */
function versIdentite(c: ClassProgress): IdentiteLigneAvancement {
  return {
    sessionId: c.sessionId,
    classeId: c.classeId,
    classe: c.classTypeName,
    salle: c.salleLabel,
    levelOrder: c.levelOrder,
    status: c.status,
  }
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
  // Filtre Classe puis Salle (T8, D3-b), LOCAL à l'onglet : en mode filtre,
  // « Toutes » vaut null, et la sélection partagée de Saisie ne doit pas s'en
  // trouver effacée. Le bouton « Saisir » positionne la sélection partagée.
  const [filtre, setFiltre] = useState<SelectionClasseSalle>(SELECTION_VIDE)
  const idEtape = useId()

  // Jeton : seul le calcul de la DERNIÈRE étape demandée est appliqué. Sans
  // lui, deux étapes choisies vite pouvaient afficher les chiffres de la première.
  const dernierCalcul = useRef(0)

  // ── Chargement ───────────────────────────────────────────────────────────────
  const loadProgress = useCallback(async (stepId: string) => {
    if (!stepId || sessions.length === 0) return
    dernierCalcul.current += 1
    const jeton = dernierCalcul.current
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
                ...identiteClasse(session),
                totalExpected: 0,
                totalEntered: 0,
                pct: 0,
                status: 'not-started',
              }
            }

            // 2. Compter les notes saisies pour chaque matière
            //
            // Le numérateur se compte sur les MÊMES paires que le dénominateur.
            // /api/grades/class-subject/:id/step/:id ne filtre pas le statut de
            // l'inscription et renvoie aussi les notes de section. Compter les
            // lignes brutes faisait donc entrer deux populations étrangères au
            // dénominateur : les notes portées par une inscription TRANSFERRED,
            // et les notes de section d'une matière découpée, comptées autant de
            // fois qu'elle a de sections. Le pourcentage pouvait dépasser 100 %
            // et marquer une salle « complète » alors qu'il manquait des notes.
            //
            // On compte des paires (inscription, matière) distinctes, restreintes
            // aux inscriptions du dénominateur. Le numérateur est alors borné par
            // construction : au plus une paire par matière et par élève retenu,
            // soit exactement totalExpected.
            const enrollmentIds = new Set(enrollments.map(e => e.id))

            const gradesCounts = await Promise.all(
              classSubjects.map(async (cs) => {
                try {
                  const grades = await apiFetch<Array<{ id: string; enrollmentId: string }>>(
                    `/api/grades/class-subject/${cs.id}/step/${stepId}`
                  )
                  const notes = new Set(
                    grades
                      .filter(g => enrollmentIds.has(g.enrollmentId))
                      .map(g => g.enrollmentId)
                  )
                  return notes.size
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
              ...identiteClasse(session),
              totalExpected,
              totalEntered,
              pct,
              status,
            }
          } catch {
            return {
              sessionId: session.id,
              ...identiteClasse(session),
              totalExpected: 0,
              totalEntered:  0,
              pct:           0,
              status:        'not-started',
            }
          }
        })
      )

      if (jeton !== dernierCalcul.current) return

      // Trier : non commencées en haut, complètes en bas ; à statut égal,
      // ordre du cursus puis salle. Plus d'ordre dépendant du serveur.
      results.sort((a, b) => comparerLignesAvancement(versIdentite(a), versIdentite(b)))

      setClassProgress(results)
    } catch (err) {
      if (jeton !== dernierCalcul.current) return
      console.error('[progression] erreur:', err)
    } finally {
      if (jeton === dernierCalcul.current) setLoading(false)
    }
  }, [sessions])

  useEffect(() => {
    if (selectedStep) loadProgress(selectedStep)
    else setClassProgress([])
  }, [selectedStep, loadProgress])

  // ── Filtre Classe / Salle (T8) ───────────────────────────────────────────────
  // Sur les lignes déjà calculées : aucune requête. Les statistiques suivent ce
  // filtre ; la recherche texte, plus bas, ne réduit que le tableau.
  const lignesFiltrees = useMemo(
    () => filtrerParClasseSalle(classProgress, filtre),
    [classProgress, filtre],
  )

  // ── KPIs (suivent le filtre Classe / Salle, pas la recherche) ────────────────
  const totalExpected = lignesFiltrees.reduce((s, c) => s + c.totalExpected, 0)
  const totalEntered  = lignesFiltrees.reduce((s, c) => s + c.totalEntered,  0)
  const globalPct     = totalExpected > 0 ? Math.round((totalEntered / totalExpected) * 100) : 0
  const complete      = lignesFiltrees.filter(c => c.status === 'complete').length
  const inProgress    = lignesFiltrees.filter(c => c.status === 'in-progress').length
  const notStarted    = lignesFiltrees.filter(c => c.status === 'not-started').length

  // ── Semantic progress color class ─────────────────────────────────────────
  const progressTextClass = (pct: number) =>
    pct === 100 ? 'text-success-ink' : pct > 0 ? 'text-info-ink' : 'text-muted-foreground'

  const progressBarClass = (pct: number) =>
    pct === 100
      ? '[&>div]:bg-success'
      : pct > 0
        ? '[&>div]:bg-info'
        : '[&>div]:bg-muted-foreground/30'

  const renderStatusBadge = (status: ClassProgress['status']) => {
    if (status === 'complete') {
      return (
        <Badge className="border-success-border bg-success-soft text-success-ink hover:bg-success-soft">
          <CheckCircleIcon className="mr-1 h-3 w-3" />
          Complet
        </Badge>
      )
    }
    if (status === 'in-progress') {
      return (
        <Badge className="border-info-border bg-info-soft text-info-ink hover:bg-info-soft">
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
  // Recherche sur la classe et la salle SÉPARÉMENT (T9), sans libellé fusionné ;
  // un seul caractère ne compare que la salle (lib/classes/avancement.ts).
  const filteredProgress = useMemo(
    () => lignesFiltrees.filter(c => ligneCorrespondRecherche(searchQuery, versIdentite(c))),
    [lignesFiltrees, searchQuery],
  )

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Sélecteur étape */}
      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Sélection d&apos;une étape</CardTitle>
          <CardDescription>
            Voir l&apos;avancement de la saisie pour une étape donnée, toutes classes ou filtré par classe et salle
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:max-w-3xl">
            <div className="space-y-1.5">
              <label htmlFor={idEtape} className="text-xs font-medium text-muted-foreground">Étape</label>
              <Select value={selectedStep} onValueChange={setSelectedStep}>
                <SelectTrigger id={idEtape}>
                  <SelectValue placeholder="Choisir une étape" />
                </SelectTrigger>
                <SelectContent>
                  {steps.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtre Classe puis Salle (T8) : « Toutes » par défaut, salle
                unique non préremplie, local à l'onglet. */}
            <ClasseSalleSelect
              mode="filtre"
              sessions={sessions}
              value={filtre}
              onChange={setFiltre}
            />
          </div>
        </CardContent>
      </Card>

      {/* Empty state */}
      {!selectedStep && (
        <Card className="border bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <InboxIcon className="h-7 w-7 text-muted-foreground" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-foreground">
              Aucune étape sélectionnée
            </h2>
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
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <TrendingUpIcon className="h-5 w-5 text-primary" />
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
              iconClassName="text-success"
              iconBgClassName="bg-success-soft"
            />
            <StatCard
              label="Classes en cours"
              value={`${inProgress} / ${classProgress.length}`}
              icon={ClockIcon}
              iconClassName="text-info"
              iconBgClassName="bg-info-soft"
            />
            <StatCard
              label="Classes non commencées"
              value={`${notStarted} / ${classProgress.length}`}
              icon={CircleDashedIcon}
              iconClassName="text-primary"
              iconBgClassName="bg-primary/10"
            />
          </div>

          {/* Table par classe */}
          <Card className="border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Détail par salle</CardTitle>
                  <CardDescription>
                    {filteredProgress.length} salle{filteredProgress.length > 1 ? 's' : ''}
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
                  placeholder="Rechercher une classe ou une salle…"
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
                  <h2 className="mt-4 text-base font-semibold text-foreground">
                    Aucune salle trouvée
                  </h2>
                  <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                    Modifiez la recherche ou le filtre Classe et Salle.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-6 font-semibold">Classe</TableHead>
                      <TableHead className="font-semibold">Salle</TableHead>
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
                          {cp.classTypeName || <span className="italic text-muted-foreground">Sans classe</span>}
                        </TableCell>
                        <TableCell>
                          {cp.salleLabel ? (
                            <span className="inline-flex items-center justify-center rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
                              {cp.salleLabel}
                            </span>
                          ) : (
                            <span className="text-xs italic text-muted-foreground">—</span>
                          )}
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