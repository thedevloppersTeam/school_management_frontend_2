"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"

/**
 * audit-note-modal.tsx — Capture de motif pour génération post-clôture (WF-005)
 *
 * Contexte REQ-F-010 : après clôture d'une période, la régénération d'un
 * bulletin crée une NOUVELLE VERSION archivée. La version précédente reste
 * accessible dans l'historique mais le flux doit être tracé (qui, quand,
 * pourquoi).
 *
 * Ce modal demande :
 *   1. Un motif standardisé (Select) pour statistiques + catégorisation
 *   2. Une note libre (Textarea) pour le détail humain
 *
 * La note est ensuite passée au backend via archiveBulletin() dans le champ
 * auditNote. Elle apparaîtra dans la vue "Historique" de la page Archives.
 */

export const AUDIT_REASONS = [
  { value: "correction_note",       label: "Correction d'une note saisie" },
  { value: "correction_nisu",       label: "Correction du NISU d'un élève" },
  { value: "correction_identite",   label: "Correction d'identité élève (nom, prénom, photo)" },
  { value: "ajustement_coefficient",label: "Ajustement d'un coefficient de matière" },
  { value: "ajout_matiere",         label: "Ajout d'une matière manquante" },
  { value: "erreur_calcul",         label: "Correction d'une erreur de calcul" },
  { value: "autre",                 label: "Autre (précisez ci-dessous)" },
] as const

export type AuditReason = typeof AUDIT_REASONS[number]['value']

export interface AuditNoteModalProps {
  open:         boolean
  onOpenChange: (open: boolean) => void
  stepName:     string  // Ex: "Période 1"
  periodName?:  string  // Ex: "Année 2025-2026 — Période 1"
  onConfirm:    (payload: { reason: AuditReason; note: string }) => void | Promise<void>
  loading?:     boolean
}

export function AuditNoteModal({
  open,
  onOpenChange,
  stepName,
  periodName,
  onConfirm,
  loading = false,
}: AuditNoteModalProps) {
  const [reason, setReason] = useState<AuditReason | null>(null)
  const [note, setNote]     = useState("")

  // Reset à chaque ouverture
  useEffect(() => {
    if (open) {
      setReason(null)
      setNote("")
    }
  }, [open])

  const noteTrimmed = note.trim()
  const canConfirm =
    reason !== null &&
    noteTrimmed.length >= 10 && // force un minimum de texte (pas "ok", "test", "zz")
    !loading

  const handleConfirm = async () => {
    if (!canConfirm || reason === null) return
    await onConfirm({ reason, note: noteTrimmed })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Motif de correction post-clôture</DialogTitle>
          <DialogDescription>
            {stepName} est clôturée. Cette génération créera une nouvelle version
            archivée du bulletin. Précisez la raison pour traçabilité (REQ-F-010).
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            Cette note sera visible dans l&apos;historique du bulletin
            {periodName && <> pour <strong>{periodName}</strong></>} et
            tracée avec votre identifiant et la date.
          </AlertDescription>
        </Alert>

        <div className="space-y-2 mt-4">
          <Label htmlFor="audit-reason">Motif *</Label>
          <Select
            value={reason ?? ""}
            onValueChange={(v) => setReason(v as AuditReason)}
          >
            <SelectTrigger id="audit-reason">
              <SelectValue placeholder="Sélectionnez un motif" />
            </SelectTrigger>
            <SelectContent>
              {AUDIT_REASONS.map(r => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 mt-2">
          <Label htmlFor="audit-note">Détail de la correction *</Label>
          <Textarea
            id="audit-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex: Correction de la note de Mathématiques de Pierre Durand (10.5 au lieu de 1.5 suite à erreur de saisie)"
            rows={4}
            maxLength={500}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Minimum 10 caractères pour traçabilité</span>
            <span>{noteTrimmed.length}/500</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {loading ? "Enregistrement..." : "Valider et générer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}