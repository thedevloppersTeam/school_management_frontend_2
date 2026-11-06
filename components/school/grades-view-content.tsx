"use client"

import { useState, useEffect, useCallback, useMemo, useRef, useId } from "react"
import { useParams } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatCard } from "@/components/school/stat-card"
import {
  LockIcon,
  UsersIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  TrendingUpIcon,
  InboxIcon,
} from "lucide-react"
import { gradeBand, gradeBandToneClass, gradeMention } from "@/lib/bulletin/grade-color"
import { fetchClassSessions, fetchSteps, type AcademicYearStep, type ClassSession } from "@/lib/api/dashboard"
import { SELECTION_VIDE, type SelectionClasseSalle } from "@/lib/classes/selection"
import { ClasseSalleSelect } from "@/components/school/classe-salle-select"
import { ClasseSalleInfo } from "@/components/school/classe-salle-info"
import { fetchClassSubjects, fetchEnrollments, effectiveMaxScore, type ApiClassSubject, type ApiEnrollment } from "@/lib/api/grades"
import DecimalJs from "decimal.js"
import type Decimal from "decimal.js"
import { computeStep, stepAverageOrNull, type SubjectOutput } from "@/lib/bulletin/compute"
import { afficherMoyenne, bandePourcent, moyenneColonne, moyenneClasse } from "@/lib/bulletin/grades-view"
import {
  toSubjectInputs,
  toScopedSubjectInputs,
  buildExclusionSet,
  rubricIndex,
  type ApiExclusionLike,
  type ToSubjectInputsResult,
} from "@/lib/bulletin/from-api"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Rubric { id: string; code: string; name: string }

interface GradeRow {
  enrollmentId: string
  studentId:    string
  lastname:     string
  firstname:    string
  studentCode:  string
  grades:       Record<string, number | null>
  /**
   * Moyenne d'etape en flottant, lue UNIQUEMENT par le calcul du rang : sa
   * regle d'egalite (valeur exacte ou affichee) attend la MOA. Tout ce qui
   * s'affiche part de `exact`.
   */
  average:      number | null
  /** Moyenne d'etape exacte sur 10, ou null si rien d'exploitable. */
  exact:        Decimal | null
  /** Sortie du calcul par matiere : source des moyennes de colonne. */
  subjectOutputs: Record<string, SubjectOutput>
  isComplete:   boolean
  rang:         number | null
  /**
   * Etat par matiere. Distingue une dispense (neutre) d'une absence de note
   * (qui penalise). Pas encore lu par le rendu — chantier UI a venir.
   */
  subjectStates: Record<string, 'noted' | 'missing' | 'exempted'>
  /**
   * Bareme effectif par matiere, issu de SubjectOutput.denominator : il tient
   * compte de maxScoreOverride et des sous-matieres dispensees.
   */
  maxScores:    Record<string, number>
}

/**
 * Mention MENFP. Était une copie locale du barème, la cinquième du dépôt ;
 * délègue maintenant à `lib/bulletin/grade-color.ts`, qui porte la table unique
 * alignée sur la légende imprimée du bulletin. `m` est la moyenne EXACTE sur
 * /10 : la bande se lit sur elle, comme `isPassing` côté bulletin.
 */
function getAppreciation(m: Decimal | null): string {
  return gradeMention(bandePourcent(m))
}

// Classe et salle : sélection en deux listes (ClasseSalleSelect) et en-tête en
// deux badges (ClasseSalleInfo). Sur les pages de notes, aucune fusion
// « 1e AF A », même en option de liste (DESIGN.md, « Pages de notes » ;
// chantier W2, T6 et T9).

/**
 * Portée du calcul, la même que celle du bulletin : 'common' = bulletin normal
 * (tronc commun), 'exam' = bulletin d'examen (matières de la filière de
 * l'élève). Une salle sans matière de filière n'a qu'une portée possible.
 */
