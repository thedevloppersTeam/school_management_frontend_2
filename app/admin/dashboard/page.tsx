// app/admin/dashboard/page.tsx
// Client Component : page de pilotage MVP avec donnees dashboard existantes.
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ElementType } from "react";
import {
  AlertTriangleIcon,
  ArchiveIcon,
  ArrowRightIcon,
  BarChart3Icon,
  CheckCircle2Icon,
  CircleDashedIcon,
  ClipboardCheckIcon,
  ClipboardEditIcon,
  FileTextIcon,
  InfoIcon,
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

type MvpStatus =
  | "Terminé"
  | "En cours"
  | "À faire"
  | "À vérifier"
  | "Bloquant"
  | "Non disponible";

type ActionPriority = "Critique" | "Important" | "Normal";

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
  tone: "blue" | "emerald" | "amber" | "violet" | "slate" | "rose";
}

interface ChecklistItem {
  label: string;
  status: MvpStatus;
  description: string;
  href: string;
  actionLabel: string;
}

interface NextAction {
  title: string;
  reason: string;
  priority: ActionPriority;
  href: string;
}

interface MvpAlert {
  title: string;
  status: MvpStatus;
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

function getStatusClasses(status: MvpStatus) {
  switch (status) {
    case "Terminé":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "En cours":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "À faire":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Bloquant":
      return "border-red-200 bg-red-50 text-red-700";
    case "Non disponible":
      return "border-slate-200 bg-slate-50 text-slate-600";
    case "À vérifier":
    default:
      return "border-violet-200 bg-violet-50 text-violet-700";
  }
}

function getPriorityClasses(priority: ActionPriority) {
  switch (priority) {
    case "Critique":
      return "border-red-200 bg-red-50 text-red-700";
    case "Important":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Normal":
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function toneClasses(tone: SummaryCardItem["tone"]) {
  const map = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    slate: "bg-slate-100 text-slate-600",
    rose: "bg-rose-50 text-rose-600",
  };
  return map[tone];
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

  const closedSteps = steps.filter((step) => !step.isCurrent);
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
          ? "Le compteur des matières n’est pas disponible depuis le Dashboard."
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
          ? "À vérifier dans la configuration annuelle."
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
          ? "Contrôlez l’avancement des notes dans l’écran Notes."
          : "Une année, une classe et une étape sont nécessaires.",
      href: routes.grades,
      actionLabel: "Contrôler",
    },
    {
      label: "Notes validées",
      status: "À vérifier",
      description:
        "Aucun statut consolidé de validation n’est disponible sur le Dashboard.",
      href: routes.grades,
      actionLabel: "Vérifier",
    },
    {
      label: "Étape clôturée",
      status:
        closedSteps.length > 0 ? "Terminé" : currentStep ? "En cours" : "À vérifier",
      description:
        closedSteps.length > 0
          ? `${closedSteps.length} étape(s) clôturée(s).`
          : "La clôture se fait depuis la configuration annuelle.",
      href: routes.config,
      actionLabel: "Clôturer",
    },
    {
      label: "Bulletins générés",
      status:
        extraData.archiveCount === null
          ? "À vérifier"
          : extraData.archiveCount > 0
            ? "Terminé"
            : "À faire",
      description:
        extraData.archiveCount === null
          ? "À vérifier dans l’écran Bulletins."
          : `${extraData.archiveCount} bulletin(s) archivé(s).`,
      href: routes.reports,
      actionLabel: "Générer",
    },
    {
      label: "Archives disponibles",
      status:
        extraData.archiveCount === null
          ? "À vérifier"
          : extraData.archiveCount > 0
            ? "Terminé"
            : "À faire",
      description:
        extraData.archiveCount === null
          ? "Le compteur des archives n’est pas disponible."
          : "Les archives se consultent dans l’historique des bulletins.",
      href: routes.archives,
      actionLabel: "Consulter",
    },
  ];
}

function buildNextActions(checklist: ChecklistItem[]): NextAction[] {
  return checklist
    .filter((item) => item.status !== "Terminé" && item.status !== "Non disponible")
    .slice(0, 5)
    .map((item) => ({
      title: item.actionLabel + " : " + item.label,
      reason: item.description,
      priority:
        item.status === "Bloquant"
          ? "Critique"
          : item.status === "À faire"
            ? "Important"
            : "Normal",
      href: item.href,
    }));
}

