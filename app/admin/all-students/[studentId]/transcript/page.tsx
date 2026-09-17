"use client"

import { Fragment, useEffect, useMemo, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCaption,
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
import {
  GRADE_SCALE,
  gradeBand,
  gradeBandToneClass,
  gradeMention,
  gradeMentionLabel,
} from "@/lib/bulletin/grade-color"
import { parseDecimal } from "@/lib/decimal"
import { toMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"
import { normalizeUploadUrl } from "@/lib/upload-url"

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
    /**
     * Donnée de **gestion** — statistiques de classe, listes, export MENFP.
     *
     * Elle est exclue du **bulletin** par décision MOA du 2026-09-13, ce qui a
     * justifié une route dédiée côté serveur (`getStudentForBulletin`, au
     * `select:` explicite sans `gender`). Le relevé, lui, passe par
     * `getOneStudent`, qui remonte la ligne `users` entière : la donnée est déjà
     * dans la charge utile, et l'afficher ici ne touche pas à cette décision.
     */
    gender?: "MALE" | "FEMALE" | null
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

interface SectionTotals {
  sectionId: string
  sectionName: string
  sectionCode: string
  perStep: Map<string, { raw: number; max: number }>
}

interface SubjectTotals {
  subjectId: string
  subjectName: string
  subjectCode: string
  maxScore: number
  coefficient: number
  perStep: Map<string, { raw: number; max: number }>
  /**
   * Décomposition par sous-matière, vide quand la matière n'en a pas.
   *
   * Accumulée exactement comme l'agrégat parent — `raw + score`, `max + secMax`
   * — pour que la somme des sous-matières redonne la matière à l'unité près.
   * Ce n'est pas un second calcul, c'est la ventilation du premier.
   */
  sections: Map<string, SectionTotals>
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
  /** Le chargement des notes de cette inscription a échoué : « aucune note » serait un mensonge. */
  gradesFailed: boolean
}

function statusBadge(status: ApiEnrollment["status"]) {
  switch (status) {
    case "ACTIVE":
      return <Badge className="border-success-border bg-success-soft text-success-ink hover:bg-success-soft">Actif</Badge>
    case "DROPPED":
      return <Badge variant="secondary">Désactivé</Badge>
    case "TRANSFERRED":
      return <Badge className="border-info-border bg-info-soft text-info-ink hover:bg-info-soft">Transféré</Badge>
    case "GRADUATED":
      return <Badge className="border-success-border bg-success-soft text-success-ink hover:bg-success-soft">Diplômé</Badge>
    default:
      // Repli en français : l'énumération brute afficherait « SUSPENDED » à une
      // administratrice francophone.
      return <Badge variant="outline">Statut inconnu</Badge>
  }
}

/** L'énumération est en anglais en base ; elle ne s'affiche pas telle quelle. */
function genderLabel(gender?: "MALE" | "FEMALE" | null): string | null {
  if (gender === "MALE") return "Masculin"
  if (gender === "FEMALE") return "Féminin"
  return null
}

function classDisplayName(e: ApiEnrollment): string {
  const trackSuffix = e.track ? ` — ${e.track.code}` : ""
  return `${e.classSession.class.classType.name} ${e.classSession.class.letter}${trackSuffix}`
}

function buildEnrollmentSummary(
  enrollment: ApiEnrollment,
  grades: ApiGrade[],
  gradesFailed: boolean
): EnrollmentSummary {
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
        sections: new Map(),
      })
    }
    const entry = subjectsMap.get(subjectId)!

    const prev = entry.perStep.get(g.step.id) ?? { raw: 0, max: 0 }
    const score = parseDecimal(g.studentScore) ?? 0

    if (g.sectionId && g.section) {
      const secMax = parseDecimal(g.section.maxScore) ?? 0
      entry.perStep.set(g.step.id, { raw: prev.raw + score, max: prev.max + secMax })

      // Même accumulation, ventilée : la somme des sous-matières redonne la
      // matière. Aucun calcul n'est ajouté ici, seulement une décomposition.
      if (!entry.sections.has(g.sectionId)) {
        entry.sections.set(g.sectionId, {
          sectionId: g.sectionId,
          sectionName: g.section.name,
          sectionCode: g.section.code,
          perStep: new Map(),
        })
      }
      const sec = entry.sections.get(g.sectionId)!
      const secPrev = sec.perStep.get(g.step.id) ?? { raw: 0, max: 0 }
      sec.perStep.set(g.step.id, { raw: secPrev.raw + score, max: secPrev.max + secMax })
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
    gradesFailed,
  }
}

