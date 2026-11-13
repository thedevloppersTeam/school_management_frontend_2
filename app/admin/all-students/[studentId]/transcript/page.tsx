"use client"

import { Fragment, useEffect, useState, useCallback } from "react"
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
import { toMessage } from "@/lib/errors"
import { fetchRoomResults } from "@/lib/api/results"
import { etapesTriees, type AnneeAvecEtapes } from "@/lib/parcours/reference"
import {
  cartesEtapes,
  celluleMatiere,
  chargerMoyennes,
  etatSousMatiere,
  moyenneAnnuelle,
  type CarteEtape,
  type MoyennesAnnee,
} from "@/lib/parcours/resultats"
import { regrouperNotes, texteSaisies, type MatiereSaisie, type NoteSaisie } from "@/lib/parcours/notes"
import { libelleClasseSalle } from "@/lib/classes/labels"
import { cn } from "@/lib/utils"
import { normalizeUploadUrl } from "@/lib/upload-url"
import { LeftBadge } from "@/components/school/left-badge"
import { departureReasonLabel } from "@/lib/departures/departures"
import { formatFrenchLongDate } from "@/lib/date-format"

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
  // Départ en cours d'année (D-22, affichage seul) : date, dernière étape suivie, motif.
  leftAt?: string | null
  lastAttendedStep?: { id: string; name: string } | null
  departureReason?: string | null
  departureNote?: string | null
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

/** Note lue par `/api/grades/enrollment/:id` : seuls les champs affichés sont déclarés. */
type ApiGrade = NoteSaisie

interface EnrollmentSummary {
  enrollment: ApiEnrollment
  /** Notes saisies, regroupées pour l'affichage (aucun calcul). */
  matieres: MatiereSaisie[]
  /** Le chargement des notes de cette inscription a échoué : « aucune note » serait un mensonge. */
  gradesFailed: boolean
  /** Moyennes calculées par le serveur (`GET /api/results`), ou la raison de leur absence. */
  moyennes: MoyennesAnnee
  /** Année de l'inscription avec ses étapes (`GET /api/academic-years`), null si illisible. */
  annee: AnneeAvecEtapes | null
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
 * audible. Depuis le lot B (D-03), les moyennes sont celles du serveur
 * (`GET /api/results`, règles du bulletin) ; rétablir la lettre sur une
 * moyenne est une décision d'affichage distincte, non prise dans ce lot.
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

/**
 * Les moyennes s'affichent **sur 10**, comme le bulletin : le serveur les rend
 * sur 10. `scoreTone` et `alertMark` attendent un POURCENTAGE : leur passer
 * `bande` (lib/parcours/resultats.ts, `pourcentageDeBande`), jamais la valeur
 * sur 10, sans quoi la bande deviendrait fausse d'un facteur dix.
 */
const MENTION_REGLES = "Moyennes calculées selon les règles du bulletin"

/** Texte de l'échec d'un appel `/api/results` pour une année (aucun chiffre de repli). */
const MOYENNES_INDISPONIBLES = "Moyennes indisponibles pour cette année. Réessayez."

/**
 * Années pour lesquelles AUCUN appel `/api/results` n'est fait (règle du
 * relevé, lib/parcours/reference.ts) : la grille garde les notes saisies, sur
 * toutes les étapes de l'année.
 */
const MESSAGES_SANS_APPEL: Partial<Record<MoyennesAnnee["kind"], string>> = {
  "sans-etape": "Aucune étape n'est définie pour cette année.",
  "aucune-etape-en-cours": "Aucune étape en cours pour cette année : moyennes non disponibles.",
  "en-preparation": "Année en préparation : moyennes non disponibles.",
}

/** Étapes à afficher en colonnes : celles du service, sinon celles de l'année. */
function colonnesDe(summary: EnrollmentSummary): Array<{ stepId: string; stepName: string }> {
  if (summary.moyennes.kind === "ok") {
    return cartesEtapes(summary.moyennes.eleve, nomsEtapesDe(summary.annee))
  }
  return etapesTriees(summary.annee?.steps).map((s) => ({ stepId: s.id, stepName: s.name }))
}

function nomsEtapesDe(annee: AnneeAvecEtapes | null): Map<string, string> {
  return new Map((annee?.steps ?? []).map((s) => [s.id, s.name]))
}

function formatDate(value?: string): string {
  if (!value) return "—"
  const d = new Date(value)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}

// ── Moyennes (serveur) ────────────────────────────────────────────────────────

/**
 * « Moy. générale » de l'année = `annual` du service. Aucune mention MENFP :
 * voir `Mention`. La teinte est calculée sur le pourcentage (`bande`).
 */
function MoyenneAnneeEnTete({ moyennes }: { moyennes: MoyennesAnnee }) {
  const annuelle = moyennes.kind === "ok" ? moyenneAnnuelle(moyennes.eleve) : null
  return (
    <div className="flex shrink-0 items-baseline gap-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">Moy. générale</span>
      <span className={cn("text-lg font-bold tabular-nums", scoreTone(annuelle?.bande ?? null))}>
        {annuelle && annuelle.texte !== "—" ? annuelle.texte : <span aria-hidden="true">—</span>}
      </span>
      <span className="text-xs text-muted-foreground">/ 10</span>
      {moyennes.kind !== "ok" && <span className="sr-only">Moyenne indisponible</span>}
    </div>
  )
}

/** Message d'une année sans moyennes du service : jamais de chiffre de repli. */
function MessageMoyennes({ moyennes, onRetry }: { moyennes: MoyennesAnnee; onRetry: () => void }) {
  const sansAppel = MESSAGES_SANS_APPEL[moyennes.kind]
  if (sansAppel) return <p className="text-xs text-muted-foreground">{sansAppel}</p>
  const texte =
    moyennes.kind === "absent"
      ? "Moyennes indisponibles pour cette année : l'inscription est absente des résultats de sa salle."
      : MOYENNES_INDISPONIBLES
  return (
    <div role="status" className="flex flex-wrap items-center gap-2 rounded-md border border-warning-border bg-warning-soft px-3 py-2 text-xs text-warning-ink">
      <span>{texte}</span>
      {moyennes.kind === "echec" && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Réessayer
        </Button>
      )}
    </div>
  )
}

