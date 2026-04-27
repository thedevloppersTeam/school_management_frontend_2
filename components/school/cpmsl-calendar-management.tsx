"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PlusIcon, CalendarOffIcon } from "lucide-react";

// Types locaux (évite l'import depuis school-data qui n'est plus utilisé)
interface Holiday {
  id: string;
  name: string;
  date: string;
}

interface SchoolEvent {
  id: string;
  title: string;
  date: string;
  type: "exam" | "holiday" | "meeting" | "other" | "ceremony" | "trip";
  academicYearId: string;
}

interface CPMSLCalendarManagementProps {
  holidays: Holiday[];
  events: SchoolEvent[];
  onAddHoliday: (data: { name: string; date: string }) => void;
  onEditHoliday: (id: string, data: { name: string; date: string }) => void;
  onDeleteHoliday: (id: string) => void;
  onAddEvent: (data: {
    title: string;
    date: string;
    type: SchoolEvent["type"];
  }) => void;
  onEditEvent: (
    id: string,
    data: { title: string; date: string; type: SchoolEvent["type"] },
  ) => void;
  onDeleteEvent: (id: string) => void;
}

// ─── Mapping des types d'événements vers tokens semantic CPMSL ─────────────
const EVENT_TYPE_CONFIG: Record<
  SchoolEvent["type"],
  { label: string; className: string }
> = {
  ceremony: { label: "Cérémonie", className: "bg-info-soft    text-info" },
  meeting: { label: "Réunion", className: "bg-warning-soft text-warning" },
  trip: { label: "Sortie", className: "bg-success-soft text-success" },
  other: { label: "Autre", className: "bg-neutral-100  text-neutral-600" },
  exam: { label: "Examen", className: "bg-error-soft   text-error" },
  holiday: { label: "Congé", className: "bg-primary-50   text-primary-500" },
};

// ─── Classe partagée pour les en-têtes de table ────────────────────────────
const TABLE_HEAD_CLASS =
  "font-sans text-xs font-bold uppercase tracking-wider text-primary-800";

// ─── Classe partagée pour les inputs des dialogs ───────────────────────────
const DIALOG_INPUT_CLASS = "border-neutral-300 rounded-lg";

