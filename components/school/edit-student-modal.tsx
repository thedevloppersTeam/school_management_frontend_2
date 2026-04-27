"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangleIcon } from "lucide-react";

interface EditStudentData {
  address: string;
  motherName: string;
  fatherName: string;
  phone1: string;
  phone2: string;
  parentsEmail: string;
}

interface EditStudentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string;
  studentCode: string;
  initialData: Partial<EditStudentData>;
  submitting?: boolean;
  onSubmit: (data: EditStudentData) => void;
}

export function EditStudentModal({
  open,
  onOpenChange,
  studentName,
  studentCode,
  initialData,
  submitting = false,
  onSubmit,
}: EditStudentModalProps) {
  const [form, setForm] = useState<EditStudentData>({
    address: "",
    motherName: "",
    fatherName: "",
    phone1: "",
    phone2: "",
    parentsEmail: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        address: initialData.address || "",
        motherName: initialData.motherName || "",
        fatherName: initialData.fatherName || "",
        phone1: initialData.phone1 || "",
        phone2: initialData.phone2 || "",
        parentsEmail: initialData.parentsEmail || "",
      });
    }
  }, [open, initialData]);

  const set =
    (field: keyof EditStudentData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] bg-white rounded-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-bold text-primary-800">
            Modifier le profil
          </DialogTitle>
          <p className="text-sm text-neutral-500 mt-0.5">
            {studentName} · <span className="font-mono">{studentCode}</span>
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Adresse */}
          <div className="space-y-2">
            <Label
              htmlFor="student-address"
              className="text-sm font-medium text-neutral-900"
            >
              Adresse
            </Label>
            <Input
              id="student-address"
              value={form.address}
              onChange={set("address")}
              placeholder="Adresse de l'élève"
              className="border-neutral-300 rounded-lg"
            />
          </div>

          {/* Mère + Père */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label
                htmlFor="student-mother-name"
                className="text-sm font-medium text-neutral-900"
              >
                Nom de la mère
              </Label>
              <Input
                id="student-mother-name"
                value={form.motherName}
                onChange={set("motherName")}
                placeholder="Prénom Nom"
                className="border-neutral-300 rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="student-father-name"
                className="text-sm font-medium text-neutral-900"
              >
                Nom du père
              </Label>
              <Input
                id="student-father-name"
                value={form.fatherName}
                onChange={set("fatherName")}
                placeholder="Prénom Nom"
                className="border-neutral-300 rounded-lg"
              />
            </div>
          </div>

          {/* Téléphone 1 + 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label
                htmlFor="student-phone1"
                className="text-sm font-medium text-neutral-900"
              >
                Téléphone 1
              </Label>
              <Input
                id="student-phone1"
                type="tel"
                value={form.phone1}
                onChange={set("phone1")}
                placeholder="+509..."
                className="border-neutral-300 rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="student-phone2"
                className="text-sm font-medium text-neutral-900"
              >
                Téléphone 2
              </Label>
              <Input
                id="student-phone2"
                type="tel"
                value={form.phone2}
                onChange={set("phone2")}
                placeholder="+509..."
                className="border-neutral-300 rounded-lg"
              />
            </div>
          </div>

          {/* Email parents */}
          <div className="space-y-2">
            <Label
              htmlFor="student-parents-email"
              className="text-sm font-medium text-neutral-900"
            >
              Email des parents
            </Label>
            <Input
              id="student-parents-email"
              type="email"
              value={form.parentsEmail}
              onChange={set("parentsEmail")}
              placeholder="email@exemple.com"
              className="border-neutral-300 rounded-lg"
            />
          </div>

          {/* Warning : NISU non modifiable */}
          <div
            className="flex items-start gap-2 bg-warning-soft border border-warning rounded-lg px-3 py-2.5 text-xs text-warning"
            role="note"
          >
            <AlertTriangleIcon
              className="h-4 w-4 mt-0.5 flex-shrink-0"
              aria-hidden="true"
            />
            <span>
              Le NISU n&apos;est pas modifiable après l&apos;inscription.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="border-neutral-300 rounded-lg"
          >
            Annuler
          </Button>
          <Button
            onClick={() => onSubmit(form)}
            disabled={submitting}
            className="bg-primary-500 hover:bg-primary-600 text-white rounded-lg disabled:bg-neutral-400 disabled:cursor-not-allowed"
          >
            {submitting ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
