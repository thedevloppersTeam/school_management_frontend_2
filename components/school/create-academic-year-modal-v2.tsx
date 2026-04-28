"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PlusIcon } from "lucide-react";
import type { AcademicYear } from "@/lib/api/dashboard";

interface CreateAcademicYearModalV2Props {
  activeYear?: AcademicYear;
  archivedYears?: AcademicYear[];
  hasActiveYear?: boolean;
  onSubmit?: (data: {
    name: string;
    startDate?: string;
    endDate?: string;
    numberOfPeriods: 4 | 5;
    copyFromYearId?: string;
  }) => void;
  trigger?: React.ReactNode;
}

export function CreateAcademicYearModalV2({
  activeYear,
  archivedYears = [],
  hasActiveYear = false,
  onSubmit,
  trigger,
}: CreateAcademicYearModalV2Props) {
  // ── FIX : useMemo pour recalculer quand activeYear change ──
  const name = useMemo(() => {
    if (activeYear) {
      const match = activeYear.name.match(/(\d{4})-(\d{4})/);
      if (match) {
        return `${parseInt(match[1]) + 1}-${parseInt(match[2]) + 1}`;
      }
    }
    // Fallback : année calendaire courante
    const currentYear = new Date().getFullYear();
    return `${currentYear}-${currentYear + 1}`;
  }, [activeYear]);

  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [numberOfPeriods, setNumberOfPeriods] = useState<4 | 5>(4);
  const [creationType, setCreationType] = useState<"scratch" | "copy">(
    "scratch",
  );
  const [copyFromYearId, setCopyFromYearId] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSubmit?.({
      name: name.trim(),
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      numberOfPeriods,
      copyFromYearId: creationType === "copy" ? copyFromYearId : undefined,
    });

    setStartDate("");
    setEndDate("");
    setNumberOfPeriods(4);
    setCreationType("scratch");
    setCopyFromYearId("");
    setOpen(false);
  };

  const handleCancel = () => {
    setStartDate("");
    setEndDate("");
    setNumberOfPeriods(4);
    setCreationType("scratch");
    setCopyFromYearId("");
    setOpen(false);
  };

  const getPeriodNames = (count: 4 | 5) => {
    const names = ["1ère Étape", "2ème Étape", "3ème Étape", "4ème Étape"];
    if (count === 5) names.push("5ème Étape");
    return names;
  };

  const isSubmitDisabled =
    !name.trim() || (creationType === "copy" && !copyFromYearId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2">
            <PlusIcon className="h-4 w-4" />
            Nouvelle année
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px] border border-neutral-300 rounded-xl bg-white max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="heading-2 text-neutral-900">
              Nouvelle année scolaire
            </DialogTitle>
            {/* FIX : aria-describedby warning */}
            <DialogDescription className="sr-only">
              Formulaire de création d'une nouvelle année scolaire
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-6">
            {/* SECTION 1 — Informations de base */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="name"
                  className="text-[13px] font-medium text-neutral-900"
                >
                  Nom de l'année <span className="text-error">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  readOnly
                  disabled
                  className="border-neutral-300 bg-neutral-50 text-neutral-600 cursor-not-allowed"
                />
                <p className="text-xs text-neutral-600">
                  Généré automatiquement
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="startDate"
                    className="text-[13px] font-medium text-neutral-900"
                  >
                    Date de début
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border-neutral-300 text-neutral-900 focus-visible:border-secondary-400 focus-visible:ring-2 focus-visible:ring-secondary-400/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="endDate"
                    className="text-[13px] font-medium text-neutral-900"
                  >
                    Date de fin
                  </Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="border-neutral-300 text-neutral-900 focus-visible:border-secondary-400 focus-visible:ring-2 focus-visible:ring-secondary-400/40"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-300" />

            {/* SECTION 2 — Nombre d'étapes */}
            <div className="space-y-3">
              <div>
                <div className="text-[15px] font-semibold text-primary-700 border-l-[3px] border-primary-700 pl-2">
                  Nombre d'étapes
                </div>
                <p className="text-[13px] text-muted-foreground mt-1">
                  L'école peut fonctionner avec 4 ou 5 étapes selon l'année
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {([4, 5] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNumberOfPeriods(n)}
                    className={`rounded-lg p-4 cursor-pointer transition-all ${
                      numberOfPeriods === n
                        ? "border-2 border-secondary-400 bg-secondary-50"
                        : "border border-neutral-300 bg-neutral-50"
                    }`}
                  >
                    <div
                      className={`text-4xl font-bold ${
                        numberOfPeriods === n
                          ? "text-neutral-900"
                          : "text-neutral-600"
                      }`}
                    >
                      {n}
                    </div>
                    <div
                      className={`text-[13px] text-center mt-1 ${
                        numberOfPeriods === n
                          ? "text-neutral-900"
                          : "text-neutral-600"
                      }`}
                    >
                      {n} Étapes
                    </div>
                  </button>
                ))}
              </div>

              <div className="rounded-lg p-3 bg-neutral-50">
                <p className="text-xs text-neutral-600 mb-2">Étapes créées :</p>
                <div className="flex flex-wrap gap-2">
                  {getPeriodNames(numberOfPeriods).map((periodName, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="border border-neutral-300 rounded px-2 py-0.5 bg-white text-xs text-neutral-900"
                    >
                      {periodName}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-300" />

            {/* SECTION 3 — Type de création */}
            <div className="space-y-3">
              <div className="text-[15px] font-semibold text-primary-700 border-l-[3px] border-primary-700 pl-2">
                Type de création
              </div>

              <div className="space-y-3">
                {[
                  {
                    value: "scratch",
                    title: "Créer depuis zéro",
                    desc: "Commencer avec une année vierge. Vous devrez configurer les classes, matières et enseignants manuellement.",
                  },
                  {
                    value: "copy",
                    title: "Copier une année existante",
                    desc: "Dupliquer la structure d'une année archivée (classes, matières). Les élèves et notes ne seront pas copiés.",
                  },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setCreationType(opt.value as "scratch" | "copy")
                    }
                    className={`w-full rounded-lg p-4 text-left transition-all ${
                      creationType === opt.value
                        ? "border-2 border-secondary-400 bg-secondary-50"
                        : "border border-neutral-300 bg-white"
                    }`}
                  >
                    <div className="text-[15px] font-semibold text-neutral-900">
                      {opt.title}
                    </div>
                    <p className="text-[13px] text-muted-foreground mt-1">
                      {opt.desc}
                    </p>
                  </button>
                ))}
              </div>

              {creationType === "copy" && (
                <div className="space-y-2">
                  <Label
                    htmlFor="copyYear"
                    className="text-[13px] font-medium text-neutral-900"
                  >
                    Copier depuis <span className="text-error">*</span>
                  </Label>
                  <Select
                    value={copyFromYearId}
                    onValueChange={setCopyFromYearId}
                  >
                    <SelectTrigger
                      id="copyYear"
                      className="border-neutral-300 text-neutral-900"
                    >
                      <SelectValue placeholder="Sélectionnez une année source" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeYear && (
                        <SelectItem value={activeYear.id}>
                          {activeYear.name} (Active)
                        </SelectItem>
                      )}
                      {archivedYears.map((year) => (
                        <SelectItem key={year.id} value={year.id}>
                          {year.name} (Archivée)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              className="border-neutral-300 hover:bg-neutral-50 text-neutral-900"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSubmitDisabled}
              className="border-0 bg-primary-700 text-white hover:bg-primary-800 disabled:bg-neutral-400"
            >
              Créer l'année
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
