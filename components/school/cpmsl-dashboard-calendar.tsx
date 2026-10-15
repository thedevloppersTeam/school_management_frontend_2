// components/school/cpmsl-dashboard-calendar.tsx
// Calendrier de l'école sur le tableau de bord : vue mensuelle des jours
// fériés de l'année ACTIVE. Lecture seule — la saisie se fait dans
// /admin/settings, onglet « Calendrier scolaire ».
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { fetchHolidays, type AcademicYear } from "@/lib/api/dashboard";
import { toMessage } from "@/lib/errors";
import {
  addDays,
  addMonths,
  formatCivilLong,
  formatMonthTitle,
  parseCivil,
  todayCivil,
  WEEKDAY_LONG_FR,
  WEEKDAY_SHORT_FR,
} from "@/lib/calendar/dates";
import { holidaysToEvents } from "@/lib/calendar/from-holidays";
import { buildMonthGrid, upcomingEvents, type MonthGridDay } from "@/lib/calendar/month-grid";
import type { CalendarDayEvent } from "@/lib/calendar/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const SETTINGS_HREF = "/admin/settings";

type HolidaysState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; events: CalendarDayEvent[]; ignored: number };

function dayAriaLabel(day: MonthGridDay): string {
  let label = formatCivilLong(day.date);
  if (day.isToday) label += ", aujourd’hui";
  if (day.events.length > 0) {
    label += `, jour férié : ${day.events.map((e) => e.label).join(", ")}`;
  }
  return label;
}

function dayClasses(day: MonthGridDay): string {
  return cn(
    "relative flex h-8 w-full items-center justify-center rounded-md border text-sm tabular-nums transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
    !day.inMonth && "border-transparent text-muted-foreground",
    day.inMonth && day.events.length === 0 && "border-transparent text-foreground hover:bg-muted",
    day.inMonth && day.isWeekend && day.events.length === 0 && "bg-muted",
    day.inMonth &&
      day.events.length > 0 &&
      "border-info-border bg-info-soft font-semibold text-info-ink",
    day.isToday && "ring-1 ring-primary",
  );
}

