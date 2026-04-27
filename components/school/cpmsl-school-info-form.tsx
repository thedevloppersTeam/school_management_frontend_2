"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { UploadIcon, SaveIcon } from "lucide-react";

interface SchoolInfo {
  name: string;
  motto?: string;
  foundedYear?: number;
  logo?: string;
  address?: string;
  phone?: string;
  email?: string;
}

interface CPMSLSchoolInfoFormProps {
  schoolInfo: SchoolInfo;
  onSave: (info: SchoolInfo) => void | Promise<void>;
  loading?: boolean;
}

export function CPMSLSchoolInfoForm({
  schoolInfo,
  onSave,
  loading = false,
}: CPMSLSchoolInfoFormProps) {
  const [editedInfo, setEditedInfo] = useState<SchoolInfo>(schoolInfo);
  const [saving, setSaving] = useState(false);

  // Sync quand les données arrivent depuis l'API
  useEffect(() => {
    setEditedInfo(schoolInfo);
  }, [schoolInfo]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () =>
      setEditedInfo((prev) => ({ ...prev, logo: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(editedInfo);
    } finally {
      setSaving(false);
    }
  };

  const isSaveDisabled = saving || !editedInfo.name.trim();

  // ── Skeleton pendant le chargement ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm">
          <div className="p-6 border-b border-neutral-200">
            <Skeleton className="h-6 w-48" />
          </div>
          <div className="p-6 space-y-5">
            <Skeleton className="h-24 w-24 rounded-xl" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-1/4" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm">
          <div className="p-6 border-b border-neutral-200">
            <Skeleton className="h-6 w-40" />
          </div>
          <div className="p-6 space-y-5">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Card 1 — Identité ────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm">
        <div className="p-6 border-b border-neutral-200">
          <h3 className="font-serif text-lg font-semibold text-primary-800 border-l-[3px] border-primary-800 pl-3 mb-2">
            Identité de l&apos;école
          </h3>
          <p className="font-sans text-sm text-muted-foreground pl-[15px]">
            Informations d&apos;identification de l&apos;établissement
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Logo */}
          <div className="space-y-2">
            <Label
              htmlFor="logo-upload"
              className="text-sm font-medium text-neutral-900"
            >
              Logo
            </Label>
            <div className="flex items-center gap-4 w-[60%]">
              <Avatar className="h-24 w-24 rounded-xl">
                {editedInfo.logo ? (
                  <AvatarImage
                    src={editedInfo.logo}
                    alt="Logo de l'école"
                    className="object-cover"
                  />
                ) : (
                  <AvatarFallback className="rounded-xl text-xl font-bold bg-primary-50 text-primary-500">
                    SL
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1">
                <label
                  htmlFor="logo-upload"
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-primary-200 cursor-pointer hover:bg-primary-50 focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2"
                >
                  <UploadIcon
                    className="h-4 w-4 text-neutral-500"
                    aria-hidden="true"
                  />
                  <span className="text-sm text-neutral-500">
                    Télécharger un logo
                  </span>
                </label>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleLogoUpload}
                  className="sr-only"
                />
                <p className="text-xs text-neutral-600 mt-1">
                  PNG ou JPG, max 2 Mo
                </p>
              </div>
            </div>
          </div>

          {/* Nom */}
          <div className="space-y-2">
            <Label
              htmlFor="school-name"
              className="text-sm font-medium text-neutral-900"
            >
              Nom de l&apos;école{" "}
              <span className="text-error" aria-label="obligatoire">
                *
              </span>
            </Label>
            <Input
              id="school-name"
              value={editedInfo.name}
              onChange={(e) =>
                setEditedInfo((prev) => ({ ...prev, name: e.target.value }))
              }
              required
              aria-required="true"
              className="border-neutral-300 rounded-lg"
            />
          </div>

          {/* Devise */}
          <div className="space-y-2">
            <Label
              htmlFor="school-motto"
              className="text-sm font-medium text-neutral-900"
            >
              Devise
            </Label>
            <Input
              id="school-motto"
              value={editedInfo.motto || ""}
              onChange={(e) =>
                setEditedInfo((prev) => ({ ...prev, motto: e.target.value }))
              }
              placeholder="Ex: L'excellence avant tout"
              className="border-neutral-300 rounded-lg"
            />
          </div>

          {/* Fondée en */}
          <div className="space-y-2 w-1/4">
            <Label
              htmlFor="school-founded"
              className="text-sm font-medium text-neutral-900"
            >
              Fondée en
            </Label>
            <Input
              id="school-founded"
              type="number"
              value={editedInfo.foundedYear || ""}
              onChange={(e) =>
                setEditedInfo((prev) => ({
                  ...prev,
                  foundedYear: parseInt(e.target.value) || undefined,
                }))
              }
              className="border-neutral-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* ── Card 2 — Coordonnées ─────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm">
        <div className="p-6 border-b border-neutral-200">
          <h3 className="font-serif text-lg font-semibold text-primary-800 border-l-[3px] border-primary-800 pl-3 mb-2">
            Coordonnées
          </h3>
          <p className="font-sans text-sm text-muted-foreground pl-[15px]">
            Informations de contact de l&apos;établissement
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Adresse */}
          <div className="space-y-2">
            <Label
              htmlFor="school-address"
              className="text-sm font-medium text-neutral-900"
            >
              Adresse complète
            </Label>
            <Textarea
              id="school-address"
              value={editedInfo.address || ""}
              onChange={(e) =>
                setEditedInfo((prev) => ({ ...prev, address: e.target.value }))
              }
              rows={2}
              className="resize-none border-neutral-300 rounded-lg"
            />
          </div>

          {/* Téléphone */}
          <div className="space-y-2">
            <Label
              htmlFor="school-phone"
              className="text-sm font-medium text-neutral-900"
            >
              Téléphone
            </Label>
            <Input
              id="school-phone"
              type="tel"
              value={editedInfo.phone || ""}
              onChange={(e) =>
                setEditedInfo((prev) => ({ ...prev, phone: e.target.value }))
              }
              className="border-neutral-300 rounded-lg"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label
              htmlFor="school-email"
              className="text-sm font-medium text-neutral-900"
            >
              Email
            </Label>
            <Input
              id="school-email"
              type="email"
              value={editedInfo.email || ""}
              onChange={(e) =>
                setEditedInfo((prev) => ({ ...prev, email: e.target.value }))
              }
              className="border-neutral-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* ── Bouton Enregistrer ─────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaveDisabled}
          title={
            isSaveDisabled && !saving
              ? "Le nom de l'école est obligatoire"
              : undefined
          }
          className="bg-primary-800 hover:bg-primary-700 text-white rounded-lg px-6 flex items-center gap-2 disabled:bg-neutral-400 disabled:cursor-not-allowed"
        >
          {saving ? (
            <div
              className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"
              role="status"
              aria-label="Enregistrement en cours"
            />
          ) : (
            <SaveIcon className="h-4 w-4" aria-hidden="true" />
          )}
          {saving ? "Enregistrement..." : "Enregistrer les modifications"}
        </Button>
      </div>
    </div>
  );
}
