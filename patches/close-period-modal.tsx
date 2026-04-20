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
import { AlertTriangleIcon, CheckCircle2Icon, ExternalLinkIcon } from "lucide-react"

interface ClassroomGradeStatus {
  className:     string
  classroomName: string
  sessionId?:    string  // pour générer le lien direct vers la saisie
  gradesEntered: number
  totalGrades:   number
  status:        'complete' | 'incomplete' | 'not-started'
}

interface ClosePeriodModalProps {
  periodName:        string
  periodId:          string
  classroomStatuses: ClassroomGradeStatus[]
  yearId:            string
  onConfirm?:        (periodId: string) => void
  trigger?:          React.ReactNode
  open?:             boolean
  onOpenChange?:     (open: boolean) => void
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
}: ClosePeriodModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [ackIncomplete, setAckIncomplete] = useState(false)

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) setAckIncomplete(false) // reset à la fermeture
    if (onOpenChange) onOpenChange(newOpen)
    else setIsOpen(newOpen)
  }

  const currentOpen = open !== undefined ? open : isOpen

  const incompleteCount = classroomStatuses.filter(
    c => c.status === 'incomplete' || c.status === 'not-started'
  ).length

  const completeCount = classroomStatuses.filter(c => c.status === 'complete').length
  const missingGradesTotal = classroomStatuses.reduce(
    (sum, c) => sum + (c.totalGrades - c.gradesEntered), 0
  )

  const isComplete = incompleteCount === 0
  const canConfirm = isComplete || ackIncomplete

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm?.(periodId)
    handleOpenChange(false)
  }

  // Formatage du nom de salle selon le niveau
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Clôturer la {periodName}</DialogTitle>
          <DialogDescription>
            Après clôture, les notes ne pourront plus être modifiées sauf via
            une correction contrôlée (qui créera une nouvelle version).
          </DialogDescription>
        </DialogHeader>

        {/* Synthèse globale */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="rounded-lg border bg-emerald-50 p-3 text-center">
            <div className="text-2xl font-bold text-emerald-700">{completeCount}</div>
            <div className="text-xs text-emerald-900 mt-0.5">Classes complètes</div>
          </div>
          <div className="rounded-lg border bg-amber-50 p-3 text-center">
            <div className="text-2xl font-bold text-amber-700">{incompleteCount}</div>
            <div className="text-xs text-amber-900 mt-0.5">Classes incomplètes</div>
          </div>
          <div className="rounded-lg border bg-slate-50 p-3 text-center">
            <div className="text-2xl font-bold text-slate-700">{missingGradesTotal}</div>
            <div className="text-xs text-slate-900 mt-0.5">Notes manquantes</div>
          </div>
        </div>

        {/* Tableau détaillé */}
        <div className="mt-4 rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr className="text-left">
                <th className="px-4 py-2 font-semibold">Classe</th>
                <th className="px-4 py-2 font-semibold">Salle</th>
                <th className="px-4 py-2 font-semibold">Notes</th>
                <th className="px-4 py-2 font-semibold">Statut</th>
                <th className="px-4 py-2 font-semibold text-right">Action</th>
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

        {/* Warning + confirmation explicite si incomplet */}
        {!isComplete && (
          <Alert className="mt-4 border-amber-300 bg-amber-50 text-amber-900">
            <AlertTriangleIcon className="h-4 w-4" />
            <AlertTitle>Données incomplètes</AlertTitle>
            <AlertDescription className="space-y-3 mt-2">
              <p>
                {incompleteCount} classe{incompleteCount > 1 ? 's ont' : ' a'} des
                notes manquantes ({missingGradesTotal} notes au total).
                La clôture avec des données incomplètes doit être **validée
                par la direction**.
              </p>
              <p className="text-xs">
                <strong>Règle actuelle :</strong> les élèves sans note dans une
                matière seront exclus du calcul pour cette matière. Cette règle
                doit être confirmée par la direction avant la première clôture.
              </p>
              <label className="flex items-start gap-2 cursor-pointer pt-1">
                <Checkbox
                  checked={ackIncomplete}
                  onCheckedChange={(v) => setAckIncomplete(v === true)}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  Je confirme ce choix malgré les {missingGradesTotal} notes
                  manquantes et assume la responsabilité de cette clôture
                  incomplète.
                </span>
              </label>
            </AlertDescription>
          </Alert>
        )}

        {/* Confirmation positive si tout est complet */}
        {isComplete && (
          <Alert className="mt-4 border-emerald-300 bg-emerald-50 text-emerald-900">
            <CheckCircle2Icon className="h-4 w-4" />
            <AlertTitle>Prêt à clôturer</AlertTitle>
            <AlertDescription>
              Toutes les classes ont leurs notes saisies. La clôture est sûre.
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            variant={isComplete ? "default" : "destructive"}
          >
            {isComplete ? "Clôturer" : "Clôturer malgré tout"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
