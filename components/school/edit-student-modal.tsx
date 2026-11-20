"use client";

import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  corpsModificationProfil,
  etatInitialFormulaire,
  type ChampProfil,
  type CorpsModificationProfil,
  type ProfilInitial,
  type SaisieProfil,
} from "@/lib/students/profil";

export type EditStudentData = SaisieProfil;

interface EditStudentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string;
  studentCode: string;
  /**
   * Profil connu de l'écran, lu UNE fois au montage du formulaire : le parent
   * remonte le modal par `key={studentId}`. `null` tant que la lecture du
   * profil n'est pas finie.
   */
  initialData: ProfilInitial | null;
  /** Échec de la lecture du profil, en français : l'enregistrement est interdit. */
  loadError?: string | null;
  submitting?: boolean;
  /** Reçoit le seul corps des champs modifiés (lib/students/profil.ts). */
  onSubmit: (corps: CorpsModificationProfil) => void;
}

const labelCls = "text-sm font-medium text-neutral-900";
const inputCls = "border-neutral-300 rounded-lg";

export function EditStudentModal({
  open,
  onOpenChange,
  studentName,
  studentCode,
  initialData,
  loadError = null,
  submitting = false,
  onSubmit,
}: EditStudentModalProps) {
  const annuler = () => onOpenChange(false);

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

        {loadError ? (
          <>
            <Alert className="border-error-border bg-error-soft text-error-ink">
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
            <PiedDuModal onAnnuler={annuler} desactive submitting={false} />
          </>
        ) : initialData === null ? (
          <>
            <div aria-busy="true" className="py-2">
              <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
                Chargement…
              </p>
            </div>
            <PiedDuModal onAnnuler={annuler} desactive submitting={false} />
          </>
        ) : (
          <FormulaireProfil
            initialData={initialData}
            submitting={submitting}
            onAnnuler={annuler}
            onSubmit={onSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FormulaireProfil({
  initialData,
  submitting,
  onAnnuler,
  onSubmit,
}: {
  initialData: ProfilInitial;
  submitting: boolean;
  onAnnuler: () => void;
  onSubmit: (corps: CorpsModificationProfil) => void;
}) {
  // État initial calculé une seule fois : un nouveau rendu du parent (pendant
  // l'envoi notamment) ne remplace plus la saisie (défaut D-2).
  const [initial] = useState<SaisieProfil>(() => etatInitialFormulaire(initialData));
  const [form, setForm] = useState<SaisieProfil>(initial);

  const { corps, erreurs } = corpsModificationProfil(initial, form);
  const aucuneModification = Object.keys(corps).length === 0 && erreurs.length === 0;
  const erreurDe = (champ: ChampProfil) => erreurs.find((e) => e.champ === champ)?.message;

  const champ = (nom: ChampProfil, id: string) => {
    const erreur = erreurDe(nom);
    return {
      id,
      value: form[nom],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [nom]: e.target.value })),
      "aria-invalid": erreur ? true : undefined,
      "aria-describedby": erreur ? `${id}-erreur` : undefined,
      className: cn(inputCls, erreur && "border-error-border"),
    };
  };
  const message = (nom: ChampProfil, id: string) => {
    const erreur = erreurDe(nom);
    return erreur ? <p id={`${id}-erreur`} className="text-xs text-error-ink">{erreur}</p> : null;
  };

  return (
    <>
      <div className="space-y-5 py-2">
        {/* ── Identité ──────────────────────────────────────────── */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Identité</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-lastname" className={labelCls}>Nom <span className="text-error">*</span></Label>
              <Input {...champ("lastname", "edit-lastname")} placeholder="Nom" />
              {message("lastname", "edit-lastname")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-firstname" className={labelCls}>Prénom <span className="text-error">*</span></Label>
              <Input {...champ("firstname", "edit-firstname")} placeholder="Prénom" />
              {message("firstname", "edit-firstname")}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-birthdate" className={labelCls}>Date de naissance</Label>
              <Input {...champ("birthDate", "edit-birthdate")} type="date" />
              {message("birthDate", "edit-birthdate")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-nisu" className={labelCls}>NISU</Label>
              <Input
                {...champ("nisu", "edit-nisu")}
                placeholder="20 caractères alphanumériques"
                className={cn(champ("nisu", "edit-nisu").className, "font-mono uppercase")}
              />
              {message("nisu", "edit-nisu")}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-email" className={labelCls}>Email de l&apos;élève</Label>
            <Input {...champ("email", "edit-email")} type="email" placeholder="email@exemple.com" />
            {message("email", "edit-email")}
          </div>
        </div>

        {/* ── Coordonnées ───────────────────────────────────────── */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Coordonnées</p>
          <div className="space-y-2">
            <Label htmlFor="edit-address" className={labelCls}>Adresse</Label>
            <Input {...champ("address", "edit-address")} placeholder="Adresse de l'élève" />
            {message("address", "edit-address")}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-mother" className={labelCls}>Nom de la mère</Label>
              <Input {...champ("motherName", "edit-mother")} placeholder="Prénom Nom" />
              {message("motherName", "edit-mother")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-father" className={labelCls}>Nom du père</Label>
              <Input {...champ("fatherName", "edit-father")} placeholder="Prénom Nom" />
              {message("fatherName", "edit-father")}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-phone1" className={labelCls}>Téléphone 1</Label>
              <Input {...champ("phone1", "edit-phone1")} type="tel" placeholder="+509..." />
              {message("phone1", "edit-phone1")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone2" className={labelCls}>Téléphone 2</Label>
              <Input {...champ("phone2", "edit-phone2")} type="tel" placeholder="+509..." />
              {message("phone2", "edit-phone2")}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-parents-email" className={labelCls}>Email des parents</Label>
            <Input {...champ("parentsEmail", "edit-parents-email")} type="email" placeholder="email@exemple.com" />
            {message("parentsEmail", "edit-parents-email")}
          </div>
        </div>
      </div>

      <PiedDuModal
        onAnnuler={onAnnuler}
        desactive={submitting || aucuneModification || erreurs.length > 0}
        submitting={submitting}
        aucuneModification={aucuneModification}
        onEnregistrer={() => onSubmit(corps)}
      />
    </>
  );
}

function PiedDuModal({
  onAnnuler,
  desactive,
  submitting,
  aucuneModification = false,
  onEnregistrer,
}: {
  onAnnuler: () => void;
  desactive: boolean;
  submitting: boolean;
  aucuneModification?: boolean;
  onEnregistrer?: () => void;
}) {
  return (
    <DialogFooter className="gap-2 sm:items-center">
      {aucuneModification && (
        <p id="edit-aucune-modif" className="text-xs text-muted-foreground sm:mr-auto">
          Aucune modification à enregistrer.
        </p>
      )}
      <Button
        variant="outline"
        onClick={onAnnuler}
        disabled={submitting}
        className="border-neutral-300 rounded-lg"
      >
        Annuler
      </Button>
      <Button
        onClick={onEnregistrer}
        disabled={desactive}
        aria-describedby={aucuneModification ? "edit-aucune-modif" : undefined}
        className="bg-primary-500 hover:bg-primary-600 text-white rounded-lg disabled:bg-neutral-400 disabled:cursor-not-allowed"
      >
        {submitting ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </DialogFooter>
  );
}
