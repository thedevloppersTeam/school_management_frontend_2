"use client"

import { useState, useEffect } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangleIcon } from "lucide-react"

/**
 * Confirmation destructive réutilisable.
 *
 * Trois modes :
 *  - typed-name = true → exige que l'Administrateur tape exactement
 *    `confirmationName` avant d'activer le bouton destructif
 *  - typed-name = false → bouton actif immédiatement (simple clic)
 *  - Auto (par défaut) → typed-name requis si impactCount > 0
 *
 * Règle d'architecte (par défaut auto) :
 *  - Supprimer une entité SANS impact (0 élève, 0 enfant) → simple clic
 *  - Supprimer une entité AVEC impact (N élèves, N enfants) → typed-name
 *  - Clôture / activation année → TOUJOURS typed-name (forcer requireTypedName=true)
 *
 * Utilise AlertDialog Radix (focus-trap, escape, aria) via shadcn.
 */

export interface ConfirmDestructiveProps {
  /** Contrôle open/close depuis le parent */
  open: boolean
  onOpenChange: (open: boolean) => void

  /** Titre du dialog */
  title: string

  /** Description courte (1-2 phrases) */
  description?: string

  /**
   * Nom à taper pour confirmer (souvent le nom de l'entité à supprimer).
   * Si undefined ou vide, pas de typed-name même avec requireTypedName=true.
   */
  confirmationName?: string

  /**
   * Nombre d'entités impactées (élèves, bulletins, matières…).
   * Si > 0 ET requireTypedName='auto' ET confirmationName défini,
   * le typed-name est exigé.
   */
  impactCount?: number

  /**
   * Libellé de l'impact (ex: "élève", "classe", "bulletin").
   * Utilisé pour afficher "3 élèves impactés".
   */
  impactLabel?: string

  /**
   * Mode typed-name :
   * - true  : toujours exigé
   * - false : jamais exigé
   * - 'auto' (défaut) : exigé si impactCount > 0 et confirmationName défini
   */
  requireTypedName?: boolean | 'auto'

  /**
   * Items impactés à lister (optionnel, max 5 affichés).
   * Ex: ["Classe 1ère AF A (30 élèves)", "Classe 2ème AF B (25 élèves)"]
   */
  impactItems?: string[]

  /** Libellé du bouton destructif (défaut : "Supprimer définitivement") */
  confirmLabel?: string

  /** Callback appelé quand la confirmation est validée */
  onConfirm: () => void | Promise<void>

  /** Si true, bouton en état chargement pendant l'action */
  loading?: boolean
}

export function ConfirmDestructive({
  open,
  onOpenChange,
  title,
  description,
  confirmationName,
  impactCount = 0,
  impactLabel,
  requireTypedName = 'auto',
  impactItems,
  confirmLabel = "Supprimer définitivement",
  onConfirm,
  loading = false,
}: ConfirmDestructiveProps) {
  const [typedValue, setTypedValue] = useState("")

  // Reset l'input à chaque ouverture
  useEffect(() => {
    if (open) setTypedValue("")
  }, [open])

  // Décide si on exige le typed-name
  const needsTypedName =
    requireTypedName === true
      ? Boolean(confirmationName)
      : requireTypedName === false
        ? false
        : /* auto */ Boolean(confirmationName) && impactCount > 0

  const typedMatches =
    !needsTypedName || (confirmationName && typedValue.trim() === confirmationName.trim())

  const canConfirm = typedMatches && !loading

  const handleConfirm = async () => {
    if (!canConfirm) return
    await onConfirm()
  }

  const impactSummary =
    impactCount > 0 && impactLabel
      ? `${impactCount} ${impactLabel}${impactCount > 1 ? 's' : ''} impacté${impactCount > 1 ? 's' : ''}`
      : null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="h-5 w-5 text-destructive" />
            {title}
          </AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>

        {/* Bloc d'impact */}
        {(impactSummary || (impactItems && impactItems.length > 0)) && (
          <Alert className="border-amber-300 bg-amber-50 text-amber-900">
            <AlertDescription className="space-y-2">
              {impactSummary && (
                <p className="font-medium">{impactSummary}</p>
              )}
              {impactItems && impactItems.length > 0 && (
                <ul className="list-disc pl-4 text-sm">
                  {impactItems.slice(0, 5).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                  {impactItems.length > 5 && (
                    <li className="italic">
                      ... et {impactItems.length - 5} autres
                    </li>
                  )}
                </ul>
              )}
              <p className="text-xs italic pt-1">
                Cette action est irréversible.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Typed-name */}
        {needsTypedName && confirmationName && (
          <div className="space-y-2 pt-2">
            <Label htmlFor="confirm-typed-name" className="text-sm">
              Pour confirmer, saisissez{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                {confirmationName}
              </code>{" "}
              ci-dessous :
            </Label>
            <Input
              id="confirm-typed-name"
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              placeholder={confirmationName}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              // Focus auto à l'ouverture
              autoFocus
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "En cours..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}