function CarteEtapeVue({ carte, enrollmentId }: { carte: CarteEtape; enrollmentId: string }) {
  return (
    // La page tenait déjà les deux paramètres de la route bulletin
    // sans jamais y mener : l'administrateur re-sélectionnait à la
    // main classe, salle et étape depuis la section Bulletins.
    <Link
      href={`/admin/bulletins/${enrollmentId}/${carte.stepId}`}
      className="rounded-md border bg-muted/20 px-3 py-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{carte.stepName}</p>
      {carte.exempted ? (
        <p className="mt-0.5 text-sm font-medium text-muted-foreground">Dispensé(e)</p>
      ) : (
        <p className={cn("mt-0.5 flex items-baseline gap-1.5 text-lg font-semibold tabular-nums", scoreTone(carte.bande))}>
          {carte.moyenne === "—" ? <span aria-hidden="true">—</span> : carte.moyenne}
          <span className="text-xs font-normal text-muted-foreground">/ 10</span>
        </p>
      )}
      <span className="sr-only">— ouvrir le bulletin de cette étape</span>
    </Link>
  )
}

/**
 * Cartes d'étape = `steps[]` du service (D-03). Élève parti : le service n'y
 * met que les étapes suivies et rend le motif dans `unavailable` (RS-09).
 */
