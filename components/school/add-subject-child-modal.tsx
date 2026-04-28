"use client";

import { useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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
  coefficient: number;
}

interface AddSubjectChildModalProps {
  parent: SubjectParent;
  existingChildren: SubjectChild[];
  onSubmit?: (data: {
    name: string;
    code: string;
    type: "L" | "C" | "N" | "P" | "T";
    coefficient: number;
  }) => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AddSubjectChildModal({
  parent,
  existingChildren,
  onSubmit,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: AddSubjectChildModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"L" | "C" | "N" | "P" | "T" | "">("");
  const [coefficient, setCoefficient] = useState("");

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const setIsOpen = (open: boolean) => {
    if (isControlled) {
      onOpenChange?.(open);
    } else {
      setInternalOpen(open);
    }
  };

  // Generate code from parent code and type
  const generateCode = (selectedType: string): string => {
    if (!selectedType) return "";

    const parentLetters = parent.code.substring(0, 3);
    let number = 1;
    const existingCodesForType = existingChildren
      .filter((c) => c.code.startsWith(`${parentLetters}${selectedType}`))
      .map((c) => c.code);

    while (
      existingCodesForType.includes(
        `${parentLetters}${selectedType}${number.toString().padStart(2, "0")}`,
      )
    ) {
      number++;
    }

    return `${parentLetters}${selectedType}${number.toString().padStart(2, "0")}`;
  };

  const generatedCode = generateCode(type);

  // Calculate current total coefficient
  const currentTotal = existingChildren
    .filter((c) => c.parentId === parent.id)
    .reduce((sum, c) => sum + c.coefficient, 0);

  const newTotal = currentTotal + (coefficient ? parseInt(coefficient) : 0);
  const isValidTotal = newTotal <= parent.coefficient;
  const isMaxReached = currentTotal >= parent.coefficient;

  // Check if form is valid
  const isFormValid =
    name.trim() !== "" &&
    type !== "" &&
    coefficient !== "" &&
    parseInt(coefficient) >= 1 &&
    isValidTotal &&
    !isMaxReached;

  const handleSubmit = () => {
    if (!isFormValid) return;

    onSubmit?.({
      name: name.trim(),
      code: generatedCode,
      type: type as "L" | "C" | "N" | "P" | "T",
      coefficient: parseInt(coefficient),
    });

    setName("");
    setType("");
    setCoefficient("");
    setIsOpen(false);
  };

  const handleCancel = () => {
    setName("");
    setType("");
    setCoefficient("");
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-[560px] bg-white border border-neutral-200 rounded-xl p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-neutral-200">
          <DialogTitle className="text-neutral-900 text-xl font-semibold mb-2">
            Ajouter une sous-matière — {parent.name}
          </DialogTitle>
          <DialogDescription className="text-neutral-600 text-sm">
            {parent.code} · {parent.rubrique} · Coefficient parent:{" "}
            {parent.coefficient}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-5">
          {/* Nom */}
          <div className="space-y-2">
            <Label
              htmlFor="name"
              className="text-neutral-900 text-[13px] font-medium"
            >
              Nom <span className="text-error">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Communication Française"
              className="border border-neutral-300 rounded-lg focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:border-primary-500"
            />
          </div>

          {/* Code (read-only) */}
          <div className="space-y-2">
            <Label
              htmlFor="code"
              className="text-neutral-900 text-[13px] font-medium"
            >
              Code
            </Label>
            <Input
              id="code"
              value={generatedCode}
              readOnly
              disabled
              className="border border-neutral-300 rounded-lg bg-neutral-50 text-neutral-500 font-mono uppercase cursor-not-allowed"
            />
            <p className="text-neutral-500 text-xs mt-1.5">
              Généré automatiquement — non modifiable
            </p>
          </div>

          {/* Type de sous-matière */}
          <div className="space-y-2">
            <Label className="text-neutral-900 text-[13px] font-medium">
              Type de sous-matière <span className="text-error">*</span>
            </Label>
            <RadioGroup
              value={type}
              onValueChange={(value) =>
                setType(value as "L" | "C" | "N" | "P" | "T")
              }
              className="flex flex-wrap gap-3"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="L" id="type-l" />
                <Label
                  htmlFor="type-l"
                  className="text-neutral-900 text-sm cursor-pointer"
                >
                  L — Langue / Communication
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="C" id="type-c" />
                <Label
                  htmlFor="type-c"
                  className="text-neutral-900 text-sm cursor-pointer"
                >
                  C — Calcul / Logique
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="N" id="type-n" />
                <Label
                  htmlFor="type-n"
                  className="text-neutral-900 text-sm cursor-pointer"
                >
                  N — Naturelle / Science
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="P" id="type-p" />
                <Label
                  htmlFor="type-p"
                  className="text-neutral-900 text-sm cursor-pointer"
                >
                  P — Pratique / Application
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="T" id="type-t" />
                <Label
                  htmlFor="type-t"
                  className="text-neutral-900 text-sm cursor-pointer"
                >
                  T — Théorie
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Coefficient */}
          <div className="space-y-2">
            <Label
              htmlFor="coefficient"
              className="text-neutral-900 text-[13px] font-medium"
            >
              Coefficient <span className="text-error">*</span>
            </Label>
            <Input
              id="coefficient"
              type="number"
              min="1"
              value={coefficient}
              onChange={(e) => setCoefficient(e.target.value)}
              placeholder={isMaxReached ? `Solde disponible : 0` : `Ex: 30`}
              disabled={isMaxReached}
              className="border border-neutral-300 rounded-lg disabled:bg-neutral-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:border-primary-500"
            />
            <p className="text-neutral-500 text-xs mt-1.5">
              La somme des coefficients des sous-matières doit égaler{" "}
              {parent.coefficient}
            </p>
            <p
              className={`text-[13px] font-medium mt-1.5 ${isValidTotal ? "text-success" : "text-warning"}`}
            >
              Total actuel: {newTotal} / {parent.coefficient}
            </p>
            {isMaxReached && (
              <p className="text-error text-[13px] font-medium mt-1.5">
                Coefficient maximum atteint. Impossible d'ajouter une
                sous-matière.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-neutral-200 flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="border border-neutral-300 text-neutral-600 rounded-lg"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid}
            className="rounded-lg bg-primary-700 text-white hover:bg-primary-800 disabled:bg-neutral-400 disabled:cursor-not-allowed"
          >
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
