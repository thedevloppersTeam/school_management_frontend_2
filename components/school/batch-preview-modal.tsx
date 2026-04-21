"use client"

import { useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { FileTextIcon, CheckCircle2Icon, XCircleIcon, InfoIcon } from "lucide-react"

/**
 * batch-preview-modal.tsx — Aperçu avant génération en lot (WF-003)
 *
 * L'Administrateur voit avant de lancer :
 *   - Combien de bulletins seront générés
 *   - Combien seront exclus (NISU manquant) et pourquoi
 *   - La classe et la période ciblées
 *   - Un avertissement si la période est clôturée (WF-005)
 *
 * Ne lance PAS la génération lui-même — retourne un callback onConfirm
 * que la section bulletins appelle. Évite de dupliquer la logique de génération.
 */

export interface BatchPreviewStudent {
  studentId:    string
  firstname:    string
  lastname:     string
  nisu:         string | null
  enrollmentId: string
}

export interface BatchPreviewModalProps {
  open:         boolean
  onOpenChange: (open: boolean) => void
  className:    string
  stepName:     string
  stepIsClosed: boolean                         // WF-005 : signale période clôturée
  students:     BatchPreviewStudent[]
  isNisuValid:  (nisu: string | null) => boolean
  onConfirm:    () => void | Promise<void>
  loading?:     boolean
}

export function BatchPreviewModal({
  open,
  onOpenChange,
  className,
  stepName,
  stepIsClosed,
  students,
  isNisuValid,
  onConfirm,
  loading = false,
}: BatchPreviewModalProps) {
  const included = useMemo(() => students.filter(s => isNisuValid(s.nisu)), [students, isNisuValid])
  const excluded = useMemo(() => students.filter(s => !isNisuValid(s.nisu)), [students, isNisuValid])

  const canConfirm = included.length > 0 && !loading

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileTextIcon className="h-5 w-5" />
            Aperçu — génération en lot
          </DialogTitle>
          <DialogDescription>
            Vérifiez les bulletins qui vont être générés avant de lancer le processus.
          </DialogDescription>
        </DialogHeader>

        {/* Contexte */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Classe</div>
            <div className="font-semibold">{className}</div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Période</div>
            <div className="font-semibold flex items-center gap-2">
              {stepName}
              {stepIsClosed && (
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                  Clôturée
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Warning clôturée (WF-005) */}
        {stepIsClosed && (
          <Alert className="mt-4 border-amber-300 bg-amber-50 text-amber-900">
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              Cette période est clôturée. Les bulletins générés seront marqués comme
              <strong> corrections</strong> et remplaceront les versions précédentes
              dans les archives (les versions anciennes restent accessibles dans l&apos;historique).
            </AlertDescription>
          </Alert>
        )}

        {/* KPI inclusion / exclusion */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-lg border bg-emerald-50 border-emerald-200 p-3">
            <div className="flex items-center gap-2 text-emerald-800">
              <CheckCircle2Icon className="h-4 w-4" />
              <div>
                <div className="text-2xl font-bold tabular-nums">{included.length}</div>
                <div className="text-xs">Bulletins à générer</div>
              </div>
            </div>
          </div>
          <div className={`rounded-lg border p-3 ${excluded.length > 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
            <div className="flex items-center gap-2">
              <XCircleIcon className="h-4 w-4" />
              <div>
                <div className="text-2xl font-bold tabular-nums">{excluded.length}</div>
                <div className="text-xs">Élèves exclus (NISU manquant)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Liste des exclus (si y en a) */}
        {excluded.length > 0 && (
          <div className="mt-4 rounded-lg border overflow-hidden">
            <div className="bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 border-b border-red-200">
              Élèves exclus — NISU manquant ou invalide
            </div>
            <div className="max-h-40 overflow-y-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Élèves exclus de la génération</caption>
                <tbody>
                  {excluded.map((s) => (
                    <tr key={s.studentId} className="border-t">
                      <td className="px-4 py-1.5">
                        {s.lastname} {s.firstname}
                      </td>
                      <td className="px-4 py-1.5 text-xs text-muted-foreground">
                        NISU : {s.nisu || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-muted px-4 py-2 text-xs text-muted-foreground border-t">
              Renseignez le NISU (12 chiffres — DR-001) dans la fiche élève avant de regénérer.
            </div>
          </div>
        )}

        {/* Cas impossible */}
        {included.length === 0 && (
          <Alert className="mt-4 border-red-300 bg-red-50 text-red-900">
            <XCircleIcon className="h-4 w-4" />
            <AlertDescription>
              Aucun bulletin ne peut être généré. Tous les élèves de cette classe
              ont un NISU manquant ou invalide. Corrigez les fiches élèves avant
              de relancer la génération.
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={onConfirm} disabled={!canConfirm}>
            {loading ? "Génération en cours..." : `Générer ${included.length} bulletin${included.length > 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}