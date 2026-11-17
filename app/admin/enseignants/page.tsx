"use client"

// Enseignants — fiches enseignant liées aux comptes (lot ID-T-F).
//
// - Liste des fiches : nom, prénom et identifiant du compte, état de la FICHE
//   et état du COMPTE en deux colonnes, en mots (D-TF1). Ni téléphone, ni
//   adresse, ni courriel : la liste ne montre que ce qui sert au geste.
// - Créer une fiche pour un compte existant (D-TF2, components/enseignants).
// - Activer ou désactiver la fiche, après confirmation (D-TF3) ; jamais sur sa
//   propre fiche (le serveur répond 403, le bouton est masqué).
// - L'état du compte est en lecture seule ici (D-TF4).
// - Après chaque geste, la liste est relue depuis le serveur, sans mise à jour
//   optimiste (D-TF5).
// Réservée à ADMIN et SYSTEM_ADMIN ; le serveur refuse de lui-même (403).

import { useCallback, useEffect, useMemo, useState } from "react"
import { IdCardIcon, Loader2Icon, LockIcon, PlusIcon, SearchIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { useToast } from "@/components/ui/use-toast"
import { CreerFicheDialog } from "@/components/enseignants/creer-fiche-dialog"
import { clientFetch } from "@/lib/client-fetch"
import { toMessage } from "@/lib/errors"
import { getMe } from "@/lib/data/auth-data"
import { cn } from "@/lib/utils"
import {
  confirmationEtatFiche,
  estAdministrateur,
  filtrerEtTrier,
  libelleEtatCompte,
  libelleEtatFiche,
  lireFiches,
  motifSansAcces,
  peutChangerLEtat,
  type FicheLigne,
} from "@/lib/enseignants/fiches"

type Acces = "verification" | "autorise" | "refuse"

interface Demande {
  ligne: FicheLigne
  activer: boolean
}

const PASTILLE = "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium"

function EtatFiche({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        PASTILLE,
        active ? "border-success-border bg-success-soft text-success-ink" : "border-border text-muted-foreground",
      )}
    >
      {libelleEtatFiche(active)}
    </span>
  )
}

function EtatCompte({ actif }: { actif: boolean }) {
  return (
    <span
      className={cn(
        PASTILLE,
        actif ? "border-border text-foreground" : "border-warning-border bg-warning-soft text-warning-ink",
      )}
    >
      {libelleEtatCompte(actif)}
    </span>
  )
}

