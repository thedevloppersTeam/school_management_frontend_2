"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { SaveIcon, LockIcon, SearchIcon, InboxIcon } from "lucide-react";
import type { ApiClassSession } from "@/lib/api/students";
import type { AcademicYearStep } from "@/lib/api/dashboard";
import type {
  ApiClassSubject,
  ApiEnrollment,
  ApiGrade,
  CreateGradePayload,
} from "@/lib/api/grades";
import { cn } from "@/lib/utils";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UpdateGradePayload {
  gradeId: string;
  studentScore: number;
  gradeType: "EXAM" | "HOMEWORK" | "ORAL";
}

interface GradeEntry {
  enrollmentId: string;
  value: string;
  isValid: boolean;
  error?: string;
}

interface CPMSLGradesGridProps {
  sessions: ApiClassSession[];
  steps: AcademicYearStep[];
  classSubjects: ApiClassSubject[];
  enrollments: ApiEnrollment[];
  existingGrades: ApiGrade[];
  selectedSessionId: string;
  selectedClassSubjectId: string;
  selectedStepId: string;
  loadingSession: boolean;
  loadingGrades: boolean;
  saving: boolean;
  onSessionChange: (sessionId: string) => void;
  onClassSubjectChange: (classSubjectId: string) => void;
  onStepChange: (stepId: string) => void;
  onSaveGrades: (
    toCreate: CreateGradePayload[],
    toUpdate: UpdateGradePayload[],
  ) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sessionLabel(session: ApiClassSession): string {
  const { classType, letter, track } = session.class;
  const base = `${classType.name} ${letter}`;
  return track ? `${base} ${track.code}` : base;
}

// ── Composant ─────────────────────────────────────────────────────────────────

export function CPMSLGradesGrid({
  sessions,
  steps,
  classSubjects,
  enrollments,
  existingGrades,
  selectedSessionId,
  selectedClassSubjectId,
  selectedStepId,
  loadingSession,
  loadingGrades,
  saving,
  onSessionChange,
  onClassSubjectChange,
  onStepChange,
  onSaveGrades,
}: CPMSLGradesGridProps) {
  const [gradeEntries, setGradeEntries] = useState<Map<string, GradeEntry>>(
    new Map(),
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const PAGE_SIZE_OPTIONS = [15, 25, 50, 100];

  // ── Classe / Salle split ────────────────────────────────────────────────
  const [selectedClassTypeId, setSelectedClassTypeId] = useState("");
  const [selectedLetter, setSelectedLetter] = useState("");

  const classTypes = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    sessions.forEach((s) => {
      const ct = s.class.classType;
      if (!map.has(ct.id)) map.set(ct.id, { id: ct.id, name: ct.name });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions]);

  const availableLetters = useMemo(() => {
    if (!selectedClassTypeId) return [];
    return sessions
      .filter((s) => s.class.classType.id === selectedClassTypeId)
      .map((s) => ({
        sessionId: s.id,
        letter: s.class.letter,
        track: s.class.track,
        label: s.class.track
          ? `${s.class.letter} — ${s.class.track.code}`
          : s.class.letter,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [sessions, selectedClassTypeId]);

  // Sync selectedClassTypeId/selectedLetter from selectedSessionId (e.g. when navigating from Avancement)
  useEffect(() => {
    if (!selectedSessionId) return;
    const session = sessions.find((s) => s.id === selectedSessionId);
    if (session) {
      setSelectedClassTypeId(session.class.classType.id);
      setSelectedLetter(session.id);
    }
  }, [selectedSessionId, sessions]);

  function handleClassTypeChange(classTypeId: string) {
    setSelectedClassTypeId(classTypeId);
    setSelectedLetter("");
    // Don't call onSessionChange yet — wait for letter selection
  }

  function handleLetterChange(sessionId: string) {
    setSelectedLetter(sessionId);
    onSessionChange(sessionId);
  }

  const selectedClassSubject = useMemo(
    () => classSubjects.find((cs) => cs.id === selectedClassSubjectId),
    [classSubjects, selectedClassSubjectId],
  );
  const maxScore = (() => {
    const raw = selectedClassSubject?.subject.maxScore;
    if (!raw) return 10;
    if (typeof raw === "object" && (raw as any).d)
      return Number((raw as any).d[0]);
    return Number(raw) || 10;
  })();

  const selectedStep = useMemo(
    () => steps.find((s) => s.id === selectedStepId),
    [steps, selectedStepId],
  );

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId),
    [sessions, selectedSessionId],
  );

  const isLocked = selectedStep ? !selectedStep.isCurrent : false; // +1
  const showContent = !!(
    selectedSessionId &&
    selectedClassSubjectId &&
    selectedStepId
  );

  // ── Pré-remplissage depuis les notes existantes ──────────────────────────

  useEffect(() => {
    const newEntries = new Map<string, GradeEntry>();
    existingGrades
      .filter(
        (g) =>
          g.classSubjectId === selectedClassSubjectId &&
          g.sectionId === null &&
          g.stepId === selectedStepId,
      )
      .forEach((g) => {
        newEntries.set(g.enrollmentId, {
          enrollmentId: g.enrollmentId,
          value: String(g.studentScore),
          isValid: true,
        });
      });
    setGradeEntries(newEntries);
    setCurrentPage(1);
  }, [existingGrades, selectedClassSubjectId, selectedStepId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedSessionId, selectedClassSubjectId, selectedStepId]);

  // ── Tri alphabétique + recherche ──────────────────────────────────────────

  const sortedEnrollments = useMemo(
    () =>
      [...enrollments].sort((a, b) =>
        `${a.student.user.lastname} ${a.student.user.firstname}`.localeCompare(
          `${b.student.user.lastname} ${b.student.user.firstname}`,
        ),
      ),
    [enrollments],
  );

  const filteredEnrollments = useMemo(() => {
    if (!searchQuery.trim()) return sortedEnrollments;
    const q = searchQuery.toLowerCase();
    return sortedEnrollments.filter((e) => {
      const first = e.student.user.firstname?.toLowerCase() ?? "";
      const last = e.student.user.lastname?.toLowerCase() ?? "";
      const code = e.student.studentCode?.toLowerCase() ?? "";
      return first.includes(q) || last.includes(q) || code.includes(q);
    });
  }, [sortedEnrollments, searchQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredEnrollments.length / itemsPerPage),
  );
  const paginatedEnrollments = filteredEnrollments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // Pagination window helper
  const paginationWindow = useMemo(() => {
    if (totalPages <= 5)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 3) return [1, 2, 3, 4, "ellipsis-right", totalPages];
    if (currentPage >= totalPages - 2) {
      return [
        1,
        "ellipsis-left",
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }
    return [
      1,
      "ellipsis-left",
      currentPage - 1,
      currentPage,
      currentPage + 1,
      "ellipsis-right",
      totalPages,
    ];
  }, [currentPage, totalPages]);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // ── Validation BR-002 : multiples de 0.25 ────────────────────────────────

  function validateScore(value: string): { isValid: boolean; error?: string } {
    if (!value || value.trim() === "") return { isValid: true };
    const num = parseFloat(value);
    if (isNaN(num)) return { isValid: false, error: "Valeur invalide" };
    if (num < 0 || num > maxScore)
      return { isValid: false, error: `Entre 0 et ${maxScore}` };
    if (Math.round(num * 4 * 1e10) / 1e10 !== Math.round(num * 4))
      return { isValid: false, error: "Multiples de 0.25 uniquement" };
    return { isValid: true };
  }

  function handleGradeChange(enrollmentId: string, value: string) {
    const validation = validateScore(value);
    setGradeEntries((prev) => {
      const next = new Map(prev);
      next.set(enrollmentId, {
        enrollmentId,
        value,
        isValid: validation.isValid,
        error: validation.error,
      });
      return next;
    });
  }

  const hasErrors = useMemo(
    () => Array.from(gradeEntries.values()).some((e) => !e.isValid),
    [gradeEntries],
  );

  const enteredCount = useMemo(
    () =>
      Array.from(gradeEntries.values()).filter((e) => e.value && e.isValid)
        .length,
    [gradeEntries],
  );
  // ── EP-006 : détection des modifications non enregistrées ─────────────────
  //
  // On compare gradeEntries (ce que l'utilisateur a tapé) avec
  // existingGrades (ce qui est déjà en base) pour détecter :
  //   - Nouvelles notes saisies mais pas encore enregistrées
  //   - Notes modifiées dont la valeur diffère de l'existante
  //
  // Quand hasUnsavedChanges = true, le browser demande confirmation
  // avant de quitter la page (fermeture onglet, F5, navigation URL…).
  // Protège contre la perte de 10-40 saisies en 1 clic accidentel.
  const hasUnsavedChanges = useMemo(() => {
    if (isLocked) return false;
    if (!selectedClassSubjectId || !selectedStepId) return false;

    const existingMap = new Map(
      existingGrades
        .filter(
          (g) =>
            g.classSubjectId === selectedClassSubjectId &&
            g.stepId === selectedStepId &&
            g.sectionId === null,
        )
        .map((g) => [g.enrollmentId, g]),
    );

    for (const [enrollmentId, entry] of gradeEntries) {
      if (!entry.value?.trim() || !entry.isValid) continue;

      const existing = existingMap.get(enrollmentId);
      const scoreTyped = parseFloat(entry.value);

      // Nouvelle note jamais enregistrée
      if (!existing) return true;
      // Note modifiée par rapport à ce qui est en base
      if (scoreTyped !== Number(existing.studentScore)) return true;
    }
    return false;
  }, [
    gradeEntries,
    existingGrades,
    selectedClassSubjectId,
    selectedStepId,
    isLocked,
  ]);

  // Active le warning beforeunload du browser quand dirty
  useUnsavedChangesWarning(hasUnsavedChanges);
  // ── Save ─────────────────────────────────────────────────────────────────

  function handleSaveGrades() {
    if (!selectedClassSubjectId || !selectedStepId || hasErrors || isLocked)
      return;

    const existingMap = new Map(
      existingGrades
        .filter(
          (g) =>
            g.classSubjectId === selectedClassSubjectId &&
            g.stepId === selectedStepId &&
            g.sectionId === null,
        )
        .map((g) => [g.enrollmentId, g]),
    );

    const toCreate: CreateGradePayload[] = [];
    const toUpdate: UpdateGradePayload[] = [];

    gradeEntries.forEach((entry, enrollmentId) => {
      if (!entry.value || !entry.isValid) return;
      const score = parseFloat(entry.value);
      const existing = existingMap.get(enrollmentId);

      if (!existing) {
        toCreate.push({
          enrollmentId,
          classSubjectId: selectedClassSubjectId,
          stepId: selectedStepId,
          studentScore: score,
          gradeType: "EXAM",
        });
      } else if (score !== Number(existing.studentScore)) {
        toUpdate.push({
          gradeId: existing.id,
          studentScore: score,
          gradeType: "EXAM",
        });
      }
    });

    if (toCreate.length === 0 && toUpdate.length === 0) return;
    onSaveGrades(toCreate, toUpdate);
  }

  const headerLabel = useMemo(() => {
    return [
      selectedSession ? sessionLabel(selectedSession) : null,
      selectedStep?.name,
      selectedClassSubject?.subject.name,
    ]
      .filter(Boolean)
      .join(" — ");
  }, [selectedSession, selectedStep, selectedClassSubject]);

  // ── Badge helper ──────────────────────────────────────────────────────────

  type BadgeKind = "modified" | "saved" | "entered" | "empty";
  function getBadgeKind(enrollmentId: string): BadgeKind {
    const entry = gradeEntries.get(enrollmentId);
    const existing = existingGrades.find(
      (g) =>
        g.enrollmentId === enrollmentId &&
        g.classSubjectId === selectedClassSubjectId &&
        g.stepId === selectedStepId &&
        g.sectionId === null,
    );
    const hasValue = !!entry?.value?.trim();
    const hasError = hasValue && entry && !entry.isValid;
    const isModified =
      existing &&
      hasValue &&
      !hasError &&
      parseFloat(entry!.value) !== Number(existing.studentScore);

    if (isModified) return "modified";
    if (existing) return "saved";
    if (hasValue && !hasError) return "entered";
    return "empty";
  }

  function renderBadge(enrollmentId: string) {
    const kind = getBadgeKind(enrollmentId);
    switch (kind) {
      case "modified":
        return (
          <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
            Modifié
          </Badge>
        );
      case "saved":
        return (
          <Badge className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">
            Enregistré
          </Badge>
        );
      case "entered":
        return (
          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
            Saisi
          </Badge>
        );
      default:
        return <Badge variant="secondary">Non saisi</Badge>;
    }
  }

  // ── Table row ─────────────────────────────────────────────────────────────

  function renderTableRow(enrollment: ApiEnrollment) {
    const entry = gradeEntries.get(enrollment.id);
    const hasValue = !!entry?.value?.trim();
    const hasError = hasValue && entry && !entry.isValid;

    return (
      <TableRow key={enrollment.id}>
        <TableCell className="pl-6 font-medium text-foreground">
          {enrollment.student.user.lastname}
        </TableCell>
        <TableCell className="text-foreground">
          {enrollment.student.user.firstname}
        </TableCell>
        <TableCell>
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {enrollment.student.studentCode}
          </code>
        </TableCell>
        <TableCell>
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max={String(maxScore)}
                step="0.25"
                value={entry?.value || ""}
                placeholder="—"
                disabled={isLocked}
                onChange={(e) =>
                  handleGradeChange(enrollment.id, e.target.value)
                }
                className={cn(
                  "w-20 text-center tabular-nums",
                  hasError &&
                    "border-destructive focus-visible:ring-destructive",
                )}
                onKeyDown={(e) => {
                  if (e.key !== "Tab") return;
                  e.preventDefault();
                  const idx = paginatedEnrollments.findIndex(
                    (en) => en.id === enrollment.id,
                  );
                  if (idx >= paginatedEnrollments.length - 1) return;
                  const nextId = paginatedEnrollments[idx + 1].id;
                  const next = document.querySelector(
                    `input[data-enrollment-id="${nextId}"]`,
                  ) as HTMLInputElement;
                  next?.focus();
                }}
                data-enrollment-id={enrollment.id}
              />
              <span className="text-xs text-muted-foreground">
                / {maxScore}
              </span>
            </div>
            {hasError && entry?.error && (
              <p className="text-[11px] text-destructive">{entry.error}</p>
            )}
          </div>
        </TableCell>
        <TableCell className="pr-6 text-center">
          {renderBadge(enrollment.id)}
        </TableCell>
      </TableRow>
    );
  }

  // ── Pagination footer ─────────────────────────────────────────────────────

  function renderPaginationFooter() {
    if (filteredEnrollments.length <= 15) return null;
    return (
      <>
        <Separator />
        <div className="flex flex-col items-center justify-between gap-3 px-4 py-3 sm:flex-row">
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">
              Page{" "}
              <span className="font-medium text-foreground tabular-nums">
                {currentPage}
              </span>{" "}
              sur{" "}
              <span className="font-medium text-foreground tabular-nums">
                {totalPages}
              </span>{" "}
              &middot; {filteredEnrollments.length} élève(s)
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Afficher</span>
              <Select
                value={String(itemsPerPage)}
                onValueChange={(v) => {
                  setItemsPerPage(Number(v));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[72px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {totalPages > 1 && (
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 1) setCurrentPage((p) => p - 1);
                    }}
                    className={cn(
                      currentPage === 1 && "pointer-events-none opacity-50",
                    )}
                  />
                </PaginationItem>
                {paginationWindow.map((p, idx) => {
                  if (typeof p === "string") {
                    return (
                      <PaginationItem key={`${p}-${idx}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    );
                  }
                  return (
                    <PaginationItem key={p}>
                      <PaginationLink
                        href="#"
                        isActive={currentPage === p}
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage(p);
                        }}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage < totalPages)
                        setCurrentPage((p) => p + 1);
                    }}
                    className={cn(
                      currentPage === totalPages &&
                        "pointer-events-none opacity-50",
                    )}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      </>
    );
  }

  // ── Spinner shared ────────────────────────────────────────────────────────
  function renderSpinner() {
    return (
      <Card className="border bg-card shadow-sm">
        <CardContent className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-muted border-t-primary" />
        </CardContent>
      </Card>
    );
  }

  // ── Grades table section ──────────────────────────────────────────────────
  function renderGradesSection() {
    if (loadingGrades) return renderSpinner();

    return (
      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Saisie des notes
              </CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2">
                <span>
                  {headerLabel} &middot; {enteredCount} /{" "}
                  {sortedEnrollments.length} notes saisies
                </span>
                {hasUnsavedChanges && (
                  <Badge
                    variant="outline"
                    className="border-amber-300 bg-amber-50 text-amber-800 text-[11px] font-medium"
                  >
                    Modifications non enregistrées
                  </Badge>
                )}
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
              placeholder="Rechercher par nom ou code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Separator />

        <CardContent className="p-0">
          {filteredEnrollments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <InboxIcon className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">
                Aucun élève trouvé
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery
                  ? "Modifiez vos critères de recherche."
                  : "Aucun élève inscrit dans cette classe."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6 font-semibold">Nom</TableHead>
                    <TableHead className="font-semibold">Prénom</TableHead>
                    <TableHead className="font-semibold">Code</TableHead>
                    <TableHead className="text-center font-semibold">
                      Note / {maxScore}
                    </TableHead>
                    <TableHead className="pr-6 text-center font-semibold">
                      Statut
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEnrollments.map((enrollment) =>
                    renderTableRow(enrollment),
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>

        {renderPaginationFooter()}

        {/* Save button */}
        {!isLocked && filteredEnrollments.length > 0 && (
          <>
            <Separator />
            <div className="flex justify-end p-4">
              <Button
                onClick={handleSaveGrades}
                disabled={
                  !selectedClassSubjectId ||
                  !selectedStepId ||
                  hasErrors ||
                  saving
                }
              >
                {saving ? (
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <SaveIcon className="mr-2 h-4 w-4" />
                )}
                {saving ? "Enregistrement..." : "Enregistrer les notes"}
              </Button>
            </div>
          </>
        )}
      </Card>
    );
  }

  // ── Main content ──────────────────────────────────────────────────────────
  function renderMainContent() {
    if (loadingSession) return renderSpinner();
    if (!showContent) {
      return (
        <Card className="border bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <InboxIcon className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              Aucune sélection
            </h3>
            <p className="mt-1 max-w-[320px] text-center text-sm text-muted-foreground">
              Choisissez une classe, une étape et une matière pour commencer la
              saisie des notes.
            </p>
          </CardContent>
        </Card>
      );
    }
    return renderGradesSection();
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Sélecteurs */}
      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Sélection</CardTitle>
          <CardDescription>
            Classe, salle, étape et matière pour la saisie
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Classe */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Classe
              </label>
              <Select
                value={selectedClassTypeId}
                onValueChange={handleClassTypeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une classe" />
                </SelectTrigger>
                <SelectContent>
                  {classTypes.map((ct) => (
                    <SelectItem key={ct.id} value={ct.id}>
                      {ct.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Salle */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Salle
              </label>
              <Select
                value={selectedLetter}
                onValueChange={handleLetterChange}
                disabled={!selectedClassTypeId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !selectedClassTypeId
                        ? "Choisir une classe d'abord"
                        : "Sélectionner une salle"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableLetters.map((l) => (
                    <SelectItem key={l.sessionId} value={l.sessionId}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Étape */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Étape
              </label>
              <Select value={selectedStepId} onValueChange={onStepChange}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    {isLocked && (
                      <LockIcon className="h-4 w-4 text-amber-600" />
                    )}
                    <SelectValue placeholder="Sélectionner une étape" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {steps.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.isCurrent ? " (active)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Matière */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Matière
              </label>
              <Select
                value={selectedClassSubjectId}
                onValueChange={onClassSubjectChange}
                disabled={!selectedSessionId || loadingSession}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingSession
                        ? "Chargement..."
                        : "Sélectionner une matière"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {classSubjects.map((cs) => (
                    <SelectItem key={cs.id} value={cs.id}>
                      {cs.subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bannière étape clôturée */}
      {showContent && isLocked && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <LockIcon className="h-4 w-4 !text-amber-600" />
          <AlertTitle>Étape clôturée</AlertTitle>
          <AlertDescription>
            Réouvrez l&apos;étape depuis la Configuration pour saisir des notes.
          </AlertDescription>
        </Alert>
      )}

      {renderMainContent()}
    </div>
  );
}
