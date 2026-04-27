// app/admin/settings/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { clientFetch as apiFetch } from "@/lib/client-fetch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { CPMSLSchoolInfoForm } from "@/components/school/cpmsl-school-info-form";
import { CPMSLCalendarManagement } from "@/components/school/cpmsl-calendar-management";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  PlusIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CheckCircle2Icon,
  ZapIcon,
  Trash2Icon,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface SchoolInfo {
  name: string;
  motto?: string;
  foundedYear?: number;
  logo?: string;
  address?: string;
  phone?: string;
  email?: string;
}
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
interface Rubric {
  id: string;
  name: string;
  code: string;
  description?: string;
}
interface Section {
  id: string;
  name: string;
  code: string;
  maxScore: number;
  displayOrder: number;
}
interface Subject {
  id: string;
  name: string;
  code: string;
  maxScore: number;
  coefficient: number;
  hasSections: boolean;
  rubricId?: string;
  rubric?: Rubric;
  sections?: Section[];
}
interface ClassType {
  id: string;
  name: string;
  code?: string;
  isTerminal: boolean;
}
interface Class {
  id: string;
  classTypeId: string;
  classType?: ClassType;
  letter: string;
  maxStudents?: number;
}
interface Attitude {
  id: string;
  label: string;
  academicYearId: string;
}
interface RubricForm {
  name: string;
  code: string;
  description: string;
}
interface SubjectForm {
  name: string;
  code: string;
  maxScore: string;
  coefficient: string;
  hasSections: boolean;
  rubricId: string;
}
interface SectionForm {
  name: string;
  code: string;
  maxScore: string;
  cycles: string[];
}
interface ClassForm {
  maxStudents: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const CLASS_TYPES_SEED = [
  { name: "1ère AF", code: "1AF", isTerminal: false },
  { name: "2ème AF", code: "2AF", isTerminal: false },
  { name: "3ème AF", code: "3AF", isTerminal: false },
  { name: "4ème AF", code: "4AF", isTerminal: false },
  { name: "5ème AF", code: "5AF", isTerminal: false },
  { name: "6ème AF", code: "6AF", isTerminal: false },
  { name: "7ème AF", code: "7AF", isTerminal: false },
  { name: "8ème AF", code: "8AF", isTerminal: false },
  { name: "9ème AF", code: "9AF", isTerminal: true },
  { name: "NS1", code: "NS1", isTerminal: false },
  { name: "NS2", code: "NS2", isTerminal: false },
  { name: "NS3", code: "NS3", isTerminal: false },
  { name: "NS4", code: "NS4", isTerminal: true },
];

const DEFAULT_SCHOOL_INFO: SchoolInfo = {
  name: "Cours Privé Mixte Saint Léonard",
  motto: "",
  foundedYear: undefined,
  logo: "",
  address: "",
  phone: "",
  email: "",
};

const CYCLES_MENFP = [
  { key: "1er Cycle", label: "1er Cycle", description: "1ère → 4ème AF" },
  { key: "2ème Cycle", label: "2ème Cycle", description: "5ème → 6ème AF" },
  { key: "3ème Cycle", label: "3ème Cycle", description: "7ème → 9ème AF" },
  { key: "Secondaire", label: "Secondaire", description: "NS1 → NS4" },
];

const TAB_LABELS: Record<string, string> = {
  general: "Informations générales",
  calendar: "Calendrier scolaire",
  referentiel: "Matières & Rubriques",
  classes: "Classes",
  attitudes: "Attitudes",
};

// ─── Classes Tailwind partagées ────────────────────────────────────────────
//
// Centralisation des classes répétées dans tout le fichier.
// Avantage vs constante d'objet style : portabilité, dark mode futur, et
// évite l'inline style.
//
const TH_CLASS =
  "font-sans text-xs font-bold uppercase tracking-wider text-primary-800";

const CARD_CLASS = "bg-white rounded-lg border border-neutral-200 shadow-sm";

const CARD_HEADER_CLASS =
  "px-6 py-5 border-b border-neutral-200 flex items-center justify-between";

const CARD_BODY_CLASS = "p-6";

const TABLE_WRAPPER_CLASS =
  "rounded-lg border border-neutral-200 overflow-hidden";

const TABLE_HEAD_ROW_CLASS = "bg-primary-50 border-b-2 border-neutral-300";

const FIELD_LABEL_CLASS = "font-sans text-sm font-medium text-neutral-900";

const INPUT_CLASS = "border-neutral-300 rounded-lg";

const BTN_PRIMARY_CLASS =
  "bg-primary-800 hover:bg-primary-700 text-white rounded-lg disabled:bg-neutral-400 disabled:cursor-not-allowed";

const BTN_DIALOG_PRIMARY_CLASS =
  "bg-primary-500 hover:bg-primary-600 text-white rounded-lg disabled:bg-neutral-400 disabled:cursor-not-allowed";

const BTN_OUTLINE_CLASS = "border-neutral-300 text-neutral-600 rounded-lg";

const LINK_BTN_CLASS =
  "text-sm font-medium hover:underline focus-visible:outline-2 focus-visible:rounded";

const SECTION_HEADER_TITLE_CLASS =
  "font-serif text-lg font-semibold text-primary-800";

const SECTION_HEADER_SUBTITLE_CLASS =
  "font-sans text-sm text-neutral-500 mt-0.5";

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE-LEVEL HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

// complexity: 1
function getSectionCycles(sectionId: string): string[] {
  try {
    const raw = localStorage.getItem(`section-cycles-${sectionId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// complexity: 0
function saveSectionCycles(sectionId: string, cycles: string[]): void {
  localStorage.setItem(`section-cycles-${sectionId}`, JSON.stringify(cycles));
}

// complexity: 3
//
// Mapping des rubriques (R1, R2, R3) vers les classes Tailwind CPMSL.
//
// Fix A11Y-004 : R3 utilisait #B0A07A sur #FAF8F3 (contraste 2.6:1, fail WCAG).
// Maintenant : text-secondary-700 (#7A6E50) sur bg-secondary-50 (#FAF8F3),
// contraste 5.2:1, conforme WCAG AA.
//
function rubricClasses(code?: string): { badge: string; weight: string } {
  if (code === "R1")
    return { badge: "bg-info-soft text-info", weight: "text-info" };
  if (code === "R2")
    return { badge: "bg-success-soft text-success", weight: "text-success" };
  if (code === "R3")
    return {
      badge: "bg-secondary-50 text-secondary-700",
      weight: "text-secondary-700",
    };
  return {
    badge: "bg-primary-50 text-primary-500",
    weight: "text-primary-500",
  };
}

// complexity: 3
function rubricWeight(code: string) {
  if (code === "R1") return "70%";
  if (code === "R2") return "25%";
  if (code === "R3") return "5%";
  return "—";
}

// complexity: 3
function extractLetters(words: string[]): string {
  if (words.length === 1) return words[0].slice(0, 3);
  if (words.length === 2) return words[0].slice(0, 2) + words[1].slice(0, 1);
  return words
    .map((w) => w[0])
    .join("")
    .slice(0, 3);
}

// complexity: 1
function generateCode(name: string, existingCount: number): string {
  const words = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z\s]/g, "")
    .toUpperCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  return `${extractLetters(words)}-${String(existingCount + 1).padStart(3, "0")}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

function useSchoolSettings() {
  const { toast } = useToast();

  // data
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>(DEFAULT_SCHOOL_INFO);
  const [loadingSchoolInfo, setLoadingSchoolInfo] = useState(false);
  const [schoolInfoLoaded, setSchoolInfoLoaded] = useState(false);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingRef, setLoadingRef] = useState(false);
  const [referentielLoaded, setReferentielLoaded] = useState(false);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(
    new Set(),
  );
  const [classTypes, setClassTypes] = useState<ClassType[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [classesLoaded, setClassesLoaded] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [attitudes, setAttitudes] = useState<Attitude[]>([]);
  const [loadingAttitudes, setLoadingAttitudes] = useState(false);
  const [attitudesLoaded, setAttitudesLoaded] = useState(false);
  const [currentYearId, setCurrentYearId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("general");

  // modals
  const [rubricModal, setRubricModal] = useState(false);
  const [subjectModal, setSubjectModal] = useState(false);
  const [sectionModal, setSectionModal] = useState(false);
  const [attitudeModal, setAttitudeModal] = useState(false);
  const [classModal, setClassModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingRubric, setEditingRubric] = useState<Rubric | null>(null);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [editingAttitude, setEditingAttitude] = useState<Attitude | null>(null);
  const [sectionParentId, setSectionParentId] = useState<string | null>(null);
  const [rubricForm, setRubricForm] = useState<RubricForm>({
    name: "",
    code: "",
    description: "",
  });
  const [subjectForm, setSubjectForm] = useState<SubjectForm>({
    name: "",
    code: "",
    maxScore: "100",
    coefficient: "1",
    hasSections: false,
    rubricId: "",
  });
  const [sectionForm, setSectionForm] = useState<SectionForm>({
    name: "",
    code: "",
    maxScore: "100",
    cycles: [],
  });
  const [classForm, setClassForm] = useState<ClassForm>({ maxStudents: "30" });
  const [attitudeLabel, setAttitudeLabel] = useState("");

  // ── Loaders ──────────────────────────────────────────────────────────────

  const loadReferentiel = useCallback(async () => {
    setLoadingRef(true);
    try {
      const [rubricsData, subjectsData] = await Promise.all([
        apiFetch<Rubric[]>("/api/subject-rubrics/"),
        apiFetch<Subject[]>("/api/subjects/"),
      ]);
      setRubrics(rubricsData);
      setSubjects(
        subjectsData.map((s) => ({
          ...s,
          sections: [],
          rubric: rubricsData.find((r) => r.id === s.rubricId),
        })),
      );
    } catch (err) {
      console.error("[settings] referentiel:", err);
    } finally {
      setLoadingRef(false);
    }
  }, []);

  const loadClasses = useCallback(async () => {
    setLoadingClasses(true);
    try {
      const [ctData, clData] = await Promise.all([
        apiFetch<ClassType[]>("/api/class-types/"),
        apiFetch<Class[]>("/api/classes/"),
      ]);
      setClassTypes(ctData);
      setClasses(
        clData.map((c) => ({
          ...c,
          classType: ctData.find((ct) => ct.id === c.classTypeId),
        })),
      );
    } catch (err) {
      console.error("[settings] classes:", err);
    } finally {
      setLoadingClasses(false);
    }
  }, []);

  const loadAttitudes = useCallback(async (yearId: string) => {
    setLoadingAttitudes(true);
    try {
      const data = await fetch(`/api/attitudes?academicYearId=${yearId}`, {
        credentials: "include",
      }).then((r) => r.json());
      setAttitudes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[settings] attitudes:", err);
    } finally {
      setLoadingAttitudes(false);
    }
  }, []);

  // ── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (activeTab === "referentiel" && !referentielLoaded) {
      loadReferentiel();
      setReferentielLoaded(true);
    }
    if (activeTab === "classes" && !classesLoaded) {
      loadClasses();
      setClassesLoaded(true);
    }
    if (activeTab === "attitudes" && !attitudesLoaded) {
      setAttitudesLoaded(true);
      fetch("/api/academic-years/current", { credentials: "include" })
        .then((r) => r.json())
        .then((data) => {
          const yearId = data?.id ?? data?.academicYear?.id;
          if (yearId) {
            setCurrentYearId(yearId);
            loadAttitudes(yearId);
          }
        })
        .catch((err) => console.error("[settings] current year:", err));
    }
  }, [
    activeTab,
    referentielLoaded,
    classesLoaded,
    attitudesLoaded,
    loadReferentiel,
    loadClasses,
    loadAttitudes,
  ]);

  useEffect(() => {
    if (activeTab !== "general" || schoolInfoLoaded) return;
    setSchoolInfoLoaded(true);
    setLoadingSchoolInfo(true);
    fetch("/api/school-info", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data)
          setSchoolInfo({
            name: data.name ?? DEFAULT_SCHOOL_INFO.name,
            motto: data.motto ?? "",
            foundedYear: data.foundedYear,
            logo: data.logo ?? "",
            address: data.address ?? "",
            phone: data.phone ?? "",
            email: data.email ?? "",
          });
      })
      .catch((err) => console.error("[settings] school-info:", err))
      .finally(() => setLoadingSchoolInfo(false));
  }, [activeTab, schoolInfoLoaded]);

