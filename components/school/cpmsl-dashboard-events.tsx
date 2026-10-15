// components/school/cpmsl-dashboard-events.tsx
// Événements à venir de l'année ACTIVE, sur le tableau de bord. Lecture
// seule — la saisie se fait dans /admin/settings, onglet « Calendrier scolaire ».
//
// Le type s'affiche en badge NEUTRE : un type d'événement n'est pas un état
// (DESIGN.md, Règle de la Rareté).
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRightIcon, CalendarDaysIcon } from "lucide-react";
import { fetchSchoolEvents, type AcademicYear } from "@/lib/api/dashboard";
import { toMessage } from "@/lib/errors";
import { formatCivilLong, todayCivil } from "@/lib/calendar/dates";
import {
  SCHOOL_EVENT_TYPE_LABELS,
  schoolEventsToItems,
  type SchoolEventItem,
} from "@/lib/calendar/from-events";
import { upcomingEvents } from "@/lib/calendar/month-grid";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SETTINGS_HREF = "/admin/settings";
const MAX_UPCOMING = 5;

type EventsState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; events: SchoolEventItem[]; ignored: number };

const LINK_CLASS =
  "inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function CPMSLDashboardEvents({
  activeYear,
  className,
}: {
  activeYear: AcademicYear | null;
  /** Classes ajoutées à la carte (ex. `flex-1` pour égaliser les colonnes). */
  className?: string;
}) {
  // Date réelle, lue une fois au montage (composant monté après le chargement
  // de la page, jamais pendant le rendu serveur).
  const [today] = useState(() => todayCivil(new Date()));
  const [state, setState] = useState<EventsState>({ kind: "loading" });

  useEffect(() => {
    if (!activeYear) return;
    let cancelled = false;

    void (async () => {
      try {
        const raw = await fetchSchoolEvents(activeYear.id);
        if (cancelled) return;
        if (!Array.isArray(raw)) {
          setState({ kind: "error", message: "La réponse du serveur n’est pas une liste." });
          return;
        }
        const { events, ignored } = schoolEventsToItems(raw);
        setState({ kind: "ready", events, ignored });
      } catch (err) {
        if (!cancelled) setState({ kind: "error", message: toMessage(err) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeYear]);

  const upcoming = useMemo(
    () =>
      state.kind === "ready"
        ? upcomingEvents(state.events, today, MAX_UPCOMING)
        : [],
    [state, today],
  );

  let body: ReactNode;
  if (!activeYear) {
    body = (
      <p className="text-sm text-muted-foreground">
        Aucune année scolaire active : aucun événement à afficher.
      </p>
    );
  } else if (state.kind === "loading") {
    body = (
      <div role="status" aria-live="polite" aria-busy className="space-y-4">
        <span className="sr-only">Chargement des événements…</span>
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-10 rounded-md" />
      </div>
    );
  } else if (state.kind === "error") {
    body = (
      <div
        role="alert"
        className="rounded-md border border-error-border bg-error-soft p-4 text-sm text-error-ink"
      >
        <p className="font-medium">Les événements n’ont pas pu être lus.</p>
        <p className="mt-1 text-xs">Détail : {state.message}</p>
      </div>
    );
  } else {
    body = (
      <div className="space-y-4">
        {upcoming.length > 0 ? (
          <ul className="divide-y">
            {upcoming.map((event, index) => (
              <li
                key={`${event.date}-${event.title}-${index}`}
                className="flex items-start gap-3 py-4 first:pt-0 last:pb-0"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CalendarDaysIcon className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground" title={event.title}>
                    {event.title}
                  </p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {formatCivilLong(event.date)}
                    {event.date === today ? " · aujourd’hui" : ""}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="shrink-0 border-border bg-muted text-muted-foreground"
                >
                  {SCHOOL_EVENT_TYPE_LABELS[event.type]}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {state.events.length === 0
              ? "Aucun événement configuré pour cette année."
              : "Aucun événement à venir d’ici la fin de l’année."}
          </p>
        )}
        {state.ignored > 0 && (
          <p className="text-xs text-warning-ink">
            {state.ignored} événement(s) ignoré(s) : date ou titre illisible dans la
            configuration.
          </p>
        )}
      </div>
    );
  }

  return (
    <Card className={cn("border bg-card shadow-sm", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Événements à venir</CardTitle>
        <CardDescription>
          {activeYear
            ? `Événements de l’année ${activeYear.name}`
            : "Aucune année scolaire active"}
        </CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-4 p-6">
        {body}
        {activeYear && (
          <Link href={SETTINGS_HREF} className={LINK_CLASS}>
            Gérer les événements
            <ArrowRightIcon className="h-3 w-3" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
