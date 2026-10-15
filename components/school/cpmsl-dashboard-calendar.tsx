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
import {
  describeHolidayCoverage,
  formatHolidayCoverage,
  type HolidayCoverage,
  type HolidayCoverageInput,
} from "@/lib/calendar/day-detail-state";
import { holidaysToEvents } from "@/lib/calendar/from-holidays";
import { weekEdgeTarget } from "@/lib/calendar/grid-keys";
import { initialMonth } from "@/lib/calendar/initial-month";
import { calendarCardDescription } from "@/lib/dashboard/labels";
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

/**
 * Libellé complet d'un jour. Un jour sans jour férié n'affirme rien (« aucun »
 * reste réservé au détail, quand la liste est lue) ; un jour non chargé, hors
 * de l'année ou en erreur le dit.
 */
function dayAriaLabel(day: MonthGridDay, coverage: HolidayCoverage): string {
  let label = formatCivilLong(day.date);
  if (day.isToday) label += ", aujourd’hui";
  if (coverage.kind === "some") {
    label += `, jour férié : ${day.events.map((e) => e.label).join(", ")}`;
  } else if (coverage.kind !== "none" && coverage.kind !== "no-year") {
    label += `, ${formatHolidayCoverage(coverage)}`;
  }
  return label;
}

function dayClasses(day: MonthGridDay): string {
  return cn(
    // 40 px de haut sous `sm` (cible tactile), 32 px ensuite. La largeur suit
    // la colonne : sept cases de 40 px ne tiennent pas à 375 px (voir lot 4b).
    "relative flex h-10 w-full items-center justify-center rounded-md border text-sm tabular-nums transition-colors sm:h-8",
    // Focus clavier : anneau de 1 px en --ring, comme toute primitive (DESIGN.md).
    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
    !day.inMonth && "border-transparent text-muted-foreground",
    day.inMonth && day.events.length === 0 && "border-transparent text-foreground hover:bg-muted",
    day.inMonth && day.isWeekend && day.events.length === 0 && "bg-muted",
    day.inMonth &&
      day.events.length > 0 &&
      "border-info-border bg-info-soft font-semibold text-info-ink",
    // Aujourd'hui : chiffre en gras et souligné. Plus d'anneau, qui se
    // confondait avec le focus ; et jamais la couleur seule.
    day.isToday && "font-bold underline underline-offset-4",
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
  // Mois du jour, tiré de la date du jour et d'elle seule : `todayCivil`
  // produit toujours `YYYY-MM-DD`, aucun repli n'est nécessaire — ni année ni
  // mois écrits en dur.
  const todayMonth = useMemo(
    () => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }),
    [today],
  );
  // Ouverture : le mois d'aujourd'hui s'il est dans l'année active, sinon le
  // mois de l'année le plus proche (lib/calendar/initial-month.ts). Le widget
  // est remonté à chaque changement d'année (`key`), donc lu une fois suffit.
  // « Aujourd'hui », lui, mène toujours au mois d'aujourd'hui (option 2).
  const [view, setView] = useState(() =>
    initialMonth(
      today,
      activeYear ? { startDate: activeYear.startDate, endDate: activeYear.endDate } : null,
    ),
  );
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
    } else {
      // Début / Fin : lundi / dimanche de la semaine (lib/calendar/grid-keys.ts).
      const edge = weekEdgeTarget(e.key, rovingDate);
      if (edge) {
        e.preventDefault();
        moveFocus(edge);
      }
    }
  };

  const goToMonth = (delta: number) => {
    setView((v) => addMonths(v.year, v.month, delta));
    setDetailDate(null);
  };

  const goToToday = () => {
    setView(todayMonth);
    setFocusDate(today);
    setDetailDate(null);
  };

  // Ce que le calendrier a le droit d'affirmer : lib/calendar/day-detail-state.ts.
  // L'année vient de AcademicYearContext (prop `activeYear`), jamais d'une
  // valeur écrite ici.
  const coverageBase: Omit<HolidayCoverageInput, "period" | "count"> = {
    load: state.kind,
    year: activeYear
      ? { name: activeYear.name, startDate: activeYear.startDate, endDate: activeYear.endDate }
      : null,
  };
  const dayCoverage = (day: MonthGridDay) =>
    describeHolidayCoverage({
      ...coverageBase,
      period: { from: day.date, to: day.date },
      count: day.events.length,
    });
  const monthDays = weeks.flat().filter((d) => d.inMonth);
  const monthCoverage = describeHolidayCoverage({
    ...coverageBase,
    period: { from: monthDays[0].date, to: monthDays[monthDays.length - 1].date },
    count: events.filter((e) => e.date.startsWith(monthPrefix)).length,
  });

  const detailDay = detailDate
    ? weeks.flat().find((d) => d.date === detailDate) ?? null
    : null;
  const detailDayCoverage = detailDay ? dayCoverage(detailDay) : null;
  const monthTitleId = "dashboard-calendar-month";

  return (
    <Card className={cn("border bg-card shadow-sm", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Calendrier de l’école</CardTitle>
        <CardDescription>
          {calendarCardDescription(activeYear?.name ?? null)}
        </CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-4 p-6">
        {/* Navigation */}
        {/* `flex-wrap` : avec des boutons de 44 px sous `sm`, le titre du mois
            ne tient plus sur la même ligne à 320 px ; il passe au-dessus. */}
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-4">
          {/* Une seule zone annoncée : le titre du mois et, hors de l'année
              active, le message « hors de la période… ». La ligne de détail
              ne le répète pas (voir plus bas). */}
          <div aria-live="polite" className="min-w-0">
            <p id={monthTitleId} className="text-sm font-semibold text-foreground">
              {formatMonthTitle(view.year, view.month)}
            </p>
            {monthCoverage.kind === "outside-year" && (
              <p className="text-xs text-muted-foreground">
                {formatHolidayCoverage(monthCoverage)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              className="h-11 w-11 sm:h-8 sm:w-8"
              aria-label="Mois précédent"
              onClick={() => goToMonth(-1)}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" className="h-11 sm:h-8" onClick={goToToday}>
              Aujourd’hui
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-11 w-11 sm:h-8 sm:w-8"
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
                    aria-label={dayAriaLabel(day, dayCoverage(day))}
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

        {/* Détail du jour survolé ou focalisé, sinon état du mois affiché.
            N'affirme « aucun jour férié » que si la liste est lue ET que la
            période est dans l'année active. Lisible par les lecteurs d'écran :
            c'est ici qu'un mois hors de l'année est annoncé « non chargé ». */}
        <p className="min-h-5 text-xs text-muted-foreground">
          {detailDay && detailDayCoverage
            ? `${formatCivilLong(detailDay.date)} — ${
                detailDayCoverage.kind === "some"
                  ? `jour férié : ${detailDay.events.map((e) => e.label).join(", ")}`
                  : formatHolidayCoverage(detailDayCoverage)
              }`
            : monthCoverage.kind === "outside-year"
              ? // Déjà affiché et annoncé sous le titre du mois : pas de doublon.
                ""
              : `${formatMonthTitle(view.year, view.month)} — ${formatHolidayCoverage(monthCoverage)}${
                  monthCoverage.kind === "some"
                    ? ". Survolez ou sélectionnez un jour pour voir son libellé."
                    : ""
                }`}
        </p>

        {/* Légende */}
        <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-label="Légende">
          <li className="flex items-center gap-2">
            <span aria-hidden className="relative inline-flex h-4 w-4 rounded-sm border border-info-border bg-info-soft">
              <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-info" />
            </span>
            Jour férié
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="inline-flex h-4 min-w-4 items-center justify-center text-xs font-bold tabular-nums text-foreground underline underline-offset-4">{Number(today.slice(8))}</span>
            Aujourd’hui
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="inline-flex h-4 w-4 rounded-sm bg-muted" />
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
            className="rounded-md border border-error-border bg-error-soft p-4 text-sm text-error-ink"
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
          <div className="space-y-4">
            <h4 className="text-xs font-medium uppercase text-muted-foreground">
              Prochains jours fériés
            </h4>
            {upcoming.length > 0 ? (
              <ul className="space-y-4">
                {upcoming.map((event, index) => (
                  <li
                    key={`${event.date}-${event.label}-${index}`}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 truncate text-foreground" title={event.label}>{event.label}</span>
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
