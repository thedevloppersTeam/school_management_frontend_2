"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * delete-classroom-modal.tsx
 *
 * Modal de suppression de salle/filière avec typed-name conditionnel (EP-006).
 * Corrigé : DT-001 (tokens au lieu de hex), VS-001 (focus rings)
 */

interface DeleteClassroomModalProps {
  classroom: {
    id: string;
    name: string;
  };
  level: {
    name: string;
    niveau: string;
  };
  studentCount: number;
  onConfirm?: () => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DeleteClassroomModal({
  classroom,
  level,
  studentCount,
  onConfirm,
  trigger,
  open,
  onOpenChange,
}: DeleteClassroomModalProps) {
  const [typedName, setTypedName] = useState("");

  // Reset à chaque ouverture
  useEffect(() => {
    if (open) setTypedName("");
  }, [open]);

  const isFondamentale = level.niveau === "Fondamentale";
  const title = isFondamentale
    ? `Supprimer la Salle ${classroom.name} — ${level.name}`
    : `Supprimer la filière ${classroom.name} — ${level.name}`;

  // Typed-name exigé uniquement si impact > 0
  const needsTypedName = studentCount > 0;
  const typedMatches =
    !needsTypedName || typedName.trim() === classroom.name.trim();
  const canConfirm = typedMatches;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm?.();
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger}
      <DialogContent className="max-w-[480px] rounded-lg border border-neutral-200 p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-neutral-900 text-lg font-semibold">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6">
          {/* Warning Block */}
          <div className="bg-error-soft text-error rounded-lg p-3 text-sm leading-relaxed">
            Cette {isFondamentale ? "salle" : "filière"} contient {studentCount}{" "}
            élèves. La suppression retirera ces élèves de la{" "}
            {isFondamentale ? "salle" : "filière"}. Cette action est
            irréversible.
          </div>

          {/* 16px spacing */}
          <div className="h-4" />

          {/* Summary Line */}
          <div
            className={`text-neutral-600 text-sm font-medium ${needsTypedName ? "mb-4" : "mb-6"}`}
          >
            Élèves affectés : {studentCount}
          </div>

          {/* Typed-name confirmation (uniquement si impact > 0) */}
          {needsTypedName && (
            <div className="mb-6">
              <Label
                htmlFor={`confirm-classroom-${classroom.id}`}
                className="text-[13px] text-neutral-900 block mb-1.5"
              >
                Pour confirmer, saisissez{" "}
                <code className="bg-secondary-100 px-1.5 py-0.5 rounded font-mono text-xs text-neutral-900">
                  {classroom.name}
                </code>{" "}
                ci-dessous :
              </Label>
              <Input
                id={`confirm-classroom-${classroom.id}`}
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder={classroom.name}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                className="rounded-lg border border-neutral-300 text-sm focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:border-primary-500"
              />
            </div>
          )}

          {/* Buttons */}
          <DialogFooter className="gap-3 flex flex-row justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange?.(false)}
              className="rounded-lg border border-neutral-300 text-neutral-900 bg-white"
            >
              Annuler
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="rounded-lg bg-error text-white hover:bg-error/90 disabled:bg-neutral-300 disabled:cursor-not-allowed"
            >
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
