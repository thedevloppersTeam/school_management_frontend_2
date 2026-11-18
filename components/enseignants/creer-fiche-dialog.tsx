"use client"

/**
 * Fenêtre « Créer une fiche enseignant » (lot ID-T-F, D-TF2).
 *
 * 1. Le compte est choisi parmi les CANDIDATS du serveur
 *    (GET /api/teachers/candidats, lot ID-T-C) : comptes sans fiche,
 *    admissibles, actifs ou désactivés. La recherche est faite par le serveur
 *    (paramètre `q`) : l'écran ne charge jamais la liste de tous les comptes.
 * 2. Les champs de la fiche sont tous facultatifs ; un champ laissé vide n'est
 *    pas envoyé (lib/enseignants/fiches.ts, corpsDeCreation).
 *
 * Un refus du serveur (409 IDENTITE_ENSEIGNANT_*) s'affiche dans la fenêtre,
 * traduit par lib/errors.ts, sans détail personnel.
 */

import { useEffect, useId, useState } from "react"
import { Loader2Icon, SearchIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { clientFetch } from "@/lib/client-fetch"
import { toMessage } from "@/lib/errors"
import {
  LONGUEUR_MAX,
  SAISIE_VIDE,
  adresseDesCandidats,
  corpsDeCreation,
  libelleEtatCompte,
  lireCandidats,
  saisieRecevable,
  type Candidat,
  type SaisieFiche,
} from "@/lib/enseignants/fiches"

/** Délai avant d'interroger le serveur pendant la frappe. */
const DELAI_RECHERCHE_MS = 250

interface CreerFicheDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Appelé après un 201 : la page recharge la liste depuis le serveur (D-TF5). */
  onCreee: () => void
}