export function CPMSLCalendarManagement({
  holidays,
  events,
  onAddHoliday,
  onEditHoliday,
  onDeleteHoliday,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
}: CPMSLCalendarManagementProps) {
  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [holidayForm, setHolidayForm] = useState({ name: "", date: "" });

  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<SchoolEvent | null>(null);
  const [eventForm, setEventForm] = useState({
    title: "",
    date: "",
    type: "ceremony" as SchoolEvent["type"],
  });

  const handleOpenHolidayDialog = (holiday?: Holiday) => {
    if (holiday) {
      setEditingHoliday(holiday);
      setHolidayForm({ name: holiday.name, date: holiday.date });
    } else {
      setEditingHoliday(null);
      setHolidayForm({ name: "", date: "" });
    }
    setHolidayDialogOpen(true);
  };

  const handleSaveHoliday = () => {
    if (editingHoliday) {
      onEditHoliday(editingHoliday.id, holidayForm);
    } else {
      onAddHoliday(holidayForm);
    }
    setHolidayDialogOpen(false);
  };

  const handleOpenEventDialog = (event?: SchoolEvent) => {
    if (event) {
      setEditingEvent(event);
      setEventForm({ title: event.title, date: event.date, type: event.type });
    } else {
      setEditingEvent(null);
      setEventForm({ title: "", date: "", type: "ceremony" });
    }
    setEventDialogOpen(true);
  };

  const handleSaveEvent = () => {
    if (editingEvent) {
      onEditEvent(editingEvent.id, eventForm);
    } else {
      onAddEvent(eventForm);
    }
    setEventDialogOpen(false);
  };

  const formatHolidayDate = (date: string) => {
    const [month, day] = date.split("-");
    return `${day}/${month}`;
  };

  const formatEventDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getEventTypeBadge = (type: SchoolEvent["type"]) => {
    const cfg = EVENT_TYPE_CONFIG[type] ?? EVENT_TYPE_CONFIG.other;
    return (
      <Badge
        className={`border-0 font-sans text-xs font-medium rounded-md ${cfg.className}`}
      >
        {cfg.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-8">
      {/* ═══════════════════ Section Jours fériés ═══════════════════════════ */}
      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm">
        <div className="p-6 border-b border-neutral-200 flex items-start justify-between">
          <div>
            <h3 className="font-serif text-lg font-semibold text-primary-800 border-l-[3px] border-primary-800 pl-3 mb-2">
              Jours fériés
            </h3>
            <p className="font-sans text-sm text-muted-foreground pl-[15px]">
              Applicables à toutes les années scolaires (récurrents)
            </p>
          </div>

          <Dialog open={holidayDialogOpen} onOpenChange={setHolidayDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => handleOpenHolidayDialog()}
                className="bg-primary-800 hover:bg-primary-700 text-white rounded-lg"
              >
                <PlusIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                Ajouter un jour férié
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white rounded-xl">
              <DialogHeader>
                <DialogTitle className="heading-4 text-primary-800">
                  {editingHoliday
                    ? "Modifier le jour férié"
                    : "Ajouter un jour férié"}
                </DialogTitle>
                <DialogDescription className="body-base text-neutral-500">
                  Les jours fériés sont récurrents chaque année
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="holiday-date"
                    className="label-ui text-neutral-900"
                  >
                    Date (JJ/MM)
                  </Label>
                  <Input
                    id="holiday-date"
                    placeholder="Ex: 01/01"
                    value={holidayForm.date}
                    onChange={(e) =>
                      setHolidayForm({ ...holidayForm, date: e.target.value })
                    }
                    className={DIALOG_INPUT_CLASS}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="holiday-name"
                    className="label-ui text-neutral-900"
                  >
                    Nom
                  </Label>
                  <Input
                    id="holiday-name"
                    value={holidayForm.name}
                    onChange={(e) =>
                      setHolidayForm({ ...holidayForm, name: e.target.value })
                    }
                    className={DIALOG_INPUT_CLASS}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setHolidayDialogOpen(false)}
                  className="border-neutral-300 text-neutral-600 rounded-lg"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleSaveHoliday}
                  className="bg-primary-500 hover:bg-primary-600 text-white rounded-lg"
                >
                  Enregistrer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="p-6">
          {holidays.length === 0 ? (
            <EmptyState
              icon={
                <CalendarOffIcon
                  className="h-8 w-8 text-neutral-400"
                  aria-hidden="true"
                />
              }
              title="Aucun jour férié"
              description="Ajoutez les jours fériés récurrents (Nouvel An, fêtes nationales, etc.)"
              action={
                <Button
                  onClick={() => handleOpenHolidayDialog()}
                  className="bg-primary-500 hover:bg-primary-600 text-white rounded-lg"
                >
                  <PlusIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                  Ajouter le premier jour férié
                </Button>
              }
            />
          ) : (
            <div className="border border-neutral-200 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary-50 border-b-2 border-neutral-300">
                    <TableHead className={TABLE_HEAD_CLASS}>Date</TableHead>
                    <TableHead className={TABLE_HEAD_CLASS}>Nom</TableHead>
                    <TableHead className={`${TABLE_HEAD_CLASS} text-center`}>
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map((holiday) => (
                    <TableRow
                      key={holiday.id}
                      className="hover:bg-secondary-50"
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {formatHolidayDate(holiday.date)}
                          <Badge
                            variant="outline"
                            className="font-sans text-xs font-medium bg-muted text-muted-foreground border-border"
                          >
                            Annuel
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{holiday.name}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleOpenHolidayDialog(holiday)}
                            className="text-sm font-medium text-neutral-900 hover:underline focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:rounded"
                          >
                            Modifier
                          </button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                type="button"
                                className="text-sm font-medium text-error hover:underline focus-visible:outline-2 focus-visible:outline-error focus-visible:rounded"
                              >
                                Supprimer
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-primary-800">
                                  Êtes-vous sûr ?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-neutral-600">
                                  Cette action est irréversible. Le jour férié
                                  &laquo;&nbsp;{holiday.name}&nbsp;&raquo; sera
                                  définitivement supprimé.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="border-neutral-300 text-neutral-600 rounded-lg">
                                  Annuler
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => onDeleteHoliday(holiday.id)}
                                  className="bg-error hover:bg-error/90 text-white rounded-lg"
                                >
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════ Section Événements ═════════════════════════════ */}
      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm">
        <div className="p-6 border-b border-neutral-200 flex items-start justify-between">
          <div>
            <h3 className="font-serif text-lg font-semibold text-primary-800 border-l-[3px] border-primary-800 pl-3 mb-2">
              Événements scolaires
            </h3>
            <p className="font-sans text-sm text-muted-foreground pl-[15px]">
              Spécifiques à l&apos;année scolaire active
            </p>
          </div>

          <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => handleOpenEventDialog()}
                className="bg-primary-800 hover:bg-primary-700 text-white rounded-lg"
              >
                <PlusIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                Ajouter un événement
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white rounded-xl">
              <DialogHeader>
                <DialogTitle className="heading-4 text-primary-800">
                  {editingEvent
                    ? "Modifier l'événement"
                    : "Ajouter un événement"}
                </DialogTitle>
                <DialogDescription className="body-base text-neutral-500">
                  Les événements sont spécifiques à l&apos;année scolaire en
                  cours
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="event-date"
                    className="label-ui text-neutral-900"
                  >
                    Date
                  </Label>
                  <Input
                    id="event-date"
                    type="date"
                    value={eventForm.date}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, date: e.target.value })
                    }
                    className={DIALOG_INPUT_CLASS}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="event-title"
                    className="label-ui text-neutral-900"
                  >
                    Nom
                  </Label>
                  <Input
                    id="event-title"
                    value={eventForm.title}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, title: e.target.value })
                    }
                    className={DIALOG_INPUT_CLASS}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="event-type"
                    className="label-ui text-neutral-900"
                  >
                    Type
                  </Label>
                  <Select
                    value={eventForm.type}
                    onValueChange={(value: SchoolEvent["type"]) =>
                      setEventForm({ ...eventForm, type: value })
                    }
                  >
                    <SelectTrigger
                      id="event-type"
                      className="border-neutral-300 rounded-lg"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ceremony">Cérémonie</SelectItem>
                      <SelectItem value="meeting">Réunion</SelectItem>
                      <SelectItem value="trip">Sortie</SelectItem>
                      <SelectItem value="other">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setEventDialogOpen(false)}
                  className="border-neutral-300 text-neutral-600 rounded-lg"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleSaveEvent}
                  className="bg-primary-500 hover:bg-primary-600 text-white rounded-lg"
                >
                  Enregistrer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="p-6">
          {events.length === 0 ? (
            <EmptyState
              icon={
                <CalendarOffIcon
                  className="h-8 w-8 text-neutral-400"
                  aria-hidden="true"
                />
              }
              title="Aucun événement"
              description="Ajoutez les événements de l'année scolaire (rentrée, examens, sorties, etc.)"
              action={
                <Button
                  onClick={() => handleOpenEventDialog()}
                  className="bg-primary-500 hover:bg-primary-600 text-white rounded-lg"
                >
                  <PlusIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                  Ajouter le premier événement
                </Button>
              }
            />
          ) : (
            <div className="border border-neutral-200 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary-50 border-b-2 border-neutral-300">
                    <TableHead className={TABLE_HEAD_CLASS}>Date</TableHead>
                    <TableHead className={TABLE_HEAD_CLASS}>Nom</TableHead>
                    <TableHead className={TABLE_HEAD_CLASS}>Type</TableHead>
                    <TableHead className={`${TABLE_HEAD_CLASS} text-center`}>
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id} className="hover:bg-secondary-50">
                      <TableCell className="font-medium">
                        {formatEventDate(event.date)}
                      </TableCell>
                      <TableCell>{event.title}</TableCell>
                      <TableCell>{getEventTypeBadge(event.type)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleOpenEventDialog(event)}
                            className="text-sm font-medium text-neutral-900 hover:underline focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:rounded"
                          >
                            Modifier
                          </button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                type="button"
                                className="text-sm font-medium text-error hover:underline focus-visible:outline-2 focus-visible:outline-error focus-visible:rounded"
                              >
                                Supprimer
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-primary-800">
                                  Êtes-vous sûr ?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-neutral-600">
                                  Cette action est irréversible.
                                  L&apos;événement &laquo;&nbsp;{event.title}
                                  &nbsp;&raquo; sera définitivement supprimé.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="border-neutral-300 text-neutral-600 rounded-lg">
                                  Annuler
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => onDeleteEvent(event.id)}
                                  className="bg-error hover:bg-error/90 text-white rounded-lg"
                                >
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Composant local Empty State ───────────────────────────────────────────
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
}

function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="mb-4 p-3 bg-neutral-100 rounded-full">{icon}</div>
      <h4 className="font-serif text-lg font-semibold text-neutral-900 mb-2">
        {title}
      </h4>
      <p className="font-sans text-sm text-muted-foreground mb-6 max-w-md">
        {description}
      </p>
      {action}
    </div>
  );
}