  // ── School info ──────────────────────────────────────────────────────────

  const handleSaveSchoolInfo = async (info: SchoolInfo) => {
    setSchoolInfo(info);
    try {
      await fetch("/api/school-info/update", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(info),
      });
      toast({ title: "Paramètres enregistrés" });
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder",
        variant: "destructive",
      });
    }
  };

  // ── Calendar ─────────────────────────────────────────────────────────────

  const handleAddHoliday = (d: { name: string; date: string }) =>
    setHolidays((p) => [...p, { id: `h-${Date.now()}`, ...d }]);
  const handleEditHoliday = (id: string, d: { name: string; date: string }) =>
    setHolidays((p) => p.map((h) => (h.id === id ? { ...h, ...d } : h)));
  const handleDeleteHoliday = (id: string) =>
    setHolidays((p) => p.filter((h) => h.id !== id));
  const handleAddEvent = (d: {
    title: string;
    date: string;
    type: SchoolEvent["type"];
  }) =>
    setEvents((p) => [
      ...p,
      { id: `e-${Date.now()}`, ...d, academicYearId: "" },
    ]);
  const handleEditEvent = (
    id: string,
    d: { title: string; date: string; type: SchoolEvent["type"] },
  ) => setEvents((p) => p.map((e) => (e.id === id ? { ...e, ...d } : e)));
  const handleDeleteEvent = (id: string) =>
    setEvents((p) => p.filter((e) => e.id !== id));

  // ── Rubric handlers ──────────────────────────────────────────────────────

  const openCreateRubric = () => {
    setEditingRubric(null);
    setRubricForm({ name: "", code: "", description: "" });
    setRubricModal(true);
  };
  const openEditRubric = (r: Rubric) => {
    setEditingRubric(r);
    setRubricForm({
      name: r.name,
      code: r.code,
      description: r.description || "",
    });
    setRubricModal(true);
  };

  const handleSaveRubric = async () => {
    setSubmitting(true);
    try {
      if (editingRubric) {
        await apiFetch(`/api/subject-rubrics/update/${editingRubric.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rubricForm),
        });
        toast({ title: "Rubrique modifiée" });
      } else {
        await apiFetch("/api/subject-rubrics/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rubricForm),
        });
        toast({ title: "Rubrique créée" });
      }
      setRubricModal(false);
      loadReferentiel();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Subject handlers ─────────────────────────────────────────────────────

  const openCreateSubject = () => {
    setEditingSubject(null);
    setSubjectForm({
      name: "",
      code: "",
      maxScore: "100",
      coefficient: "1",
      hasSections: false,
      rubricId: "",
    });
    setSubjectModal(true);
  };
  const openEditSubject = (s: Subject) => {
    setEditingSubject(s);
    setSubjectForm({
      name: s.name,
      code: s.code,
      maxScore: String(s.maxScore),
      coefficient: String(s.coefficient),
      hasSections: s.hasSections,
      rubricId: s.rubricId || "",
    });
    setSubjectModal(true);
  };

  const handleSubjectNameChange = (name: string) => {
    setSubjectForm((f) => ({
      ...f,
      name,
      ...(!editingSubject && { code: generateCode(name, subjects.length) }),
    }));
  };

  const handleSaveSubject = async () => {
    setSubmitting(true);
    try {
      const body = {
        name: subjectForm.name,
        code: subjectForm.code,
        maxScore: Number.parseFloat(subjectForm.maxScore),
        coefficient: Number.parseFloat(subjectForm.coefficient),
        hasSections: subjectForm.hasSections,
        rubricId: subjectForm.rubricId || null,
      };
      if (editingSubject) {
        await apiFetch(`/api/subjects/update/${editingSubject.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        toast({ title: "Matière modifiée" });
      } else {
        await apiFetch("/api/subjects/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        toast({ title: "Matière créée" });
      }
      setSubjectModal(false);
      loadReferentiel();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Section handlers ─────────────────────────────────────────────────────

  const openCreateSection = (subjectId: string) => {
    setSectionParentId(subjectId);
    setSectionForm({ name: "", code: "", maxScore: "100", cycles: [] });
    setSectionModal(true);
  };

  const handleSectionNameChange = (name: string) => {
    const parent = subjects.find((s) => s.id === sectionParentId);
    setSectionForm((f) => ({
      ...f,
      name,
      code: generateCode(name, parent?.sections?.length || 0),
    }));
  };

  const toggleSectionCycle = (key: string, checked: boolean) => {
    setSectionForm((f) => ({
      ...f,
      cycles: checked ? [...f.cycles, key] : f.cycles.filter((c) => c !== key),
    }));
  };

  const handleSaveSection = async () => {
    if (!sectionParentId) return;
    setSubmitting(true);
    try {
      const parent = subjects.find((s) => s.id === sectionParentId);
      const result = await apiFetch<{ section?: { id: string } }>(
        `/api/subjects/${sectionParentId}/sections/create`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: sectionForm.name,
            code: sectionForm.code,
            maxScore: parseFloat(sectionForm.maxScore),
            displayOrder: (parent?.sections?.length || 0) + 1,
          }),
        },
      );
      const sectionId = result?.section?.id;
      if (sectionId && sectionForm.cycles.length > 0)
        saveSectionCycles(sectionId, sectionForm.cycles);
      toast({ title: "Sous-matière créée" });
      setSectionModal(false);
      loadReferentiel();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Expand ───────────────────────────────────────────────────────────────

  const toggleExpand = async (subjectId: string) => {
    setExpandedSubjects((prev) => {
      const n = new Set(prev);
      if (n.has(subjectId)) n.delete(subjectId);
      else n.add(subjectId);
      return n;
    });
    const subject = subjects.find((s) => s.id === subjectId);
    if (
      subject?.hasSections &&
      (!subject.sections || subject.sections.length === 0)
    ) {
      try {
        const sections = await apiFetch<Section[]>(
          `/api/subjects/${subjectId}/sections`,
        );
        setSubjects((prev) =>
          prev.map((s) => (s.id === subjectId ? { ...s, sections } : s)),
        );
      } catch {
        /* ignore */
      }
    }
  };

  // ── Attitude handlers ────────────────────────────────────────────────────

  const openCreateAttitude = () => {
    setEditingAttitude(null);
    setAttitudeLabel("");
    setAttitudeModal(true);
  };
  const openEditAttitude = (a: Attitude) => {
    setEditingAttitude(a);
    setAttitudeLabel(a.label);
    setAttitudeModal(true);
  };

  const handleSaveAttitude = async () => {
    if (!attitudeLabel.trim() || !currentYearId) return;
    setSubmitting(true);
    try {
      if (editingAttitude) {
        await fetch(`/api/attitudes/update/${editingAttitude.id}`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: attitudeLabel.trim() }),
        });
        toast({ title: "Attitude modifiée" });
      } else {
        await fetch("/api/attitudes/create", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: attitudeLabel.trim(),
            academicYearId: currentYearId,
          }),
        });
        toast({ title: "Attitude créée" });
      }
      setAttitudeModal(false);
      loadAttitudes(currentYearId);
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAttitude = async (attitude: Attitude) => {
    if (!currentYearId) return;
    try {
      await fetch(`/api/attitudes/delete/${attitude.id}`, {
        method: "POST",
        credentials: "include",
      });
      toast({ title: "Attitude supprimée" });
      loadAttitudes(currentYearId);
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  // ── Class handlers ───────────────────────────────────────────────────────

  const handleInitializeClasses = async () => {
    setInitializing(true);
    try {
      const createdTypes: Array<{
        classType?: { id: string };
        data?: { id: string };
        id?: string;
      }> = [];
      for (const ct of CLASS_TYPES_SEED) {
        const res = await apiFetch<{
          classType?: { id: string };
          data?: { id: string };
          id?: string;
        }>("/api/class-types/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ct),
        });
        createdTypes.push(res);
      }
      await Promise.all(
        createdTypes.map((res) => {
          const id = res?.classType?.id ?? res?.data?.id ?? res?.id;
          if (!id) return Promise.resolve();
          return apiFetch("/api/classes/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              classTypeId: id,
              letter: "A",
              maxStudents: 30,
            }),
          });
        }),
      );
      toast({
        title: "Initialisation réussie",
        description: "13 niveaux et 13 classes créés.",
      });
      await loadClasses();
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible d'initialiser",
        variant: "destructive",
      });
    } finally {
      setInitializing(false);
    }
  };

  const openEditClass = (c: Class) => {
    setEditingClass(c);
    setClassForm({ maxStudents: String(c.maxStudents || 30) });
    setClassModal(true);
  };

  const handleSaveClass = async () => {
    if (!editingClass) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/classes/update/${editingClass.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxStudents: parseInt(classForm.maxStudents) || undefined,
        }),
      });
      toast({ title: "Classe modifiée" });
      setClassModal(false);
      setClassesLoaded(false);
      loadClasses();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return {
    activeTab,
    setActiveTab,
    schoolInfo,
    loadingSchoolInfo,
    handleSaveSchoolInfo,
    holidays,
    events,
    handleAddHoliday,
    handleEditHoliday,
    handleDeleteHoliday,
    handleAddEvent,
    handleEditEvent,
    handleDeleteEvent,
    loadingRef,
    rubrics,
    subjects,
    expandedSubjects,
    toggleExpand,
    openCreateRubric,
    openEditRubric,
    openCreateSubject,
    openEditSubject,
    openCreateSection,
    loadingClasses,
    classTypes,
    classes,
    initializing,
    handleInitializeClasses,
    openEditClass,
    loadingAttitudes,
    attitudes,
    currentYearId,
    openCreateAttitude,
    openEditAttitude,
    handleDeleteAttitude,
    rubricModal,
    setRubricModal,
    subjectModal,
    setSubjectModal,
    sectionModal,
    setSectionModal,
    attitudeModal,
    setAttitudeModal,
    classModal,
    setClassModal,
    submitting,
    editingRubric,
    editingSubject,
    editingClass,
    editingAttitude,
    rubricForm,
    setRubricForm,
    subjectForm,
    setSubjectForm,
    sectionForm,
    setSectionForm,
    classForm,
    setClassForm,
    attitudeLabel,
    setAttitudeLabel,
    sectionParentId,
    handleSubjectNameChange,
    handleSectionNameChange,
    toggleSectionCycle,
    handleSaveRubric,
    handleSaveSubject,
    handleSaveSection,
    handleSaveAttitude,
    handleSaveClass,
  };
}
// ═══════════════════════════════════════════════════════════════════════════════
// TAB COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