export function CreerFicheDialog({ open, onOpenChange, onCreee }: CreerFicheDialogProps) {
  // Pendant l'envoi, la fenêtre ne se ferme pas (Échap, clic à l'extérieur).
  const [envoi, setEnvoi] = useState(false)
  return (
    <Dialog open={open} onOpenChange={(o) => !envoi && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto cpmsl-scroll sm:max-w-2xl">
        {/* Démonté à la fermeture : aucune saisie ne survit à la fenêtre. */}
        <FormulaireFiche
          envoi={envoi}
          onEnvoi={setEnvoi}
          onAnnuler={() => onOpenChange(false)}
          onCreee={() => {
            onOpenChange(false)
            onCreee()
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

interface FormulaireFicheProps {
  envoi: boolean
  onEnvoi: (envoi: boolean) => void
  onAnnuler: () => void
  onCreee: () => void
}

function FormulaireFiche({ envoi, onEnvoi, onAnnuler, onCreee }: FormulaireFicheProps) {
  const idBase = useId()
  const [recherche, setRecherche] = useState("")
  const [candidats, setCandidats] = useState<Candidat[]>([])
  const [chargement, setChargement] = useState(false)
  const [erreurCandidats, setErreurCandidats] = useState<string | null>(null)
  const [saisieBrute, setSaisie] = useState<SaisieFiche>(SAISIE_VIDE)
  const [erreurEnvoi, setErreurEnvoi] = useState<string | null>(null)

  // Le compte choisi qui disparaît des résultats d'une nouvelle recherche n'est
  // plus sélectionné : on n'envoie jamais un compte que l'écran ne montre pas.
  const saisie: SaisieFiche = candidats.some((c) => c.id === saisieBrute.userId)
    ? saisieBrute
    : { ...saisieBrute, userId: "" }

  useEffect(() => {
    let annule = false
    const minuteur = setTimeout(() => {
      setChargement(true)
      setErreurCandidats(null)
      clientFetch<unknown>(adresseDesCandidats(recherche))
        .then((brut) => {
          if (!annule) setCandidats(lireCandidats(brut))
        })
        .catch((err) => {
          if (!annule) {
            setCandidats([])
            setErreurCandidats(toMessage(err, "lors du chargement des comptes"))
          }
        })
        .finally(() => {
          if (!annule) setChargement(false)
        })
    }, recherche ? DELAI_RECHERCHE_MS : 0)
    return () => {
      annule = true
      clearTimeout(minuteur)
    }
  }, [recherche])

  const champ = (nom: keyof SaisieFiche) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const valeur = e.target.value
    setSaisie((s) => ({ ...s, [nom]: valeur }))
  }

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!saisieRecevable(saisie) || envoi) return
    onEnvoi(true)
    setErreurEnvoi(null)
    let creee = false
    try {
      await clientFetch("/api/teachers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpsDeCreation(saisie)),
      })
      creee = true
    } catch (err) {
      setErreurEnvoi(toMessage(err, "lors de la création de la fiche"))
    } finally {
      onEnvoi(false)
    }
    if (creee) onCreee()
  }

  const idListe = `${idBase}-comptes`

  return (
    <form onSubmit={envoyer} className="space-y-6">
      <DialogHeader>
        <DialogTitle>Créer une fiche enseignant</DialogTitle>
        <DialogDescription>
          La fiche donne le rôle enseignant au compte choisi, dès sa prochaine action si le compte est actif.
        </DialogDescription>
      </DialogHeader>

      <section className="space-y-4" aria-labelledby={`${idBase}-titre-compte`}>
        <h3 id={`${idBase}-titre-compte`} className="label-ui text-foreground">
          Compte
        </h3>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            maxLength={LONGUEUR_MAX.recherche}
            placeholder="Rechercher par nom, prénom ou identifiant"
            aria-label="Rechercher un compte"
            aria-controls={idListe}
            className="pl-9"
          />
        </div>

        <div
          id={idListe}
          className="max-h-56 overflow-y-auto rounded-md border cpmsl-scroll"
          aria-busy={chargement}
        >
          {erreurCandidats ? (
            <p role="alert" className="p-4 text-sm text-error-ink">
              {erreurCandidats}
            </p>
          ) : chargement && candidats.length === 0 ? (
            <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />
              Chargement des comptes…
            </p>
          ) : candidats.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {recherche.trim()
                ? "Aucun compte sans fiche ne correspond à cette recherche."
                : "Aucun compte ne peut recevoir de fiche : tous les comptes admissibles en ont déjà une."}
            </p>
          ) : (
            <RadioGroup
              value={saisie.userId}
              onValueChange={(userId) => setSaisie((s) => ({ ...s, userId }))}
              aria-label="Compte qui reçoit la fiche"
              className="gap-0 divide-y"
            >
              {candidats.map((c) => {
                const idOption = `${idBase}-c-${c.id}`
                return (
                  <Label
                    key={c.id}
                    htmlFor={idOption}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2 font-normal transition-colors hover:bg-muted/60 has-[[data-state=checked]]:bg-muted"
                  >
                    <RadioGroupItem id={idOption} value={c.id} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {c.lastname} {c.firstname}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{c.username}</span>
                    </span>
                    {!c.isActive && (
                      <span className="shrink-0 text-xs text-warning-ink">{libelleEtatCompte(false)}</span>
                    )}
                  </Label>
                )
              })}
            </RadioGroup>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Un compte désactivé peut recevoir sa fiche : il aura le rôle enseignant à sa réactivation.
        </p>
      </section>

      <section className="space-y-4" aria-labelledby={`${idBase}-titre-fiche`}>
        <h3 id={`${idBase}-titre-fiche`} className="label-ui text-foreground">
          Fiche <span className="font-normal text-muted-foreground">— tous les champs sont facultatifs</span>
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${idBase}-role`}>Fonction</Label>
            <Input
              id={`${idBase}-role`}
              value={saisie.role}
              onChange={champ("role")}
              maxLength={LONGUEUR_MAX.role}
              placeholder="Titulaire, suppléant…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idBase}-embauche`}>Date d&apos;embauche</Label>
            <Input id={`${idBase}-embauche`} type="date" value={saisie.hireDate} onChange={champ("hireDate")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idBase}-courriel`}>Courriel</Label>
            <Input id={`${idBase}-courriel`} type="email" value={saisie.email} onChange={champ("email")} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idBase}-telephone`}>Téléphone</Label>
            <Input
              id={`${idBase}-telephone`}
              type="tel"
              value={saisie.phone}
              onChange={champ("phone")}
              maxLength={LONGUEUR_MAX.phone}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor={`${idBase}-adresse`}>Adresse</Label>
            <Input id={`${idBase}-adresse`} value={saisie.address} onChange={champ("address")} autoComplete="off" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor={`${idBase}-description`}>Note</Label>
            <Textarea id={`${idBase}-description`} value={saisie.description} onChange={champ("description")} rows={2} />
          </div>
        </div>
      </section>

      {erreurEnvoi && (
        <Alert role="alert" className="border-error-border bg-error-soft text-error-ink">
          <AlertDescription>{erreurEnvoi}</AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onAnnuler} disabled={envoi}>
          Annuler
        </Button>
        <Button type="submit" disabled={!saisieRecevable(saisie) || envoi}>
          {envoi && <Loader2Icon className="animate-spin" aria-hidden />}
          Créer la fiche
        </Button>
      </DialogFooter>
    </form>
  )
}
