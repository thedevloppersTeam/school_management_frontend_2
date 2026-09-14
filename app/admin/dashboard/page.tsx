// app/admin/dashboard/page.tsx
// Client Component : pilotage de l'année scolaire à partir des données dashboard.
"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
} from "react";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  ClipboardEditIcon,
  FileTextIcon,
  InfoIcon,
  RefreshCwIcon,
  SchoolIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react";
import {
  fetchActiveAcademicYear,
  fetchClassSessions,
  fetchEnrollmentCount,
  fetchSteps,
  getCurrentStep,
  type AcademicYear,
  type AcademicYearStep,
  type ClassSession,
} from "@/lib/api/dashboard";
import { clientFetch as apiFetch } from "@/lib/client-fetch";
import { toMessage } from "@/lib/errors";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type ChecklistStatus =
  | "Terminé"
  | "En cours"
  | "À faire"
  | "À vérifier"
  | "Bloquant";

type LoadState = "loading" | "ready" | "error";

interface SubjectRow {
  id: string;
}

interface ClassSubjectRow {
  id: string;
}

interface ArchiveRow {
  id: string;
}

interface AssignmentSummary {
  totalAssigned: number;
  sessionsWithSubjects: number;
  checkedSessions: number;
}

interface DashboardExtraData {
  subjectCount: number | null;
  assignmentSummary: AssignmentSummary | null;
  archiveCount: number | null;
}

interface SummaryCardItem {
  label: string;
  value: string | number;
  description: string;
  icon: ElementType;
}

interface ChecklistItem {
  label: string;
  status: ChecklistStatus;
  description: string;
  href: string;
  actionLabel: string;
}

interface QuickLink {
  label: string;
  description: string;
  href: string;
  icon: ElementType;
}

const EMPTY_EXTRA_DATA: DashboardExtraData = {
  subjectCount: null,
  assignmentSummary: null,
  archiveCount: null,
};

const TIME_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});

function getRouteSet(activeYear: AcademicYear | null) {
  const yearId = activeYear?.id;
  return {
    academicYears: "/admin/academic-years",
    config: yearId ? `/admin/academic-year/${yearId}/config` : "/admin/academic-years",
    students: yearId ? `/admin/academic-year/${yearId}/students` : "/admin/all-students",
    grades: yearId ? `/admin/academic-year/${yearId}/grades` : "/admin/academic-years",
    reports: yearId ? `/admin/academic-year/${yearId}/reports` : "/admin/academic-years",
    archives: "/admin/archives",
  };
}