type PorteeBulletin = 'common' | 'exam'

function porteeEffective(cs: ApiClassSubject[], choix: PorteeBulletin): PorteeBulletin {
  return cs.some(c => c.trackId != null) ? choix : 'common'
}

// ── Page ──────────────────────────────────────────────────────────────────────

/**
 * Deux modes, exclusifs (union discriminée sur `selection`) :
 * - CONTRÔLÉ, dans la page Notes : la page fournit ensemble la sélection
 *   partagée entre les onglets (T10), son rappel et ses sessions. Fournir
 *   l'une sans les autres ne compile pas.
 * - AUTONOME, sur la page /grades/view : aucune des trois ; le composant tient
 *   sa propre sélection et charge ses sessions.
 */
type ModeSelection =
  | {
      selection:         SelectionClasseSalle
      onSelectionChange: (next: SelectionClasseSalle) => void
      sessions:          ClassSession[]
    }
  | {
      selection?:         never
      onSelectionChange?: never
      sessions?:          never
    }

export type GradesViewContentProps = ModeSelection & {
  /** Étape reprise au montage (celle de Saisie) ; propre à l'onglet ensuite. */
  initialStepId?: string
}

export function GradesViewContent(props: GradesViewContentProps) {
  const { initialStepId = "" } = props
  const controle = props.selection !== undefined
  const params  = useParams()
  const yearId  = params.yearId as string
  const { toast } = useToast()

  const [sessionsLocales,  setSessions]         = useState<ClassSession[]>([])
  const [selectionLocale,  setSelectionLocale]  = useState<SelectionClasseSalle>(SELECTION_VIDE)
  const sessions  = props.sessions ?? sessionsLocales
  const selection = props.selection ?? selectionLocale
  function changerSelection(next: SelectionClasseSalle) {
    if (props.onSelectionChange) props.onSelectionChange(next)
    else setSelectionLocale(next)
  }
  const [steps,      setSteps]      = useState<AcademicYearStep[]>([])
  const [rubrics,    setRubrics]    = useState<Rubric[]>([])
  const [loadingCtx, setLoadingCtx] = useState(true)

  // Identifiant de la salle choisie ("" si aucune) : nom conservé pour les
  // usages existants. Aucune requête ne part sans salle (loadGrid, effet).
  const selectedSession = selection.sessionId ?? ""
  const [selectedStep,    setSelectedStep]    = useState(initialStepId)
  const idEtape  = useId()
  const idPortee = useId()
  const [scope,           setScope]           = useState<PorteeBulletin>('common')

  const [classSubjects, setClassSubjects] = useState<ApiClassSubject[]>([])
  const isLocked = useMemo(() => {
    const step = steps.find(s => s.id === selectedStep)
    return step ? !step.isCurrent : false
  }, [steps, selectedStep])
  const [gradeRows,   setGradeRows]   = useState<GradeRow[]>([])
  const [loadingGrid, setLoadingGrid] = useState(false)
  // DR-003 — matieres dont la rubrique est inconnue. Signalees, jamais ignorees.
  const [unmappedSubjects, setUnmappedSubjects] = useState<ToSubjectInputsResult['unmapped']>([])

  // ── Chargement contexte ───────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const [sessionsData, stepsData, rubricsRes, yearRes] = await Promise.all([
          // En mode contrôlé, la page fournit déjà les sessions.
          controle ? Promise.resolve(null) : fetchClassSessions(yearId),
          fetchSteps(yearId),
          fetch('/api/subject-rubrics', { credentials: 'include' }),
          fetch(`/api/academic-years/${yearId}`, { credentials: 'include' }),
        ])
        if (sessionsData) setSessions(sessionsData)
        setSteps([...stepsData].sort((a, b) => a.stepNumber - b.stepNumber))
        if (rubricsRes.ok) setRubrics(await rubricsRes.json())
        
      } catch {
        toast({ title: "Erreur", description: "Impossible de charger le contexte", variant: "destructive" })
      } finally {
        setLoadingCtx(false)
      }
    }
    init()
  }, [yearId, toast, controle])

  // ── Chargement grille ─────────────────────────────────────────────────────
  // Jeton : seule la réponse de la DERNIÈRE demande est appliquée. Sans lui,
  // deux salles enchaînées vite pouvaient afficher les notes de la première
  // sous l'en-tête de la seconde (chantier W2, PR 3).
  const dernierChargement = useRef(0)

  const loadGrid = useCallback(async (sessionId: string, stepId: string) => {
    if (!sessionId || !stepId) return
    dernierChargement.current += 1
    const jeton = dernierChargement.current
    const perime = () => jeton !== dernierChargement.current
    // Vider AVANT de charger : rien de la salle précédente ne reste affiché.
    setLoadingGrid(true)
    setGradeRows([])
    setClassSubjects([])
    setUnmappedSubjects([])
    try {
      const [cs, enr, exclusionRows] = await Promise.all([
        fetchClassSubjects(sessionId),
        fetchEnrollments(sessionId),
        // MEME source que le bulletin : une seule verite sur les dispenses.
        fetch(`/api/enrollments/excluded-sections?classSessionId=${sessionId}&stepId=${stepId}`, { credentials: 'include' })
          .then((r) => (r.ok ? r.json() as Promise<ApiExclusionLike[]> : []))
          .catch(() => [] as ApiExclusionLike[]),
      ])
      if (perime()) return
      setClassSubjects(cs)

      const rubricCodeById = rubricIndex(rubrics)
      const exclusions     = buildExclusionSet(exclusionRows)
      const portee         = porteeEffective(cs, scope)

      // DR-003 — le mapping ne depend ni de l'eleve ni des notes : on le
      // constate une fois pour la salle.
      setUnmappedSubjects(
        toSubjectInputs({ classSubjects: cs, grades: [], rubricCodeById, enrollmentId: '' }).unmapped,
      )

      const rows = await Promise.all(
        enr.map(async (enrollment) => {
          try {
            const res       = await fetch(`/api/grades/enrollment/${enrollment.id}?stepId=${stepId}`, { credentials: 'include' })
            const rawGrades = res.ok ? await res.json() : []

            // Même portée que le bulletin : sans elle, les matières d'examen
            // des autres filières entraient comme notes manquantes.
            const { subjects } = toScopedSubjectInputs({
              classSubjects: cs,
              grades:        rawGrades,
              rubricCodeById,
              enrollmentId:  enrollment.id,
              exclusions,
              scope:         portee,
              trackId:       enrollment.trackId,
            })
            const step = computeStep(subjects)

            const grades:         Record<string, number | null> = {}
            const subjectStates:  GradeRow['subjectStates']     = {}
            const subjectOutputs: Record<string, SubjectOutput> = {}
            const maxScores:      Record<string, number>        = {}
            let anyMissing     = false

            for (const rubrique of [step.r1, step.r2, step.r3]) {
              for (const s of rubrique.subjects) {
                subjectStates[s.classSubjectId]  = s.state
                subjectOutputs[s.classSubjectId] = s
                maxScores[s.classSubjectId]     = s.denominator.toNumber()
                // La colonne affiche la note dans SON bareme, pas ramenee sur 10.
                grades[s.classSubjectId]        = s.state === 'noted' ? s.numerator.toNumber() : null
                if (s.state === 'missing') anyMissing = true
              }
            }

            // Sur /10. Null si les trois rubriques ont un denominateur nul :
            // rien d'exploitable.
            const exact = stepAverageOrNull(step)

            return {
              enrollmentId: enrollment.id,
              studentId:    enrollment.student.id,
              lastname:     enrollment.student.user.lastname,
              firstname:    enrollment.student.user.firstname,
              studentCode:  enrollment.student.studentCode,
              grades,
              // Flottant pour le rang SEULEMENT (voir GradeRow.average).
              average:      exact === null ? null : exact.toNumber(),
              exact,
              subjectOutputs,
              // Une matiere DISPENSEE ne rend pas l'eleve incomplet.
              isComplete:   !anyMissing,
              rang:         null,
              subjectStates,
              maxScores,
            } as GradeRow
          } catch {
            return {
              enrollmentId: enrollment.id,
              studentId:    enrollment.student.id,
              lastname:     enrollment.student.user.lastname,
              firstname:    enrollment.student.user.firstname,
              studentCode:  enrollment.student.studentCode,
              grades:       {},
              average:      null,
              exact:        null,
              subjectOutputs: {},
              isComplete:   false,
              rang:         null,
              subjectStates: {},
              maxScores:    {},
            } as GradeRow
          }
        })
      )

      rows.sort((a, b) => `${a.lastname} ${a.firstname}`.localeCompare(`${b.lastname} ${b.firstname}`))

      // ── Fix : rang n'incrémente que pour les élèves avec une moyenne ──────
      const ranked = [...rows].sort((a, b) => (b.average ?? -1) - (a.average ?? -1))
      let rang = 1
      ranked.forEach((row, i) => {
        if (row.average === null) {
          row.rang = null
        } else if (i > 0 && ranked[i - 1].average === row.average) {
          row.rang = ranked[i - 1].rang
          rang++
        } else {
          row.rang = rang
          rang++
        }
      })

      if (perime()) return
      setGradeRows(rows)
    } catch {
      if (perime()) return
      toast({ title: "Erreur", description: "Impossible de charger les notes", variant: "destructive" })
    } finally {
      if (!perime()) setLoadingGrid(false)
    }
  }, [rubrics, scope, toast])

  useEffect(() => {
    if (selectedSession && selectedStep) loadGrid(selectedSession, selectedStep)
    else {
      // Plus de salle ou d'étape : un chargement encore en vol est périmé.
      dernierChargement.current += 1
      setLoadingGrid(false)
      setGradeRows([]); setClassSubjects([]); setUnmappedSubjects([])
    }
  }, [selectedSession, selectedStep, loadGrid])

  // ── Portée affichée ───────────────────────────────────────────────────────
  // Les colonnes suivent la portée du calcul : tronc commun en bulletin normal,
  // matières de filière en bulletin d'examen.
  const hasTrackSubjects = useMemo(() => classSubjects.some(cs => cs.trackId != null), [classSubjects])
  const visibleSubjects  = useMemo(() => {
    const portee = porteeEffective(classSubjects, scope)
    return classSubjects.filter(cs => portee === 'common' ? cs.trackId == null : cs.trackId != null)
  }, [classSubjects, scope])

  // ── Groupes rubriques ─────────────────────────────────────────────────────
  const rubricGroups = useMemo(() => {
    const rubricMap: Record<string, string> = {}
    rubrics.forEach(r => { rubricMap[r.id] = r.code })
    const groups: Array<{ rubric: Rubric; subjects: ApiClassSubject[] }> = []
    ;['R1', 'R2', 'R3'].forEach(code => {
      const rubric   = rubrics.find(r => r.code === code)
      if (!rubric) return
      const subjects = visibleSubjects.filter(cs => cs.subject.rubric?.id && rubricMap[cs.subject.rubric.id] === code)
      if (subjects.length > 0) groups.push({ rubric, subjects })
    })
    const withoutRubric = visibleSubjects.filter(cs => !cs.subject.rubric)
    if (withoutRubric.length > 0) groups.push({ rubric: { id: 'none', code: '—', name: 'Sans rubrique' }, subjects: withoutRubric })
    return groups
  }, [visibleSubjects, rubrics])

  // ── KPIs ──────────────────────────────────────────────────────────────────
  // Regle 3 via computeClassAverage : une dispense sort de la moyenne de
  // colonne, une note manquante y compte ZERO (27/30 contre 27/27). Chaque
  // eleve y entre par SA moyenne de la matiere, ce qui neutralise les baremes
  // reduits par une dispense partielle ; le resultat est rendu dans le bareme
  // nominal de la colonne, celui des cellules. Portee : les colonnes visibles,
  // donc les memes matieres que la moyenne d'eleve.
  const columnAverages = useMemo(() => {
    const avgs: Record<string, Decimal | null> = {}
    visibleSubjects.forEach(cs => {
      avgs[cs.id] = moyenneColonne(
        gradeRows.map(r => r.subjectOutputs[cs.id]),
        new DecimalJs(effectiveMaxScore(cs)),
      )
    })
    return avgs
  }, [visibleSubjects, gradeRows])

  const classAverage = useMemo(
    () => moyenneClasse(gradeRows.map(r => r.exact)),
    [gradeRows],
  )

  const completeCount   = gradeRows.filter(r => r.isComplete).length
  const incompleteCount = gradeRows.length - completeCount

  // ── Helpers UI ────────────────────────────────────────────────────────────
  const rubricClasses = (code: string) => {
    switch (code) {
      case 'R1':
        return {
          header: 'bg-info-soft text-info-ink',
          col:    'text-info-ink',
          border: 'border-l-info-border',
        }
      case 'R2':
        return {
          header: 'bg-success-soft text-success-ink',
          col:    'text-success-ink',
          border: 'border-l-success-border',
        }
      case 'R3':
        return {
          header: 'bg-warning-soft text-warning-ink',
          col:    'text-warning-ink',
          border: 'border-l-warning-border',
        }
      default:
        return {
          header: 'bg-muted text-muted-foreground',
          col:    'text-muted-foreground',
          border: 'border-l-border',
        }
    }
  }

  const poids = (code: string) => {
    if (code === 'R1') return '70%'
    if (code === 'R2') return '25%'
    if (code === 'R3') return '5%'
    return ''
  }
  // Moyennes : formatées depuis le Decimal, comme le bulletin (formatAverage).
  const fmt = (v: Decimal | null) => afficherMoyenne(v)

  // Seuils 70/50 remplacés par les bandes du bulletin imprimé (E ≤ 50,
  // D 51-59, C 60-68, puis aucune couleur). C'était la divergence d'origine :
  // entre 60 et 69, cet écran peignait en orange ce que la feuille remise à la
  // famille peignait en vert. Une seule table, dans `lib/bulletin/grade-color.ts`.
  const noteColorClass = (note: number | null, max: number) => {
    if (note === null) return 'text-muted-foreground'
    return gradeBandToneClass(gradeBand((note / max) * 100))
  }

  // `avg` est la moyenne EXACTE sur /10 ; les bandes raisonnent en pourcentage.
  const averageColorClass = (avg: Decimal | null) => {
    if (avg === null) return 'text-muted-foreground'
    return gradeBandToneClass(gradeBand(bandePourcent(avg)))
  }

  if (loadingCtx) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[104px] rounded-xl" />)}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Titre de page ── */}
      <div>
        <h1 className="heading-1 text-foreground">Consultation des notes</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Grille en lecture seule des notes saisies, par classe et par étape
        </p>
      </div>

      {/* ── Sélecteurs ── */}
      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Sélection</CardTitle>
          <CardDescription>Choisissez une classe, une salle et une étape pour afficher la grille</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Classe puis Salle (T6). Pas de garde : l'écran est en lecture seule. */}
            <ClasseSalleSelect
              sessions={sessions}
              value={selection}
              onChange={changerSelection}
            />

            <div className="space-y-1.5">
              <label htmlFor={idEtape} className="text-xs font-medium text-muted-foreground">Étape</label>
              <Select value={selectedStep} onValueChange={setSelectedStep}>
                <SelectTrigger id={idEtape}>
                  <SelectValue placeholder="Sélectionner une étape" />
                </SelectTrigger>
                <SelectContent>
                  {steps.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Uniquement si la salle a des matières de filière : ailleurs, les
                deux bulletins portent sur le même tronc commun. */}
            {hasTrackSubjects && (
              <div className="space-y-1.5">
                <label htmlFor={idPortee} className="text-xs font-medium text-muted-foreground">Portée</label>
                <Select value={scope} onValueChange={(v) => setScope(v as PorteeBulletin)}>
                  <SelectTrigger id={idPortee} aria-label="Portée du calcul">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="common">Bulletin normal (tronc commun)</SelectItem>
                    <SelectItem value="exam">Bulletin d&apos;examen (matières de la filière)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Bannière étape clôturée ── */}
      {selectedStep && isLocked && (
        <Alert className="border-warning-border bg-warning-soft text-warning-ink">
          <LockIcon className="h-4 w-4 !text-warning-ink" />
          <AlertTitle>Étape clôturée</AlertTitle>
          <AlertDescription>Consultation en lecture seule</AlertDescription>
        </Alert>
      )}

      {/* ── DR-003 : matières non rattachées à une rubrique ── */}
      {unmappedSubjects.length > 0 && (
        <Alert className="border-destructive/30 bg-destructive/5">
          <AlertCircleIcon className="h-4 w-4 !text-destructive" />
          <AlertTitle>Matières non rattachées à une rubrique</AlertTitle>
          <AlertDescription>
            {unmappedSubjects.length === 1 ? 'Cette matière est exclue' : 'Ces matières sont exclues'}
            {' '}du calcul de la moyenne : {unmappedSubjects.map(u => u.name).join(', ')}.
            Rattachez-{unmappedSubjects.length === 1 ? 'la' : 'les'} à R1, R2 ou R3 pour
            {unmappedSubjects.length === 1 ? " qu'elle soit prise" : " qu'elles soient prises"} en compte.
          </AlertDescription>
        </Alert>
      )}

      {/* ── État vide ── */}
      {(!selectedSession || !selectedStep) && (
        <Card className="border bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <InboxIcon className="h-7 w-7 text-muted-foreground" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-foreground">
              Aucune sélection
            </h2>
            <p className="mt-1 max-w-[320px] text-center text-sm text-muted-foreground">
              Sélectionnez une classe, une salle et une étape pour voir les notes des élèves.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Contenu ── */}
      {selectedSession && selectedStep && (
        loadingGrid ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[104px] rounded-xl" />)}
            </div>
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        ) : (
          <>
            {/* Classe et salle consultées : deux badges étiquetés (D8) */}
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <ClasseSalleInfo source={sessions.find(s => s.id === selectedSession)} />
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Élèves inscrits"
                value={gradeRows.length}
                icon={UsersIcon}
                iconClassName="text-primary"
                iconBgClassName="bg-primary/10"
              />
              <StatCard
                label="Notes complètes"
                value={completeCount}
                icon={CheckCircle2Icon}
                iconClassName="text-success"
                iconBgClassName="bg-success-soft"
              />
              <StatCard
                label="Notes manquantes"
                value={incompleteCount}
                icon={AlertCircleIcon}
                iconClassName="text-warning-ink"
                iconBgClassName="bg-warning-soft"
              />
              <StatCard
                label="Moyenne classe"
                value={afficherMoyenne(classAverage)}
                icon={TrendingUpIcon}
                iconClassName="text-primary"
                iconBgClassName="bg-primary/10"
              />
            </div>

            {/* Grille des notes */}
            {gradeRows.length === 0 ? (
              <Card className="border bg-card shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                    <UsersIcon className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h2 className="mt-4 text-base font-semibold text-foreground">
                    Aucun élève inscrit
                  </h2>
                  <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                    Aucun élève n&apos;est inscrit dans cette classe.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border bg-card shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base font-semibold">Grille des notes</CardTitle>
                      <CardDescription>
                        {gradeRows.length} élève{gradeRows.length > 1 ? 's' : ''} · {classSubjects.length} matière{classSubjects.length > 1 ? 's' : ''}
                      </CardDescription>
                    </div>
                    {isLocked && (
                      <Badge variant="outline" className="border-warning-border bg-warning-soft text-warning-ink">
                        <LockIcon className="mr-1 h-3 w-3" /> Clôturée
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="p-0">
                  <div className="max-h-[68vh] overflow-auto">
                    <Table className="min-w-full" style={{ minWidth: `${520 + classSubjects.length * 108}px` }}>
                      <TableHeader>
                        {/* Ligne 1 — Rubriques */}
                        <TableRow className="bg-muted/60 hover:bg-muted/60">
                          <TableHead
                            rowSpan={2}
                            className="sticky left-0 z-30 min-w-[220px] border-r-2 border-border bg-muted/80 pl-6 align-middle text-xs font-semibold uppercase tracking-wider text-foreground shadow-[1px_0_0_hsl(var(--border))]"
                          >
                            Élève
                          </TableHead>
                          {rubricGroups.map(group => {
                            const rc = rubricClasses(group.rubric.code)
                            return (
                              <TableHead
                                key={group.rubric.id}
                                colSpan={group.subjects.length}
                                className={cn(
                                  "border-l-2 text-center align-middle text-xs font-semibold uppercase tracking-wide",
                                  rc.header,
                                  rc.border
                                )}
                              >
                                {group.rubric.code} {poids(group.rubric.code)}
                              </TableHead>
                            )
                          })}
                          <TableHead
                            rowSpan={2}
                            className="min-w-[80px] border-l-2 border-border bg-primary/5 text-center align-middle text-xs font-semibold uppercase tracking-wider text-foreground"
                          >
                            Moy.
                          </TableHead>
                          <TableHead
                            rowSpan={2}
                            className="min-w-[90px] border-l border-border text-center align-middle text-xs font-semibold uppercase tracking-wider text-foreground"
                          >
                            Statut
                          </TableHead>
                          <TableHead
                            rowSpan={2}
                            className="min-w-[60px] border-l border-border text-center align-middle text-xs font-semibold uppercase tracking-wider text-foreground"
                          >
                            Rang
                          </TableHead>
                          <TableHead
                            rowSpan={2}
                            className="min-w-[90px] border-l border-border text-center align-middle text-xs font-semibold uppercase tracking-wider text-foreground"
                          >
                            Appréciation
                          </TableHead>
                        </TableRow>
                        {/* Ligne 2 — Codes matières */}
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          {rubricGroups.map(group => {
                            const rc = rubricClasses(group.rubric.code)
                            return group.subjects.map((cs, i) => (
                              <TableHead
                                key={cs.id}
                                title={cs.subject.name}
                                className={cn(
                                  "min-w-[104px] text-center text-2xs font-semibold uppercase tracking-wide",
                                  rc.col,
                                  i === 0 ? `border-l-2 ${rc.border}` : `border-l ${rc.border}`
                                )}
                              >
                                {cs.subject.code}
                              </TableHead>
                            ))
                          })}
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {gradeRows.map((row, ri) => (
                          <TableRow
                            key={row.enrollmentId}
                            className={cn("group", ri % 2 === 1 && "bg-muted/20")}
                          >
                            <TableCell className="sticky left-0 z-10 border-r-2 border-border bg-card pl-6 shadow-[1px_0_0_hsl(var(--border))] group-hover:bg-muted/80">
                              <div className="text-sm font-semibold text-foreground">{row.lastname}</div>
                              <div className="text-xs text-muted-foreground">{row.firstname}</div>
                            </TableCell>
                            {rubricGroups.map(group => {
                              const rc = rubricClasses(group.rubric.code)
                              return group.subjects.map((cs, i) => {
                                const note = row.grades[cs.id]
                                // Bareme effectif calcule par le module : plus de
                                // troncature d[0], plus de bareme magique 10.
                                const max = row.maxScores[cs.id] ?? 0
                                return (
                                  <TableCell
                                    key={cs.id}
                                    className={cn(
                                      "min-w-[104px] text-center text-sm tabular-nums",
                                      i === 0 ? `border-l-2 ${rc.border}` : "border-l border-border/50"
                                    )}
                                  >
                                    {note !== null && note !== undefined ? (
                                      <span
                                        className={cn(
                                          "inline-flex min-w-[64px] justify-center rounded-md border bg-background px-2 py-1 font-bold shadow-sm",
                                          noteColorClass(note, max)
                                        )}
                                        title={`${cs.subject.name} : ${note.toFixed(2)} / ${max}`}
                                      >
                                        {note.toFixed(2)}
                                      </span>
                                    ) : (
                                      <span className="inline-flex min-w-[64px] justify-center rounded-md border border-dashed px-2 py-1 text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                )
                              })
                            })}
                            {/* Moyenne */}
                            <TableCell
                              className={cn(
                                "min-w-[96px] border-l-2 border-border bg-primary/5 text-center text-sm font-bold tabular-nums",
                                averageColorClass(row.exact)
                              )}
                            >
                              <span className="inline-flex min-w-[72px] justify-center rounded-md bg-background px-2 py-1 shadow-sm">
                                {fmt(row.exact)}
                              </span>
                            </TableCell>
                            {/* Statut */}
                            <TableCell className="border-l border-border text-center">
                              {row.isComplete ? (
                                <Badge className="border-success-border bg-success-soft text-success-ink hover:bg-success-soft">
                                  Complet
                                </Badge>
                              ) : (
                                <Badge className="border-warning-border bg-warning-soft text-warning-ink hover:bg-warning-soft">
                                  Incomplet
                                </Badge>
                              )}
                            </TableCell>
                            {/* Rang */}
                            <TableCell className="border-l border-border text-center text-sm font-bold tabular-nums text-foreground">
                              {row.rang !== null ? `${row.rang}e` : '—'}
                            </TableCell>
                            {/* Appréciation */}
                            <TableCell className="border-l border-border text-center">
                              <Badge
                                variant={row.exact !== null ? "secondary" : "outline"}
                                className="font-bold tabular-nums"
                              >
                                {getAppreciation(row.exact)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>

                      <TableFooter>
                        {/* Ligne moyenne classe */}
                        <TableRow className="bg-muted/60 hover:bg-muted/60">
                          <TableCell className="sticky left-0 z-20 border-r-2 border-border bg-muted/80 pl-6 text-xs font-bold uppercase tracking-wider text-foreground shadow-[1px_0_0_hsl(var(--border))]">
                            Moy. classe
                          </TableCell>
                          {rubricGroups.map(group => {
                            const rc = rubricClasses(group.rubric.code)
                            return group.subjects.map((cs, i) => (
                              <TableCell
                                key={cs.id}
                                className={cn(
                                  "min-w-[104px] text-center text-sm font-bold tabular-nums",
                                  rc.col,
                                  i === 0 ? `border-l-2 ${rc.border}` : "border-l border-border/50"
                                )}
                              >
                                {fmt(columnAverages[cs.id])}
                              </TableCell>
                            ))
                          })}
                          <TableCell className="border-l-2 border-border bg-primary/10 text-center text-sm font-bold tabular-nums text-primary">
                            {fmt(classAverage)}
                          </TableCell>
                          <TableCell className="border-l border-border" />
                          <TableCell className="border-l border-border" />
                          <TableCell className="border-l border-border" />
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )
      )}
    </div>
  )
}
