"use client"

import { useEffect, useRef, useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CameraIcon, ImageIcon, UploadIcon, UserIcon } from "lucide-react"
import { toMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"
import { normalizeUploadUrl } from "@/lib/upload-url"

interface PromotionPhotoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentId: string
  studentName: string
  studentCode: string
  academicYearId: string
  academicYearName: string
  currentPhotoUrl?: string | null
  onUploaded?: (newPhotoUrl: string) => void
}

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB (matches backend)
const ALLOWED = ["image/jpeg", "image/png", "image/webp"]

export function PromotionPhotoModal({
  open,
  onOpenChange,
  studentId,
  studentName,
  studentCode,
  academicYearId,
  academicYearName,
  currentPhotoUrl,
  onUploaded,
}: PromotionPhotoModalProps) {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setFile(null)
      setPreviewUrl(null)
      setSubmitting(false)
    }
  }, [open])

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!ALLOWED.includes(f.type)) {
      toast({
        title: "Format non supporté",
        description: "Acceptés : JPG, PNG, WEBP.",
        variant: "destructive",
      })
      e.target.value = ""
      return
    }
    if (f.size > MAX_BYTES) {
      toast({
        title: "Fichier trop volumineux",
        description: "Maximum 5 Mo.",
        variant: "destructive",
      })
      e.target.value = ""
      return
    }
    setFile(f)
  }

  async function handleSubmit() {
    if (!file) return
    setSubmitting(true)
    try {
      const form = new FormData()
      form.append("photo", file)
      form.append("studentId", studentId)
      form.append("academicYearId", academicYearId)

      const res = await fetch("/api/promotion-photos/upload", {
        method: "POST",
        credentials: "include",
        body: form,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.message || `Échec de l'envoi (HTTP ${res.status})`)
      }

      toast({ title: "Photo de promotion enregistrée" })
      if (data?.photo?.photoUrl) onUploaded?.(data.photo.photoUrl)
      onOpenChange(false)
    } catch (err) {
      toast({
        title: "Erreur",
        description: toMessage(err),
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Local previews (object URLs) are passed through; saved URLs may be
  // legacy absolute paths and need normalization for the rewrite to kick in.
  const displayedUrl = previewUrl ?? normalizeUploadUrl(currentPhotoUrl) ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CameraIcon className="h-5 w-5 text-[#2C4A6E]" />
            Photo de promotion
          </DialogTitle>
          <DialogDescription>
            {studentName} <code className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{studentCode}</code>
            <span className="ml-2 text-xs">— année {academicYearName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className={cn(
              "relative flex h-48 w-full items-center justify-center overflow-hidden rounded-md border-2 border-dashed bg-muted/30",
              displayedUrl && "border-solid"
            )}
          >
            {displayedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayedUrl}
                alt={`Photo de promotion de ${studentName}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <ImageIcon className="h-10 w-10 opacity-60" />
                <p className="text-xs">Aucune photo pour cette année</p>
              </div>
            )}
            {previewUrl && (
              <span className="absolute right-2 top-2 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                Aperçu
              </span>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="promotion-photo-file" className="text-sm font-medium">
              {currentPhotoUrl ? "Remplacer la photo" : "Choisir une photo"}
            </Label>
            <input
              ref={fileRef}
              id="promotion-photo-file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePick}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-[#2C4A6E] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#1F3856] file:cursor-pointer"
            />
            <p className="text-[11px] text-muted-foreground">
              JPG, PNG ou WEBP &middot; 5 Mo max
            </p>
          </div>

          {file && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs">
              <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium text-foreground">{file.name}</span>
              <span className="text-muted-foreground">
                ({(file.size / 1024).toFixed(0)} Ko)
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!file || submitting}
            className="bg-[#2C4A6E] text-white hover:bg-[#1F3856]"
          >
            {submitting ? (
              "Envoi..."
            ) : (
              <>
                <UploadIcon className="mr-2 h-4 w-4" />
                Enregistrer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
