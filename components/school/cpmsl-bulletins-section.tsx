"use client";
import { clientFetch as apiFetch } from "@/lib/client-fetch";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatCard } from "@/components/school/stat-card";
import { BulletinPDFGenerator } from "@/components/bulletin-pdf-generator";
import { type BulletinData } from "@/components/BulletinScolaire";
import { BulletinPrintable } from "@/components/school/bulletin-printable";
import { buildBulletinData } from "@/lib/api/bulletin";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  FileTextIcon,
  AlertCircleIcon,
  UserIcon,
  LayersIcon,
  Loader2,
  SearchIcon,
  InboxIcon,
} from "lucide-react";
import { toast } from "sonner";
import { toMessage } from "@/lib/errors";
import { BatchPreviewModal } from "@/components/school/batch-preview-modal";
import {
  AuditNoteModal,
  type AuditReason,
} from "@/components/school/audit-note-modal";
import { cn } from "@/lib/utils";
import {
  fetchSteps,
  fetchClassSessions,
  getClassSessionName,
  type AcademicYearStep,
  type ClassSession,
} from "@/lib/api/dashboard";
import { isNisuValid as isCentralNisuValid } from "@/lib/nisu";
import {
  addBulletinCanvasToPdf,
  captureBulletinElement,
  PDF_CAPTURE_HOST_ID,
  removeStalePdfCaptureHosts,
  waitForTwoFrames,
} from "@/lib/bulletin-pdf-capture";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EnrollmentRow {
  enrollmentId: string;
  studentId: string;
  studentCode: string;
  nisu: string;
  firstname: string;
  lastname: string;
  classSessionId: string;
  className: string;
  status: string;
}