export function CPMSLDashboardCalendar({
  activeYear,
  className,
}: {
  activeYear: AcademicYear | null;
  /** Classes ajoutées à la carte (ex. `flex-1` pour égaliser les colonnes). */
  className?: string;
}) {
  // Date réelle, lue une fois au montage. La page ne monte ce composant
  // qu'après son propre chargement, donc jamais pendant le rendu serveur.
  const [today] = useState(() => todayCivil(new Date()));
  const todayParts = parseCivil(today);
  const [view, setView] = useState(() => ({
    year: todayParts?.year ?? 2026,
    month: todayParts?.month ?? 1,
  }));
  const [focusDate, setFocusDate] = useState(today);
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [state, setState] = useState<HolidaysState>({ kind: "loading" });
  const shouldFocusRef = useRef(false);
  const dayRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (!activeYear) return;
    let cancelled = false;

    void (async () => {
      try {
        // Jours fériés seulement. Congés (événements scolaires de type
        // « holiday », /api/academic-years/:id/events) : EXCLUS, consigne du
        // 2026-10-15. Les inclure = ajouter cet appel ici et fusionner.
        const raw = await fetchHolidays(activeYear.id);
        if (cancelled) return;
        if (!Array.isArray(raw)) {
          setState({ kind: "error", message: "La réponse du serveur n’est pas une liste." });
          return;
        }
        const { events, ignored } = holidaysToEvents(raw);
        setState({ kind: "ready", events, ignored });
      } catch (err) {
        if (!cancelled) setState({ kind: "error", message: toMessage(err) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeYear]);

  const events = useMemo(
    () => (state.kind === "ready" ? state.events : []),
    [state],
  );
  const weeks = useMemo(
    () => buildMonthGrid(view.year, view.month, events, today),
    [view, events, today],
  );
  const upcoming = useMemo(() => upcomingEvents(events, today), [events, today]);

  // Le jour qui porte le focus clavier : celui choisi s'il est dans le mois
  // affiché, sinon aujourd'hui s'il y est, sinon le 1er.
  const monthPrefix = `${view.year}-${String(view.month).padStart(2, "0")}`;
  const rovingDate = focusDate.startsWith(monthPrefix)
    ? focusDate
    : today.startsWith(monthPrefix)
      ? today
      : `${monthPrefix}-01`;

  useEffect(() => {
    if (!shouldFocusRef.current) return;
    shouldFocusRef.current = false;
    dayRefs.current.get(rovingDate)?.focus();
  }, [rovingDate]);

  const moveFocus = (date: string) => {
    const p = parseCivil(date);
    if (!p) return;
    shouldFocusRef.current = true;
    setFocusDate(date);
    setDetailDate(date);
    if (p.year !== view.year || p.month !== view.month) {
      setView({ year: p.year, month: p.month });
    }
  };

  const onGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (e.key in moves) {
      e.preventDefault();
      moveFocus(addDays(rovingDate, moves[e.key]));
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const target = addMonths(view.year, view.month, e.key === "PageUp" ? -1 : 1);
      moveFocus(`${target.year}-${String(target.month).padStart(2, "0")}-01`);
    }
  };

  const goToMonth = (delta: number) => {
    setView((v) => addMonths(v.year, v.month, delta));
    setDetailDate(null);
  };

  const goToToday = () => {
    if (todayParts) setView({ year: todayParts.year, month: todayParts.month });
    setFocusDate(today);
    setDetailDate(null);
  };

  const detailDay = detailDate
    ? weeks.flat().find((d) => d.date === detailDate) ?? null
    : null;
  const monthTitleId = "dashboard-calendar-month";

  return (
    <Card className={cn("border bg-card shadow-sm", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Calendrier de l’école</CardTitle>
        <CardDescription>
          {activeYear
            ? `Jours fériés de l’année ${activeYear.name}`
            : "Aucune année scolaire active"}
        </CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-3 p-4">
        {/* Navigation */}
        <div className="flex items-center justify-between gap-2">
          <p
            id={monthTitleId}
            aria-live="polite"
            className="text-sm font-semibold text-foreground"
          >
            {formatMonthTitle(view.year, view.month)}
          </p>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              aria-label="Mois précédent"
              onClick={() => goToMonth(-1)}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={goToToday}>
              Aujourd’hui
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              aria-label="Mois suivant"
              onClick={() => goToMonth(1)}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Grille */}
        <div role="grid" aria-labelledby={monthTitleId} onKeyDown={onGridKeyDown}>
          <div role="row" className="grid grid-cols-7 gap-1 pb-1">
            {WEEKDAY_SHORT_FR.map((short, i) => (
              <div
                key={short}
                role="columnheader"
                aria-label={WEEKDAY_LONG_FR[i]}
                className="text-center text-xs font-medium text-muted-foreground"
              >
                {short}
              </div>
            ))}
          </div>
          {weeks.map((week) => (
            <div key={week[0].date} role="row" className="grid grid-cols-7 gap-1 pb-1">
              {week.map((day) => (
                <div key={day.date} role="gridcell">
                  <button
                    type="button"
                    ref={(el) => {
                      if (el) dayRefs.current.set(day.date, el);
                      else dayRefs.current.delete(day.date);
                    }}
                    tabIndex={day.date === rovingDate ? 0 : -1}
                    aria-label={dayAriaLabel(day)}
                    aria-current={day.isToday ? "date" : undefined}
                    className={dayClasses(day)}
                    onClick={() => moveFocus(day.date)}
                    onFocus={() => setDetailDate(day.date)}
                    onMouseEnter={() => setDetailDate(day.date)}
                  >
                    {Number(day.date.slice(8))}
                    {day.inMonth && day.events.length > 0 && (
                      <span
                        aria-hidden
                        className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-info"
                      />
                    )}
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Détail du jour survolé ou focalisé — déjà annoncé par aria-label. */}
        <p aria-hidden className="min-h-5 text-xs text-muted-foreground">
          {detailDay
            ? `${formatCivilLong(detailDay.date)} — ${
                detailDay.events.length > 0
                  ? `jour férié : ${detailDay.events.map((e) => e.label).join(", ")}`
                  : "aucun jour férié"
              }`
            : "Survolez ou sélectionnez un jour pour voir son libellé."}
        </p>

        {/* Légende */}
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Légende">
          <li className="flex items-center gap-2">
            <span aria-hidden className="relative inline-flex h-4 w-4 rounded border border-info-border bg-info-soft">
              <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-info" />
            </span>
            Jour férié
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="inline-flex h-4 w-4 rounded ring-1 ring-primary" />
            Aujourd’hui
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="inline-flex h-4 w-4 rounded bg-muted" />
            Week-end
          </li>
        </ul>

        <Separator />

        {/* États et prochains jours */}
        {!activeYear ? (
          <p className="text-sm text-muted-foreground">
            Aucune année scolaire active : aucun jour férié à afficher.
          </p>
        ) : state.kind === "loading" ? (
          <p role="status" className="text-sm text-muted-foreground">
            Chargement des jours fériés…
          </p>
        ) : state.kind === "error" ? (
          <div
            role="alert"
            className="rounded-md border border-error-border bg-error-soft p-3 text-sm text-error-ink"
          >
            <p className="font-medium">Les jours fériés n’ont pas pu être lus.</p>
            <p className="mt-1 text-xs">
              La grille s’affiche sans marquage. Détail : {state.message}
            </p>
          </div>
        ) : state.events.length === 0 && state.ignored === 0 ? (
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">Aucun jour férié configuré</p>
            <Link
              href={SETTINGS_HREF}
              className="inline-flex items-center gap-1 text-sm text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Configurer les jours fériés
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            <h4 className="text-xs font-medium uppercase text-muted-foreground">
              Prochains jours fériés
            </h4>
            {upcoming.length > 0 ? (
              <ul className="space-y-1.5">
                {upcoming.map((event) => (
                  <li
                    key={`${event.date}-${event.label}`}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 truncate text-foreground">{event.label}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatCivilLong(event.date)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucun jour férié à venir dans la configuration.
              </p>
            )}
            {state.ignored > 0 && (
              <p className="text-xs text-warning-ink">
                {state.ignored} jour(s) férié(s) ignoré(s) : date ou libellé illisible dans la
                configuration.
              </p>
            )}
          </div>
        )}

        {activeYear && (state.kind !== "ready" || state.events.length > 0 || state.ignored > 0) && (
          <Link
            href={SETTINGS_HREF}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Configurer les jours fériés
            <ArrowRightIcon className="h-3 w-3" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
