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
import { isNisuValid, normalizeNisu, NISU_RULE_LABEL } from "@/lib/nisu";

export interface EditStudentData {
  // Compte (User)
  lastname: string;
  firstname: string;
  birthDate: string; // yyyy-mm-dd
  email: string;
  // Identité scolaire
  nisu: string;
  // Coordonnées
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

const EMPTY: EditStudentData = {
  lastname: "", firstname: "", birthDate: "", email: "",
  nisu: "",
  address: "", motherName: "", fatherName: "", phone1: "", phone2: "", parentsEmail: "",
};

export function EditStudentModal({
  open,
  onOpenChange,
  studentName,
  studentCode,
  initialData,
  submitting = false,
  onSubmit,
}: EditStudentModalProps) {
  const [form, setForm] = useState<EditStudentData>(EMPTY);

  useEffect(() => {
    if (open) {
      setForm({
        lastname:     initialData.lastname || "",
        firstname:    initialData.firstname || "",
        birthDate:    initialData.birthDate || "",
        email:        initialData.email || "",
        nisu:         initialData.nisu || "",
        address:      initialData.address || "",
        motherName:   initialData.motherName || "",
        fatherName:   initialData.fatherName || "",
        phone1:       initialData.phone1 || "",
        phone2:       initialData.phone2 || "",
        parentsEmail: initialData.parentsEmail || "",
      });
    }
  }, [open, initialData]);

  const set =
    (field: keyof EditStudentData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  // Le NISU n'est validé que s'il a été MODIFIÉ (beaucoup de NISU hérités ne
  // respectent pas le format 20 caractères — on ne bloque pas leur édition).
  const nisuChanged = normalizeNisu(form.nisu) !== normalizeNisu(initialData.nisu);
  const nisuTouchedInvalid = nisuChanged && form.nisu.trim() !== "" && !isNisuValid(form.nisu.trim());
  const canSubmit =
    !submitting &&
    form.lastname.trim() !== "" &&
    form.firstname.trim() !== "" &&
    !nisuTouchedInvalid;

  const labelCls = "text-sm font-medium text-neutral-900";
  const inputCls = "border-neutral-300 rounded-lg";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] max-h-[85vh] overflow-y-auto bg-white rounded-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-bold text-primary-800">
            Modifier l&apos;élève
          </DialogTitle>
          <p className="text-sm text-neutral-500 mt-0.5">
            {studentName} · <span className="font-mono">{studentCode}</span>
          </p>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* ── Identité ──────────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Identité</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-lastname" className={labelCls}>Nom <span className="text-error">*</span></Label>
                <Input id="edit-lastname" value={form.lastname} onChange={set("lastname")} placeholder="Nom" className={inputCls} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-firstname" className={labelCls}>Prénom <span className="text-error">*</span></Label>
                <Input id="edit-firstname" value={form.firstname} onChange={set("firstname")} placeholder="Prénom" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-birthdate" className={labelCls}>Date de naissance</Label>
                <Input id="edit-birthdate" type="date" value={form.birthDate} onChange={set("birthDate")} className={inputCls} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-nisu" className={labelCls}>NISU</Label>
                <Input
                  id="edit-nisu"
                  value={form.nisu}
                  onChange={set("nisu")}
                  placeholder="20 caractères alphanumériques"
                  className={`${inputCls} font-mono uppercase ${nisuTouchedInvalid ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                {nisuTouchedInvalid && (
                  <p className="text-xs text-destructive">{NISU_RULE_LABEL}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email" className={labelCls}>Email de l&apos;élève</Label>
              <Input id="edit-email" type="email" value={form.email} onChange={set("email")} placeholder="email@exemple.com" className={inputCls} />
            </div>
          </div>

          {/* ── Coordonnées ───────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Coordonnées</p>
            <div className="space-y-2">
              <Label htmlFor="edit-address" className={labelCls}>Adresse</Label>
              <Input id="edit-address" value={form.address} onChange={set("address")} placeholder="Adresse de l'élève" className={inputCls} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-mother" className={labelCls}>Nom de la mère</Label>
                <Input id="edit-mother" value={form.motherName} onChange={set("motherName")} placeholder="Prénom Nom" className={inputCls} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-father" className={labelCls}>Nom du père</Label>
                <Input id="edit-father" value={form.fatherName} onChange={set("fatherName")} placeholder="Prénom Nom" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-phone1" className={labelCls}>Téléphone 1</Label>
                <Input id="edit-phone1" type="tel" value={form.phone1} onChange={set("phone1")} placeholder="+509..." className={inputCls} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone2" className={labelCls}>Téléphone 2</Label>
                <Input id="edit-phone2" type="tel" value={form.phone2} onChange={set("phone2")} placeholder="+509..." className={inputCls} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-parents-email" className={labelCls}>Email des parents</Label>
              <Input id="edit-parents-email" type="email" value={form.parentsEmail} onChange={set("parentsEmail")} placeholder="email@exemple.com" className={inputCls} />
            </div>
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
            disabled={!canSubmit}
            className="bg-primary-500 hover:bg-primary-600 text-white rounded-lg disabled:bg-neutral-400 disabled:cursor-not-allowed"
          >
            {submitting ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