/**
 * Teinte d'une note ou d'une moyenne, sur les bandes du bulletin imprimé.
 *
 * Voir `lib/bulletin/grade-color.ts` : les seuils sont ceux de la légende de
 * pied de bulletin (E ≤ 50, D 51-59, C 60-68, puis aucune couleur), et non plus
 * les 70/50 qui vivaient ici.
 */
function scoreTone(value: number | null): string {
  if (value == null) return "text-muted-foreground"
  return gradeBandToneClass(gradeBand(value))
}

/**
 * Second canal, sur les deux bandes d'alerte seulement.
 *
 * Dans les colonnes d'étape, la mention n'est plus visible : la teinte y était
 * redevenue le seul signal, et la clé de lecture est écrite sur 10 alors que
 * ces cellules portent le barème de la matière (/20, /40, /50). Un utilisateur
 * daltonien voyant ne pouvait ni percevoir la couleur ni la reconstituer sans
 * calcul mental (WCAG 1.4.1).
 *
 * Le soulignement pointillé ne marque que l'échec et le déficient — trois
 * bandes sur huit reçoivent un signal, au lieu de huit peintes. La Règle de la
 * Rareté y gagne aussi : ce qui est signalé redevient rare.
 */
function alertMark(value: number | null): string {
  if (value == null) return ""
  const band = gradeBand(value)
  return band === "echec" || band === "deficient"
    ? "border-b border-dotted border-current"
    : ""
}

/**
 * Mention MENFP d'une **note**, annoncée aux lecteurs d'écran.
 *
 * Elle n'est posée que sur les notes individuelles, où elle est fidèle : la
 * bande d'une note sort de `note / barème × 100`, exactement ce que fait
 * `colorClass` sur le gabarit imprimé.
 *
 * Elle n'est posée sur **aucune moyenne** de cette page — ni visible, ni
 * audible. Les moyennes sont pondérées par coefficient, sans les 70 % R1 /
 * 25 % R2 / 5 % R3 que le pied de bulletin déclare comme la règle : leur
 * accoler une lettre officielle, c'était prononcer un verdict d'établissement
 * sur un chiffre qui ne l'applique pas. La teinte reste, elle correspond bien
 * à la valeur affichée ; la lettre reviendra quand `lib/bulletin/compute.ts`
 * alimentera cet écran (U1i-2).
 *
 * Elle n'est pas visible non plus sur les notes : elle se répétait jusqu'à six
 * fois par ligne et écrasait une grille conçue pour le balayage vertical. Le
 * canal visuel de remplacement est `alertMark`.
 */
function Mention({ value }: { value: number | null }) {
  if (value == null) return <span className="sr-only">Non calculée</span>
  const mention = gradeMention(value)
  return (
    <span className="sr-only">
      {" "}
      — mention {mention}, {gradeMentionLabel(mention)}
    </span>
  )
}

/**
 * Échelle des mentions, au point de lecture.
 *
 * Elle vivait en pied de carte, après l'accordéon — donc à plusieurs milliers
 * de pixels du premier chiffre coloré, sur un élève à six inscriptions. On ne
 * descend pas vers une légende dont on ignore l'existence. Elle est ici réduite
 * aux trois bandes qui portent effectivement une couleur : les cinq autres
 * entrées documentaient une absence de couleur sous un titre qui en promettait.
 */
