"use client"

/**
 * Paramètres › MENFP (SPEC-MENFP M-54, plan d'écrans A) : trois onglets.
 * Onglet, année et niveau vivent dans l'adresse (?onglet=&annee=&niveau=) : les
 * liens de correction de l'écran de préparation ouvrent directement le bon endroit.
 * Un changement d'onglet, d'année ou de niveau avec des modifications non
 * enregistrées demande confirmation.
 */
import { useCallback, useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchAllAcademicYears, type AcademicYear } from "@/lib/api/dashboard"
import type { OngletMenfp } from "@/lib/menfp/liens"
import { OngletCorrespondances } from "./onglet-correspondances"
import { OngletGeneral } from "./onglet-general"
import { OngletMatieres } from "./onglet-matieres"

const ONGLETS: Record<OngletMenfp, string> = {
  general: "Général",
  matieres: "Matières et coefficients",
  correspondances: "Correspondances",
}

const estOnglet = (v: string | null): v is OngletMenfp => v !== null && v in ONGLETS

export interface ChoixNiveau {
  annees: AcademicYear[] | null
  annee: string | null
  niveau: string | null
  changerAnnee: (annee: string) => void
  changerNiveau: (niveau: string | null) => void
  signalerModifications: (sale: boolean) => void
}

export function ParametresMenfp() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const onglet: OngletMenfp = estOnglet(params.get("onglet")) ? (params.get("onglet") as OngletMenfp) : "general"
  const annee = params.get("annee")
  const niveau = params.get("niveau")

  const [annees, setAnnees] = useState<AcademicYear[] | null>(null)
  const [sale, setSale] = useState(false)
  const [enAttente, setEnAttente] = useState<Record<string, string | null> | null>(null)

  const appliquer = useCallback(
    (changes: Record<string, string | null>) => {
      const q = new URLSearchParams(params.toString())
      for (const [k, v] of Object.entries(changes)) {
        if (v) q.set(k, v)
        else q.delete(k)
      }
      setSale(false)
      router.replace(`${pathname}?${q.toString()}`, { scroll: false })
    },
    [params, pathname, router],
  )

  const demander = useCallback(
    (changes: Record<string, string | null>) => {
      if (sale) setEnAttente(changes)
      else appliquer(changes)
    },
    [sale, appliquer],
  )

  useEffect(() => {
    let actif = true
    fetchAllAcademicYears()
      .then((liste) => {
        if (!actif) return
        setAnnees(liste)
        if (!annee) {
          const active = liste.find((a) => a.isCurrent) ?? liste[0]
          if (active) appliquer({ annee: active.id })
        }
      })
      .catch(() => actif && setAnnees([]))
    return () => {
      actif = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lecture unique des années au montage
  }, [])

  const choix: ChoixNiveau = {
    annees,
    annee,
    niveau,
    changerAnnee: (a) => demander({ annee: a, niveau: null }),
    changerNiveau: (n) => demander({ niveau: n }),
    signalerModifications: setSale,
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="heading-1 text-foreground">MENFP</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Liste de fin d&apos;année transmise au ministère : logo, seuil d&apos;alerte, matières, coefficients et
          correspondances.
        </p>
      </div>

      <Tabs value={onglet} onValueChange={(v) => demander({ onglet: v })} className="space-y-6">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-muted/40 p-1">
          {Object.entries(ONGLETS).map(([value, label]) => (
            <TabsTrigger key={value} value={value}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="general" className="space-y-6">
          {onglet === "general" ? <OngletGeneral /> : null}
        </TabsContent>
        <TabsContent value="matieres" className="space-y-6">
          {onglet === "matieres" ? <OngletMatieres choix={choix} /> : null}
        </TabsContent>
        <TabsContent value="correspondances" className="space-y-6">
          {onglet === "correspondances" ? <OngletCorrespondances choix={choix} /> : null}
        </TabsContent>
      </Tabs>

      <AlertDialog open={enAttente !== null} onOpenChange={(o) => !o && setEnAttente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abandonner les modifications non enregistrées ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les changements faits dans cet onglet n&apos;ont pas été enregistrés ; ils seront perdus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (enAttente) appliquer(enAttente)
                setEnAttente(null)
              }}
            >
              Abandonner
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