export default function EnseignantsPage() {
  const { toast } = useToast()
  const [acces, setAcces] = useState<Acces>("verification")
  const [moiId, setMoiId] = useState<string | null>(null)

  const [fiches, setFiches] = useState<FicheLigne[]>([])
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [recherche, setRecherche] = useState("")

  const [creerOuvert, setCreerOuvert] = useState(false)
  const [demande, setDemande] = useState<Demande | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const charger = useCallback(async () => {
    setChargement(true)
    setErreur(null)
    try {
      const brut = await clientFetch<unknown>("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
      setFiches(lireFiches(brut))
    } catch (err) {
      setFiches([])
      setErreur(toMessage(err, "lors du chargement des fiches"))
    } finally {
      setChargement(false)
    }
  }, [])

  useEffect(() => {
    let annule = false
    getMe().then((moi) => {
      if (annule) return
      if (!estAdministrateur(moi)) {
        setAcces("refuse")
        return
      }
      setMoiId(moi?.id ?? null)
      setAcces("autorise")
      void charger()
    })
    return () => {
      annule = true
    }
  }, [charger])

  const visibles = useMemo(() => filtrerEtTrier(fiches, recherche), [fiches, recherche])

  const confirmer = async () => {
    if (!demande || envoi) return
    const { ligne, activer } = demande
    setEnvoi(true)
    try {
      await clientFetch(`/api/teachers/fiche-status/${encodeURIComponent(ligne.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: activer }),
      })
      toast({ title: activer ? "Fiche activée" : "Fiche désactivée" })
    } catch (err) {
      toast({
        title: activer ? "Activation refusée" : "Désactivation refusée",
        description: toMessage(err, activer ? "lors de l'activation de la fiche" : "lors de la désactivation de la fiche"),
        variant: "destructive",
      })
    } finally {
      setEnvoi(false)
      setDemande(null)
      // Succès ou refus : l'écran montre ce qui est réellement en base (D-TF5).
      void charger()
    }
  }

  const apresCreation = () => {
    toast({ title: "Fiche créée" })
    void charger()
  }

  if (acces === "verification") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />
        Vérification des droits…
      </p>
    )
  }

  if (acces === "refuse") {
    return (
      <div className="space-y-6">
        <h1 className="flex items-center gap-2 font-serif text-2xl font-bold tracking-tight text-foreground">
          <LockIcon className="h-6 w-6 text-muted-foreground" aria-hidden />
          Enseignants
        </h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Cette page est réservée aux administrateurs de l&apos;établissement.
        </p>
      </div>
    )
  }

  const confirmation = demande ? confirmationEtatFiche(demande.activer) : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 font-serif text-2xl font-bold tracking-tight text-foreground">
            <IdCardIcon className="h-6 w-6 text-muted-foreground" aria-hidden />
            Enseignants
          </h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Une fiche active donne le rôle enseignant à son compte, à condition que le compte soit actif.
            L&apos;état du compte se gère sur l&apos;écran des comptes.
          </p>
        </div>
        <Button onClick={() => setCreerOuvert(true)}>
          <PlusIcon aria-hidden />
          Créer une fiche
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-3">
          <CardTitle className="text-sm font-semibold">
            Fiches
            {!chargement && !erreur && (
              <span className="ml-2 font-normal text-muted-foreground">
                {recherche.trim() ? `${visibles.length} sur ${fiches.length}` : fiches.length}
              </span>
            )}
          </CardTitle>
          <div className="relative w-full sm:w-72">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Nom, prénom ou identifiant"
              aria-label="Rechercher une fiche"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {erreur ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-error-border bg-error-soft px-4 py-3 text-sm text-error-ink">
              <span>{erreur}</span>
              <Button variant="outline" size="sm" onClick={() => void charger()}>
                Réessayer
              </Button>
            </div>
          ) : chargement && fiches.length === 0 ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />
              Chargement des fiches…
            </p>
          ) : fiches.length === 0 ? (
            <div className="space-y-3 py-6">
              <p className="max-w-prose text-sm text-muted-foreground">
                Aucune fiche enseignant. Sans fiche active, aucun enseignant ne peut se connecter.
              </p>
              <Button variant="outline" size="sm" onClick={() => setCreerOuvert(true)}>
                <PlusIcon aria-hidden />
                Créer la première fiche
              </Button>
            </div>
          ) : visibles.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">Aucune fiche ne correspond à cette recherche.</p>
          ) : (
            <div className="overflow-x-auto cpmsl-scroll" aria-busy={chargement}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Prénom</TableHead>
                    <TableHead>Identifiant</TableHead>
                    <TableHead>État de la fiche</TableHead>
                    <TableHead>État du compte</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibles.map((ligne) => {
                    const motif = motifSansAcces(ligne)
                    return (
                      <TableRow key={ligne.id}>
                        <TableCell className="font-medium">{ligne.lastname || "—"}</TableCell>
                        <TableCell>{ligne.firstname || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{ligne.username || "—"}</TableCell>
                        <TableCell>
                          <EtatFiche active={ligne.ficheActive} />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <EtatCompte actif={ligne.compteActif} />
                            {motif && <p className="max-w-56 text-xs text-muted-foreground">{motif}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {peutChangerLEtat(ligne, moiId) ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDemande({ ligne, activer: !ligne.ficheActive })}
                            >
                              {ligne.ficheActive ? "Désactiver la fiche" : "Activer la fiche"}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Votre fiche</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreerFicheDialog open={creerOuvert} onOpenChange={setCreerOuvert} onCreee={apresCreation} />

      <AlertDialog open={demande !== null} onOpenChange={(o) => !o && !envoi && setDemande(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation?.titre}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {demande && (
                  <p className="font-medium text-foreground">
                    {demande.ligne.lastname} {demande.ligne.firstname}
                    <span className="font-normal text-muted-foreground"> · {demande.ligne.username}</span>
                  </p>
                )}
                <p>{confirmation?.effet}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={envoi}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={envoi}
              onClick={(e) => {
                e.preventDefault()
                void confirmer()
              }}
            >
              {envoi && <Loader2Icon className="animate-spin" aria-hidden />}
              {confirmation?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