interface ReferentielTabProps {
  loading: boolean;
  rubrics: Rubric[];
  subjects: Subject[];
  expandedSubjects: Set<string>;
  onCreateRubric: () => void;
  onEditRubric: (r: Rubric) => void;
  onCreateSubject: () => void;
  onEditSubject: (s: Subject) => void;
  onCreateSection: (id: string) => void;
  onToggleExpand: (id: string) => void;
}

function ReferentielTab({
  loading,
  rubrics,
  subjects,
  expandedSubjects,
  onCreateRubric,
  onEditRubric,
  onCreateSubject,
  onEditSubject,
  onCreateSection,
  onToggleExpand,
}: ReferentielTabProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <>
      {/* ─── Card Rubriques ─────────────────────────────────────────────── */}
      <div className={CARD_CLASS}>
        <div className={CARD_HEADER_CLASS}>
          <div>
            <h3 className={SECTION_HEADER_TITLE_CLASS}>
              Rubriques ({rubrics.length})
            </h3>
            <p className={SECTION_HEADER_SUBTITLE_CLASS}>
              Formule BR-001 : R1 × 70% + R2 × 25% + R3 × 5%
            </p>
          </div>
          <Button
            onClick={onCreateRubric}
            disabled={rubrics.length >= 3}
            title={rubrics.length >= 3 ? "Maximum 3 rubriques" : undefined}
            className={BTN_PRIMARY_CLASS}
          >
            <PlusIcon className="mr-2 h-4 w-4" aria-hidden="true" />
            Nouvelle rubrique
          </Button>
        </div>

        <div className={CARD_BODY_CLASS}>
          <div className={TABLE_WRAPPER_CLASS}>
            <Table>
              <TableHeader>
                <TableRow className={TABLE_HEAD_ROW_CLASS}>
                  <TableHead className={TH_CLASS}>Code</TableHead>
                  <TableHead className={TH_CLASS}>Nom</TableHead>
                  <TableHead className={TH_CLASS}>Description</TableHead>
                  <TableHead className={TH_CLASS}>Poids BR-001</TableHead>
                  <TableHead className={`${TH_CLASS} text-center`}>
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rubrics.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-neutral-500 py-8"
                    >
                      Aucune rubrique — créez R1, R2, R3
                    </TableCell>
                  </TableRow>
                ) : (
                  rubrics.map((r) => {
                    const c = rubricClasses(r.code);
                    return (
                      <TableRow
                        key={r.id}
                        className="border-t border-neutral-200"
                      >
                        <TableCell>
                          <Badge className={`border-0 font-bold ${c.badge}`}>
                            {r.code}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-neutral-900 text-sm">
                          {r.name}
                        </TableCell>
                        <TableCell className="text-neutral-500 text-sm">
                          {r.description || "—"}
                        </TableCell>
                        <TableCell className={`font-bold text-sm ${c.weight}`}>
                          {rubricWeight(r.code)}
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            type="button"
                            onClick={() => onEditRubric(r)}
                            className={`${LINK_BTN_CLASS} text-primary-500 focus-visible:outline-primary-500`}
                          >
                            Modifier
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* ─── Card Matières ──────────────────────────────────────────────── */}
      <div className={CARD_CLASS}>
        <div className={CARD_HEADER_CLASS}>
          <div>
            <h3 className={SECTION_HEADER_TITLE_CLASS}>
              Matières ({subjects.length})
            </h3>
            <p className={SECTION_HEADER_SUBTITLE_CLASS}>
              Référentiel global — assignées aux classes dans la configuration
              de l&apos;année
            </p>
          </div>
          <Button
            onClick={onCreateSubject}
            disabled={rubrics.length === 0}
            title={
              rubrics.length === 0 ? "Créez d'abord les rubriques" : undefined
            }
            className={BTN_PRIMARY_CLASS}
          >
            <PlusIcon className="mr-2 h-4 w-4" aria-hidden="true" />
            Nouvelle matière
          </Button>
        </div>

        <div className={CARD_BODY_CLASS}>
          <div className={TABLE_WRAPPER_CLASS}>
            <Table>
              <TableHeader>
                <TableRow className={TABLE_HEAD_ROW_CLASS}>
                  <TableHead className={`${TH_CLASS} w-[3%]`}></TableHead>
                  <TableHead className={TH_CLASS}>Code</TableHead>
                  <TableHead className={TH_CLASS}>Nom</TableHead>
                  <TableHead className={TH_CLASS}>Rubrique</TableHead>
                  <TableHead className={TH_CLASS}>Coeff.</TableHead>
                  <TableHead className={TH_CLASS}>Max</TableHead>
                  <TableHead className={`${TH_CLASS} text-center`}>
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-neutral-500 py-8"
                    >
                      {rubrics.length === 0
                        ? "Créez d'abord les rubriques (R1, R2, R3)"
                        : "Aucune matière — créez la première"}
                    </TableCell>
                  </TableRow>
                ) : (
                  subjects.map((subject) => {
                    const isExpanded = expandedSubjects.has(subject.id);
                    const c = rubricClasses(subject.rubric?.code);
                    return (
                      <React.Fragment key={subject.id}>
                        <TableRow className="border-t border-neutral-200 bg-white hover:bg-secondary-50">
                          <TableCell className="px-2 py-3">
                            {subject.hasSections && (
                              <button
                                type="button"
                                onClick={() => onToggleExpand(subject.id)}
                                aria-label={
                                  isExpanded
                                    ? "Masquer les sous-matières"
                                    : "Afficher les sous-matières"
                                }
                                aria-expanded={isExpanded}
                                className="flex items-center text-primary-500 bg-transparent border-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:rounded"
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
                          </TableCell>
                          <TableCell className="font-mono text-xs font-semibold text-neutral-900 uppercase">
                            {subject.code}
                          </TableCell>
                          <TableCell className="font-semibold text-neutral-900 text-sm">
                            {subject.name}
                          </TableCell>
                          <TableCell>
                            {subject.rubric ? (
                              <Badge className={`border-0 ${c.badge}`}>
                                {subject.rubric.code}
                              </Badge>
                            ) : (
                              <span className="text-neutral-500">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {subject.coefficient}
                          </TableCell>
                          <TableCell className="text-sm">
                            {subject.maxScore}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => onCreateSection(subject.id)}
                                className={`${LINK_BTN_CLASS} text-xs text-primary-800 focus-visible:outline-primary-800`}
                              >
                                + Section
                              </button>
                              <span
                                className="text-neutral-300"
                                aria-hidden="true"
                              >
                                |
                              </span>
                              <button
                                type="button"
                                onClick={() => onEditSubject(subject)}
                                className={`${LINK_BTN_CLASS} text-primary-500 focus-visible:outline-primary-500`}
                              >
                                Modifier
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {isExpanded &&
                          subject.sections?.map((section) => {
                            const cycles = getSectionCycles(section.id);
                            return (
                              <TableRow
                                key={section.id}
                                className="border-t border-neutral-200 bg-neutral-50"
                              >
                                <TableCell></TableCell>
                                <TableCell className="pl-6 font-mono text-xs text-neutral-500 uppercase">
                                  <span
                                    className="text-neutral-400"
                                    aria-hidden="true"
                                  >
                                    └{" "}
                                  </span>
                                  {section.code}
                                </TableCell>
                                <TableCell className="text-sm text-neutral-900">
                                  {section.name}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1 flex-wrap">
                                    {cycles.length > 0 ? (
                                      cycles.map((cyc) => (
                                        <span
                                          key={cyc}
                                          className="bg-info-soft text-info px-1.5 py-0.5 rounded text-xs font-medium"
                                        >
                                          {cyc}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-neutral-500 text-xs">
                                        Tous les cycles
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-neutral-500">
                                  {section.maxScore}
                                </TableCell>
                                <TableCell></TableCell>
                              </TableRow>
                            );
                          })}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Tab : Classes ─────────────────────────────────────────────────────────

interface ClassesTabProps {
  loading: boolean;
  classTypes: ClassType[];
  classes: Class[];
  initializing: boolean;
  onInitialize: () => void;
  onEditClass: (c: Class) => void;
}

function ClassesTab({
  loading,
  classTypes,
  classes,
  initializing,
  onInitialize,
  onEditClass,
}: ClassesTabProps) {
  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className={CARD_CLASS}>
      <div className={CARD_HEADER_CLASS}>
        <div>
          <h3 className={SECTION_HEADER_TITLE_CLASS}>
            Classes ({classes.length} / {classTypes.length || 13})
          </h3>
          <p className={SECTION_HEADER_SUBTITLE_CLASS}>
            Référentiel permanent — salle A par défaut pour chaque niveau
          </p>
        </div>

        {classTypes.length === 0 && (
          <Button
            onClick={onInitialize}
            disabled={initializing}
            className={`${BTN_PRIMARY_CLASS} flex items-center gap-2`}
          >
            <ZapIcon className="h-4 w-4" aria-hidden="true" />
            {initializing
              ? "Initialisation..."
              : "Initialiser niveaux & classes"}
          </Button>
        )}

        {classes.length > 0 && (
          <div className="flex items-center gap-2 text-success text-sm font-medium">
            <CheckCircle2Icon className="h-4 w-4" aria-hidden="true" />
            Classes initialisées
          </div>
        )}
      </div>

      <div className={CARD_BODY_CLASS}>
        {classTypes.length === 0 ? (
          <div className="text-center py-12 px-6">
            <p className="text-base font-semibold text-primary-800 mb-2">
              Aucun niveau configuré
            </p>
            <p className="text-sm text-neutral-500 mb-6">
              Cliquez sur &laquo;&nbsp;Initialiser niveaux &amp;
              classes&nbsp;&raquo; pour créer les 13 niveaux MENFP.
            </p>
            <Button
              onClick={onInitialize}
              disabled={initializing}
              className={`${BTN_PRIMARY_CLASS} inline-flex items-center gap-2`}
            >
              <ZapIcon className="h-4 w-4" aria-hidden="true" />
              {initializing
                ? "Initialisation en cours..."
                : "Initialiser niveaux & classes"}
            </Button>
          </div>
        ) : (
          <div className={TABLE_WRAPPER_CLASS}>
            <Table>
              <TableHeader>
                <TableRow className={TABLE_HEAD_ROW_CLASS}>
                  <TableHead className={TH_CLASS}>Niveau</TableHead>
                  <TableHead className={TH_CLASS}>Type</TableHead>
                  <TableHead className={TH_CLASS}>Max élèves</TableHead>
                  <TableHead className={`${TH_CLASS} text-center`}>
                    Statut
                  </TableHead>
                  <TableHead className={`${TH_CLASS} text-center`}>
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classTypes.map((ct) => {
                  const cls = classes.find((c) => c.classTypeId === ct.id);
                  return (
                    <TableRow
                      key={ct.id}
                      className="border-t border-neutral-200"
                    >
                      <TableCell className="font-bold text-neutral-900 text-sm">
                        {ct.name}
                      </TableCell>
                      <TableCell>
                        {ct.isTerminal ? (
                          <Badge className="bg-warning-soft text-warning border-0 text-xs">
                            Examen
                          </Badge>
                        ) : (
                          <Badge className="bg-primary-50 text-primary-500 border-0 text-xs">
                            Standard
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-neutral-500">
                        {cls?.maxStudents ?? "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {cls ? (
                          <Badge className="bg-success-soft text-success border-0 text-xs">
                            ✓ Créée
                          </Badge>
                        ) : (
                          <Badge className="bg-warning-soft text-warning border-0 text-xs">
                            En attente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {cls ? (
                          <button
                            type="button"
                            onClick={() => onEditClass(cls)}
                            className={`${LINK_BTN_CLASS} text-primary-500 focus-visible:outline-primary-500`}
                          >
                            Modifier
                          </button>
                        ) : (
                          <span className="text-neutral-300 text-sm">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab : Attitudes ───────────────────────────────────────────────────────

interface AttitudesTabProps {
  loading: boolean;
  attitudes: Attitude[];
  currentYearId: string | null;
  onCreateAttitude: () => void;
  onEditAttitude: (a: Attitude) => void;
  onDeleteAttitude: (a: Attitude) => void;
}

function AttitudesTab({
  loading,
  attitudes,
  currentYearId,
  onCreateAttitude,
  onEditAttitude,
  onDeleteAttitude,
}: AttitudesTabProps) {
  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className={CARD_CLASS}>
      <div className={CARD_HEADER_CLASS}>
        <div>
          <h3 className={SECTION_HEADER_TITLE_CLASS}>
            Attitudes ({attitudes.length})
          </h3>
          <p className={SECTION_HEADER_SUBTITLE_CLASS}>
            Caractéristiques de comportement — Oui / Non par élève
          </p>
        </div>
        <Button
          onClick={onCreateAttitude}
          disabled={!currentYearId}
          title={!currentYearId ? "Aucune année active" : undefined}
          className={BTN_PRIMARY_CLASS}
        >
          <PlusIcon className="mr-2 h-4 w-4" aria-hidden="true" />
          Nouvelle attitude
        </Button>
      </div>

      {!currentYearId && (
        <div className="p-8 text-center">
          <p className="text-sm text-warning">
            Aucune année scolaire active. Activez une année dans la
            configuration.
          </p>
        </div>
      )}

      {currentYearId && (
        <div className={CARD_BODY_CLASS}>
          {attitudes.length === 0 ? (
            <div className="text-center py-12 px-6 border border-dashed border-neutral-300 rounded-lg">
              <p className="text-base font-semibold text-primary-800 mb-1.5">
                Aucune attitude configurée
              </p>
              <p className="text-sm text-neutral-500 mb-5">
                Exemples : Respectueux(se), Ponctuel(le), Attentif(ve)
              </p>
              <Button onClick={onCreateAttitude} className={BTN_PRIMARY_CLASS}>
                <PlusIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                Créer la première attitude
              </Button>
            </div>
          ) : (
            <div className={TABLE_WRAPPER_CLASS}>
              <Table>
                <TableHeader>
                  <TableRow className={TABLE_HEAD_ROW_CLASS}>
                    <TableHead className={TH_CLASS}>#</TableHead>
                    <TableHead className={TH_CLASS}>Libellé</TableHead>
                    <TableHead className={`${TH_CLASS} text-center`}>
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attitudes.map((att, i) => (
                    <TableRow
                      key={att.id}
                      className="border-t border-neutral-200"
                    >
                      <TableCell className="w-12 text-neutral-400 text-sm font-medium">
                        {i + 1}
                      </TableCell>
                      <TableCell className="font-semibold text-neutral-900 text-sm">
                        {att.label}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => onEditAttitude(att)}
                            className={`${LINK_BTN_CLASS} text-primary-500 focus-visible:outline-primary-500`}
                          >
                            Modifier
                          </button>
                          <span className="text-neutral-300" aria-hidden="true">
                            |
                          </span>
                          <button
                            type="button"
                            onClick={() => onDeleteAttitude(att)}
                            className={`${LINK_BTN_CLASS} text-error focus-visible:outline-error inline-flex items-center gap-1`}
                          >
                            <Trash2Icon
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            Supprimer
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── RubricModal ───────────────────────────────────────────────────────────

interface RubricModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: RubricForm;
  onChange: (f: RubricForm) => void;
  editing: Rubric | null;
  submitting: boolean;
  onSave: () => void;
}

function RubricModal({
  open,
  onOpenChange,
  form,
  onChange,
  editing,
  submitting,
  onSave,
}: RubricModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white rounded-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-bold text-primary-800">
            {editing ? "Modifier la rubrique" : "Nouvelle rubrique"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Formulaire rubrique
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="rubric-code" className={FIELD_LABEL_CLASS}>
                Code{" "}
                <span className="text-error" aria-label="obligatoire">
                  *
                </span>
                <span className="ml-2 text-xs text-neutral-500 font-normal">
                  (ex: R1)
                </span>
              </Label>
              <Input
                id="rubric-code"
                value={form.code}
                onChange={(e) =>
                  onChange({ ...form, code: e.target.value.toUpperCase() })
                }
                disabled={!!editing}
                placeholder="R1"
                className={`${INPUT_CLASS} ${editing ? "bg-neutral-100" : ""}`}
                required
                aria-required="true"
              />
              {editing && (
                <p className="text-xs text-neutral-500">
                  Le code ne peut pas être modifié
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="rubric-name" className={FIELD_LABEL_CLASS}>
                Nom{" "}
                <span className="text-error" aria-label="obligatoire">
                  *
                </span>
              </Label>
              <Input
                id="rubric-name"
                value={form.name}
                onChange={(e) => onChange({ ...form, name: e.target.value })}
                placeholder="Ex: Évaluation continue"
                className={INPUT_CLASS}
                required
                aria-required="true"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="rubric-description" className={FIELD_LABEL_CLASS}>
              Description
            </Label>
            <Input
              id="rubric-description"
              value={form.description}
              onChange={(e) =>
                onChange({ ...form, description: e.target.value })
              }
              className={INPUT_CLASS}
            />
          </div>

          <div className="bg-primary-50 text-primary-700 rounded-lg px-4 py-2.5 text-xs">
            <strong>Poids BR-001 :</strong> R1 = 70% · R2 = 25% · R3 = 5%
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className={BTN_OUTLINE_CLASS}
          >
            Annuler
          </Button>
          <Button
            onClick={onSave}
            disabled={submitting || !form.name || !form.code}
            className={BTN_DIALOG_PRIMARY_CLASS}
          >
            {submitting ? "En cours..." : editing ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── SubjectModal ──────────────────────────────────────────────────────────

interface SubjectModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: SubjectForm;
  onChange: (f: SubjectForm) => void;
  onNameChange: (name: string) => void;
  rubrics: Rubric[];
  editing: Subject | null;
  submitting: boolean;
  onSave: () => void;
}

function SubjectModal({
  open,
  onOpenChange,
  form,
  onChange,
  onNameChange,
  rubrics,
  editing,
  submitting,
  onSave,
}: SubjectModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white rounded-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-bold text-primary-800">
            {editing ? "Modifier la matière" : "Nouvelle matière"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Formulaire matière
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="subject-name" className={FIELD_LABEL_CLASS}>
                Nom{" "}
                <span className="text-error" aria-label="obligatoire">
                  *
                </span>
              </Label>
              <Input
                id="subject-name"
                value={form.name}
                onChange={(e) => onNameChange(e.target.value)}
                className={INPUT_CLASS}
                required
                aria-required="true"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="subject-code" className={FIELD_LABEL_CLASS}>
                Code
              </Label>
              <Input
                id="subject-code"
                value={form.code}
                readOnly={!editing}
                onChange={(e) =>
                  editing &&
                  onChange({ ...form, code: e.target.value.toUpperCase() })
                }
                className={`${INPUT_CLASS} ${!editing ? "bg-neutral-100" : ""}`}
              />
              {!editing && (
                <p className="text-xs text-neutral-500">
                  Généré automatiquement depuis le nom
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label
                htmlFor="subject-coefficient"
                className={FIELD_LABEL_CLASS}
              >
                Coefficient
              </Label>
              <Input
                id="subject-coefficient"
                type="number"
                step="0.5"
                value={form.coefficient}
                onChange={(e) =>
                  onChange({ ...form, coefficient: e.target.value })
                }
                className={INPUT_CLASS}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="subject-maxscore" className={FIELD_LABEL_CLASS}>
                Note max
              </Label>
              <Input
                id="subject-maxscore"
                type="number"
                value={form.maxScore}
                onChange={(e) =>
                  onChange({ ...form, maxScore: e.target.value })
                }
                className={INPUT_CLASS}
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="subject-rubric" className={FIELD_LABEL_CLASS}>
              Rubrique{" "}
              <span className="text-error" aria-label="obligatoire">
                *
              </span>
            </Label>
            <Select
              value={form.rubricId}
              onValueChange={(v) => onChange({ ...form, rubricId: v })}
            >
              <SelectTrigger
                id="subject-rubric"
                className={INPUT_CLASS}
                aria-required="true"
              >
                <SelectValue placeholder="Sélectionner une rubrique" />
              </SelectTrigger>
              <SelectContent>
                {rubrics.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.code} — {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="subject-hasSections"
              checked={form.hasSections}
              onChange={(e) =>
                onChange({ ...form, hasSections: e.target.checked })
              }
              className="h-4 w-4 cursor-pointer accent-primary-800"
            />
            <Label
              htmlFor="subject-hasSections"
              className={`${FIELD_LABEL_CLASS} cursor-pointer`}
            >
              Cette matière a des sous-matières (sections)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className={BTN_OUTLINE_CLASS}
          >
            Annuler
          </Button>
          <Button
            onClick={onSave}
            disabled={submitting || !form.name || !form.code}
            className={BTN_DIALOG_PRIMARY_CLASS}
          >
            {submitting ? "En cours..." : editing ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── SectionModal ──────────────────────────────────────────────────────────

interface SectionModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: SectionForm;
  onChange: (f: SectionForm) => void;
  onNameChange: (name: string) => void;
  onToggleCycle: (key: string, checked: boolean) => void;
  submitting: boolean;
  onSave: () => void;
}

function SectionModal({
  open,
  onOpenChange,
  form,
  onChange,
  onNameChange,
  onToggleCycle,
  submitting,
  onSave,
}: SectionModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white rounded-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-bold text-primary-800">
            Nouvelle sous-matière
          </DialogTitle>
          <DialogDescription className="sr-only">
            Formulaire sous-matière
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="section-name" className={FIELD_LABEL_CLASS}>
                Nom{" "}
                <span className="text-error" aria-label="obligatoire">
                  *
                </span>
              </Label>
              <Input
                id="section-name"
                value={form.name}
                onChange={(e) => onNameChange(e.target.value)}
                className={INPUT_CLASS}
                required
                aria-required="true"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="section-code" className={FIELD_LABEL_CLASS}>
                Code
              </Label>
              <Input
                id="section-code"
                value={form.code}
                readOnly
                className={`${INPUT_CLASS} bg-neutral-100`}
              />
              <p className="text-xs text-neutral-500">
                Généré automatiquement depuis le nom
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="section-maxscore" className={FIELD_LABEL_CLASS}>
              Note max
            </Label>
            <Input
              id="section-maxscore"
              type="number"
              value={form.maxScore}
              onChange={(e) => onChange({ ...form, maxScore: e.target.value })}
              className={INPUT_CLASS}
              inputMode="numeric"
            />
          </div>

          <div className="space-y-2">
            <span className={FIELD_LABEL_CLASS}>
              Cycles applicables{" "}
              <span className="text-error" aria-label="obligatoire">
                *
              </span>
              <span className="ml-1.5 text-xs text-neutral-500 font-normal">
                Dans quels cycles cette sous-matière est enseignée ?
              </span>
            </span>
            <div className="border border-neutral-200 rounded-lg overflow-hidden">
              {CYCLES_MENFP.map((cycle, i) => {
                const checked = form.cycles.includes(cycle.key);
                const cycleId = `section-cycle-${cycle.key}`;
                return (
                  <label
                    key={cycle.key}
                    htmlFor={cycleId}
                    className={`
                      flex items-center gap-3 px-4 py-2.5 cursor-pointer
                      ${i > 0 ? "border-t border-neutral-200" : ""}
                      ${checked ? "bg-primary-50" : "bg-white"}
                    `}
                  >
                    <input
                      id={cycleId}
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        onToggleCycle(cycle.key, e.target.checked)
                      }
                      className="h-4 w-4 cursor-pointer accent-primary-800"
                    />
                    <div>
                      <span className="text-sm font-semibold text-neutral-900">
                        {cycle.label}
                      </span>
                      <span className="ml-2 text-xs text-neutral-500">
                        {cycle.description}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
            {form.cycles.length === 0 && (
              <p className="text-xs text-warning">
                ⚠ Aucun cycle — la sous-matière s&apos;appliquera à toutes les
                classes
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className={BTN_OUTLINE_CLASS}
          >
            Annuler
          </Button>
          <Button
            onClick={onSave}
            disabled={submitting || !form.name || !form.code}
            className={BTN_DIALOG_PRIMARY_CLASS}
          >
            {submitting ? "En cours..." : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── AttitudeModal ─────────────────────────────────────────────────────────

interface AttitudeModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  label: string;
  onLabelChange: (v: string) => void;
  editing: Attitude | null;
  submitting: boolean;
  onSave: () => void;
}

function AttitudeModal({
  open,
  onOpenChange,
  label,
  onLabelChange,
  editing,
  submitting,
  onSave,
}: AttitudeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white rounded-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-bold text-primary-800">
            {editing ? "Modifier l'attitude" : "Nouvelle attitude"}
          </DialogTitle>
          <DialogDescription className="text-sm text-neutral-500">
            L&apos;attitude sera évaluée Oui / Non pour chaque élève.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="attitude-label" className={FIELD_LABEL_CLASS}>
              Libellé{" "}
              <span className="text-error" aria-label="obligatoire">
                *
              </span>
            </Label>
            <Input
              id="attitude-label"
              value={label}
              onChange={(e) => onLabelChange(e.target.value)}
              placeholder="Ex: Respectueux(se), Ponctuel(le)..."
              onKeyDown={(e) => e.key === "Enter" && onSave()}
              autoFocus
              className={INPUT_CLASS}
              required
              aria-required="true"
            />
          </div>

          <div className="bg-primary-50 text-primary-700 rounded-lg px-4 py-2.5 text-xs">
            Exemples : Respectueux(se) · Ponctuel(le) · Attentif(ve) ·
            Travailleur(se) · Perturbateur(trice)
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className={BTN_OUTLINE_CLASS}
          >
            Annuler
          </Button>
          <Button
            onClick={onSave}
            disabled={submitting || !label.trim()}
            className={BTN_DIALOG_PRIMARY_CLASS}
          >
            {submitting ? "En cours..." : editing ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── ClassModal ────────────────────────────────────────────────────────────

interface ClassModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: ClassForm;
  onChange: (f: ClassForm) => void;
  editing: Class | null;
  submitting: boolean;
  onSave: () => void;
}

function ClassModal({
  open,
  onOpenChange,
  form,
  onChange,
  editing,
  submitting,
  onSave,
}: ClassModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white rounded-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-bold text-primary-800">
            Modifier la classe
          </DialogTitle>
          <DialogDescription className="sr-only">
            Modifier le nombre maximal d&apos;élèves de la classe
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-primary-50 rounded-lg px-4 py-3">
            <p className="text-xs text-neutral-500 mb-1">Classe</p>
            <p className="text-base font-bold text-primary-800">
              {editing?.classType?.name} — Salle A
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="class-maxstudents" className={FIELD_LABEL_CLASS}>
              Max élèves
            </Label>
            <Input
              id="class-maxstudents"
              type="number"
              value={form.maxStudents}
              onChange={(e) =>
                onChange({ ...form, maxStudents: e.target.value })
              }
              className={INPUT_CLASS}
              inputMode="numeric"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className={BTN_OUTLINE_CLASS}
          >
            Annuler
          </Button>
          <Button
            onClick={onSave}
            disabled={submitting}
            className={BTN_DIALOG_PRIMARY_CLASS}
          >
            {submitting ? "En cours..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE  —  cognitive complexity: 0
// ═══════════════════════════════════════════════════════════════════════════════

export default function SchoolSettingsPage() {
  const s = useSchoolSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Établissement
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paramètres et référentiel de votre établissement
        </p>
      </div>

      <Tabs
        defaultValue="general"
        className="w-full"
        onValueChange={s.setActiveTab}
      >
        <TabsList>
          {Object.entries(TAB_LABELS).map(([value, label]) => (
            <TabsTrigger key={value} value={value}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general" className="space-y-6 mt-6">
          <CPMSLSchoolInfoForm
            schoolInfo={s.schoolInfo}
            onSave={s.handleSaveSchoolInfo}
            loading={s.loadingSchoolInfo}
          />
        </TabsContent>

        <TabsContent value="calendar" className="space-y-8 mt-6">
          <CPMSLCalendarManagement
            holidays={s.holidays}
            events={s.events}
            onAddHoliday={s.handleAddHoliday}
            onEditHoliday={s.handleEditHoliday}
            onDeleteHoliday={s.handleDeleteHoliday}
            onAddEvent={s.handleAddEvent}
            onEditEvent={s.handleEditEvent}
            onDeleteEvent={s.handleDeleteEvent}
          />
        </TabsContent>

        <TabsContent value="referentiel" className="space-y-6 mt-6">
          <ReferentielTab
            loading={s.loadingRef}
            rubrics={s.rubrics}
            subjects={s.subjects}
            expandedSubjects={s.expandedSubjects}
            onCreateRubric={s.openCreateRubric}
            onEditRubric={s.openEditRubric}
            onCreateSubject={s.openCreateSubject}
            onEditSubject={s.openEditSubject}
            onCreateSection={s.openCreateSection}
            onToggleExpand={s.toggleExpand}
          />
        </TabsContent>

        <TabsContent value="classes" className="space-y-6 mt-6">
          <ClassesTab
            loading={s.loadingClasses}
            classTypes={s.classTypes}
            classes={s.classes}
            initializing={s.initializing}
            onInitialize={s.handleInitializeClasses}
            onEditClass={s.openEditClass}
          />
        </TabsContent>

        <TabsContent value="attitudes" className="space-y-6 mt-6">
          <AttitudesTab
            loading={s.loadingAttitudes}
            attitudes={s.attitudes}
            currentYearId={s.currentYearId}
            onCreateAttitude={s.openCreateAttitude}
            onEditAttitude={s.openEditAttitude}
            onDeleteAttitude={s.handleDeleteAttitude}
          />
        </TabsContent>
      </Tabs>

      <RubricModal
        open={s.rubricModal}
        onOpenChange={s.setRubricModal}
        form={s.rubricForm}
        onChange={s.setRubricForm}
        editing={s.editingRubric}
        submitting={s.submitting}
        onSave={s.handleSaveRubric}
      />
      <SubjectModal
        open={s.subjectModal}
        onOpenChange={s.setSubjectModal}
        form={s.subjectForm}
        onChange={s.setSubjectForm}
        onNameChange={s.handleSubjectNameChange}
        rubrics={s.rubrics}
        editing={s.editingSubject}
        submitting={s.submitting}
        onSave={s.handleSaveSubject}
      />
      <SectionModal
        open={s.sectionModal}
        onOpenChange={s.setSectionModal}
        form={s.sectionForm}
        onChange={s.setSectionForm}
        onNameChange={s.handleSectionNameChange}
        onToggleCycle={s.toggleSectionCycle}
        submitting={s.submitting}
        onSave={s.handleSaveSection}
      />
      <AttitudeModal
        open={s.attitudeModal}
        onOpenChange={s.setAttitudeModal}
        label={s.attitudeLabel}
        onLabelChange={s.setAttitudeLabel}
        editing={s.editingAttitude}
        submitting={s.submitting}
        onSave={s.handleSaveAttitude}
      />
      <ClassModal
        open={s.classModal}
        onOpenChange={s.setClassModal}
        form={s.classForm}
        onChange={s.setClassForm}
        editing={s.editingClass}
        submitting={s.submitting}
        onSave={s.handleSaveClass}
      />
    </div>
  );
}
