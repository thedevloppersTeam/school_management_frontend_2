"use client";

import * as React from "react";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PlusIcon,
  SearchIcon,
  LockIcon,
  UnlockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "lucide-react";
import { ClosePeriodModal } from "@/components/school/close-period-modal";
import { ReopenPeriodModalV2 } from "@/components/school/reopen-period-modal-v2";
import { CreatePeriodModalV2 } from "@/components/school/create-period-modal-v2";
import { AddClassSessionModal } from "@/components/school/add-class-session-modal";
import { DeleteClassroomModal } from "@/components/school/delete-classroom-modal";
import { EditClassroomModal } from "@/components/school/edit-classroom-modal";
import { CreateLevelModalV2 } from "@/components/school/create-level-modal-v2";
import { EditLevelModal } from "@/components/school/edit-level-modal";
import { DeleteLevelModal } from "@/components/school/delete-level-modal";
import { CreateSubjectParentModal } from "@/components/school/create-subject-parent-modal";
import { AddSubjectChildModal } from "@/components/school/add-subject-child-modal";
import { EditSubjectParentModal } from "@/components/school/edit-subject-parent-modal";
import { DeleteSubjectParentModal } from "@/components/school/delete-subject-parent-modal";
import { EditSubjectChildModal } from "@/components/school/edit-subject-child-modal";
import { DeleteSubjectChildModal } from "@/components/school/delete-subject-child-modal";
import { clientFetch, ApiError } from "@/lib/client-fetch";
import { toMessage } from "@/lib/errors";
import {
  computeClassroomStatuses,
  type ClassroomStatus,
} from "@/lib/api/close-readiness";
import {
  TH_CLASS,
  TABLE_HEAD_ROW_CLASS,
  TABLE_WRAPPER_CLASS,
  FIELD_LABEL_CLASS,
  INPUT_CLASS,
  BTN_PRIMARY_CLASS,
  BTN_DIALOG_PRIMARY_CLASS,
  BTN_OUTLINE_CLASS,
  LINK_BTN_CLASS,
  SECTION_HEADER_TITLE_CLASS,
  SECTION_HEADER_SUBTITLE_CLASS,
  rubricClasses,
} from "@/lib/cpmsl-classes";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface Period {
  id: string;
  name: string;
  status: "open" | "closed";
}
interface Track {
  id: string;
  code: string;
  name: string;
}
interface Level {
  id: string;
  name: string;
  niveau: string;
  filiere?: string;
  description?: string;
  category?: "fondamental" | "ns-tronc" | "ns-filiere";
}
interface Classroom {
  id: string;
  name: string;
  levelId: string;
  capacity: number;
  description?: string;
}
interface Student {
  id: string;
  classroomId: string;
  levelId: string;
}
interface SubjectParent {
  id: string;
  code: string;
  name: string;
  rubrique: "R1" | "R2" | "R3";
  coefficient: number;
}
interface SubjectChild {
  id: string;
  code: string;
  parentId: string;
  name: string;
  type: "L" | "C" | "N" | "P" | "T";
  coefficient: number;
}