function buildMvpAlerts(params: {
  activeYear: AcademicYear | null;
  currentStep: AcademicYearStep | null;
  sessions: ClassSession[];
  totalStudents: number;
  extraData: DashboardExtraData;
  routes: ReturnType<typeof getRouteSet>;
}): MvpAlert[] {
  const { activeYear, currentStep, sessions, totalStudents, extraData, routes } =
    params;
  const alerts: MvpAlert[] = [];

  if (!activeYear) {
    alerts.push({
      title: "Aucune année scolaire active",
      status: "Bloquant",
      description: "Commencez par créer ou activer une année scolaire.",
      href: routes.academicYears,
      actionLabel: "Configurer",
    });
  }

  if (activeYear && sessions.length === 0) {
    alerts.push({
      title: "Classes / salles à configurer",
      status: "Bloquant",
      description: "Aucune classe n’est disponible pour l’année scolaire active.",
      href: routes.config,
      actionLabel: "Configurer",
    });
  }

  if (extraData.subjectCount === 0) {
    alerts.push({
      title: "Matières non configurées",
      status: "Bloquant",
      description: "Les matières doivent être configurées avant la saisie.",
      href: routes.config,
      actionLabel: "Configurer",
    });
  }

  if (
    extraData.assignmentSummary &&
    sessions.length > 0 &&
    extraData.assignmentSummary.sessionsWithSubjects < sessions.length
  ) {
    alerts.push({
      title: "Matières non affectées",
      status: "À vérifier",
      description: "Certaines classes n’ont pas encore de matières affectées.",
      href: routes.config,
      actionLabel: "Vérifier",
    });
  }

  if (activeYear && totalStudents === 0) {
    alerts.push({
      title: "Aucun élève inscrit",
      status: "À faire",
      description: "Inscrivez les élèves avant de saisir les notes.",
      href: routes.students,
      actionLabel: "Inscrire",
    });
  }

  if (activeYear && currentStep) {
    alerts.push({
      title: "Notes manquantes",
      status: "À vérifier",
      description: "Contrôlez l’avancement des notes dans l’écran Notes.",
      href: routes.grades,
      actionLabel: "Contrôler",
    });

    alerts.push({
      title: "Étape non clôturée",
      status: currentStep.isCurrent ? "En cours" : "À vérifier",
      description: `Étape actuelle : ${currentStep.name}.`,
      href: routes.config,
      actionLabel: "Gérer",
    });
  }

  if (extraData.archiveCount === 0) {
    alerts.push({
      title: "Archives absentes",
      status: "À faire",
      description: "Aucun bulletin archivé n’a été trouvé pour l’année active.",
      href: routes.reports,
      actionLabel: "Générer",
    });
  }

  alerts.push({
    title: "Élèves sans NISU valide",
    status: "À vérifier",
    description: "Le Dashboard ne dispose pas d’un compteur fiable. Vérifiez la liste des élèves.",
    href: routes.students,
    actionLabel: "Vérifier",
  });

  return alerts;
}

function ActiveYearCard({
  activeYear,
  currentStep,
  routes,
}: {
  activeYear: AcademicYear | null;
  currentStep: AcademicYearStep | null;
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
              État de l’année scolaire utilisée par les opérations MVP
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
              ? "Les données du Dashboard sont rattachées à cette année scolaire."
              : "Commencez par créer ou activer une année scolaire."}
          </p>
        </div>
        <StatusValue label="Statut" value={activeYear ? "Active" : "À faire"} />
        <StatusValue
          label="Étape active"
          value={currentStep?.name ?? "Non disponible"}
        />
        <StatusValue label="Dernière mise à jour" value="Non disponible" />
      </CardContent>
    </Card>
  );
}

function StatusValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function SummaryCards({ items }: { items: SummaryCardItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label} className="border bg-card shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-1 truncate text-2xl font-semibold text-foreground">
                    {item.value}
                  </p>
                </div>
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    toneClasses(item.tone),
                  )}
                >
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
  const completed = items.filter((item) => item.status === "Terminé").length;
  const pct = Math.round((completed / items.length) * 100);

  return (
    <Card className="border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              Progression MVP
            </CardTitle>
            <CardDescription>
              Configuration → élèves → notes → clôture → bulletins → archives
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Progress value={pct} className="h-2 w-32" />
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {pct}%
            </span>
          </div>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="p-0">
        <div className="divide-y">
          {items.map((item, index) => (
            <div
              key={item.label}
              className="grid gap-3 p-4 md:grid-cols-[32px_1fr_auto]"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
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
                <p className="mt-1 text-sm text-muted-foreground">
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

function NextActions({ actions }: { actions: NextAction[] }) {
  return (
    <Card className="border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          Prochaines actions
        </CardTitle>
        <CardDescription>
          Les étapes recommandées pour continuer le parcours MVP
        </CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-3 p-4">
        {actions.length === 0 ? (
          <div className="rounded-lg border bg-emerald-50 p-4 text-sm text-emerald-800">
            Aucune action critique immédiate. Vérifiez les notes et les archives
            avant la prochaine clôture.
          </div>
        ) : (
          actions.map((action) => (
            <div
              key={`${action.title}-${action.href}`}
              className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {action.title}
                  </p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "border",
                      getPriorityClasses(action.priority),
                    )}
                  >
                    {action.priority}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {action.reason}
                </p>
              </div>
              <Button asChild size="sm">
                <Link href={action.href}>
                  Ouvrir
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function MvpAlerts({ alerts }: { alerts: MvpAlert[] }) {
  const visibleAlerts = alerts.filter((alert) => alert.status !== "Terminé");

  return (
    <Card className="border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Alertes MVP</CardTitle>
        <CardDescription>
          Points à traiter ou à vérifier avant d’avancer
        </CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-3 p-4">
        {visibleAlerts.length === 0 ? (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
            <CheckCircle2Icon className="h-4 w-4 !text-emerald-600" />
            <AlertTitle>Aucune alerte critique</AlertTitle>
            <AlertDescription>
              Les principaux indicateurs disponibles ne signalent pas de blocage.
            </AlertDescription>
          </Alert>
        ) : (
          visibleAlerts.map((alert) => (
            <Alert
              key={`${alert.title}-${alert.status}`}
              className="border bg-background"
            >
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertTitle className="flex flex-wrap items-center gap-2">
                {alert.title}
                <Badge
                  variant="outline"
                  className={cn("border", getStatusClasses(alert.status))}
                >
                  {alert.status}
                </Badge>
              </AlertTitle>
              <AlertDescription className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{alert.description}</span>
                <Button asChild size="sm" variant="outline">
                  <Link href={alert.href}>{alert.actionLabel}</Link>
                </Button>
              </AlertDescription>
            </Alert>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function QuickLinks({ links }: { links: QuickLink[] }) {
  return (
    <Card className="border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Accès rapide</CardTitle>
        <CardDescription>Écrans principaux du parcours MVP</CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.label}
              href={link.href}
              className="group rounded-lg border bg-muted/30 p-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

export default function AdminDashboardPage() {
  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null);
  const [steps, setSteps] = useState<AcademicYearStep[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [extraData, setExtraData] =
    useState<DashboardExtraData>(EMPTY_EXTRA_DATA);
  const [loading, setLoading] = useState(true);
  const [hasPartialData, setHasPartialData] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setHasPartialData(false);

      try {
        const year = await fetchActiveAcademicYear();
        if (cancelled) return;
        setActiveYear(year);

        if (!year) {
          setSteps([]);
          setSessions([]);
          setTotalStudents(0);
          setExtraData(EMPTY_EXTRA_DATA);
          return;
        }

        const [stepsData, sessionsData] = await Promise.all([
          fetchSteps(year.id),
          fetchClassSessions(year.id),
        ]);

        if (cancelled) return;
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

        if (cancelled) return;
        const fulfilledCounts = counts
          .filter(
            (
              result,
            ): result is PromiseFulfilledResult<{
              sessionId: string;
              studentCount: number;
            }> =>
              result.status === "fulfilled",
          )
          .map((result) => result.value);
        setTotalStudents(
          fulfilledCounts.reduce((sum, stat) => sum + stat.studentCount, 0),
        );
        if (fulfilledCounts.length !== sessionsData.length) {
          setHasPartialData(true);
        }

        const dashboardExtra = await fetchDashboardExtraData(year, sessionsData);
        if (cancelled) return;
        setExtraData(dashboardExtra);
        if (
          dashboardExtra.subjectCount === null ||
          dashboardExtra.assignmentSummary === null ||
          dashboardExtra.archiveCount === null
        ) {
          setHasPartialData(true);
        }
      } catch {
        if (!cancelled) {
          setActiveYear(null);
          setSteps([]);
          setSessions([]);
          setTotalStudents(0);
          setExtraData(EMPTY_EXTRA_DATA);
          setHasPartialData(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const routes = useMemo(() => getRouteSet(activeYear), [activeYear]);
  const currentStep = useMemo(() => getCurrentStep(steps), [steps]);
  const closedSteps = steps.filter((step) => !step.isCurrent);

  const summaryCards: SummaryCardItem[] = useMemo(
    () => [
      {
        label: "Élèves",
        value: totalStudents,
        description: "Inscrits dans l’année scolaire active",
        icon: UsersIcon,
        tone: "emerald",
      },
      {
        label: "Classes / salles",
        value: sessions.length,
        description: "Groupes disponibles pour la saisie",
        icon: SchoolIcon,
        tone: "amber",
      },
      {
        label: "Matières",
        value: extraData.subjectCount ?? "À vérifier",
        description: "Matières configurées",
        icon: ClipboardEditIcon,
        tone: "blue",
      },
      {
        label: "Notes",
        value: currentStep ? "À vérifier" : "À faire",
        description: currentStep
          ? `Contrôle requis pour ${currentStep.name}`
          : "Aucune étape active disponible",
        icon: BarChart3Icon,
        tone: "violet",
      },
      {
        label: "Bulletins",
        value: extraData.archiveCount ?? "À vérifier",
        description: "Bulletins générés ou archivés",
        icon: FileTextIcon,
        tone: "rose",
      },
      {
        label: "Archives",
        value:
          extraData.archiveCount === null
            ? "À vérifier"
            : extraData.archiveCount > 0
              ? "Disponibles"
              : "À faire",
        description: "Historique des bulletins",
        icon: ArchiveIcon,
        tone: "slate",
      },
    ],
    [currentStep, extraData.archiveCount, extraData.subjectCount, sessions.length, totalStudents],
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

  const nextActions = useMemo(() => buildNextActions(checklist), [checklist]);
  const mvpAlerts = useMemo(
    () =>
      buildMvpAlerts({
        activeYear,
        currentStep,
        sessions,
        totalStudents,
        extraData,
        routes,
      }),
    [activeYear, currentStep, extraData, routes, sessions, totalStudents],
  );

  const quickLinks: QuickLink[] = useMemo(
    () => [
      {
        label: "Configuration annuelle",
        description: "Année, étapes, classes, matières",
        href: routes.config,
        icon: SettingsIcon,
      },
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
        label: "Validation / avancement",
        description: "Contrôle des notes",
        href: routes.grades,
        icon: ClipboardCheckIcon,
      },
      {
        label: "Clôture",
        description: "Depuis la configuration",
        href: routes.config,
        icon: CheckCircle2Icon,
      },
      {
        label: "Bulletins",
        description: "Individuel et lot",
        href: routes.reports,
        icon: FileTextIcon,
      },
      {
        label: "Rapport statistique",
        description: "PDF classe",
        href: routes.reports,
        icon: BarChart3Icon,
      },
      {
        label: "Archives",
        description: "Versions de bulletins",
        href: routes.archives,
        icon: ArchiveIcon,
      },
    ],
    [routes],
  );

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="space-y-1">
          <Skeleton className="h-9 w-80" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Skeleton className="h-44 rounded-xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <Skeleton key={item} className="h-[132px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Tableau de bord administrateur
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Pilotage de l’année scolaire et des opérations MVP</span>
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

      {hasPartialData && (
        <Alert className="border-blue-200 bg-blue-50 text-blue-900">
          <InfoIcon className="h-4 w-4 !text-blue-600" />
          <AlertTitle>Données partielles</AlertTitle>
          <AlertDescription>
            Certains indicateurs ne sont pas disponibles depuis le Dashboard.
            Les lignes concernées sont marquées “À vérifier”.
          </AlertDescription>
        </Alert>
      )}

      {!activeYear && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertTriangleIcon className="h-4 w-4 !text-amber-600" />
          <AlertTitle>Aucune année scolaire active</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Commencez par créer ou activer une année scolaire pour piloter le
              MVP.
            </span>
            <Button asChild size="sm" variant="outline">
              <Link href={routes.academicYears}>Configurer l’année scolaire</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <ActiveYearCard
        activeYear={activeYear}
        currentStep={currentStep}
        routes={routes}
      />

      <SummaryCards items={summaryCards} />

      {steps.length > 0 && (
        <Card className="border bg-card shadow-sm">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50">
                <CircleDashedIcon className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {currentStep
                    ? `Étape active : ${currentStep.name}`
                    : "Étape active à vérifier"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {closedSteps.length} étape(s) clôturée(s) sur {steps.length}
                </p>
              </div>
            </div>
            <div className="flex flex-1 items-center gap-3">
              <Progress
                value={Math.round((closedSteps.length / steps.length) * 100)}
                className="flex-1 bg-muted [&>div]:bg-violet-500"
              />
              <span className="text-sm font-medium tabular-nums text-muted-foreground">
                {Math.round((closedSteps.length / steps.length) * 100)}%
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <ProgressChecklist items={checklist} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <NextActions actions={nextActions} />
        <MvpAlerts alerts={mvpAlerts} />
      </div>

      <QuickLinks links={quickLinks} />
    </div>
  );
}