function getStatusClasses(status: ChecklistStatus) {
  switch (status) {
    case "Terminé":
      return "border-success-border bg-success-soft text-success-ink";
    case "En cours":
      return "border-info-border bg-info-soft text-info-ink";
    case "À faire":
      return "border-warning-border bg-warning-soft text-warning-ink";
    case "Bloquant":
      return "border-error-border bg-error-soft text-error-ink";
    case "À vérifier":
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

/**
 * Étapes dont la date de fin est passée.
 *
 * `isCurrent` ne distingue PAS les étapes passées des étapes futures : filtrer
 * sur `!isCurrent` affichait « 3 étapes clôturées sur 4 » dès la rentrée. La
 * clôture réelle n'existe pas encore dans le contrat de données ; en attendant,
 * on parle d'étapes « écoulées », ce que la date de fin permet d'affirmer.
 */
function countElapsedSteps(steps: AcademicYearStep[], now: number): number {
  return steps.filter((step) => {
    const end = new Date(step.endDate).getTime();
    return Number.isFinite(end) && end < now;
  }).length;
}

async function fetchDashboardExtraData(
  year: AcademicYear,
  sessions: ClassSession[],
): Promise<DashboardExtraData> {
  const [subjectsResult, archivesResult, assignmentsResult] =
    await Promise.allSettled([
      apiFetch<SubjectRow[]>("/api/subjects"),
      apiFetch<ArchiveRow[]>(`/api/bulletin-archives?academicYearId=${year.id}`),
      Promise.allSettled(
        sessions.map((session) =>
          apiFetch<ClassSubjectRow[]>(
            `/api/class-subjects?classSessionId=${session.id}`,
          ),
        ),
      ),
    ]);

  const subjectCount =
    subjectsResult.status === "fulfilled" && Array.isArray(subjectsResult.value)
      ? subjectsResult.value.length
      : null;

  const archiveCount =
    archivesResult.status === "fulfilled" && Array.isArray(archivesResult.value)
      ? archivesResult.value.length
      : null;

  let assignmentSummary: AssignmentSummary | null = null;
  if (assignmentsResult.status === "fulfilled") {
    const fulfilled = assignmentsResult.value.filter(
      (result): result is PromiseFulfilledResult<ClassSubjectRow[]> =>
        result.status === "fulfilled",
    );

    if (fulfilled.length > 0 || sessions.length === 0) {
      assignmentSummary = {
        totalAssigned: fulfilled.reduce(
          (sum, result) => sum + result.value.length,
          0,
        ),
        sessionsWithSubjects: fulfilled.filter(
          (result) => result.value.length > 0,
        ).length,
        checkedSessions: fulfilled.length,
      };
    }
  }

  return {
    subjectCount,
    archiveCount,
    assignmentSummary,
  };
}

function buildChecklist(params: {
  activeYear: AcademicYear | null;
  steps: AcademicYearStep[];
  sessions: ClassSession[];
  totalStudents: number;
  currentStep: AcademicYearStep | null;
  extraData: DashboardExtraData;
  routes: ReturnType<typeof getRouteSet>;
}): ChecklistItem[] {
  const {
    activeYear,
    steps,
    sessions,
    totalStudents,
    currentStep,
    extraData,
    routes,
  } = params;

  const hasSubjects =
    extraData.subjectCount === null ? null : extraData.subjectCount > 0;
  const assignmentSummary = extraData.assignmentSummary;
  const assignmentsComplete =
    assignmentSummary && sessions.length > 0
      ? assignmentSummary.checkedSessions === sessions.length &&
        assignmentSummary.sessionsWithSubjects === sessions.length
      : null;

  return [
    {
      label: "Année scolaire active",
      status: activeYear ? "Terminé" : "Bloquant",
      description: activeYear
        ? `${activeYear.name} est l’année scolaire utilisée.`
        : "Aucune année scolaire active n’est disponible.",
      href: routes.academicYears,
      actionLabel: activeYear ? "Gérer" : "Configurer",
    },
    {
      label: "Périodes / étapes configurées",
      status: !activeYear ? "Bloquant" : steps.length > 0 ? "Terminé" : "À faire",
      description:
        steps.length > 0
          ? `${steps.length} étape(s) configurée(s).`
          : "Configurez les périodes et étapes de l’année scolaire.",
      href: routes.config,
      actionLabel: "Configurer",
    },
    {
      label: "Classes / salles / filières configurées",
      status: !activeYear ? "Bloquant" : sessions.length > 0 ? "Terminé" : "À faire",
      description:
        sessions.length > 0
          ? `${sessions.length} classe(s), salle(s) ou filière(s) disponible(s).`
          : "Ajoutez les classes, salles et filières nécessaires.",
      href: routes.config,
      actionLabel: "Configurer",
    },
    {
      label: "Matières configurées",
      status:
        hasSubjects === null ? "À vérifier" : hasSubjects ? "Terminé" : "À faire",
      description:
        extraData.subjectCount === null
          ? "Le compteur des matières n’a pas pu être lu. Ouvrez la configuration pour le vérifier."
          : `${extraData.subjectCount} matière(s) configurée(s).`,
      href: routes.config,
      actionLabel: "Voir",
    },
    {
      label: "Affectations matières / classes complètes",
      status:
        assignmentsComplete === null
          ? "À vérifier"
          : assignmentsComplete
            ? "Terminé"
            : assignmentSummary && assignmentSummary.totalAssigned > 0
              ? "En cours"
              : "À faire",
      description:
        assignmentSummary === null
          ? "Les affectations n’ont pas pu être lues. Ouvrez la configuration pour les vérifier."
          : `${assignmentSummary.sessionsWithSubjects}/${sessions.length} classe(s) avec matières affectées.`,
      href: routes.config,
      actionLabel: "Affecter",
    },
    {
      label: "Élèves inscrits",
      status: !activeYear ? "Bloquant" : totalStudents > 0 ? "Terminé" : "À faire",
      description:
        totalStudents > 0
          ? `${totalStudents} élève(s) inscrit(s).`
          : "Aucun élève inscrit pour l’année scolaire active.",
      href: routes.students,
      actionLabel: "Inscrire",
    },
    {
      label: "Notes saisies",
      status:
        !activeYear || sessions.length === 0 || !currentStep
          ? "À faire"
          : "À vérifier",
      description:
        activeYear && currentStep
          ? `Contrôlez l’avancement des notes de ${currentStep.name} dans l’écran Notes.`
          : "Une année, une classe et une étape sont nécessaires.",
      href: routes.grades,
      actionLabel: "Contrôler",
    },
    {
      label: "Bulletins archivés",
      status:
        extraData.archiveCount === null
          ? "À vérifier"
          : extraData.archiveCount > 0
            ? "Terminé"
            : "À faire",
      description:
        extraData.archiveCount === null
          ? "Le compteur des archives n’a pas pu être lu. Ouvrez l’écran Bulletins pour le vérifier."
          : extraData.archiveCount > 0
            ? `${extraData.archiveCount} bulletin(s) archivé(s) pour cette année.`
            : "Aucun bulletin archivé pour cette année.",
      href: routes.reports,
      actionLabel: "Générer",
    },
  ];
}

function ActiveYearCard({
  activeYear,
  lastUpdatedAt,
  routes,
}: {
  activeYear: AcademicYear | null;
  lastUpdatedAt: Date | null;
  routes: ReturnType<typeof getRouteSet>;
}) {
  return (
    <Card className="border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              Année scolaire active
            </CardTitle>
            <CardDescription>
              L’année à laquelle toutes les données de cet écran se rattachent
            </CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={routes.config}>
              <SettingsIcon className="h-4 w-4" />
              Configuration annuelle
            </Link>
          </Button>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="grid gap-4 p-5 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Année scolaire
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {activeYear?.name ?? "Aucune année active"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {activeYear
              ? "Les données de cet écran sont rattachées à cette année scolaire."
              : "Commencez par créer ou activer une année scolaire."}
          </p>
        </div>
        <StatusValue label="Statut" value={activeYear ? "Active" : "À faire"} />
        <StatusValue
          label="Chiffres relevés à"
          value={lastUpdatedAt ? TIME_FORMAT.format(lastUpdatedAt) : "—"}
        />
      </CardContent>
    </Card>
  );
}

function StatusValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

function SummaryCards({ items }: { items: SummaryCardItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label} className="border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-1 truncate text-2xl font-semibold tabular-nums text-foreground">
                    {item.value}
                  </p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {item.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ProgressChecklist({ items }: { items: ChecklistItem[] }) {
  // Une ligne « À vérifier » signale une donnée que le serveur n'a pas fournie.
  // La compter dans le dénominateur rendrait 100 % inatteignable et le
  // pourcentage cesserait de vouloir dire quelque chose.
  const determinable = items.filter((item) => item.status !== "À vérifier");
  const unverified = items.length - determinable.length;
  const completed = determinable.filter(
    (item) => item.status === "Terminé",
  ).length;
  const pct =
    determinable.length > 0
      ? Math.round((completed / determinable.length) * 100)
      : 0;
  const allDone = determinable.length > 0 && completed === determinable.length;

  return (
    <Card className="border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              Préparation de l’année
            </CardTitle>
            <CardDescription>
              {completed} sur {determinable.length} étape(s) vérifiable(s)
              {unverified > 0
                ? ` · ${unverified} à contrôler manuellement`
                : ""}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Progress
              value={pct}
              aria-label={`Préparation de l’année : ${pct} %`}
              className="h-2 w-32"
            />
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {pct}%
            </span>
          </div>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="p-0">
        {allDone && (
          <div className="flex items-start gap-3 border-b bg-success-soft p-4 text-sm text-success-ink">
            <CheckCircle2Icon className="mt-0.5 h-4 w-4 shrink-0 text-success-ink" />
            <p>
              Tout ce que cet écran sait vérifier est en place.
              {unverified > 0
                ? " Il reste les points marqués « À vérifier », que le serveur ne sait pas encore compter."
                : ""}
            </p>
          </div>
        )}
        <div className="divide-y">
          {items.map((item, index) => (
            <div
              key={item.label}
              className="grid gap-3 p-4 md:grid-cols-[32px_1fr_auto]"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                {index + 1}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {item.label}
                  </p>
                  <Badge
                    variant="outline"
                    className={cn("border", getStatusClasses(item.status))}
                  >
                    {item.status}
                  </Badge>
                </div>
                <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
              <Button asChild size="sm" variant="outline" className="md:self-center">
                <Link href={item.href}>
                  {item.actionLabel}
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickLinks({ links }: { links: QuickLink[] }) {
  return (
    <Card className="border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Accès rapide</CardTitle>
        <CardDescription>Les quatre écrans du travail courant</CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.label}
              href={link.href}
              className="group rounded-lg border bg-muted/30 p-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background ring-1 ring-border">
                  <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {link.label}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {link.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}

function PageHeading({ activeYear }: { activeYear: AcademicYear | null }) {
  return (
    <div>
      <h1 className="heading-1 text-foreground">
        Tableau de bord administrateur
      </h1>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Pilotage de l’année scolaire</span>
        {activeYear && (
          <>
            <span>&middot;</span>
            <Badge variant="secondary" className="align-middle">
              {activeYear.name}
            </Badge>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null);
  const [steps, setSteps] = useState<AcademicYearStep[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [extraData, setExtraData] =
    useState<DashboardExtraData>(EMPTY_EXTRA_DATA);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [partialReasons, setPartialReasons] = useState<string[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  // Une requête plus ancienne ne doit jamais écraser une plus récente : le
  // bouton « Réessayer » peut relancer un chargement pendant qu'un autre court.
  const requestIdRef = useRef(0);

  // Aucun setState synchrone ici : la fonction est appelée depuis un effet, et
  // tout état visible n'est écrit qu'après le premier `await`. La remise à zéro
  // avant chargement appartient à `reload`, que seuls les boutons déclenchent.
  const loadDashboard = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const isStale = () => requestIdRef.current !== requestId;

    try {
      const year = await fetchActiveAcademicYear();
      if (isStale()) return;
      setActiveYear(year);
      setErrorMessage(null);

      if (!year) {
        setSteps([]);
        setSessions([]);
        setTotalStudents(0);
        setExtraData(EMPTY_EXTRA_DATA);
        setLastUpdatedAt(new Date());
        setLoadState("ready");
        return;
      }

      const [stepsData, sessionsData] = await Promise.all([
        fetchSteps(year.id),
        fetchClassSessions(year.id),
      ]);

      if (isStale()) return;
      const orderedSteps = [...stepsData].sort(
        (a, b) => a.stepNumber - b.stepNumber,
      );
      setSteps(orderedSteps);
      setSessions(sessionsData);

      const counts = await Promise.allSettled(
        sessionsData.map(async (session) => ({
          sessionId: session.id,
          studentCount: await fetchEnrollmentCount(session.id),
        })),
      );

      if (isStale()) return;
      const fulfilledCounts = counts
        .filter(
          (
            result,
          ): result is PromiseFulfilledResult<{
            sessionId: string;
            studentCount: number;
          }> => result.status === "fulfilled",
        )
        .map((result) => result.value);
      setTotalStudents(
        fulfilledCounts.reduce((sum, stat) => sum + stat.studentCount, 0),
      );

      const reasons: string[] = [];
      if (fulfilledCounts.length !== sessionsData.length) {
        const missing = sessionsData.length - fulfilledCounts.length;
        reasons.push(`les effectifs de ${missing} classe(s)`);
      }

      const dashboardExtra = await fetchDashboardExtraData(year, sessionsData);
      if (isStale()) return;
      setExtraData(dashboardExtra);

      if (dashboardExtra.subjectCount === null) {
        reasons.push("le compteur des matières");
      }
      if (dashboardExtra.assignmentSummary === null) {
        reasons.push("les affectations matières / classes");
      }
      if (dashboardExtra.archiveCount === null) {
        reasons.push("le compteur des bulletins archivés");
      }

      setPartialReasons(reasons);
      setLastUpdatedAt(new Date());
      setLoadState("ready");
    } catch (err) {
      if (isStale()) return;
      // Surtout : on ne vide RIEN. Une panne de lecture n'est pas une perte de
      // données, et l'écran ne doit jamais laisser croire le contraire.
      setErrorMessage(toMessage(err));
      setLoadState("error");
    }
  }, []);

  const reload = useCallback(() => {
    setLoadState("loading");
    setErrorMessage(null);
    setPartialReasons([]);
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    void loadDashboard();
    return () => {
      requestIdRef.current += 1;
    };
  }, [loadDashboard]);

  const routes = useMemo(() => getRouteSet(activeYear), [activeYear]);
  const currentStep = useMemo(() => getCurrentStep(steps), [steps]);
  const hasDeclaredCurrentStep = steps.some((step) => step.isCurrent);

  // Référence temporelle = l'instant du relevé, pas l'instant du rendu. Rend le
  // calcul pur (pas de Date.now() pendant le render) et cohérent avec la valeur
  // « Chiffres relevés à » affichée juste au-dessus.
  const elapsedSteps = useMemo(
    () =>
      lastUpdatedAt ? countElapsedSteps(steps, lastUpdatedAt.getTime()) : 0,
    [steps, lastUpdatedAt],
  );

  const summaryCards: SummaryCardItem[] = useMemo(
    () => [
      {
        label: "Élèves",
        value: totalStudents,
        description: "Inscrits dans l’année scolaire active",
        icon: UsersIcon,
      },
      {
        label: "Classes / salles",
        value: sessions.length,
        description: "Groupes disponibles pour la saisie",
        icon: SchoolIcon,
      },
      {
        label: "Matières",
        value: extraData.subjectCount ?? "À vérifier",
        description: "Matières configurées",
        icon: ClipboardEditIcon,
      },
      {
        label: "Bulletins archivés",
        value: extraData.archiveCount ?? "À vérifier",
        description: "Pour l’année scolaire active",
        icon: FileTextIcon,
      },
    ],
    [extraData.archiveCount, extraData.subjectCount, sessions.length, totalStudents],
  );

  const checklist = useMemo(
    () =>
      buildChecklist({
        activeYear,
        steps,
        sessions,
        totalStudents,
        currentStep,
        extraData,
        routes,
      }),
    [activeYear, currentStep, extraData, routes, sessions, steps, totalStudents],
  );

  const quickLinks: QuickLink[] = useMemo(
    () => [
      {
        label: "Élèves",
        description: "Inscriptions et classes",
        href: routes.students,
        icon: UsersIcon,
      },
      {
        label: "Notes",
        description: "Saisie et consultation",
        href: routes.grades,
        icon: ClipboardEditIcon,
      },
      {
        label: "Bulletins",
        description: "Individuel et lot",
        href: routes.reports,
        icon: FileTextIcon,
      },
      {
        label: "Configuration annuelle",
        description: "Année, étapes, classes, matières",
        href: routes.config,
        icon: SettingsIcon,
      },
    ],
    [routes],
  );

  if (loadState === "loading") {
    return (
      <div className="space-y-6" role="status" aria-live="polite" aria-busy>
        <span className="sr-only">Chargement du tableau de bord…</span>
        <div className="space-y-1">
          <Skeleton className="h-9 w-80" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Skeleton className="h-44 rounded-xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-[132px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="space-y-6">
        <PageHeading activeYear={activeYear} />
        <Alert role="alert" className="border-error-border bg-error-soft text-error-ink">
          <AlertTriangleIcon className="h-4 w-4 !text-error-ink" />
          <AlertTitle>Impossible de charger le tableau de bord</AlertTitle>
          <AlertDescription className="mt-2 space-y-3">
            <p>
              Le serveur n’a pas répondu. Vos données ne sont pas perdues :
              seule cette page n’a pas pu les lire.
            </p>
            {errorMessage && (
              <p className="text-xs opacity-80">Détail : {errorMessage}</p>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={reload}
            >
              <RefreshCwIcon className="h-3.5 w-3.5" />
              Réessayer
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeading activeYear={activeYear} />
        <Button
          size="sm"
          variant="outline"
          onClick={reload}
          className="shrink-0"
        >
          <RefreshCwIcon className="h-3.5 w-3.5" />
          Actualiser
        </Button>
      </div>

      {partialReasons.length > 0 && (
        <Alert
          role="status"
          aria-live="polite"
          className="border-info-border bg-info-soft text-info-ink"
        >
          <InfoIcon className="h-4 w-4 !text-info-ink" />
          <AlertTitle>Données partielles</AlertTitle>
          <AlertDescription>
            Le serveur n’a pas renvoyé {partialReasons.join(", ")}. Les lignes
            concernées affichent « À vérifier ».
          </AlertDescription>
        </Alert>
      )}

      {!activeYear && (
        <Alert className="border-warning-border bg-warning-soft text-warning-ink">
          <AlertTriangleIcon className="h-4 w-4 !text-warning-ink" />
          <AlertTitle>Aucune année scolaire active</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Le serveur a répondu qu’aucune année n’est marquée active. Créez-en
              une ou activez une année existante.
            </span>
            <Button asChild size="sm" variant="outline">
              <Link href={routes.academicYears}>Configurer l’année scolaire</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <ActiveYearCard
        activeYear={activeYear}
        lastUpdatedAt={lastUpdatedAt}
        routes={routes}
      />

      <SummaryCards items={summaryCards} />

      {steps.length > 0 && (
        <Card className="border bg-card shadow-sm">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <CircleDashedIcon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {currentStep
                    ? hasDeclaredCurrentStep
                      ? `Étape en cours : ${currentStep.name}`
                      : `Étape supposée : ${currentStep.name}`
                    : "Aucune étape en cours"}
                </p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {elapsedSteps} étape(s) écoulée(s) sur {steps.length}
                  {hasDeclaredCurrentStep
                    ? ""
                    : " · aucune étape n’est marquée en cours côté serveur"}
                </p>
              </div>
            </div>
            <div className="flex flex-1 items-center gap-3">
              <Progress
                value={Math.round((elapsedSteps / steps.length) * 100)}
                aria-label={`Étapes écoulées : ${elapsedSteps} sur ${steps.length}`}
                className="flex-1"
              />
              <span className="text-sm font-medium tabular-nums text-muted-foreground">
                {Math.round((elapsedSteps / steps.length) * 100)}%
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <ProgressChecklist items={checklist} />

      <QuickLinks links={quickLinks} />
    </div>
  );
}