function GradeScaleHint() {
  const colored = GRADE_SCALE.filter((e) => e.band !== "neutre")
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span>Couleurs&nbsp;:</span>
      {colored.map((e) => (
        <span key={e.mention} className="whitespace-nowrap">
          {/* La clé porte elle-même le marqueur qu'elle documente. */}
          <span
            className={cn(
              "font-medium",
              gradeBandToneClass(e.band),
              e.band !== "assez-bien" && "border-b border-dotted border-current"
            )}
          >
            {e.label}
          </span>{" "}
          {e.rangeOn10}
        </span>
      ))}
      <span className="whitespace-nowrap">
        <span className="font-medium text-foreground">Bien et au-delà</span> 6,90 et plus, sans
        couleur
      </span>
    </p>
  )
}

const scoreFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const plainFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 })

/** Affichage seul : aucun arrondi métier n'est introduit ici. */
function formatScore(value: number): string {
  return scoreFormatter.format(value)
}

/**
 * Les moyennes s'affichent **sur 10**, comme le bulletin.
 *
 * Elles sont calculées en interne sur 100 — c'est ce qu'attendent `gradeBand` et
 * `scoreTone`, alignés sur `colorClass` du gabarit, qui raisonne en pourcentage.
 * Seule la restitution change d'échelle. Deux échelles pour le même élève,
 * /100 ici et /10 sur la feuille remise à la famille, étaient ingérables : le
 * seuil de promotion imprimé en pied de bulletin est 7,00.
 *
 * Ne pas passer une valeur déjà divisée à `scoreTone` : la bande deviendrait
 * fausse d'un facteur dix.
 */
