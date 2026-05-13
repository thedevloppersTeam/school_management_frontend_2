"use client"

import { useEffect, useRef, useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { UploadIcon, SaveIcon, BuildingIcon, ContactIcon, ImageOffIcon, Loader2Icon } from "lucide-react"
import { toMessage } from "@/lib/errors"

interface SchoolInfo {
  name: string
  motto?: string
  foundedYear?: number
  logo?: string
  address?: string
  phone?: string
  email?: string
}

interface CPMSLSchoolInfoFormProps {
  schoolInfo: SchoolInfo
  onSave: (info: SchoolInfo) => void | Promise<void>
  loading?: boolean
}

const ALLOWED_LOGO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"]
const MAX_LOGO_BYTES = 2 * 1024 * 1024

export function CPMSLSchoolInfoForm({ schoolInfo, onSave, loading = false }: CPMSLSchoolInfoFormProps) {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [editedInfo, setEditedInfo] = useState<SchoolInfo>(schoolInfo)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setEditedInfo(schoolInfo)
  }, [schoolInfo])

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      toast({
        title: "Format non supporté",
        description: "Acceptés : PNG, JPG, WEBP, SVG.",
        variant: "destructive",
      })
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast({
        title: "Fichier trop volumineux",
        description: "Maximum 2 Mo.",
        variant: "destructive",
      })
      return
    }

    setUploadingLogo(true)
    try {
      const form = new FormData()
      form.append("logo", file)
      const res = await fetch("/api/school-info/upload-logo", {
        method: "POST",
        credentials: "include",
        body: form,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.message || `Échec de l'envoi (HTTP ${res.status})`)
      }
      if (data?.logoUrl) {
        setEditedInfo((prev) => ({ ...prev, logo: data.logoUrl }))
        toast({ title: "Logo enregistré" })
      }
    } catch (err) {
      toast({
        title: "Erreur",
        description: toMessage(err),
        variant: "destructive",
      })
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(editedInfo)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    )
  }

  const initials = (editedInfo.name || "École").trim().slice(0, 2).toUpperCase()

  return (
    <div className="space-y-6">
      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <BuildingIcon className="h-4 w-4 text-[#2C4A6E]" />
            Identité de l&apos;école
          </CardTitle>
          <CardDescription>Informations d&apos;identification de l&apos;établissement</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-5 p-6">
          {/* Logo */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Logo</Label>
            <div className="flex items-center gap-4">
              <Avatar className="h-24 w-24 rounded-xl ring-1 ring-border">
                {editedInfo.logo ? (
                  <AvatarImage src={editedInfo.logo} alt="Logo" className="object-cover" />
                ) : (
                  <AvatarFallback className="rounded-xl bg-muted text-xl font-bold text-muted-foreground">
                    {initials || <ImageOffIcon className="h-8 w-8" />}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1 space-y-1">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingLogo}
                  className="inline-flex items-center gap-2 rounded-md border-2 border-dashed border-border bg-background px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-[#2C4A6E] hover:bg-muted/30 disabled:opacity-60"
                >
                  {uploadingLogo ? (
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                  ) : (
                    <UploadIcon className="h-4 w-4" />
                  )}
                  {uploadingLogo ? "Envoi du logo..." : editedInfo.logo ? "Remplacer le logo" : "Télécharger un logo"}
                </button>
                <input
                  ref={fileRef}
                  id="logo-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  onChange={handleLogoFile}
                  className="hidden"
                />
                <p className="text-[11px] text-muted-foreground">
                  PNG, JPG, WEBP ou SVG &middot; 2 Mo max
                </p>
              </div>
            </div>
          </div>

          {/* Nom */}
          <div className="space-y-2">
            <Label htmlFor="school-name" className="text-sm font-medium">
              Nom de l&apos;école <span className="text-destructive">*</span>
            </Label>
            <Input
              id="school-name"
              value={editedInfo.name}
              onChange={(e) => setEditedInfo((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          {/* Devise */}
          <div className="space-y-2">
            <Label htmlFor="school-motto" className="text-sm font-medium">
              Devise
            </Label>
            <Input
              id="school-motto"
              value={editedInfo.motto || ""}
              onChange={(e) => setEditedInfo((prev) => ({ ...prev, motto: e.target.value }))}
              placeholder="Ex: L'excellence avant tout"
            />
          </div>

          {/* Fondée en */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="school-founded" className="text-sm font-medium">
                Fondée en
              </Label>
              <Input
                id="school-founded"
                type="number"
                min="1800"
                max={new Date().getFullYear()}
                value={editedInfo.foundedYear ?? ""}
                onChange={(e) =>
                  setEditedInfo((prev) => ({
                    ...prev,
                    foundedYear: e.target.value ? parseInt(e.target.value) : undefined,
                  }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ContactIcon className="h-4 w-4 text-[#2C4A6E]" />
            Coordonnées
          </CardTitle>
          <CardDescription>Informations de contact de l&apos;établissement</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-5 p-6">
          <div className="space-y-2">
            <Label htmlFor="school-address" className="text-sm font-medium">
              Adresse complète
            </Label>
            <Textarea
              id="school-address"
              value={editedInfo.address || ""}
              onChange={(e) => setEditedInfo((prev) => ({ ...prev, address: e.target.value }))}
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="school-phone" className="text-sm font-medium">
                Téléphone
              </Label>
              <Input
                id="school-phone"
                type="tel"
                value={editedInfo.phone || ""}
                onChange={(e) => setEditedInfo((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="school-email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="school-email"
                type="email"
                value={editedInfo.email || ""}
                onChange={(e) => setEditedInfo((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving || !editedInfo.name.trim()}
          className="bg-[#2C4A6E] text-white hover:bg-[#1F3856]"
        >
          {saving ? (
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <SaveIcon className="mr-2 h-4 w-4" />
          )}
          {saving ? "Enregistrement..." : "Enregistrer les modifications"}
        </Button>
      </div>
    </div>
  )
}
