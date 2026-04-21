"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangleIcon, CheckCircle2Icon, ExternalLinkIcon } from "lucide-react"

/**
 * close-period-modal.tsx — VERSION FINALE (Groupe B)
 *
 * Corrections appliquées :
 *   - WF-001 / EP-002 : désactive le bouton tant que la confirmation n'est pas explicite
 *   - WF-002 : checklist élargie (notes manquantes + NISU manquants + matières non mappées)
 *   - Typed-name : exige de taper le nom de la période pour confirmer
 *   - AI-002 : styles Tailwind / shadcn au lieu de styles inline
 *   - AI-003 : <caption> + scope="col" sur la table
 *
 * Le typed-name est TOUJOURS exigé pour une clôture (action irréversible
 * affectant toute la base d'élèves).
 */

interface ClassroomGradeStatus {
  className:           string
  classroomName:       string
  sessionId?:          string  // pour générer le lien direct vers la saisie
  gradesEntered:       number
  totalGrades:         number
  studentsWithoutNisu: number  // WF-002 : comptage des NISU manquants (DR-001)
  unmappedSubjects:    number  // WF-002 : matières sans rubrique (DR-003)
  status:              'complete' | 'incomplete' | 'not-started'
}

interface ClosePeriodModalProps {
  periodName:        string
  periodId:          string
  classroomStatuses: ClassroomGradeStatus[]
  yearId:            string
  onConfirm?:        (periodId: string) => void | Promise<void>
  trigger?:          React.ReactNode
  open?:             boolean
  onOpenChange?:     (open: boolean) => void
  loading?:          boolean
}