function formatAverageOn10(percent: number): string {
  return scoreFormatter.format(percent / 10)
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
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setNotFound(false)
    setLoadError(null)
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
            return { enrollment: e, grades, failed: false }
          } catch {
            // L'échec est retenu : sans lui, une année dont les notes n'ont pas
            // chargé affiche « Aucune note saisie », ce qui est faux.
            return { enrollment: e, grades: [] as ApiGrade[], failed: true }
          }
        })
      )

      const built = gradesPerEnrollment.map(({ enrollment, grades, failed }) =>
        buildEnrollmentSummary(enrollment, grades, failed)
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
        // Une panne n'est pas une absence : sans cet état distinct, l'écran
        // affichait « Élève introuvable » sous un toast qui disait l'inverse.
        setLoadError(toMessage(err, "lors du chargement du relevé de notes"))
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
    // Le compte des inscriptions **retenues** sort avec la valeur : la phrase
    // sous le chiffre annonçait `summaries.length`, donc « Moyenne des 6
    // inscriptions » pour la moyenne de 2. Le dénominateur suit le numérateur.
    return {
      value: valid.length === 0
        ? null
        : valid.reduce((sum, s) => sum + s.generalAverage, 0) / valid.length,
      counted: valid.length,
      /** Une année en panne sort du calcul en silence : il faut le dire. */
      degraded: summaries.some((s) => s.gradesFailed),
    }
  }, [summaries])

  // Rendu dans les trois états : sans lui, le clavier n'avait aucune
  // échappatoire tant que les trois vagues de chargement n'étaient pas revenues.
  const backLink = (
    <Link
      href="/admin/all-students"
      className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeftIcon className="h-4 w-4" />
      Élèves
    </Link>
  )

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        {backLink}
        <p role="status" className="sr-only">
          Chargement du relevé de notes…
        </p>
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        {backLink}
        <Card className="border-destructive/40">
          <CardContent role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm font-medium text-foreground">
              Le relevé n&apos;a pas pu être chargé.
            </p>
            <p className="max-w-prose text-sm text-muted-foreground">{loadError}</p>
            <Button variant="outline" size="sm" onClick={() => load()}>
              Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (notFound || !student) {
    return (
      <div className="space-y-4">
        {backLink}
        <Card className="border-destructive/40">
          <CardContent role="alert" className="py-12 text-center text-sm text-destructive">
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
        {backLink}
        {/* `window.print()` a été retiré : sans gabarit `@media print`, il
            imprimait la coque d'administration, l'accordéon dans son état de
            dépliement courant — donc sans les années repliées, que Radix
            démonte — et les coordonnées d'un mineur. Le bouton reste visible,
            désactivé, parce que l'impression du relevé est une décision
            attendue et non un abandon : voir U1i-1 du backlog. */}
        <div className="flex flex-col items-start gap-1 sm:items-end">
          {/* Pas d'`aria-describedby` : un bouton natif désactivé n'est pas
              focusable, la description n'y serait jamais annoncée. Le paragraphe
              qui suit est dans l'ordre de lecture, il suffit. */}
          <Button variant="outline" size="sm" disabled>
            <PrinterIcon className="mr-2 h-4 w-4" />
            Imprimer
          </Button>
          <p className="text-xs text-muted-foreground">
            Gabarit d&apos;impression en attente de décision. Les bulletins, eux,
            s&apos;impriment depuis chaque étape ci-dessous.
          </p>
        </div>
      </div>

      {/* Profile card */}
      <Card>
        <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start">
          <Avatar className="h-24 w-24 shrink-0">
            <AvatarImage src={normalizeUploadUrl(student.user.profilePhoto)} alt="" />
            <AvatarFallback className="bg-muted text-muted-foreground">
              <UserIcon className="h-10 w-10" />
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-3">
            <div>
              <h1 className="heading-2 break-words text-foreground">{fullName}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{student.studentCode}</code>
                {student.nisu && (
                  <>
                    <span>&middot;</span>
                    <span className="tabular-nums">NISU {student.nisu}</span>
                  </>
                )}
                {genderLabel(student.user.gender) && (
                  <>
                    <span>&middot;</span>
                    <span>
                      <span className="sr-only">Sexe : </span>
                      {genderLabel(student.user.gender)}
                    </span>
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
            {/* Ni couleur ni mention : cette agrégation multi-années n'existe dans
                aucun document opposable (U1i-1 du backlog), et lui donner la bande
                du bulletin lui prêterait un verdict MENFP qu'elle n'a pas.
                Rétrogradée de 36 px à 22 px : la plus grosse chose de l'écran ne
                peut pas être la seule mesure que le produit n'assume pas. Et le
                dire à l'écran, pas seulement dans ce commentaire — sans quoi
                l'absence de couleur se lit « 69 et plus » une fois l'échelle
                apprise. */}
            <p className={cn("text-xl font-bold tabular-nums", overall.value == null ? "text-muted-foreground" : "text-foreground")}>
              {overall.value !== null ? formatAverageOn10(overall.value) : <><span aria-hidden="true">—</span><span className="sr-only">Non calculée</span></>}
            </p>
            <p className="text-xs text-muted-foreground">/ 10</p>
            <p className="mt-2 max-w-[190px] text-right text-xs text-muted-foreground">
              {overall.counted === summaries.length
                ? `Moyenne des ${summaries.length} inscription${summaries.length > 1 ? "s" : ""}`
                : `Moyenne de ${overall.counted} inscription${overall.counted > 1 ? "s" : ""} notée${overall.counted > 1 ? "s" : ""} sur ${summaries.length}`}{" "}
              — hors barème MENFP
            </p>
            {overall.degraded && (
              <p className="max-w-[190px] text-right text-xs text-warning-ink">
                Incomplet : des notes n&apos;ont pas pu être chargées.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transcripts */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <GraduationCapIcon className="h-5 w-5 text-primary" />
                {/* `CardTitle` rend un h3 : le poser ici sautait de h1 à h3. */}
                <h2 className="text-base font-semibold leading-none tracking-tight">
                  Relevé de notes
                </h2>
              </div>
              <CardDescription className="mt-1">
                Historique académique complet de l&apos;élève, classé par année scolaire.
              </CardDescription>
              {summaries.length > 0 && <GradeScaleHint />}
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
              {/* `<h2>` et non `<p>` : DESIGN.md a consigné la correction des
                  titres d'état vide sur 15 emplacements, celui-ci était resté. */}
              <h2 className="mt-3 text-sm font-medium text-foreground">Aucune inscription</h2>
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
                    <AccordionTrigger className="rounded-md px-3 py-3 transition-colors hover:bg-muted hover:no-underline">
                      <div className="flex w-full items-center justify-between gap-3 pr-2">
                        <div className="flex items-center gap-3 text-left">
                          <Avatar className="h-10 w-10 shrink-0 ring-1 ring-border">
                            {/* alt vide : la photo double le libellé de l'année, déjà dans le bouton. */}
                            <AvatarImage src={normalizeUploadUrl(yearPhoto)} alt="" />
                            <AvatarFallback className="bg-muted text-xs text-muted-foreground">
                              {e.classSession.academicYear.yearString.slice(2, 4)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-wrap items-center gap-2">
                            {/* DESIGN.md nomme `.heading-3` pour l'en-tête d'année
                                scolaire : c'est ici que le serif porte l'autorité. */}
                            <span className="heading-3 text-foreground">{className}</span>
                            <Badge variant="outline" className="font-mono text-xs">
                              {e.classSession.academicYear.yearString}
                            </Badge>
                            {statusBadge(e.status)}
                            {/* `information` et non `succes` : l'année courante est un
                                repère de navigation, pas une validation. Deux verts
                                voisins pour deux sens étaient indiscernables. */}
                            {e.classSession.academicYear.isCurrent && (
                              <Badge className="border-info-border bg-info-soft text-xs text-info-ink hover:bg-info-soft">
                                Année courante
                              </Badge>
                            )}
                            {/* Remonté du panneau au déclencheur : « Tout replier »
                                masquait d'un coup tous les avertissements, et une
                                année en panne devenait indiscernable d'une année
                                sans notes. */}
                            {summary.gradesFailed && (
                              <Badge className="border-warning-border bg-warning-soft text-xs text-warning-ink hover:bg-warning-soft">
                                Notes non chargées
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-baseline gap-2">
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">
                            Moy. générale
                          </span>
                          <span className={cn("text-lg font-bold tabular-nums", scoreTone(summary.generalAverage))}>
                            {summary.generalAverage !== null ? (
                              formatAverageOn10(summary.generalAverage)
                            ) : (
                              <span aria-hidden="true">—</span>
                            )}
                          </span>
                          {/* Aucune mention MENFP sur les moyennes de cette page :
                              elles sont pondérées par coefficient, sans les 70 % R1 /
                              25 % R2 / 5 % R3 que le pied de bulletin déclare comme la
                              règle. Afficher la lettre, c'était prononcer un verdict
                              d'établissement sur un chiffre qui ne l'applique pas. La
                              teinte reste : elle correspond bien à `colorClass`. */}
                          <span className="text-xs text-muted-foreground">/ 10</span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-4">
                      {summary.gradesFailed && (
                        <p
                          role="status"
                          className="mb-4 rounded-md border border-warning-border bg-warning-soft px-3 py-2 text-xs text-warning-ink"
                        >
                          Les notes de cette année n&apos;ont pas pu être chargées. Ce qui suit est
                          incomplet : ne l&apos;utilisez pas pour vérifier une moyenne.
                        </p>
                      )}

                      {/* Promotion photo + step summary */}
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start">
                        <div className="shrink-0">
                          {yearPhoto ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={normalizeUploadUrl(yearPhoto)}
                              alt={`Photo de promotion ${e.classSession.academicYear.yearString}`}
                              className="h-28 w-28 rounded-md object-cover ring-1 ring-border"
                            />
                          ) : (
                            <div className="flex h-28 w-28 flex-col items-center justify-center rounded-md border border-dashed bg-muted/30 text-xs text-muted-foreground">
                              <UserIcon className="mb-1 h-6 w-6 opacity-60" />
                              <span>Aucune photo</span>
                            </div>
                          )}
                          <p className="mt-1 text-center text-xs uppercase tracking-wide text-muted-foreground">
                            Promotion {e.classSession.academicYear.yearString}
                          </p>
                        </div>

                        <div className="flex-1">
                          {summary.steps.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              {summary.steps.map((s) => (
                                // La page tenait déjà les deux paramètres de la route bulletin
                                // sans jamais y mener : l'administrateur re-sélectionnait à la
                                // main classe, salle et étape depuis la section Bulletins.
                                <Link
                                  key={s.stepId}
                                  href={`/admin/bulletins/${e.id}/${s.stepId}`}
                                  className="rounded-md border bg-muted/20 px-3 py-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    {s.stepName}
                                  </p>
                                  <p className={cn("mt-0.5 flex items-baseline gap-1.5 text-lg font-semibold tabular-nums", scoreTone(s.average))}>
                                    {s.average !== null ? (
                                      formatAverageOn10(s.average)
                                    ) : (
                                      <span aria-hidden="true">—</span>
                                    )}
                                    <span className="text-xs font-normal text-muted-foreground">/ 10</span>
                                  </p>
                                  <span className="sr-only">— ouvrir le bulletin de cette étape</span>
                                </Link>
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
                          {summary.gradesFailed
                            ? "Les notes de cette année n'ont pas pu être chargées."
                            : "Aucune note saisie pour cette année."}
                        </div>
                      ) : (
                        <div className="rounded-md border">
                          {/* Le conteneur défilant est celui de `Table` ; en ajouter un
                              second les imbriquait sans que ni l'un ni l'autre ne porte
                              l'habillage de barre de défilement du système. */}
                          {/* La table fait ~830 px et défile toujours. Sans hauteur
                              bornée, un en-tête collant n'aurait rien contre quoi se
                              résoudre ; sans colonne figée, on lit une colonne de
                              chiffres sans savoir de quelle matière — et une ligne
                              `└` anonyme ne veut plus rien dire. */}
                          <Table containerClassName="cpmsl-scroll max-h-[70vh]">
                            <TableCaption className="sr-only">
                              Notes de {className}, année {e.classSession.academicYear.yearString},
                              par matière et par étape. Moyennes sur 10.
                            </TableCaption>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent">
                                <TableHead
                                  scope="col"
                                  className="sticky left-0 top-0 z-20 min-w-[180px] bg-card pl-3 font-semibold"
                                >
                                  Matière / sous-matière
                                </TableHead>
                                <TableHead scope="col" className="sticky top-0 z-10 min-w-[72px] bg-card text-right font-semibold">
                                  Coef.
                                </TableHead>
                                {/* Largeur plancher : sans elle, la colonne Matière se
                                    comprime avant que le défilement ne s'active. */}
                                {summary.steps.map((s) => (
                                  <TableHead key={s.stepId} scope="col" className="sticky top-0 z-10 min-w-[120px] bg-card text-right font-semibold">
                                    {s.stepName}
                                  </TableHead>
                                ))}
                                <TableHead scope="col" className="sticky top-0 z-10 min-w-[110px] bg-card pr-3 text-right font-semibold">
                                  Moyenne <span className="font-normal text-muted-foreground">/ 10</span>
                                </TableHead>
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
                                const sections = Array.from(subj.sections.values())
                                return (
                                  <Fragment key={subj.subjectId}>
                                  {/* Ligne matière. Quand elle porte des sous-matières,
                                      elle en est la somme : c'est le même accumulateur,
                                      ventilé plus bas. */}
                                  <TableRow className={cn(sections.length > 0 && "bg-muted")}>
                                    {/* `th scope="row"` : en navigation cellule à
                                        cellule, le lecteur d'écran n'annonçait jamais
                                        de quelle matière venait la note. Fond opaque
                                        nommé, exigé par le figement à gauche. */}
                                    <TableHead
                                      scope="row"
                                      className={cn(
                                        "sticky left-0 z-10 h-auto p-2 pl-3 font-normal text-foreground",
                                        sections.length > 0 ? "bg-muted" : "bg-card"
                                      )}
                                    >
                                      <div className="flex flex-col">
                                        <span className="font-medium text-foreground">{subj.subjectName}</span>
                                        <code className="font-mono text-3xs text-muted-foreground">
                                          {subj.subjectCode}
                                          {sections.length > 0 && (
                                            <>
                                              {" · "}
                                              {sections.length} sous-matière
                                              {sections.length > 1 ? "s" : ""}
                                            </>
                                          )}
                                        </code>
                                      </div>
                                    </TableHead>
                                    <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                                      {plainFormatter.format(subj.coefficient)}
                                    </TableCell>
                                    {summary.steps.map((step) => {
                                      const entry = subj.perStep.get(step.stepId)
                                      if (!entry || entry.max <= 0) {
                                        return (
                                          <TableCell key={step.stepId} className="text-right text-muted-foreground">
                                            <span aria-hidden="true">—</span>
                                            <span className="sr-only">Non noté</span>
                                          </TableCell>
                                        )
                                      }
                                      // La note est ramenée au pourcentage avant
                                      // d'être colorée : le gabarit imprimé fait
                                      // exactement `note / coeff × 100`.
                                      const pct = (entry.raw / entry.max) * 100
                                      return (
                                        <TableCell key={step.stepId} className="text-right tabular-nums">
                                          <span className={cn("font-medium", scoreTone(pct), alertMark(pct))}>
                                            {formatScore(entry.raw)}
                                          </span>
                                          <span className="text-muted-foreground">
                                            {" "}
                                            / {plainFormatter.format(entry.max)}
                                          </span>
                                          <Mention value={pct} />
                                        </TableCell>
                                      )
                                    })}
                                    <TableCell className="pr-3 text-right">
                                      <span className={cn("font-semibold tabular-nums", scoreTone(subjAvg))}>
                                        {subjAvg !== null ? (
                                          formatAverageOn10(subjAvg)
                                        ) : (
                                          <span aria-hidden="true">—</span>
                                        )}
                                      </span>
                                    </TableCell>
                                  </TableRow>

                                  {/* Lignes sous-matière. Ni coefficient ni moyenne :
                                      dans le modèle, le coefficient est porté par la
                                      matière (`classSubject`), pas par la section, et
                                      une moyenne de sous-matière n'est un objet
                                      d'aucun document.

                                      Ces deux cellules sont **vides**, plus barrées d'un
                                      tiret : dans la même table, `—` veut déjà dire
                                      « non noté ». Le même glyphe pour une donnée
                                      manquante et pour une notion inexistante faisait
                                      lire trois absences de saisie par ligne. Le
                                      `sr-only` dit ce que le vide signifie. */}
                                  {sections.map((sec) => (
                                    <TableRow key={sec.sectionId} className="text-muted-foreground">
                                      <TableHead
                                        scope="row"
                                        className="sticky left-0 z-10 h-auto bg-card p-2 py-1.5 pl-8 font-normal text-muted-foreground"
                                      >
                                        <span className="mr-1.5" aria-hidden="true">└</span>
                                        {sec.sectionName}
                                        <code className="ml-2 font-mono text-3xs">{sec.sectionCode}</code>
                                      </TableHead>
                                      <TableCell className="py-1.5 text-right">
                                        <span className="sr-only">Sans coefficient propre</span>
                                      </TableCell>
                                      {summary.steps.map((step) => {
                                        const cell = sec.perStep.get(step.stepId)
                                        if (!cell || cell.max <= 0) {
                                          return (
                                            <TableCell key={step.stepId} className="py-1.5 text-right">
                                              <span aria-hidden="true">—</span>
                                              <span className="sr-only">Non noté</span>
                                            </TableCell>
                                          )
                                        }
                                        const secPct = (cell.raw / cell.max) * 100
                                        return (
                                          <TableCell key={step.stepId} className="py-1.5 text-right tabular-nums">
                                            <span className={cn(scoreTone(secPct), alertMark(secPct))}>
                                              {formatScore(cell.raw)}
                                            </span>
                                            <span> / {plainFormatter.format(cell.max)}</span>
                                            <Mention value={secPct} />
                                          </TableCell>
                                        )
                                      })}
                                      <TableCell className="py-1.5 pr-3 text-right">
                                        <span className="sr-only">Sans moyenne propre</span>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  </Fragment>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {e.notes && (
                        <p className="mt-3 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            Remarque d&apos;inscription&nbsp;:
                          </span>{" "}
                          {e.notes}
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
