"use client";

import { useState, useEffect } from "react";
import { clientFetch as apiFetch } from "@/lib/client-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  LoaderIcon,
  UploadIcon,
  TrashIcon,
  UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toMessage } from "@/lib/errors";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ClassSessionOption {
  id: string;
  name: string;
}

interface StudentEnrollFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  academicYearId: string;
  onSuccess: () => void;
  trigger?: React.ReactNode;
}

interface FormState {
  nisu: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  classSessionId: string;
  address: string;
  fatherName: string;
  motherName: string;
  phone1: string;
  phone2: string;
  parentsEmail: string;
  photo: string | null; // base64 data URL ou null
}

const EMPTY_FORM: FormState = {
  nisu: "",
  firstName: "",
  lastName: "",
  birthDate: "",
  classSessionId: "",
  address: "",
  fatherName: "",
  motherName: "",
  phone1: "",
  phone2: "",
  parentsEmail: "",
  photo: null,
};

// ─── Constantes photo ──────────────────────────────────────────────────────
const PHOTO_MAX_SIZE_MB = 2;
const PHOTO_MAX_SIZE_BYTES = PHOTO_MAX_SIZE_MB * 1024 * 1024;
const PHOTO_ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/jpg"];

// ─── Classes partagées ─────────────────────────────────────────────────────
const SECTION_TITLE_CLASS =
  "font-serif text-base font-semibold text-primary-800 border-l-[3px] border-primary-800 pl-2";

const FIELD_LABEL_CLASS = "font-sans text-sm font-medium text-neutral-900";

const FIELD_HINT_CLASS = "font-sans text-xs text-neutral-500 font-normal ml-2";

const INPUT_CLASS = "h-9 border-neutral-300 rounded-lg";

// ─── Component ─────────────────────────────────────────────────────────────