function BlocMoyennesEtapes({
  moyennes,
  annee,
  enrollmentId,
  onRetry,
}: {
  moyennes: MoyennesAnnee
  annee: AnneeAvecEtapes | null
  enrollmentId: string
  onRetry: () => void
}) {
  if (moyennes.kind !== "ok") return <MessageMoyennes moyennes={moyennes} onRetry={onRetry} />
  const cartes = cartesEtapes(moyennes.eleve, nomsEtapesDe(annee))
  const depart = moyennes.eleve.unavailable
  return (
    <div className="space-y-2">
      {depart && (
        <p role="status" className="rounded-md border border-info-border bg-info-soft px-3 py-2 text-xs text-info-ink">
          {depart.message}
        </p>
      )}
      {cartes.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {cartes.map((c) => (
            <CarteEtapeVue key={c.stepId} carte={c} enrollmentId={enrollmentId} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Aucune étape suivie pour cette année.</p>
      )}
      <p className="text-xs text-muted-foreground">{MENTION_REGLES}</p>
    </div>
  )
}

// ── Grille des notes ──────────────────────────────────────────────────────────

const TIRET_ABSENT = (
  <>
    <span aria-hidden="true">—</span>
    <span className="sr-only">Non noté</span>
  </>
)

/**
 * Total d'une matière à une étape : celui du SERVEUR (numérateur / barème
 * retenu), rapproché par `classSubjectId`. Les notes saisies sur la matière
 * entière restent visibles quand le total ne les reflète pas tel quel.
 */
function CelluleMatiereVue({
  summary,
  matiere,
  stepId,
}: {
  summary: EnrollmentSummary
  matiere: MatiereSaisie
  stepId: string
}) {
  const saisies = texteSaisies(matiere.globalParEtape.get(stepId))
  if (summary.moyennes.kind !== "ok") {
    return <TableCell className="text-right tabular-nums text-muted-foreground">{saisies ?? TIRET_ABSENT}</TableCell>
  }
  const c = celluleMatiere(summary.moyennes.eleve, stepId, matiere.classSubjectId)
  const plusieurs = (matiere.globalParEtape.get(stepId)?.length ?? 0) > 1
  return (
    <TableCell className="text-right tabular-nums">
      {c.etat === "exempted" && <span className="text-xs font-medium text-muted-foreground">Dispensé</span>}
      {c.etat === "hors-calcul" && <span className="text-xs text-muted-foreground">Hors calcul</span>}
      {c.etat === "missing" && (
        <>
          {TIRET_ABSENT}
          <span className="text-muted-foreground"> / {c.bareme}</span>
        </>
      )}
      {c.etat === "noted" && (
        <>
          <span className={cn("font-medium", scoreTone(c.bande), alertMark(c.bande))}>{c.note}</span>
          <span className="text-muted-foreground"> / {c.bareme}</span>
          <Mention value={c.bande} />
        </>
      )}
      {saisies && (c.etat !== "noted" || plusieurs) && (
        <span className="block text-2xs text-muted-foreground">Saisie : {saisies}</span>
      )}
    </TableCell>
  )
}

/** Note(s) saisie(s) d'une sous-matière, telles quelles ; dispense marquée d'après le serveur. */
function CelluleSousMatiereVue({
  summary,
  matiere,
  sectionId,
  stepId,
  saisies,
  bareme,
}: {
  summary: EnrollmentSummary
  matiere: MatiereSaisie
  sectionId: string
  stepId: string
  saisies: string | null
  bareme: number | null
}) {
  const dispensee =
    summary.moyennes.kind === "ok" &&
    etatSousMatiere(summary.moyennes.eleve, stepId, matiere.classSubjectId, sectionId) === "exempted"
  return (
    <TableCell className="py-1.5 text-right tabular-nums">
      {saisies ?? TIRET_ABSENT}
      {saisies && bareme !== null && <span> / {bareme.toLocaleString("fr-FR")}</span>}
      {dispensee && <span className="block text-2xs font-medium">Dispensé</span>}
    </TableCell>
  )
}

function LignesMatiere({
  summary,
  matiere,
  colonnes,
}: {
  summary: EnrollmentSummary
  matiere: MatiereSaisie
  colonnes: Array<{ stepId: string; stepName: string }>
}) {
  const avecSous = matiere.sousMatieres.length > 0
  return (
    <Fragment>
      <TableRow className={cn(avecSous && "bg-muted")}>
        {/* `th scope="row"` : en navigation cellule à cellule, le lecteur
            d'écran annonce de quelle matière vient la note. Fond opaque
            nommé, exigé par le figement à gauche. */}
        <TableHead
          scope="row"
          className={cn("sticky left-0 z-10 h-auto p-2 pl-3 font-normal text-foreground", avecSous ? "bg-muted" : "bg-card")}
        >
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{matiere.name}</span>
            <code className="font-mono text-3xs text-muted-foreground">
              {matiere.code}
              {avecSous && ` · ${matiere.sousMatieres.length} sous-matière${matiere.sousMatieres.length > 1 ? "s" : ""}`}
            </code>
          </div>
        </TableHead>
        {colonnes.map((col) => (
          <CelluleMatiereVue key={col.stepId} summary={summary} matiere={matiere} stepId={col.stepId} />
        ))}
      </TableRow>
      {matiere.sousMatieres.map((sec) => (
        <TableRow key={sec.sectionId} className="text-muted-foreground">
          <TableHead scope="row" className="sticky left-0 z-10 h-auto bg-card py-1.5 pl-8 text-xs font-normal">
            <span className="mr-1.5" aria-hidden="true">└</span>
            {sec.name}
            <code className="ml-2 font-mono text-3xs">{sec.code}</code>
          </TableHead>
          {colonnes.map((col) => (
            <CelluleSousMatiereVue
              key={col.stepId}
              summary={summary}
              matiere={matiere}
              sectionId={sec.sectionId}
              stepId={col.stepId}
              saisies={texteSaisies(sec.parEtape.get(col.stepId))}
              bareme={sec.maxScore}
            />
          ))}
        </TableRow>
      ))}
    </Fragment>
  )
}

/**
 * Grille : notes SAISIES (`/api/grades/enrollment/:id`) par matière et par
 * étape. Ligne matière = total du serveur ; lignes sous-matière = notes
 * brutes. Ni coefficient ni moyenne par matière (décision 3 du lot B).
 */
function GrilleNotes({ summary, caption }: { summary: EnrollmentSummary; caption: string }) {
  const colonnes = colonnesDe(summary)
  return (
    <div className="rounded-md border">
      {/* La table défile toujours : hauteur bornée pour l'en-tête collant,
          colonne figée pour garder la matière en vue. */}
      <Table containerClassName="cpmsl-scroll max-h-[70vh]">
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col" className="sticky left-0 top-0 z-20 min-w-[180px] bg-card pl-3 font-semibold">
              Matière / sous-matière
            </TableHead>
            {colonnes.map((s) => (
              <TableHead key={s.stepId} scope="col" className="sticky top-0 z-10 min-w-[120px] bg-card text-right font-semibold">
                {s.stepName}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {summary.matieres.map((m) => (
            <LignesMatiere key={m.classSubjectId} summary={summary} matiere={m} colonnes={colonnes} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ── En-tête d'une inscription ────────────────────────────────────────────────

/** Libellés de l'inscription : classe, salle, filière, année, statut, repères. */
function LibellesInscription({ summary, classe, salle }: { summary: EnrollmentSummary; classe: string; salle: string }) {
  const e = summary.enrollment
  return (
  <div className="flex flex-wrap items-center gap-2">
    {/* DESIGN.md nomme `.heading-3` pour l'en-tête d'année
        scolaire : c'est ici que le serif porte l'autorité. */}
    <span className="heading-3 text-foreground">
      {classe || "Classe inconnue"}
    </span>
    {/* « La Règle des Deux Champs » : la salle est un champ
        à elle, badge monospace comme la colonne Salle de la
        liste des élèves. Et la FILIÈRE n'est pas un suffixe
        de salle — elle vient de l'inscription
        (`Enrollment.trackId`), pas de la classe : ce libellé
        composait « NS3 A — SMP », trois données en une
        chaîne que rien ne permettait de relire. Les deux
        champs portent une étiquette : hors tableau, un
        badge nu ne dit pas ce qu'il contient. */}
    {salle && (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <span className="text-2xs uppercase tracking-wide">Salle</span>
        <span className="inline-flex items-center justify-center rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
          {salle}
        </span>
      </span>
    )}
    {e.track && (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <span className="text-2xs uppercase tracking-wide">Filière</span>
        <span className="rounded border border-info-border bg-info-soft px-1.5 py-0.5 text-xs font-medium text-info-ink">
          {e.track.code}
        </span>
      </span>
    )}
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
    {e.status === "DROPPED" && <LeftBadge leftAt={e.leftAt} />}
  </div>
  )
}

/**
 * D-22 : départ en cours d'année, tel que déclaré (RS-08). Affichage seul : la
 * borne des moyennes est appliquée par le serveur (RS-09).
 */
function DepartDeclare({ e }: { e: ApiEnrollment }) {
  if (e.status !== "DROPPED") return null
  return (
    <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
      <dt className="text-muted-foreground">Date du départ</dt>
      <dd className="text-foreground">{e.leftAt ? formatFrenchLongDate(e.leftAt) : "—"}</dd>
      <dt className="text-muted-foreground">Dernière étape suivie</dt>
      <dd className={cn(e.lastAttendedStep ? "text-foreground" : "font-medium text-warning-ink")}>
        {e.lastAttendedStep?.name ?? "Départ à compléter"}
      </dd>
      <dt className="text-muted-foreground">Motif</dt>
      <dd className="text-foreground">{departureReasonLabel(e.departureReason)}</dd>
      {e.departureNote && (
        <>
          <dt className="text-muted-foreground">Commentaire</dt>
          <dd className="whitespace-pre-wrap text-foreground">{e.departureNote}</dd>
        </>
      )}
    </dl>
  )
}

// ── Chargement ────────────────────────────────────────────────────────────────

/** Notes saisies d'une inscription ; l'échec est retenu, jamais pris pour « aucune note ». */
async function chargerNotes(e: ApiEnrollment): Promise<{ enrollment: ApiEnrollment; grades: ApiGrade[]; failed: boolean }> {
  try {
    const grades = await apiFetch<ApiGrade[]>(`/api/grades/enrollment/${e.id}`)
    return { enrollment: e, grades, failed: false }
  } catch {
    // Sans lui, une année dont les notes n'ont pas chargé afficherait
    // « Aucune note saisie », ce qui est faux.
    return { enrollment: e, grades: [], failed: true }
  }
}

/**
 * Une année par inscription : notes saisies, puis moyennes du serveur.
 *
 * Étapes de chaque année en UN appel (`/api/academic-years`) : elles fixent
 * l'étape de référence (lib/parcours/reference.ts). Un échec n'est pas fatal :
 * les notes restent lisibles, les moyennes sont dites indisponibles. Moyennes :
 * UN appel `/api/results` par inscription (D-03, ADR-007), triées par année
 * décroissante.
 */
async function chargerAnnees(enrollments: ApiEnrollment[]): Promise<EnrollmentSummary[]> {
  const [annees, notes] = await Promise.all([
    apiFetch<AnneeAvecEtapes[]>("/api/academic-years").catch(() => null),
    Promise.all(enrollments.map(chargerNotes)),
  ])
  const moyennes = await chargerMoyennes(
    enrollments.map((e) => ({ id: e.id, classSessionId: e.classSessionId, academicYearId: e.classSession.academicYear.id })),
    annees,
    (classSessionId, stepId) => fetchRoomResults(classSessionId, stepId)
  )
  const anneeParId = new Map((annees ?? []).map((a) => [a.id, a]))
  return notes
    .map(({ enrollment, grades, failed }) => ({
      enrollment,
      matieres: regrouperNotes(grades),
      gradesFailed: failed,
      moyennes: moyennes.get(enrollment.id) ?? { kind: "echec" as const },
      annee: anneeParId.get(enrollment.classSession.academicYear.id) ?? null,
    }))
    .sort((a, b) =>
      b.enrollment.classSession.academicYear.yearString.localeCompare(a.enrollment.classSession.academicYear.yearString)
    )
}

function estIntrouvable(err: unknown): boolean {
  return !!err && typeof err === "object" && "status" in err && (err as { status: number }).status === 404
}

/** Fiche d'identité de l'élève, en tête de page (affichage seul). */
function FicheEleve({ student }: { student: StudentDetail }) {
  const fullName = `${student.user.firstname} ${student.user.lastname}`.trim()
  return (
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
      </CardContent>
    </Card>
  )
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

      const [allEnrollments, photos] = await Promise.all([
        apiFetch<ApiEnrollment[]>(`/api/enrollments?studentId=${studentId}`),
        apiFetch<Array<{ academicYearId: string; photoUrl: string }>>(
          `/api/promotion-photos?studentId=${studentId}`
        ).catch(() => [] as Array<{ academicYearId: string; photoUrl: string }>),
      ])

      setPhotosByYear(new Map(photos.map((p) => [p.academicYearId, p.photoUrl])))

      /*
       * Les inscriptions TRANSFERRED sortent du releve.
       *
       * Le filtre est volontairement negatif, et surtout PAS `status=ACTIVE` :
       * le releve est un document historique, DROPPED et GRADUATED doivent
       * continuer d'y figurer. Seules les inscriptions rendues caduques par un
       * ancien transfert sont ecartees.
       */
      const enrollments = allEnrollments.filter((e) => e.status !== "TRANSFERRED")
      const built = await chargerAnnees(enrollments)

      setSummaries(built)
      setExpandedItems(built.map((s) => s.enrollment.id))
    } catch (err) {
      if (estIntrouvable(err)) {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {backLink}
      </div>

      <FicheEleve student={student} />

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
                const { classe, salle } = libelleClasseSalle(e.classSession)
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
                          <LibellesInscription summary={summary} classe={classe} salle={salle} />
                          <DepartDeclare e={e} />
                        </div>
                        <MoyenneAnneeEnTete moyennes={summary.moyennes} />
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-4">
                      {/* Relevé de notes de CETTE année : prévisualisation, puis PDF. */}
                      <div className="mb-4 flex justify-end">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/all-students/${studentId}/transcript/releve/${e.id}`}>
                            <PrinterIcon className="mr-2 h-4 w-4" />
                            Imprimer le relevé
                          </Link>
                        </Button>
                      </div>
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
                          <BlocMoyennesEtapes
                            moyennes={summary.moyennes}
                            annee={summary.annee}
                            enrollmentId={e.id}
                            onRetry={() => load()}
                          />
                        </div>
                      </div>

                      {summary.matieres.length === 0 ? (
                        <div className="rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
                          {summary.gradesFailed
                            ? "Les notes de cette année n'ont pas pu être chargées."
                            : "Aucune note saisie pour cette année."}
                        </div>
                      ) : (
                        <GrilleNotes
                          summary={summary}
                          caption={`Notes de la classe ${classe || "inconnue"}${salle ? `, salle ${salle}` : ""}, année ${e.classSession.academicYear.yearString}, par matière et par étape.`}
                        />
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