interface CPMSLYearConfigTabsProps {
  yearName: string;
  yearId: string;
  isArchived?: boolean;
  periods: Period[];
  levels: Level[];
  subjectParents: SubjectParent[];
  subjectChildren: SubjectChild[];
  classrooms: Classroom[];
  students: Student[];
  tracks?: Track[];
  onAddPeriod?: (data: {
    name: string;
    type: "normal" | "blanc";
    startDate: string;
    endDate: string;
    description?: string;
  }) => void;
  onClosePeriod?: (periodId: string) => void;
  onReopenPeriod?: (periodId: string, reason: string) => void;
  onAddLevel?: (data: {
    niveau: "Fondamentale" | "Nouveau Secondaire";
    name: string;
    filieres?: string[];
    description?: string;
  }) => void;
  onAddSubjectParent?: (data: {
    name: string;
    code: string;
    rubrique: "R1" | "R2" | "R3";
    coefficient: number;
  }) => void;
  onAddSubjectChild?: (
    parentId: string,
    data: {
      name: string;
      code: string;
      type: "L" | "C" | "N" | "P" | "T";
      coefficient: number;
    },
  ) => void;
  onEditSubjectParent?: (
    parentId: string,
    data: { name: string; rubrique: "R1" | "R2" | "R3"; coefficient: number },
  ) => void;
  onDeleteSubjectParent?: (parentId: string) => void;
  onEditSubjectChild?: (
    childId: string,
    data: {
      name: string;
      type: "L" | "C" | "N" | "P" | "T";
      coefficient: number;
    },
  ) => void;
  onDeleteSubjectChild?: (childId: string) => void;
  onAddClassroom?: (
    levelId: string,
    data: { letter?: string; trackId?: string },
  ) => void;
  onEditClassroom?: (classroomId: string) => void;
  onDeleteClassroom?: (classroomId: string) => void;
  onEditLevel?: (levelId: string, data: { description?: string }) => void;
  onDeleteLevel?: (levelId: string) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function CPMSLYearConfigTabs({
  yearName,
  yearId,
  isArchived,
  periods,
  levels,
  subjectParents,
  subjectChildren,
  classrooms,
  students,
  tracks = [],
  onAddPeriod,
  onClosePeriod,
  onReopenPeriod,
  onAddLevel,
  onAddSubjectParent,
  onAddSubjectChild,
  onEditSubjectParent,
  onDeleteSubjectParent,
  onEditSubjectChild,
  onDeleteSubjectChild,
  onAddClassroom,
  onEditClassroom,
  onDeleteClassroom,
  onEditLevel,
  onDeleteLevel,
}: CPMSLYearConfigTabsProps) {
  const { toast } = useToast();

  const [searchClass, setSearchClass] = useState("");
  const [searchSubject, setSearchSubject] = useState("");
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(
    new Set(["1"]),
  );

  // ── Modaux périodes ──────────────────────────────────────────────────────
  const [closePeriodModalOpen, setClosePeriodModalOpen] = useState(false);
  const [reopenPeriodModalOpen, setReopenPeriodModalOpen] = useState(false);
  const [createPeriodModalOpen, setCreatePeriodModalOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null);
  const [closeReadiness, setCloseReadiness] = useState<ClassroomStatus[]>([]);
  const [readinessLoading, setReadinessLoading] = useState(false);

  // ── Modaux classes ───────────────────────────────────────────────────────
  const [addClassroomModalOpen, setAddClassroomModalOpen] = useState(false);
  const [addClassroomSubmitting, setAddClassroomSubmitting] = useState(false);
  const [deleteClassroomModalOpen, setDeleteClassroomModalOpen] =
    useState(false);
  const [editClassroomModalOpen, setEditClassroomModalOpen] = useState(false);
  const [createLevelModalOpen, setCreateLevelModalOpen] = useState(false);
  const [editLevelModalOpen, setEditLevelModalOpen] = useState(false);
  const [deleteLevelModalOpen, setDeleteLevelModalOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<Level | null>(null);
  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(
    null,
  );

  // ── Modaux matières ──────────────────────────────────────────────────────
  const [createSubjectParentModalOpen, setCreateSubjectParentModalOpen] =
    useState(false);
  const [addSubjectChildModalOpen, setAddSubjectChildModalOpen] =
    useState(false);
  const [editSubjectParentModalOpen, setEditSubjectParentModalOpen] =
    useState(false);
  const [deleteSubjectParentModalOpen, setDeleteSubjectParentModalOpen] =
    useState(false);
  const [editSubjectChildModalOpen, setEditSubjectChildModalOpen] =
    useState(false);
  const [deleteSubjectChildModalOpen, setDeleteSubjectChildModalOpen] =
    useState(false);
  const [selectedSubjectParent, setSelectedSubjectParent] =
    useState<SubjectParent | null>(null);
  const [selectedSubjectChild, setSelectedSubjectChild] =
    useState<SubjectChild | null>(null);

  // ── Affectation matières ─────────────────────────────────────────────────
  const [selectedSessionForAssign, setSelectedSessionForAssign] = useState("");
  const [classSubjects, setClassSubjects] = useState<
    Array<{
      id: string;
      subjectId: string;
      subjectName: string;
      subjectCode: string;
      rubriqueCode?: string;
      coefficient: number;
      coefficientOverride: number | null;
    }>
  >([]);
  const [loadingClassSubjects, setLoadingClassSubjects] = useState(false);

  // ── Modal assignation ────────────────────────────────────────────────────
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignSubjectId, setAssignSubjectId] = useState("");
  const [assignSelectedSessions, setAssignSelectedSessions] = useState<
    Set<string>
  >(new Set());
  const [assignCoeffOverride, setAssignCoeffOverride] = useState("");
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  // ── Modal edit coefficient override ──────────────────────────────────────
  const [editCoeffModalOpen, setEditCoeffModalOpen] = useState(false);
  const [editCoeffClassSubject, setEditCoeffClassSubject] = useState<{
    id: string;
    subjectName: string;
    coefficient: number;
    coefficientOverride: number | null;
  } | null>(null);
  const [editCoeffValue, setEditCoeffValue] = useState("");
  const [editCoeffSubmitting, setEditCoeffSubmitting] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getClassroomsForLevel = (levelId: string) =>
    classrooms.filter((c) => c.levelId === levelId);
  const getStudentCountForClassroom = (classroomId: string) =>
    students.filter((s) => s.classroomId === classroomId).length;
  const getTotalStudentCountForLevel = (levelId: string) =>
    students.filter((s) => s.levelId === levelId).length;
  const totalClassrooms = classrooms.length;
  const r1Count = subjectParents.filter((s) => s.rubrique === "R1").length;
  const r2Count = subjectParents.filter((s) => s.rubrique === "R2").length;
  const r3Count = subjectParents.filter((s) => s.rubrique === "R3").length;

  const toggleLevelExpansion = (levelId: string) => {
    setExpandedLevels((prev) => {
      const n = new Set(prev);
      if (n.has(levelId)) n.delete(levelId);
      else n.add(levelId);
      return n;
    });
  };
  const toggleSubjectExpansion = (subjectId: string) => {
    setExpandedSubjects((prev) => {
      const n = new Set(prev);
      if (n.has(subjectId)) n.delete(subjectId);
      else n.add(subjectId);
      return n;
    });
  };

  // ── Handlers périodes ────────────────────────────────────────────────────
  const handleClosePeriod = async (p: Period) => {
    setSelectedPeriod(p);
    setCloseReadiness([]);
    setReadinessLoading(true);
    setClosePeriodModalOpen(true);
    try {
      const statuses = await computeClassroomStatuses(classrooms, levels, p.id);
      setCloseReadiness(statuses);
    } catch (err) {
      console.error("[close-readiness]", err);
      toast({
        title: "Erreur",
        description: toMessage(err, "lors du calcul de l'état de clôture"),
        variant: "destructive",
      });
    } finally {
      setReadinessLoading(false);
    }
  };
  const handleReopenPeriod = (p: Period) => {
    setSelectedPeriod(p);
    setReopenPeriodModalOpen(true);
  };

  // ── Handlers classes ─────────────────────────────────────────────────────
  const handleAddClassroom = (l: Level) => {
    setSelectedLevel(l);
    setAddClassroomModalOpen(true);
  };
  const handleEditClassroom = (c: Classroom, l: Level) => {
    setSelectedClassroom(c);
    setSelectedLevel(l);
    setEditClassroomModalOpen(true);
  };
  const handleDeleteClassroom = (c: Classroom, l: Level) => {
    setSelectedClassroom(c);
    setSelectedLevel(l);
    setDeleteClassroomModalOpen(true);
  };
  const handleEditLevel = (l: Level) => {
    setSelectedLevel(l);
    setEditLevelModalOpen(true);
  };
  const handleDeleteLevel = (l: Level) => {
    setSelectedLevel(l);
    setDeleteLevelModalOpen(true);
  };

  // ── Handlers matières ────────────────────────────────────────────────────
  const handleAddSubjectChild = (p: SubjectParent) => {
    setSelectedSubjectParent(p);
    setAddSubjectChildModalOpen(true);
  };
  const handleEditSubjectParent = (p: SubjectParent) => {
    setSelectedSubjectParent(p);
    setEditSubjectParentModalOpen(true);
  };
  const handleDeleteSubjectParent = (p: SubjectParent) => {
    setSelectedSubjectParent(p);
    setDeleteSubjectParentModalOpen(true);
  };
  const handleEditSubjectChild = (c: SubjectChild) => {
    setSelectedSubjectChild(c);
    setEditSubjectChildModalOpen(true);
  };
  const handleDeleteSubjectChild = (c: SubjectChild) => {
    setSelectedSubjectChild(c);
    setDeleteSubjectChildModalOpen(true);
  };

  // ── Chargement matières d'une classe ─────────────────────────────────────
  const loadClassSubjects = async (sessionId: string) => {
    setLoadingClassSubjects(true);
    try {
      const res = await fetch(
        `/api/class-subjects?classSessionId=${sessionId}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`Échec du chargement (HTTP ${res.status})`);
      const data = await res.json();
      setClassSubjects(
        data.map(
          (cs: {
            id: string;
            subjectId: string;
            subject?: {
              name?: string;
              code?: string;
              rubric?: { code?: string };
              coefficient?: { d?: number[] } | number;
            };
            coefficientOverride?: { d?: number[] } | number | null;
          }) => ({
            id: cs.id,
            subjectId: cs.subjectId,
            subjectName: cs.subject?.name || "—",
            subjectCode: cs.subject?.code || "—",
            rubriqueCode: cs.subject?.rubric?.code,
            coefficient:
              Number(
                (cs.subject?.coefficient as { d?: number[] })?.d?.[0] ??
                  cs.subject?.coefficient,
              ) || 1,
            coefficientOverride:
              cs.coefficientOverride != null
                ? Number(
                    (cs.coefficientOverride as { d?: number[] })?.d?.[0] ??
                      cs.coefficientOverride,
                  )
                : null,
          }),
        ),
      );
    } catch (err) {
      console.error("[affectation] erreur chargement class-subjects:", err);
      toast({
        title: "Erreur",
        description: toMessage(
          err,
          "lors du chargement des matières de la classe",
        ),
        variant: "destructive",
      });
      setClassSubjects([]);
    } finally {
      setLoadingClassSubjects(false);
    }
  };

  const handleSessionChangeForAssign = (sessionId: string) => {
    setSelectedSessionForAssign(sessionId);
    if (sessionId) loadClassSubjects(sessionId);
    else setClassSubjects([]);
  };

  // ── Modal edit coefficient override ──────────────────────────────────────
  const openEditCoeffModal = (cs: (typeof classSubjects)[0]) => {
    setEditCoeffClassSubject({
      id: cs.id,
      subjectName: cs.subjectName,
      coefficient: cs.coefficient,
      coefficientOverride: cs.coefficientOverride ?? null,
    });
    setEditCoeffValue(
      cs.coefficientOverride != null ? String(cs.coefficientOverride) : "",
    );
    setEditCoeffModalOpen(true);
  };

  const handleSaveCoeffOverride = async () => {
    if (!editCoeffClassSubject) return;
    setEditCoeffSubmitting(true);
    try {
      const res = await fetch(
        `/api/class-subjects/update/${editCoeffClassSubject.id}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            coefficientOverride:
              editCoeffValue !== "" ? parseFloat(editCoeffValue) : null,
          }),
        },
      );
      if (!res.ok)
        throw new Error(`Échec de la mise à jour (HTTP ${res.status})`);
      toast({ title: "Coefficient modifié" });
      setEditCoeffModalOpen(false);
      if (selectedSessionForAssign)
        await loadClassSubjects(selectedSessionForAssign);
    } catch (err) {
      console.error("[coeff-override]", err);
      toast({
        title: "Erreur",
        description: toMessage(err, "lors de la modification du coefficient"),
        variant: "destructive",
      });
    } finally {
      setEditCoeffSubmitting(false);
    }
  };

  // ── Modal assignation ────────────────────────────────────────────────────
  const openAssignModal = () => {
    setAssignSubjectId("");
    setAssignSelectedSessions(new Set());
    setAssignCoeffOverride("");
    setAssignModalOpen(true);
  };

  const toggleAssignSession = (sessionId: string) => {
    setAssignSelectedSessions((prev) => {
      const n = new Set(prev);
      if (n.has(sessionId)) n.delete(sessionId);
      else n.add(sessionId);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (assignSelectedSessions.size === classrooms.length) {
      setAssignSelectedSessions(new Set());
    } else {
      setAssignSelectedSessions(new Set(classrooms.map((c) => c.id)));
    }
  };

  const handleAssignSubjectToClasses = async () => {
    if (!assignSubjectId || assignSelectedSessions.size === 0) return;
    setAssignSubmitting(true);
    try {
      await Promise.all(
        Array.from(assignSelectedSessions).map(async (sessionId) => {
          const payload = {
            classSessionId: sessionId,
            subjectId: assignSubjectId,
            teacherId: null,
            coefficientOverride: assignCoeffOverride
              ? parseFloat(assignCoeffOverride)
              : null,
          };
          const res = await fetch("/api/class-subjects/create", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            if (res.status === 500 || res.status === 409) return;
            const err = await res.json().catch(() => ({}));
            throw new Error(
              err.message || `Échec assignation (HTTP ${res.status})`,
            );
          }
        }),
      );
      setAssignModalOpen(false);
      if (selectedSessionForAssign)
        await loadClassSubjects(selectedSessionForAssign);
    } catch (err) {
      console.error("[affectation] erreur:", err);
      toast({
        title: "Erreur assignation",
        description: toMessage(err, "lors de l'assignation de la matière"),
        variant: "destructive",
      });
    } finally {
      setAssignSubmitting(false);
    }
  };

  const filteredLevels = levels.filter((l) =>
    l.name.toLowerCase().includes(searchClass.toLowerCase()),
  );
  const filteredSubjectParents = subjectParents.filter(
    (s) =>
      s.name.toLowerCase().includes(searchSubject.toLowerCase()) ||
      s.code.toLowerCase().includes(searchSubject.toLowerCase()),
  );
  const assignSelectedSubject = subjectParents.find(
    (s) => s.id === assignSubjectId,
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
      <Tabs defaultValue="periods" className="w-full">
        <div className="px-6 pt-4">
          <TabsList className="bg-primary-50 rounded-lg p-1">
            <TabsTrigger
              value="periods"
              className="label-ui rounded-md text-neutral-500 data-[state=active]:bg-white data-[state=active]:text-primary-800 data-[state=active]:shadow-sm"
            >
              Étapes ({periods.length}/5)
            </TabsTrigger>
            <TabsTrigger
              value="classes"
              className="label-ui rounded-md text-neutral-500 data-[state=active]:bg-white data-[state=active]:text-primary-800 data-[state=active]:shadow-sm"
            >
              Classes ({levels.length})
            </TabsTrigger>
            <TabsTrigger
              value="subjects"
              className="label-ui rounded-md text-neutral-500 data-[state=active]:bg-white data-[state=active]:text-primary-800 data-[state=active]:shadow-sm"
            >
              Matières ({subjectParents.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ═══════════════════ Onglet Étapes ═══════════════════════════════ */}
        <TabsContent value="periods" className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-600">
              {periods.length} / 5 étapes configurées
            </span>
            {!isArchived && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        onClick={() => setCreatePeriodModalOpen(true)}
                        disabled={periods.length >= 5}
                        className={
                          periods.length >= 5
                            ? "bg-neutral-200 text-neutral-500 cursor-not-allowed rounded-lg"
                            : "bg-primary-500 hover:bg-primary-600 text-white rounded-lg"
                        }
                      >
                        <PlusIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                        Nouvelle étape
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {periods.length >= 5 && (
                    <TooltipContent>
                      <p>Maximum 5 étapes par année scolaire</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          <div className={TABLE_WRAPPER_CLASS}>
            <table className="w-full">
              <thead>
                <tr className={TABLE_HEAD_ROW_CLASS}>
                  <th
                    scope="col"
                    className={`${TH_CLASS} px-4 py-3 text-left w-[40%]`}
                  >
                    Nom
                  </th>
                  <th
                    scope="col"
                    className={`${TH_CLASS} px-4 py-3 text-left w-[35%]`}
                  >
                    Statut
                  </th>
                  <th
                    scope="col"
                    className={`${TH_CLASS} px-4 py-3 text-center w-[25%]`}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {periods.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-6 text-center text-neutral-500 text-sm"
                    >
                      Aucune étape — cliquez sur &laquo;&nbsp;Nouvelle
                      étape&nbsp;&raquo; pour commencer
                    </td>
                  </tr>
                ) : (
                  periods.map((period, index) => (
                    <tr
                      key={period.id}
                      className={`${index > 0 ? "border-t border-neutral-200" : ""} bg-white hover:bg-secondary-50`}
                    >
                      <td className="px-4 py-3 text-neutral-900 text-sm font-semibold">
                        {period.name}
                      </td>
                      <td className="px-4 py-3">
                        {period.status === "open" ? (
                          <div className="inline-flex items-center gap-1.5 bg-success-soft text-success px-2.5 py-1 rounded-md text-xs font-medium">
                            <UnlockIcon
                              className="h-3 w-3"
                              aria-hidden="true"
                            />
                            Ouverte
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 bg-warning-soft text-warning px-2.5 py-1 rounded-md text-xs font-medium">
                            <LockIcon className="h-3 w-3" aria-hidden="true" />
                            Clôturée
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {!isArchived && (
                          <button
                            type="button"
                            onClick={() =>
                              period.status === "open"
                                ? handleClosePeriod(period)
                                : handleReopenPeriod(period)
                            }
                            className={`${LINK_BTN_CLASS} text-primary-500 focus-visible:outline-primary-500`}
                          >
                            {period.status === "open" ? "Clôturer" : "Réouvrir"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ═══════════════════ Onglet Classes ══════════════════════════════ */}
        <TabsContent value="classes" className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-neutral-600">
              {levels.length} classes · {totalClassrooms} salles / filières
            </span>
            <div className="relative">
              <SearchIcon
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400"
                aria-hidden="true"
              />
              <Input
                id="year-search-class"
                placeholder="Rechercher une classe..."
                value={searchClass}
                onChange={(e) => setSearchClass(e.target.value)}
                className={`${INPUT_CLASS} pl-9 focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20`}
                aria-label="Rechercher une classe"
              />
            </div>
          </div>

          <div className={TABLE_WRAPPER_CLASS}>
            <table className="w-full">
              <thead>
                <tr className={TABLE_HEAD_ROW_CLASS}>
                  <th
                    scope="col"
                    className={`${TH_CLASS} px-4 py-3 text-left w-[4%]`}
                  ></th>
                  <th
                    scope="col"
                    className={`${TH_CLASS} px-4 py-3 text-left w-[12%]`}
                  >
                    Nom
                  </th>
                  <th
                    scope="col"
                    className={`${TH_CLASS} px-4 py-3 text-left w-[22%]`}
                  >
                    Niveau
                  </th>
                  <th
                    scope="col"
                    className={`${TH_CLASS} px-4 py-3 text-left w-[18%]`}
                  >
                    Groupes
                  </th>
                  <th
                    scope="col"
                    className={`${TH_CLASS} px-4 py-3 text-left w-[18%]`}
                  >
                    Élèves
                  </th>
                  <th
                    scope="col"
                    className={`${TH_CLASS} px-4 py-3 text-center w-[26%]`}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLevels.map((level, levelIndex) => {
                  const levelClassrooms = getClassroomsForLevel(level.id);
                  const isExpanded = expandedLevels.has(level.id);
                  const hasClassrooms = levelClassrooms.length > 0;
                  const totalStudents = getTotalStudentCountForLevel(level.id);
                  const isFiliere = level.category === "ns-filiere";
                  return (
                    <React.Fragment key={`level-${level.id}`}>
                      <tr
                        className={`${levelIndex > 0 ? "border-t border-neutral-200" : ""} bg-white hover:bg-secondary-50`}
                      >
                        <td className="px-4 py-3">
                          {hasClassrooms && (
                            <button
                              type="button"
                              onClick={() => toggleLevelExpansion(level.id)}
                              aria-label={
                                isExpanded
                                  ? `Masquer les classes de ${level.name}`
                                  : `Afficher les classes de ${level.name}`
                              }
                              aria-expanded={isExpanded}
                              className="flex items-center justify-center text-primary-500 hover:bg-neutral-100 rounded p-1 focus-visible:outline-2 focus-visible:outline-primary-500"
                            >
                              {isExpanded ? (
                                <ChevronDownIcon
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              ) : (
                                <ChevronRightIcon
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              )}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-neutral-900 text-sm font-semibold">
                          {level.name}
                        </td>
                        <td className="px-4 py-3 text-neutral-600 text-sm">
                          {level.niveau}
                        </td>
                        <td className="px-4 py-3 text-neutral-600 text-sm">
                          {`${levelClassrooms.length} ${
                            isFiliere
                              ? levelClassrooms.length === 1
                                ? "filière"
                                : "filières"
                              : levelClassrooms.length === 1
                                ? "salle"
                                : "salles"
                          }`}
                        </td>
                        <td className="px-4 py-3 text-neutral-600 text-sm">
                          {totalStudents}{" "}
                          {totalStudents === 1 ? "élève" : "élèves"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {!isArchived && (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleAddClassroom(level)}
                                className={`${LINK_BTN_CLASS} text-primary-500 focus-visible:outline-primary-500 inline-flex items-center gap-1`}
                              >
                                <PlusIcon
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                                {isFiliere
                                  ? "Ajouter filière"
                                  : "Ajouter salle"}
                              </button>
                              <span
                                className="text-neutral-300"
                                aria-hidden="true"
                              >
                                |
                              </span>
                              <button
                                type="button"
                                onClick={() => handleEditLevel(level)}
                                className={`${LINK_BTN_CLASS} text-primary-500 focus-visible:outline-primary-500`}
                              >
                                Modifier
                              </button>
                              <span
                                className="text-neutral-300"
                                aria-hidden="true"
                              >
                                |
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteLevel(level)}
                                className={`${LINK_BTN_CLASS} text-error focus-visible:outline-error`}
                              >
                                Supprimer
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {isExpanded &&
                        levelClassrooms.map((classroom) => {
                          const studentCount = getStudentCountForClassroom(
                            classroom.id,
                          );
                          return (
                            <tr
                              key={`classroom-${classroom.id}`}
                              className="border-t border-neutral-200 bg-neutral-50 hover:bg-neutral-100"
                            >
                              <td className="px-4 py-3"></td>
                              <td className="pl-8 pr-4 py-3 text-neutral-900 text-sm">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="text-neutral-400"
                                    aria-hidden="true"
                                  >
                                    └
                                  </span>
                                  {isFiliere ? (
                                    <div className="flex items-center gap-2">
                                      <span className="bg-info-soft text-info px-2 py-0.5 rounded text-xs font-medium">
                                        Filière
                                      </span>
                                      <span>{classroom.name}</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <span className="bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded text-xs font-medium">
                                        Salle
                                      </span>
                                      <span>{classroom.name}</span>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-neutral-500 text-sm">
                                —
                              </td>
                              <td className="px-4 py-3 text-neutral-500 text-sm">
                                —
                              </td>
                              <td className="px-4 py-3 text-neutral-600 text-sm">
                                {studentCount}{" "}
                                {studentCount === 1 ? "élève" : "élèves"}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {!isArchived && (
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleEditClassroom(classroom, level)
                                      }
                                      className={`${LINK_BTN_CLASS} text-primary-500 focus-visible:outline-primary-500`}
                                    >
                                      Modifier
                                    </button>
                                    <span
                                      className="text-neutral-300"
                                      aria-hidden="true"
                                    >
                                      |
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteClassroom(classroom, level)
                                      }
                                      className={`${LINK_BTN_CLASS} text-error focus-visible:outline-error`}
                                    >
                                      Supprimer
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ═══════════════════ Onglet Matières ═════════════════════════════ */}
        <TabsContent value="subjects" className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="secondary"
                className="bg-primary-50 text-primary-800 text-xs font-medium px-2.5 py-1"
              >
                {subjectParents.length} matières
              </Badge>
              <Badge
                variant="secondary"
                className="bg-primary-50 text-primary-800 text-xs font-medium px-2.5 py-1"
              >
                {subjectChildren.length} sous-matières
              </Badge>
              <Badge
                variant="secondary"
                className={`text-xs font-medium px-2.5 py-1 border-0 ${rubricClasses("R1").badge}`}
              >
                R1: {r1Count}
              </Badge>
              <Badge
                variant="secondary"
                className={`text-xs font-medium px-2.5 py-1 border-0 ${rubricClasses("R2").badge}`}
              >
                R2: {r2Count}
              </Badge>
              <Badge
                variant="secondary"
                className={`text-xs font-medium px-2.5 py-1 border-0 ${rubricClasses("R3").badge}`}
              >
                R3: {r3Count}
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <SearchIcon
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400"
                  aria-hidden="true"
                />
                <Input
                  id="year-search-subject"
                  placeholder="Rechercher une matière..."
                  value={searchSubject}
                  onChange={(e) => setSearchSubject(e.target.value)}
                  className={`${INPUT_CLASS} pl-9 focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20`}
                  aria-label="Rechercher une matière"
                />
              </div>
              {!isArchived && (
                <a
                  href="/admin/settings"
                  className="bg-primary-500 hover:bg-primary-600 text-white rounded-lg px-4 py-2 text-sm font-medium inline-flex items-center gap-2 no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                >
                  <PlusIcon className="h-4 w-4" aria-hidden="true" />
                  Gérer les matières
                </a>
              )}
            </div>
          </div>

          <div className={TABLE_WRAPPER_CLASS}>
            <table className="w-full">
              <thead>
                <tr className={TABLE_HEAD_ROW_CLASS}>
                  <th
                    scope="col"
                    className={`${TH_CLASS} px-4 py-3 text-left w-[4%]`}
                  ></th>
                  <th
                    scope="col"
                    className={`${TH_CLASS} px-4 py-3 text-left w-[12%]`}
                  >
                    Code
                  </th>
                  <th
                    scope="col"
                    className={`${TH_CLASS} px-4 py-3 text-left w-[30%]`}
                  >
                    Nom
                  </th>
                  <th
                    scope="col"
                    className={`${TH_CLASS} px-4 py-3 text-left w-[15%]`}
                  >
                    Rubrique
                  </th>
                  <th
                    scope="col"
                    className={`${TH_CLASS} px-4 py-3 text-left w-[15%]`}
                  >
                    Coefficient
                  </th>
                  <th
                    scope="col"
                    className={`${TH_CLASS} px-4 py-3 text-center w-[24%]`}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSubjectParents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-neutral-500 text-sm"
                    >
                      Aucune matière — utilisez &laquo;&nbsp;Gérer les
                      matières&nbsp;&raquo; pour en ajouter
                    </td>
                  </tr>
                ) : (
                  filteredSubjectParents.map((parent, parentIndex) => {
                    const children = subjectChildren.filter(
                      (c) => c.parentId === parent.id,
                    );
                    const isExpanded = expandedSubjects.has(parent.id);
                    const hasChildren = children.length > 0;
                    const cR = rubricClasses(parent.rubrique);
                    return (
                      <React.Fragment key={parent.id}>
                        <tr
                          className={`${parentIndex > 0 ? "border-t border-neutral-200" : ""} bg-white hover:bg-secondary-50`}
                        >
                          <td className="px-4 py-3">
                            {hasChildren && (
                              <button
                                type="button"
                                onClick={() =>
                                  toggleSubjectExpansion(parent.id)
                                }
                                aria-label={
                                  isExpanded
                                    ? `Masquer les sous-matières de ${parent.name}`
                                    : `Afficher les sous-matières de ${parent.name}`
                                }
                                aria-expanded={isExpanded}
                                className="flex items-center justify-center text-primary-500 hover:bg-neutral-100 rounded p-1 focus-visible:outline-2 focus-visible:outline-primary-500"
                              >
                                {isExpanded ? (
                                  <ChevronDownIcon
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <ChevronRightIcon
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                )}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-neutral-900 uppercase">
                            {parent.code}
                          </td>
                          <td className="px-4 py-3 text-neutral-900 text-sm font-semibold">
                            {parent.name}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              className={`text-xs font-medium border-0 ${cR.badge}`}
                            >
                              {parent.rubrique}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-neutral-900 text-sm">
                            {parent.coefficient}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              {!isArchived && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleAddSubjectChild(parent)
                                    }
                                    className={`${LINK_BTN_CLASS} text-primary-800 focus-visible:outline-primary-800`}
                                  >
                                    + Sous-matière
                                  </button>
                                  <span
                                    className="text-neutral-300"
                                    aria-hidden="true"
                                  >
                                    |
                                  </span>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => handleEditSubjectParent(parent)}
                                className={`${LINK_BTN_CLASS} text-primary-500 focus-visible:outline-primary-500`}
                              >
                                Modifier
                              </button>
                              <span
                                className="text-neutral-300"
                                aria-hidden="true"
                              >
                                |
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteSubjectParent(parent)
                                }
                                className={`${LINK_BTN_CLASS} text-error focus-visible:outline-error`}
                              >
                                Supprimer
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded &&
                          children.map((child) => (
                            <tr
                              key={child.id}
                              className="border-t border-neutral-200 bg-neutral-50 hover:bg-neutral-100"
                            >
                              <td className="px-4 py-3"></td>
                              <td className="pl-10 pr-4 py-3 font-mono text-xs font-semibold text-neutral-600 uppercase">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="text-neutral-400"
                                    aria-hidden="true"
                                  >
                                    └
                                  </span>
                                  {child.code}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-neutral-900 text-sm">
                                {child.name}
                              </td>
                              <td className="px-4 py-3"></td>
                              <td className="px-4 py-3 text-neutral-900 text-sm">
                                {child.coefficient}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleEditSubjectChild(child)
                                    }
                                    className={`${LINK_BTN_CLASS} text-primary-500 focus-visible:outline-primary-500`}
                                  >
                                    Modifier
                                  </button>
                                  <span
                                    className="text-neutral-300"
                                    aria-hidden="true"
                                  >
                                    |
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteSubjectChild(child)
                                    }
                                    className={`${LINK_BTN_CLASS} text-error focus-visible:outline-error`}
                                  >
                                    Supprimer
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Affectation aux classes ────────────────────────────────── */}
          <div className="mt-8 pt-8 border-t-2 border-neutral-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={SECTION_HEADER_TITLE_CLASS}>
                  Affectation aux classes
                </h3>
                <p className={SECTION_HEADER_SUBTITLE_CLASS}>
                  Assignez une matière à une ou plusieurs classes de cette année
                </p>
              </div>
              {!isArchived &&
                subjectParents.length > 0 &&
                classrooms.length > 0 && (
                  <Button
                    onClick={openAssignModal}
                    className={BTN_PRIMARY_CLASS}
                  >
                    <PlusIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                    Assigner une matière
                  </Button>
                )}
            </div>

            <div className="mb-4 max-w-xs">
              <Label htmlFor="year-class-selector" className="sr-only">
                Voir les matières d&apos;une classe
              </Label>
              <select
                id="year-class-selector"
                value={selectedSessionForAssign}
                onChange={(e) => handleSessionChangeForAssign(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-900 bg-white focus-visible:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/20"
              >
                <option value="">
                  — Voir les matières d&apos;une classe —
                </option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedSessionForAssign &&
              (loadingClassSubjects ? (
                <p className="text-sm text-neutral-500">Chargement...</p>
              ) : (
                <div className={TABLE_WRAPPER_CLASS}>
                  <table className="w-full">
                    <thead>
                      <tr className={TABLE_HEAD_ROW_CLASS}>
                        <th
                          scope="col"
                          className={`${TH_CLASS} px-4 py-2.5 text-left`}
                        >
                          Code
                        </th>
                        <th
                          scope="col"
                          className={`${TH_CLASS} px-4 py-2.5 text-left`}
                        >
                          Matière
                        </th>
                        <th
                          scope="col"
                          className={`${TH_CLASS} px-4 py-2.5 text-left`}
                        >
                          Rubrique
                        </th>
                        <th
                          scope="col"
                          className={`${TH_CLASS} px-4 py-2.5 text-left`}
                        >
                          Coeff. global
                        </th>
                        <th
                          scope="col"
                          className={`${TH_CLASS} px-4 py-2.5 text-left`}
                        >
                          Coeff. override
                        </th>
                        <th
                          scope="col"
                          className={`${TH_CLASS} px-4 py-2.5 text-left`}
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {classSubjects.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-6 text-center text-neutral-500 text-sm"
                          >
                            Aucune matière assignée à cette classe
                          </td>
                        </tr>
                      ) : (
                        classSubjects.map((cs, i) => {
                          const cR = rubricClasses(cs.rubriqueCode);
                          return (
                            <tr
                              key={cs.id}
                              className={`${i > 0 ? "border-t border-neutral-200" : ""} bg-white hover:bg-secondary-50`}
                            >
                              <td className="px-4 py-3 font-mono text-xs font-semibold text-neutral-900 uppercase">
                                {cs.subjectCode}
                              </td>
                              <td className="px-4 py-3 text-sm font-semibold text-neutral-900">
                                {cs.subjectName}
                              </td>
                              <td className="px-4 py-3">
                                {cs.rubriqueCode ? (
                                  <span
                                    className={`px-2 py-0.5 rounded text-xs font-bold ${cR.badge}`}
                                  >
                                    {cs.rubriqueCode}
                                  </span>
                                ) : (
                                  <span className="text-neutral-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-neutral-900">
                                {cs.coefficient}
                              </td>
                              <td
                                className={`px-4 py-3 text-sm ${cs.coefficientOverride ? "text-info font-semibold" : "text-neutral-400"}`}
                              >
                                {cs.coefficientOverride ?? "—"}
                              </td>
                              <td className="px-4 py-3">
                                {!isArchived && (
                                  <button
                                    type="button"
                                    onClick={() => openEditCoeffModal(cs)}
                                    className={`${LINK_BTN_CLASS} text-primary-500 focus-visible:outline-primary-500`}
                                  >
                                    Modifier
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              ))}

            {!selectedSessionForAssign && (
              <div className="px-6 py-6 text-center text-sm text-neutral-500 bg-neutral-50 rounded-lg border border-neutral-200">
                Sélectionnez une classe pour voir ses matières assignées
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ═══════════════════ Modal Edit Coefficient Override ════════════════ */}
      <Dialog open={editCoeffModalOpen} onOpenChange={setEditCoeffModalOpen}>
        <DialogContent className="bg-white rounded-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-bold text-primary-800">
              Modifier le coefficient
            </DialogTitle>
            <DialogDescription className="text-sm text-neutral-500">
              {editCoeffClassSubject?.subjectName}
            </DialogDescription>
          </DialogHeader>

          {editCoeffClassSubject && (
            <div className="space-y-4 py-2">
              <div className="bg-primary-50 rounded-lg px-4 py-3">
                <p className="text-xs text-neutral-500 mb-0.5">
                  Coefficient global
                </p>
                <p className="text-base font-bold text-primary-800">
                  {editCoeffClassSubject.coefficient}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="coeff-override-value"
                  className={FIELD_LABEL_CLASS}
                >
                  Coefficient override
                  <span className="ml-2 text-xs text-neutral-500 font-normal">
                    (laisser vide = coefficient global)
                  </span>
                </Label>
                <Input
                  id="coeff-override-value"
                  type="number"
                  step="0.5"
                  inputMode="decimal"
                  value={editCoeffValue}
                  onChange={(e) => setEditCoeffValue(e.target.value)}
                  placeholder={String(editCoeffClassSubject.coefficient)}
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditCoeffModalOpen(false)}
              disabled={editCoeffSubmitting}
              className={BTN_OUTLINE_CLASS}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSaveCoeffOverride}
              disabled={editCoeffSubmitting}
              className={BTN_DIALOG_PRIMARY_CLASS}
            >
              {editCoeffSubmitting ? "En cours..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════ Modal Assignation matière ══════════════════════ */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="bg-white rounded-xl max-w-lg max-h-[85vh] overflow-y-auto cpmsl-scroll">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-bold text-primary-800">
              Assigner une matière aux classes
            </DialogTitle>
            <DialogDescription className="sr-only">
              Sélectionnez une matière et les classes à qui l&apos;assigner
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label
                htmlFor="assign-subject-select"
                className={FIELD_LABEL_CLASS}
              >
                Matière{" "}
                <span className="text-error" aria-label="obligatoire">
                  *
                </span>
                <span className="ml-2 text-xs text-neutral-500 font-normal">
                  — choisir la matière à assigner
                </span>
              </Label>
              <select
                id="assign-subject-select"
                value={assignSubjectId}
                onChange={(e) => setAssignSubjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-900 bg-white focus-visible:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/20"
                required
                aria-required="true"
              >
                <option value="">Sélectionner une matière</option>
                {subjectParents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name} ({s.rubrique})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="assign-coeff-override"
                className={FIELD_LABEL_CLASS}
              >
                Coefficient override
                <span className="ml-2 text-xs text-neutral-500 font-normal">
                  (optionnel)
                </span>
              </Label>
              <Input
                id="assign-coeff-override"
                type="number"
                step="0.5"
                inputMode="decimal"
                value={assignCoeffOverride}
                onChange={(e) => setAssignCoeffOverride(e.target.value)}
                placeholder={
                  assignSelectedSubject
                    ? `Coefficient global : ${assignSelectedSubject.coefficient}`
                    : "Ex: 3"
                }
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={FIELD_LABEL_CLASS}>
                  Classes{" "}
                  <span className="text-error" aria-label="obligatoire">
                    *
                  </span>
                  <span className="ml-2 text-xs text-neutral-500 font-normal">
                    ({assignSelectedSessions.size} sélectionnée
                    {assignSelectedSessions.size > 1 ? "s" : ""})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs text-primary-800 font-medium hover:underline focus-visible:outline-2 focus-visible:outline-primary-800"
                >
                  {assignSelectedSessions.size === classrooms.length
                    ? "Tout désélectionner"
                    : "Tout sélectionner"}
                </button>
              </div>

              <div className="border border-neutral-200 rounded-lg overflow-auto max-h-60 cpmsl-scroll">
                {classrooms.length === 0 ? (
                  <p className="p-4 text-center text-sm text-neutral-500">
                    Aucune classe dans cette année
                  </p>
                ) : (
                  classrooms.map((classroom, i) => {
                    const checked = assignSelectedSessions.has(classroom.id);
                    const inputId = `assign-classroom-${classroom.id}`;
                    return (
                      <label
                        key={classroom.id}
                        htmlFor={inputId}
                        className={`
                        flex items-center gap-3 px-4 py-2.5 cursor-pointer
                        ${i > 0 ? "border-t border-neutral-200" : ""}
                        ${checked ? "bg-primary-50" : "bg-white hover:bg-secondary-50"}
                      `}
                      >
                        <input
                          id={inputId}
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAssignSession(classroom.id)}
                          className="h-4 w-4 cursor-pointer accent-primary-800"
                        />
                        <span
                          className={`text-sm text-neutral-900 ${checked ? "font-semibold" : ""}`}
                        >
                          {classroom.name}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignModalOpen(false)}
              disabled={assignSubmitting}
              className={BTN_OUTLINE_CLASS}
            >
              Annuler
            </Button>
            <Button
              onClick={handleAssignSubjectToClasses}
              disabled={
                assignSubmitting ||
                !assignSubjectId ||
                assignSelectedSessions.size === 0
              }
              className={BTN_DIALOG_PRIMARY_CLASS}
            >
              {assignSubmitting
                ? "Assignation..."
                : `Assigner à ${assignSelectedSessions.size} classe${assignSelectedSessions.size > 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════ Modaux importés (inchangés) ════════════════════ */}

      {/* Modaux périodes */}
      {selectedPeriod && (
        <>
          <ClosePeriodModal
            open={closePeriodModalOpen}
            onOpenChange={setClosePeriodModalOpen}
            periodName={selectedPeriod.name}
            periodId={selectedPeriod.id}
            yearId={yearId}
            classroomStatuses={closeReadiness}
            loading={readinessLoading}
            onConfirm={() => onClosePeriod?.(selectedPeriod.id)}
          />
          <ReopenPeriodModalV2
            open={reopenPeriodModalOpen}
            onOpenChange={setReopenPeriodModalOpen}
            periodName={selectedPeriod.name}
            onConfirm={(reason) => onReopenPeriod?.(selectedPeriod.id, reason)}
          />
        </>
      )}
      <CreatePeriodModalV2
        open={createPeriodModalOpen}
        onOpenChange={setCreatePeriodModalOpen}
        existingPeriodsCount={periods.length}
        onSubmit={(data) => onAddPeriod?.(data)}
      />

      {/* Modaux classes */}
      {selectedLevel && (
        <AddClassSessionModal
          open={addClassroomModalOpen}
          onOpenChange={setAddClassroomModalOpen}
          level={{
            id: selectedLevel.id,
            name: selectedLevel.name,
            category: selectedLevel.category || "fondamental",
          }}
          tracks={tracks}
          submitting={addClassroomSubmitting}
          onSubmit={async (data) => {
            setAddClassroomSubmitting(true);
            onAddClassroom?.(selectedLevel.id, data);
            setAddClassroomSubmitting(false);
            setAddClassroomModalOpen(false);
          }}
        />
      )}
      {selectedClassroom && selectedLevel && (
        <>
          <EditClassroomModal
            open={editClassroomModalOpen}
            onOpenChange={setEditClassroomModalOpen}
            classroom={selectedClassroom}
            level={selectedLevel}
            existingClassrooms={getClassroomsForLevel(selectedLevel.id)}
            onConfirm={() => {
              onEditClassroom?.(selectedClassroom.id);
              setEditClassroomModalOpen(false);
            }}
          />
          <DeleteClassroomModal
            open={deleteClassroomModalOpen}
            onOpenChange={setDeleteClassroomModalOpen}
            classroom={selectedClassroom}
            level={selectedLevel}
            studentCount={getStudentCountForClassroom(selectedClassroom.id)}
            onConfirm={() => {
              onDeleteClassroom?.(selectedClassroom.id);
              setDeleteClassroomModalOpen(false);
            }}
          />
        </>
      )}
      <CreateLevelModalV2
        open={createLevelModalOpen}
        onOpenChange={setCreateLevelModalOpen}
        existingLevels={levels}
        yearName={yearName}
        onSubmit={(data) => {
          onAddLevel?.(data);
          setCreateLevelModalOpen(false);
        }}
      />
      {selectedLevel && (
        <>
          <EditLevelModal
            open={editLevelModalOpen}
            onOpenChange={setEditLevelModalOpen}
            level={selectedLevel}
            onConfirm={(data) => {
              onEditLevel?.(selectedLevel.id, data);
              setEditLevelModalOpen(false);
            }}
          />
          <DeleteLevelModal
            open={deleteLevelModalOpen}
            onOpenChange={setDeleteLevelModalOpen}
            level={selectedLevel}
            classroomCount={getClassroomsForLevel(selectedLevel.id).length}
            studentCount={getTotalStudentCountForLevel(selectedLevel.id)}
            onConfirm={() => {
              onDeleteLevel?.(selectedLevel.id);
              setDeleteLevelModalOpen(false);
            }}
          />
        </>
      )}

      {/* Modaux matières */}
      <CreateSubjectParentModal
        open={createSubjectParentModalOpen}
        onOpenChange={setCreateSubjectParentModalOpen}
        yearName={yearName}
        existingSubjects={subjectParents}
        onSubmit={(data) => {
          onAddSubjectParent?.(data);
          setCreateSubjectParentModalOpen(false);
        }}
      />
      {selectedSubjectParent && (
        <>
          <AddSubjectChildModal
            open={addSubjectChildModalOpen}
            onOpenChange={setAddSubjectChildModalOpen}
            parent={selectedSubjectParent}
            existingChildren={subjectChildren}
            onSubmit={(data) => {
              onAddSubjectChild?.(selectedSubjectParent.id, data);
              setAddSubjectChildModalOpen(false);
            }}
          />
          <EditSubjectParentModal
            open={editSubjectParentModalOpen}
            onOpenChange={setEditSubjectParentModalOpen}
            subject={selectedSubjectParent}
            onSubmit={(data) => {
              onEditSubjectParent?.(selectedSubjectParent.id, data);
              setEditSubjectParentModalOpen(false);
            }}
          />
          <DeleteSubjectParentModal
            open={deleteSubjectParentModalOpen}
            onOpenChange={setDeleteSubjectParentModalOpen}
            subject={selectedSubjectParent}
            childCount={
              subjectChildren.filter(
                (c) => c.parentId === selectedSubjectParent.id,
              ).length
            }
            onConfirm={() => {
              onDeleteSubjectParent?.(selectedSubjectParent.id);
              setDeleteSubjectParentModalOpen(false);
            }}
          />
        </>
      )}
      {selectedSubjectChild && (
        <>
          <EditSubjectChildModal
            open={editSubjectChildModalOpen}
            onOpenChange={setEditSubjectChildModalOpen}
            child={selectedSubjectChild}
            parent={
              subjectParents.find(
                (p) => p.id === selectedSubjectChild.parentId,
              )!
            }
            existingChildren={subjectChildren}
            onSubmit={(data) => {
              onEditSubjectChild?.(selectedSubjectChild.id, data);
              setEditSubjectChildModalOpen(false);
            }}
          />
          <DeleteSubjectChildModal
            open={deleteSubjectChildModalOpen}
            onOpenChange={setDeleteSubjectChildModalOpen}
            child={selectedSubjectChild}
            studentCount={0}
            onConfirm={() => {
              onDeleteSubjectChild?.(selectedSubjectChild.id);
              setDeleteSubjectChildModalOpen(false);
            }}
          />
        </>
      )}
    </div>
  );
}