interface CPMSLBulletinsSectionProps {
  academicYearId: string;
  isArchived?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasValidNisu(nisu: string | null): boolean {
  return isCentralNisuValid(nisu, false);
}

function canPrintBulletin(nisu: string | null): boolean {
  return isCentralNisuValid(nisu);
}

// ── Helper archive silencieux ─────────────────────────────────────────────────

async function archiveBulletin(params: {
  enrollmentId: string;
  stepId: string;
  source: "individual" | "batch";
  bulletinSnapshot: BulletinData;
  isCorrection: boolean;
  auditNote?: string; // WF-005 : motif pour correction post-clôture
}): Promise<{ ok: true } | { ok: false; error: unknown }> {
  try {
    await apiFetch<unknown>("/api/bulletin-archives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return { ok: true };
  } catch (err) {
    // EP-003 : on ne swallow plus, on retourne l'erreur pour que
    // l'appelant puisse la remonter à l'utilisateur
    return { ok: false, error: err };
  }
}

// ── Composant ─────────────────────────────────────────────────────────────────

export function CPMSLBulletinsSection({
  academicYearId,
  isArchived = false,
}: CPMSLBulletinsSectionProps) {
  // ── Données ──────────────────────────────────────────────────────────────────
  const [steps, setSteps] = useState<AcademicYearStep[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // ── Sélections ───────────────────────────────────────────────────────────────
  const [selectedStep, setSelectedStep] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  // Classe (niveau) puis Salle (lettre) — sélecteurs en cascade
  const [selectedClassTypeId, setSelectedClassTypeId] = useState("");
  // Type de bulletin : normal (tronc commun) ou examen officiel (filière)
  const [bulletinScope, setBulletinScope] = useState<'common' | 'exam'>('common');

  const bulletinClassTypes = (() => {
    const map = new Map<string, { id: string; name: string }>();
    sessions.forEach((s) => {
      const ct = s.class.classType;
      if (!map.has(ct.id)) map.set(ct.id, { id: ct.id, name: ct.name });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }));
  })();

  const bulletinSalles = !selectedClassTypeId
    ? []
    : sessions
        .filter((s) => s.class.classType.id === selectedClassTypeId)
        .map((s) => ({
          sessionId: s.id,
          label: s.class.track ? `${s.class.letter} — ${s.class.track.code}` : s.class.letter,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "fr", { numeric: true }));

  // La classe choisie est-elle terminale ? → possibilité du bulletin d'examen
  const bulletinClassIsTerminal =
    sessions.find((s) => s.class.classType.id === selectedClassTypeId)?.class
      .classType.isTerminal === true;

  const handleBulletinClassChange = (classTypeId: string) => {
    setSelectedClassTypeId(classTypeId);
    setSelectedSession(""); // reset la salle
    setBulletinScope('common'); // le type de bulletin dépend de la classe
  };

  // ── PDF Generator ─────────────────────────────────────────────────────────────
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfStudent, setPdfStudent] = useState<EnrollmentRow | null>(null);

  // ── Génération en lot ──────────────────────────────────────────────────────
  const [generatingLot, setGeneratingLot] = useState(false);
  const [lotProgress, setLotProgress] = useState({ current: 0, total: 0 });
  const [lotData, setLotData] = useState<BulletinData | null>(null);
  const lotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      window.setTimeout(removeStalePdfCaptureHosts, 0);
    };
  }, []);

  // WF-003 / WF-005 : modaux de confirmation pré-génération
  const [previewOpen, setPreviewOpen] = useState(false);
  const [auditNoteOpen, setAuditNoteOpen] = useState(false);
  const [includeGeneralAverage, setIncludeGeneralAverage] = useState(false);

  // ── Recherche + pagination ─────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const PAGE_SIZE_OPTIONS = [15, 25, 50, 100];

  const filteredEnrollments = useMemo(() => {
    if (!searchQuery) return enrollments;
    return enrollments.filter((enrollment) => {
      const studentName =
        `${enrollment.firstname} ${enrollment.lastname}`.toLowerCase();
      return studentName.includes(searchQuery.toLowerCase());
    });
  }, [enrollments, searchQuery]);

  const paginatedEnrollments = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredEnrollments.slice(start, end);
  }, [filteredEnrollments, currentPage, itemsPerPage]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setCurrentPage(1), 0);
    return () => window.clearTimeout(timeoutId);
  }, [searchQuery, itemsPerPage]);

  // ── Chargement initial ────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const [stepsData, sessionsData] = await Promise.all([
          fetchSteps(academicYearId),
          fetchClassSessions(academicYearId),
        ]);
        setSteps(stepsData);
        setSessions(sessionsData);
      } catch (err) {
        console.error("[bulletins] init error:", err);
      } finally {
        setLoadingInit(false);
      }
    }
    init();
  }, [academicYearId]);

  // ── Chargement élèves quand session sélectionnée ──────────────────────────────
  const loadEnrollments = useCallback(
    async (sessionId: string) => {
      if (!sessionId) return;
      setLoadingStudents(true);
      try {
        const data = await apiFetch<
          Array<{
            id: string;
            studentId: string;
            classSessionId: string;
            status: string;
            student?: {
              id: string;
              studentCode?: string;
              nisu?: string;
              user?: { firstname?: string; lastname?: string };
            };
          }>
        >(`/api/enrollments?classSessionId=${sessionId}&status=ACTIVE`);

        const session = sessions.find((s) => s.id === sessionId);
        const className = session ? getClassSessionName(session) : "";

        setEnrollments(
          data.map((enr) => ({
            enrollmentId: enr.id,
            studentId: enr.studentId,
            studentCode: enr.student?.studentCode || "—",
            nisu: enr.student?.nisu || "",
            firstname: enr.student?.user?.firstname || "",
            lastname: enr.student?.user?.lastname || "",
            classSessionId: sessionId,
            className,
            status: enr.status,
          })),
        );
      } catch (err) {
        console.error("[bulletins] enrollments error:", err);
      } finally {
        setLoadingStudents(false);
      }
    },
    [sessions],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (selectedSession) void loadEnrollments(selectedSession);
      else setEnrollments([]);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [selectedSession, loadEnrollments]);

  // ── KPIs ──────────────────────────────────────────────────────────────────────
  const withNisu = enrollments.filter((e) => hasValidNisu(e.nisu));
  const withoutNisu = enrollments.filter((e) => !hasValidNisu(e.nisu));
  const bulletinEligible = enrollments.filter((e) => canPrintBulletin(e.nisu));
  const selectedStepObj = steps.find((s) => s.id === selectedStep);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredEnrollments.length / itemsPerPage),
  );
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

  // ── Génération en lot — découpée en 3 étapes (WF-003, WF-005, EP-003) ──

  // Étape 1 — click "Générer le lot" → ouvre le preview
  const handleOpenPreview = () => {
    if (!selectedStep || !selectedSession) return;
    setPreviewOpen(true);
  };

  // Étape 2 — après validation du preview
  const handlePreviewConfirm = () => {
    setPreviewOpen(false);
    const stepObj = steps.find((s) => s.id === selectedStep);
    const isCorrection = !(stepObj?.isCurrent ?? true);

    if (isCorrection) {
      // Période clôturée → demander le motif (WF-005)
      setAuditNoteOpen(true);
    } else {
      // Période active → génération directe
      void executeGenerateLot(null);
    }
  };

  // Étape 2bis — après validation du motif post-clôture
  const handleAuditNoteConfirm = async (payload: {
    reason: AuditReason;
    note: string;
  }) => {
    setAuditNoteOpen(false);
    await executeGenerateLot(payload);
  };

  // Étape 3 — exécution réelle (ex-generateLot)
  const executeGenerateLot = async (
    audit: { reason: AuditReason; note: string } | null,
  ) => {
    const eligible = enrollments.filter((e) => canPrintBulletin(e.nisu));
    if (eligible.length === 0 || !selectedStep || !selectedSession) return;

    setGeneratingLot(true);
    setLotProgress({ current: 0, total: eligible.length });

    // EP-003 : compteurs d'échec pour remonter à l'utilisateur
    let archiveFailures = 0;
    let firstArchiveFailure: string | null = null;
    let generationFailures = 0;
    let pdfSaved = false;

    try {
      const jsPDF = (await import("jspdf")).default;
      const { flushSync } = await import("react-dom");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "letter",
        compress: true,
      });
      const stepObj = steps.find((s) => s.id === selectedStep);
      const stepName = stepObj?.name ?? "etape";
      const isCorrection = !(stepObj?.isCurrent ?? true);
      const sessionObj = sessions.find((s) => s.id === selectedSession);
      const className = sessionObj ? getClassSessionName(sessionObj) : "classe";

      let firstPage = true;

      for (let i = 0; i < eligible.length; i++) {
        const student = eligible[i];
        setLotProgress({ current: i + 1, total: eligible.length });

        // Résilience : un élève qui échoue (données, capture, image…) est
        // compté en erreur et le lot continue — plus de gel global.
        try {
          const data = await buildBulletinData({
            enrollmentId: student.enrollmentId,
            studentId: student.studentId,
            classSessionId: student.classSessionId,
            stepId: selectedStep,
            stepName,
            className: student.className,
            yearId: academicYearId,
            academicYearLabel:
              sessionObj?.academicYear?.yearString ??
              sessionObj?.academicYear?.name,
            includeGeneralAverage,
            scope: bulletinScope,
          });

          flushSync(() => setLotData(data));
          await waitForTwoFrames();

          if (!lotRef.current) {
            generationFailures++;
            continue;
          }

          const { canvas } = await captureBulletinElement(lotRef.current);
          if (!firstPage) pdf.addPage("letter", "portrait");
          addBulletinCanvasToPdf(pdf, canvas);
          firstPage = false;

          // WF-005 + EP-003 : archivage avec auditNote + remontée des échecs.
          // Seul le bulletin NORMAL est archivé : l'archive est versionnée par
          // (élève, étape) sans notion de type, donc archiver l'examen dans la
          // même chaîne le ferait passer pour une correction du normal.
          if (bulletinScope === 'common') {
            const archiveResult = await archiveBulletin({
              enrollmentId: student.enrollmentId,
              stepId: selectedStep,
              source: "batch",
              bulletinSnapshot: data,
              isCorrection,
              auditNote: audit ? `[${audit.reason}] ${audit.note}` : undefined,
            });

            if (!archiveResult.ok) {
              archiveFailures++;
              const archiveMessage = toMessage(archiveResult.error);
              firstArchiveFailure ??= archiveMessage;
              console.warn("[archive lot] échec pour", student.studentCode, archiveMessage);
            }
          }
        } catch (studentError) {
          generationFailures++;
          console.error(
            "[generateLot] échec élève",
            student.studentCode ?? student.enrollmentId,
            studentError,
          );
        }
      }

      const total = eligible.length - generationFailures;

      if (total === 0) {
        toast.error(
          "Aucun bulletin n'a pu être généré — voir la console pour le détail.",
        );
        return;
      }

      // Téléchargement du PDF combiné (le type figure dans le nom de fichier)
      const scopeLabel = bulletinScope === 'exam' ? 'examen' : 'normal';
      const lotFilename = `bulletins_lot_${scopeLabel}_${className}_${stepName}_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(lotFilename);
      pdfSaved = true;

      if (generationFailures > 0) {
        toast.warning(
          `${generationFailures} bulletin${generationFailures > 1 ? "s" : ""} non généré${generationFailures > 1 ? "s" : ""} (erreur pendant la génération) — voir la console.`,
        );
      }

      // EP-003 : remonter l'état d'archivage à l'utilisateur
      const archived = total - archiveFailures;
      if (archiveFailures === 0) {
        toast.success(
          `${total} bulletin${total > 1 ? "s" : ""} généré${total > 1 ? "s" : ""} et archivé${total > 1 ? "s" : ""}.`,
        );
      } else if (archiveFailures < total) {
        toast.warning(
          `${archived} bulletin${archived > 1 ? "s" : ""} archivé${archived > 1 ? "s" : ""}, ` +
            `${archiveFailures} échec${archiveFailures > 1 ? "s" : ""} d'archivage. ` +
            `Le PDF est téléchargé mais certaines archives sont incomplètes.` +
            (firstArchiveFailure ? ` Détail : ${firstArchiveFailure}` : ""),
        );
      } else {
        toast.error(
          `PDF téléchargé pour ${total} élèves, mais AUCUN bulletin n'a été archivé. ` +
            `L'historique est incomplet. Contactez le support.` +
            (firstArchiveFailure ? ` Détail : ${firstArchiveFailure}` : ""),
        );
      }
    } catch (e) {
      console.error("[generateLot]", e);
      // EP-003 : plus de silent fail sur l'erreur globale
      if (pdfSaved) {
        toast.error(toMessage(e, "lors de la finalisation du lot"));
      } else {
        toast.error(toMessage(e, "lors de la génération du lot"));
      }
    } finally {
      setGeneratingLot(false);
      setLotData(null);
      setLotProgress({ current: 0, total: 0 });
      window.setTimeout(removeStalePdfCaptureHosts, 0);
    }
  };

  // ── Ouvrir PDF Generator ──────────────────────────────────────────────────────
  const handleGenerateBulletin = (student: EnrollmentRow) => {
    if (!selectedStep) return;
    setPdfStudent(student);
    setPdfOpen(true);
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────────
  if (loadingInit) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const selectedSessionLabel = sessions.find((s) => s.id === selectedSession)
    ? getClassSessionName(sessions.find((s) => s.id === selectedSession)!)
    : "";

  return (
    <div className="space-y-6">
      {/* Sélecteurs */}
      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Sélection</CardTitle>
          <CardDescription>
            Classe, salle et étape pour la génération des bulletins
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select value={selectedStep} onValueChange={setSelectedStep}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une étape" />
              </SelectTrigger>
              <SelectContent>
                {steps.map((step) => (
                  <SelectItem key={step.id} value={step.id}>
                    {step.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedClassTypeId} onValueChange={handleBulletinClassChange}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une classe" />
              </SelectTrigger>
              <SelectContent>
                {bulletinClassTypes.map((ct) => (
                  <SelectItem key={ct.id} value={ct.id}>
                    {ct.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedSession}
              onValueChange={setSelectedSession}
              disabled={!selectedClassTypeId}
            >
              <SelectTrigger>
                <SelectValue placeholder={selectedClassTypeId ? "Sélectionner une salle" : "Choisir une classe d'abord"} />
              </SelectTrigger>
              <SelectContent>
                {bulletinSalles.map((s) => (
                  <SelectItem key={s.sessionId} value={s.sessionId}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type de bulletin — uniquement pour les classes terminales */}
          {bulletinClassIsTerminal && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
              <span className="text-xs font-medium text-muted-foreground">
                Type de bulletin :
              </span>
              <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
                {([
                  { key: 'common', label: 'Normal (tronc commun)' },
                  { key: 'exam',   label: 'Examen officiel (filière)' },
                ] as const).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setBulletinScope(opt.key)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      bulletinScope === opt.key
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {bulletinScope === 'exam'
                  ? "Chaque élève reçoit les matières de SA filière."
                  : "Matières communes à toute la salle."}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empty state */}
      {(!selectedStep || !selectedSession) && (
        <Card className="border bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <InboxIcon className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              Aucune sélection
            </h3>
            <p className="mt-1 max-w-[320px] text-center text-sm text-muted-foreground">
              Sélectionnez une étape et une classe pour commencer la génération
              des bulletins.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Contenu si sélections faites */}
      {selectedStep && selectedSession && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Élèves"
              value={enrollments.length}
              icon={AlertCircleIcon}
              iconClassName="text-blue-600"
              iconBgClassName="bg-blue-50"
            />
            <StatCard
              label="NISU valides"
              value={withNisu.length}
              icon={CheckCircleIcon}
              iconClassName="text-emerald-600"
              iconBgClassName="bg-emerald-50"
            />
            <StatCard
              label="NISU absents/invalides"
              value={withoutNisu.length}
              icon={AlertTriangleIcon}
              iconClassName="text-amber-600"
              iconBgClassName="bg-amber-50"
            />
            <StatCard
              label="Étape"
              value={selectedStepObj?.name || "—"}
              icon={FileTextIcon}
              iconClassName="text-violet-600"
              iconBgClassName="bg-violet-50"
            />
          </div>

          {/* Lot button + progress */}
          <Card className="border bg-card shadow-sm">
            <CardContent className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center">
              <Button
                onClick={handleOpenPreview}
                disabled={isArchived || generatingLot || bulletinEligible.length === 0}
              >
                {generatingLot ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Génération {lotProgress.current} / {lotProgress.total}...
                  </>
                ) : (
                  <>
                    <LayersIcon className="mr-2 h-4 w-4" />
                    Générer le lot ({bulletinEligible.length} bulletin
                    {bulletinEligible.length > 1 ? "s" : ""})
                  </>
                )}
              </Button>

              {generatingLot && lotProgress.total > 0 && (
                <div className="flex w-full flex-1 items-center gap-3">
                  <Progress
                    value={(lotProgress.current / lotProgress.total) * 100}
                    className="h-2 flex-1 [&>div]:bg-primary"
                  />
                  <span className="whitespace-nowrap text-xs font-medium tabular-nums text-muted-foreground">
                    {Math.round(
                      (lotProgress.current / lotProgress.total) * 100,
                    )}
                    %
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Table card */}
          <Card className="border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Liste des élèves — {selectedSessionLabel}
              </CardTitle>
              <CardDescription>
                {filteredEnrollments.length} élève
                {filteredEnrollments.length > 1 ? "s" : ""}
                {searchQuery && ` — recherche : "${searchQuery}"`}
              </CardDescription>
            </CardHeader>

            <Separator />

            {/* Search toolbar */}
            <div className="p-4">
              <div className="relative max-w-md">
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <Separator />

            <CardContent className="p-0">
              {loadingStudents ? (
                <div className="flex items-center justify-center py-16">
                  <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-muted border-t-primary" />
                </div>
              ) : filteredEnrollments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                    <UserIcon className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-foreground">
                    {searchQuery ? "Aucun élève trouvé" : "Aucun élève actif"}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {searchQuery
                      ? "Modifiez vos critères de recherche."
                      : "Aucun élève actif dans cette classe."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[800px]">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[60px] pl-6 font-semibold">
                          Élève
                        </TableHead>
                        <TableHead className="font-semibold">Nom</TableHead>
                        <TableHead className="font-semibold">Prénom</TableHead>
                        <TableHead className="font-semibold">NISU</TableHead>
                        <TableHead className="font-semibold">Statut</TableHead>
                        <TableHead className="pr-6 text-right font-semibold">
                          Action
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedEnrollments.map((student) => {
                        const hasNisu = student.nisu.trim() !== "";
                        const canPrint = canPrintBulletin(student.nisu);
                        return (
                          <TableRow key={student.enrollmentId}>
                            <TableCell className="pl-6">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-muted text-muted-foreground">
                                  <UserIcon className="h-4 w-4" />
                                </AvatarFallback>
                              </Avatar>
                            </TableCell>
                            <TableCell className="font-medium text-foreground">
                              {student.lastname}
                            </TableCell>
                            <TableCell className="text-foreground">
                              {student.firstname}
                            </TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  "font-mono text-xs tabular-nums",
                                  canPrint
                                    ? "text-foreground"
                                    : "text-destructive font-medium",
                                )}
                              >
                                {student.nisu || "—"}
                              </span>
                            </TableCell>
                            <TableCell>
                              {canPrint ? (
                                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                                  {hasNisu ? "Valide" : "Optionnel"}
                                </Badge>
                              ) : (
                                <Badge variant="destructive">Invalide</Badge>
                              )}
                            </TableCell>
                            <TableCell className="pr-6 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isArchived || !canPrint}
                                onClick={() => handleGenerateBulletin(student)}
                              >
                                <FileTextIcon className="mr-1 h-3 w-3" />
                                Générer
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>

            {/* Pagination footer — affiché uniquement si > 15 élèves */}
            {filteredEnrollments.length > 15 && (
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
                      <span className="text-xs text-muted-foreground">
                        Afficher
                      </span>
                      <Select
                        value={String(itemsPerPage)}
                        onValueChange={(v) => setItemsPerPage(Number(v))}
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
                              currentPage === 1 &&
                                "pointer-events-none opacity-50",
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
            )}
          </Card>
        </>
      )}

      {/* Div caché pour capture lot PDF */}
      {generatingLot && lotData && (
      <div
        id={PDF_CAPTURE_HOST_ID}
        data-pdf-capture-host="true"
        aria-hidden="true"
        style={{
          position: "fixed",
          left: "-100000px",
          top: 0,
          zIndex: 0,
          background: "white",
          width: "816px",
          minHeight: "1056px",
          margin: 0,
          padding: 0,
          overflow: "visible",
          pointerEvents: "none",
          opacity: 1,
          visibility: "visible",
        }}
      >
        <div ref={lotRef}>
          <BulletinPrintable data={lotData} renderMode="pdf" />
        </div>
      </div>
      )}

      {/* PDF Generator Modal — individuel */}
      {pdfStudent && selectedStepObj && (
        <BulletinPDFGenerator
          open={pdfOpen}
          onOpenChange={(open) => {
            setPdfOpen(open);
            if (!open) setPdfStudent(null);
          }}
          studentId={pdfStudent.studentId}
          studentName={`${pdfStudent.lastname} ${pdfStudent.firstname}`}
          classSessionId={pdfStudent.classSessionId}
          stepId={selectedStep}
          stepName={selectedStepObj.name}
          className={pdfStudent.className}
          enrollmentId={pdfStudent.enrollmentId}
          yearId={academicYearId}
          academicYearLabel={
            sessions.find((s) => s.id === pdfStudent.classSessionId)?.academicYear?.yearString ??
            sessions.find((s) => s.id === pdfStudent.classSessionId)?.academicYear?.name
          }
          stepIsCurrent={selectedStepObj.isCurrent}
        />
      )}

      {/* WF-003 : aperçu avant génération en lot */}
      <BatchPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        className={
          selectedSession
            ? getClassSessionName(
                sessions.find((s) => s.id === selectedSession)!,
              )
            : ""
        }
        stepName={steps.find((s) => s.id === selectedStep)?.name ?? ""}
        stepIsClosed={
          !(steps.find((s) => s.id === selectedStep)?.isCurrent ?? true)
        }
        students={enrollments.map((e) => ({
          studentId: e.studentId,
          firstname: e.firstname,
          lastname: e.lastname,
          nisu: e.nisu,
          enrollmentId: e.enrollmentId,
        }))}
        isNisuValid={canPrintBulletin}
        onConfirm={handlePreviewConfirm}
        loading={generatingLot}
        includeGeneralAverage={includeGeneralAverage}
        onIncludeGeneralAverageChange={setIncludeGeneralAverage}
      />

      {/* WF-005 : motif pour correction post-clôture */}
      <AuditNoteModal
        open={auditNoteOpen}
        onOpenChange={setAuditNoteOpen}
        stepName={steps.find((s) => s.id === selectedStep)?.name ?? ""}
        onConfirm={handleAuditNoteConfirm}
        loading={generatingLot}
      />
    </div>
  );
}