export function ClosePeriodModal({
  periodName,
  periodId,
  classroomStatuses,
  yearId,
  onConfirm,
  trigger,
  open,
  onOpenChange,
  loading = false,
}: ClosePeriodModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [ackIncomplete, setAckIncomplete] = useState(false)
  const [typedName, setTypedName] = useState("")

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset à la fermeture
      setAckIncomplete(false)
      setTypedName("")
    }
    if (onOpenChange) onOpenChange(newOpen)
    else setIsOpen(newOpen)
  }

  const currentOpen = open !== undefined ? open : isOpen

  // Synthèse quantifiée (WF-002)
  const incompleteCount = classroomStatuses.filter(
    c => c.status === 'incomplete' || c.status === 'not-started'
  ).length
  const completeCount = classroomStatuses.filter(c => c.status === 'complete').length
  const missingGradesTotal = classroomStatuses.reduce(
    (sum, c) => sum + (c.totalGrades - c.gradesEntered), 0
  )
  const missingNisuTotal = classroomStatuses.reduce(
    (sum, c) => sum + (c.studentsWithoutNisu || 0), 0
  )
  const unmappedSubjectsTotal = classroomStatuses.reduce(
    (sum, c) => sum + (c.unmappedSubjects || 0), 0
  )

  // Prêt-à-clôturer = pas de notes manquantes ET pas de NISU manquants ET pas de matières non mappées
  const isComplete =
    incompleteCount === 0 && missingNisuTotal === 0 && unmappedSubjectsTotal === 0

  // Confirmation typed-name (TOUJOURS pour une clôture)
  const typedMatches = typedName.trim() === periodName.trim()

  // Le bouton s'active si :
  // - typed-name correct ET
  // - (tout est complet OU la case "je confirme malgré tout" est cochée)
  const canConfirm = typedMatches && (isComplete || ackIncomplete) && !loading

  const handleConfirm = async () => {
    if (!canConfirm) return
    await onConfirm?.(periodId)
    handleOpenChange(false)
  }

  const formatClassroomName = (className: string, classroomName: string) => {
    const isFondamentale = ['7e', '8e', '9e'].includes(className)
    if (isFondamentale && classroomName.startsWith('Salle ')) {
      return classroomName.replace('Salle ', '')
    }
    return classroomName
  }

  return (
    <Dialog open={currentOpen} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="h-5 w-5 text-destructive" />
            Clôturer {periodName}
          </DialogTitle>
          <DialogDescription>
            Après clôture, les notes ne pourront plus être modifiées sauf via
            une correction contrôlée (qui créera une nouvelle version du bulletin).
          </DialogDescription>
        </DialogHeader>

        {/* Synthèse en 4 KPI (WF-002) */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          <KpiCard value={completeCount} label="Classes complètes" tone="success" />
          <KpiCard value={incompleteCount} label="Classes incomplètes" tone="warning" />
          <KpiCard value={missingNisuTotal} label="NISU manquants" tone={missingNisuTotal > 0 ? "error" : "neutral"} />
          <KpiCard value={unmappedSubjectsTotal} label="Matières non mappées" tone={unmappedSubjectsTotal > 0 ? "error" : "neutral"} />
        </div>

        {/* Tableau détaillé */}
        <div className="mt-4 rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <caption className="sr-only">
              État de saisie des notes par classe pour {periodName}
            </caption>
            <thead className="bg-muted">
              <tr className="text-left">
                <th scope="col" className="px-4 py-2 font-semibold">Classe</th>
                <th scope="col" className="px-4 py-2 font-semibold">Salle</th>
                <th scope="col" className="px-4 py-2 font-semibold">Notes</th>
                <th scope="col" className="px-4 py-2 font-semibold">Statut</th>
                <th scope="col" className="px-4 py-2 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {classroomStatuses.map((cr) => (
                <tr
                  key={`${cr.className}-${cr.classroomName}`}
                  className="border-t"
                >
                  <td className="px-4 py-2 font-medium">{cr.className}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {formatClassroomName(cr.className, cr.classroomName)}
                  </td>
                  <td className="px-4 py-2 tabular-nums">
                    {cr.gradesEntered}/{cr.totalGrades}
                  </td>
                  <td className="px-4 py-2">
                    {cr.status === 'complete' && (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                        <CheckCircle2Icon className="mr-1 h-3 w-3" /> Complet
                      </Badge>
                    )}
                    {cr.status === 'incomplete' && (
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                        Incomplet
                      </Badge>
                    )}
                    {cr.status === 'not-started' && (
                      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                        Non commencé
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {cr.status !== 'complete' && cr.sessionId && (
                      <Link
                        href={`/admin/academic-year/${yearId}/grades?sessionId=${cr.sessionId}`}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Saisir <ExternalLinkIcon className="h-3 w-3" />
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Warnings détaillés */}
        {!isComplete && (
          <Alert className="mt-4 border-amber-300 bg-amber-50 text-amber-900">
            <AlertTriangleIcon className="h-4 w-4" />
            <AlertTitle>Données incomplètes</AlertTitle>
            <AlertDescription className="space-y-2 mt-2">
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {incompleteCount > 0 && (
                  <li>
                    <strong>{incompleteCount}</strong> classe{incompleteCount > 1 ? 's ont' : ' a'} des notes manquantes
                    ({missingGradesTotal} notes au total).
                  </li>
                )}
                {missingNisuTotal > 0 && (
                  <li>
                    <strong>{missingNisuTotal}</strong> élève{missingNisuTotal > 1 ? 's ont' : ' a'} un NISU manquant
                    — ces élèves seront exclus des bulletins archivés (DR-001).
                  </li>
                )}
                {unmappedSubjectsTotal > 0 && (
                  <li>
                    <strong>{unmappedSubjectsTotal}</strong> matière{unmappedSubjectsTotal > 1 ? 's ne sont' : ' n&apos;est'} pas associée{unmappedSubjectsTotal > 1 ? 's' : ''} à
                    une rubrique (R1, R2, R3) — ces matières n&apos;apparaîtront pas sur les bulletins (DR-003).
                  </li>
                )}
              </ul>
              <p className="text-xs italic pt-2">
                Règle actuelle : les élèves sans note dans une matière seront exclus
                du calcul pour cette matière. Cette règle doit être validée par la direction.
              </p>
              <label className="flex items-start gap-2 cursor-pointer pt-2">
                <Checkbox
                  checked={ackIncomplete}
                  onCheckedChange={(v) => setAckIncomplete(v === true)}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  Je confirme ce choix malgré les données incomplètes et j&apos;assume la
                  responsabilité de cette clôture.
                </span>
              </label>
            </AlertDescription>
          </Alert>
        )}

        {isComplete && (
          <Alert className="mt-4 border-emerald-300 bg-emerald-50 text-emerald-900">
            <CheckCircle2Icon className="h-4 w-4" />
            <AlertTitle>Prêt à clôturer</AlertTitle>
            <AlertDescription>
              Toutes les classes ont leurs notes saisies, les NISU sont renseignés
              et toutes les matières sont mappées. La clôture est sûre.
            </AlertDescription>
          </Alert>
        )}

        {/* Typed-name (TOUJOURS requis pour une clôture) */}
        <div className="space-y-2 mt-4">
          <Label htmlFor="confirm-period-name" className="text-sm">
            Pour confirmer la clôture, saisissez{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {periodName}
            </code>{" "}
            ci-dessous :
          </Label>
          <Input
            id="confirm-period-name"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={periodName}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            variant="destructive"
          >
            {loading ? "Clôture en cours..." : "Clôturer définitivement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Sous-composant KPI ─────────────────────────────────────────────────

function KpiCard({
  value,
  label,
  tone,
}: {
  value: number
  label: string
  tone: 'success' | 'warning' | 'error' | 'neutral'
}) {
  const toneClasses = {
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    error:   "bg-red-50 border-red-200 text-red-800",
    neutral: "bg-slate-50 border-slate-200 text-slate-800",
  }[tone]

  return (
    <div className={`rounded-lg border p-3 text-center ${toneClasses}`}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-[10px] mt-0.5 leading-tight">{label}</div>
    </div>
  )
}