export function StudentEnrollForm({
  open,
  onOpenChange,
  academicYearId,
  onSuccess,
  trigger,
}: StudentEnrollFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [classSessions, setClassSessions] = useState<ClassSessionOption[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  useEffect(() => {
    if (!open || !academicYearId) return;
    setLoadingClasses(true);
    fetch(`/api/class-sessions?academicYearId=${academicYearId}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then(
        (
          data: Array<{
            id: string;
            class: {
              classType: { name: string };
              letter: string;
              track?: { code: string } | null;
            };
          }>,
        ) => {
          setClassSessions(
            data
              .map((s) => ({
                id: s.id,
                name: `${s.class.classType.name} ${s.class.letter}${s.class.track ? ` ${s.class.track.code}` : ""}`,
              }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          );
        },
      )
      .catch(() => setClassSessions([]))
      .finally(() => setLoadingClasses(false));
  }, [open, academicYearId]);

  const set =
    (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  // ─── Handlers photo ──────────────────────────────────────────────────────
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation type
    if (!PHOTO_ACCEPTED_TYPES.includes(file.type)) {
      setPhotoError("Format invalide. Utilisez PNG ou JPG.");
      e.target.value = "";
      return;
    }

    // Validation taille
    if (file.size > PHOTO_MAX_SIZE_BYTES) {
      setPhotoError(`La photo ne doit pas dépasser ${PHOTO_MAX_SIZE_MB} Mo.`);
      e.target.value = "";
      return;
    }

    // Encodage base64
    const reader = new FileReader();
    reader.onloadend = () => {
      setForm((f) => ({ ...f, photo: reader.result as string }));
    };
    reader.onerror = () => {
      setPhotoError("Impossible de lire le fichier. Réessayez.");
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoRemove = () => {
    setForm((f) => ({ ...f, photo: null }));
    setPhotoError(null);
    // Reset l'input file (sinon re-uploader le même fichier ne déclenche pas onChange)
    const input = document.getElementById(
      "enroll-photo",
    ) as HTMLInputElement | null;
    if (input) input.value = "";
  };

  // ─── Initiales pour le fallback de l'avatar ──────────────────────────────
  const initials =
    (form.firstName.trim()[0] || "") + (form.lastName.trim()[0] || "");

  // ─── Validation ──────────────────────────────────────────────────────────
  const nisuValid = /^[A-Z0-9]{14}$/i.test(form.nisu);

  const canSubmit =
    nisuValid &&
    form.firstName.trim() !== "" &&
    form.lastName.trim() !== "" &&
    form.birthDate !== "" &&
    form.classSessionId !== "" &&
    form.fatherName.trim() !== "" &&
    form.motherName.trim() !== "" &&
    form.phone1.trim() !== "";

  // ─── Submit — un seul appel, transaction atomique côté backend ───────────
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setApiError(null);
    setSuccessMsg(null);

    try {
      await apiFetch("/api/students/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nisu: form.nisu.toUpperCase(),
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          birthDate: form.birthDate,
          classSessionId: form.classSessionId,
          fatherName: form.fatherName.trim(),
          motherName: form.motherName.trim(),
          phone1: form.phone1.trim(),
          phone2: form.phone2.trim(),
          address: form.address.trim(),
          parentsEmail: form.parentsEmail.trim(),
          photo: form.photo, // base64 ou null
        }),
      });

      setSuccessMsg(
        `${form.firstName} ${form.lastName} inscrit(e) avec succès.`,
      );
      setForm(EMPTY_FORM);
      onSuccess();
    } catch (err) {
      setApiError(toMessage(err, "lors de l'inscription de l'élève"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setApiError(null);
      setSuccessMsg(null);
      setPhotoError(null);
    }
    onOpenChange(v);
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-xl cpmsl-scroll"></DialogContent>{" "}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-xl cpmsl-scroll">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-bold tracking-tight text-neutral-900 leading-tight">
            Inscrire un élève
          </DialogTitle>
          <DialogDescription className="font-sans text-sm text-muted-foreground">
            Remplissez les informations de l&apos;élève
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {/* ── Bandeau succès ──────────────────────────────────────────── */}
          {successMsg && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-start gap-2 rounded-lg p-3 bg-success-soft text-success font-sans text-sm"
            >
              <CheckCircle2Icon
                className="h-4 w-4 mt-0.5 flex-shrink-0"
                aria-hidden="true"
              />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ── Bandeau erreur API ─────────────────────────────────────── */}
          {apiError && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-2 rounded-lg p-3 bg-error-soft text-error font-sans text-sm"
            >
              <AlertTriangleIcon
                className="h-4 w-4 mt-0.5 flex-shrink-0"
                aria-hidden="true"
              />
              <span>{apiError}</span>
            </div>
          )}

          {/* ═════════════════ Section Identité ════════════════════════ */}
          <div className="space-y-3">
            <h3 className={SECTION_TITLE_CLASS}>Identité</h3>
            <div className="space-y-3">
              {/* ── Photo (optionnelle) ───────────────────────────────── */}
              <div className="space-y-1.5">
                <Label htmlFor="enroll-photo" className={FIELD_LABEL_CLASS}>
                  Photo
                  <span className={FIELD_HINT_CLASS}>
                    optionnel — PNG ou JPG, max {PHOTO_MAX_SIZE_MB} Mo
                  </span>
                </Label>

                <div className="flex items-center gap-4">
                  {/* Preview */}
                  <Avatar className="h-20 w-20 rounded-full border-2 border-neutral-200">
                    {form.photo ? (
                      <AvatarImage
                        src={form.photo}
                        alt={`Photo de ${form.firstName || "l'élève"}`}
                        className="object-cover"
                      />
                    ) : (
                      <AvatarFallback className="rounded-full bg-primary-50 text-primary-500">
                        {initials ? (
                          <span className="font-sans text-lg font-bold uppercase">
                            {initials}
                          </span>
                        ) : (
                          <UserIcon className="h-8 w-8" aria-hidden="true" />
                        )}
                      </AvatarFallback>
                    )}
                  </Avatar>

                  {/* Actions */}
                  <div className="flex-1 space-y-1.5">
                    <label
                      htmlFor="enroll-photo"
                      className="
                        inline-flex items-center gap-2 px-3 py-2 rounded-lg
                        border-2 border-dashed border-primary-200 cursor-pointer
                        text-sm text-primary-700 font-medium
                        hover:bg-primary-50 transition-colors
                        focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2
                      "
                    >
                      <UploadIcon className="h-4 w-4" aria-hidden="true" />
                      {form.photo ? "Changer la photo" : "Choisir une photo"}
                    </label>
                    <input
                      id="enroll-photo"
                      type="file"
                      accept={PHOTO_ACCEPTED_TYPES.join(",")}
                      onChange={handlePhotoUpload}
                      className="sr-only"
                      aria-describedby="enroll-photo-error"
                    />

                    {form.photo && (
                      <button
                        type="button"
                        onClick={handlePhotoRemove}
                        className="
                          inline-flex items-center gap-1.5 ml-2
                          text-sm text-error font-medium hover:underline
                          focus-visible:outline-2 focus-visible:outline-error focus-visible:rounded
                        "
                      >
                        <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        Supprimer
                      </button>
                    )}

                    <p id="enroll-photo-error" aria-live="polite">
                      {photoError && (
                        <span className="text-xs text-error">{photoError}</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* NISU */}
              <div className="space-y-1.5">
                <Label htmlFor="enroll-nisu" className={FIELD_LABEL_CLASS}>
                  NISU{" "}
                  <span className="text-error" aria-label="obligatoire">
                    *
                  </span>
                  <span className={FIELD_HINT_CLASS} id="enroll-nisu-hint">
                    14 caractères alphanumériques
                  </span>
                </Label>
                <Input
                  id="enroll-nisu"
                  type="text"
                  placeholder="Ex: M4XGKTJTXYN4SM"
                  value={form.nisu}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      nisu: e.target.value.toUpperCase(),
                    }))
                  }
                  className={cn(
                    INPUT_CLASS,
                    "font-mono tracking-wider",
                    form.nisu && !nisuValid && "border-error",
                  )}
                  maxLength={14}
                  inputMode="text"
                  autoCapitalize="characters"
                  required
                  aria-required="true"
                  aria-invalid={form.nisu !== "" && !nisuValid}
                  aria-describedby="enroll-nisu-hint enroll-nisu-status"
                />
                <div id="enroll-nisu-status" aria-live="polite">
                  {form.nisu && !nisuValid && (
                    <p className="text-xs text-error">
                      14 caractères alphanumériques requis
                    </p>
                  )}
                  {nisuValid && (
                    <p className="text-xs text-success">✓ NISU valide</p>
                  )}
                </div>
              </div>

              {/* Nom + Prénom */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="enroll-lastname"
                    className={FIELD_LABEL_CLASS}
                  >
                    Nom{" "}
                    <span className="text-error" aria-label="obligatoire">
                      *
                    </span>
                  </Label>
                  <Input
                    id="enroll-lastname"
                    type="text"
                    placeholder="PIERRE"
                    value={form.lastName}
                    onChange={set("lastName")}
                    className={INPUT_CLASS}
                    autoCapitalize="characters"
                    required
                    aria-required="true"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="enroll-firstname"
                    className={FIELD_LABEL_CLASS}
                  >
                    Prénom{" "}
                    <span className="text-error" aria-label="obligatoire">
                      *
                    </span>
                  </Label>
                  <Input
                    id="enroll-firstname"
                    type="text"
                    placeholder="Jean"
                    value={form.firstName}
                    onChange={set("firstName")}
                    className={INPUT_CLASS}
                    autoCapitalize="words"
                    required
                    aria-required="true"
                  />
                </div>
              </div>

              {/* Date de naissance */}
              <div className="space-y-1.5">
                <Label htmlFor="enroll-birthdate" className={FIELD_LABEL_CLASS}>
                  Date de naissance{" "}
                  <span className="text-error" aria-label="obligatoire">
                    *
                  </span>
                </Label>
                <Input
                  id="enroll-birthdate"
                  type="date"
                  value={form.birthDate}
                  onChange={set("birthDate")}
                  className={INPUT_CLASS}
                  required
                  aria-required="true"
                />
              </div>
            </div>
          </div>

          {/* ═════════════════ Section Scolarité ═══════════════════════ */}
          <div className="space-y-3">
            <h3 className={SECTION_TITLE_CLASS}>Scolarité</h3>
            <div className="space-y-1.5">
              <Label htmlFor="enroll-class" className={FIELD_LABEL_CLASS}>
                Classe{" "}
                <span className="text-error" aria-label="obligatoire">
                  *
                </span>
              </Label>
              <Select
                value={form.classSessionId}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, classSessionId: v }))
                }
                disabled={loadingClasses}
              >
                <SelectTrigger
                  id="enroll-class"
                  className={INPUT_CLASS}
                  aria-required="true"
                >
                  <SelectValue
                    placeholder={
                      loadingClasses
                        ? "Chargement..."
                        : "Sélectionnez une classe"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {classSessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ═════════════════ Section Contact ═════════════════════════ */}
          <div className="space-y-3">
            <h3 className={SECTION_TITLE_CLASS}>Contact</h3>
            <div className="space-y-3">
              {/* Adresse */}
              <div className="space-y-1.5">
                <Label htmlFor="enroll-address" className={FIELD_LABEL_CLASS}>
                  Adresse
                  <span className={FIELD_HINT_CLASS}>optionnel</span>
                </Label>
                <Input
                  id="enroll-address"
                  type="text"
                  placeholder="123 Rue Principale, Port-au-Prince"
                  value={form.address}
                  onChange={set("address")}
                  className={INPUT_CLASS}
                  autoCapitalize="sentences"
                />
              </div>

              {/* Père + Mère */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="enroll-father-name"
                    className={FIELD_LABEL_CLASS}
                  >
                    Nom du père{" "}
                    <span className="text-error" aria-label="obligatoire">
                      *
                    </span>
                  </Label>
                  <Input
                    id="enroll-father-name"
                    type="text"
                    placeholder="Paul Pierre"
                    value={form.fatherName}
                    onChange={set("fatherName")}
                    className={INPUT_CLASS}
                    autoCapitalize="words"
                    required
                    aria-required="true"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="enroll-mother-name"
                    className={FIELD_LABEL_CLASS}
                  >
                    Nom de la mère{" "}
                    <span className="text-error" aria-label="obligatoire">
                      *
                    </span>
                  </Label>
                  <Input
                    id="enroll-mother-name"
                    type="text"
                    placeholder="Marie Pierre"
                    value={form.motherName}
                    onChange={set("motherName")}
                    className={INPUT_CLASS}
                    autoCapitalize="words"
                    required
                    aria-required="true"
                  />
                </div>
              </div>

              {/* Tel 1 + Tel 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="enroll-phone1" className={FIELD_LABEL_CLASS}>
                    Téléphone 1{" "}
                    <span className="text-error" aria-label="obligatoire">
                      *
                    </span>
                  </Label>
                  <Input
                    id="enroll-phone1"
                    type="tel"
                    inputMode="tel"
                    placeholder="+509 XX XX XXXX"
                    value={form.phone1}
                    onChange={set("phone1")}
                    className={INPUT_CLASS}
                    required
                    aria-required="true"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="enroll-phone2" className={FIELD_LABEL_CLASS}>
                    Téléphone 2
                    <span className={FIELD_HINT_CLASS}>optionnel</span>
                  </Label>
                  <Input
                    id="enroll-phone2"
                    type="tel"
                    inputMode="tel"
                    placeholder="+509 XX XX XXXX"
                    value={form.phone2}
                    onChange={set("phone2")}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="enroll-parents-email"
                  className={FIELD_LABEL_CLASS}
                >
                  Email des parents
                  <span className={FIELD_HINT_CLASS}>optionnel</span>
                </Label>
                <Input
                  id="enroll-parents-email"
                  type="email"
                  inputMode="email"
                  placeholder="parents@example.com"
                  value={form.parentsEmail}
                  onChange={set("parentsEmail")}
                  className={INPUT_CLASS}
                  autoCapitalize="none"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={submitting}
            className="border-neutral-300 text-neutral-600 rounded-lg"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            title={
              !canSubmit && !submitting
                ? "Remplissez tous les champs obligatoires (*)"
                : undefined
            }
            className="bg-primary-800 hover:bg-primary-700 text-white rounded-lg disabled:bg-neutral-400 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <LoaderIcon
                  className="h-4 w-4 mr-2 animate-spin"
                  role="status"
                  aria-label="Inscription en cours"
                />
                Inscription...
              </>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
