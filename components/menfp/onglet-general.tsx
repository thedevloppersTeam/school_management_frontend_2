"use client"

/**
 * Paramètres › MENFP › Général (plan A.1) : logo du ministère (M-49, M-53) et
 * seuil d'alerte de l'écart (M-22). Le seuil est affiché tel que renvoyé par le
 * serveur ; la saisie n'est jamais convertie en nombre.
 */
import { useCallback, useEffect, useId, useState } from "react"
import { Upload } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/client-fetch"
import { adresseLogoMinistere, lireParametres, modifierSeuil, televerserLogoMinistere } from "@/lib/menfp/api"
import { decimaleAffichee, seuilSaisi } from "@/lib/menfp/format"
import type { Parametres } from "@/lib/menfp/types"
import { Acces403, AnnonceChargement, Encadre, RefusMenfp } from "./etats"

const TYPES_LOGO = ["image/png", "image/jpeg"]
const TAILLE_MAX_LOGO = 2 * 1024 * 1024

export function OngletGeneral() {
  const [parametres, setParametres] = useState<Parametres | null>(null)
  const [erreurLecture, setErreurLecture] = useState<unknown>(null)

  // `actif` : une réponse arrivée après le démontage est ignorée.
  const charger = useCallback(async (actif: () => boolean = () => true) => {
    try {
      const p = await lireParametres()
      if (!actif()) return
      setParametres(p)
      setErreurLecture(null)
    } catch (err) {
      if (actif()) setErreurLecture(err)
    }
  }, [])

  useEffect(() => {
    let annule = false
    void (async () => {
      await charger(() => !annule)
    })()
    return () => {
      annule = true
    }
  }, [charger])

  if (erreurLecture instanceof ApiError && erreurLecture.status === 403) return <Acces403 />
  if (erreurLecture) return <RefusMenfp erreur={erreurLecture} onReessayer={() => void charger()} />
  if (!parametres) {
    return (
      <div aria-busy="true" className="space-y-6">
        <AnnonceChargement />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CarteLogo parametres={parametres} onChange={setParametres} />
      <CarteSeuil parametres={parametres} onChange={setParametres} />
    </div>
  )
}

function CarteLogo({ parametres, onChange }: { parametres: Parametres; onChange: (p: Parametres) => void }) {
  const { toast } = useToast()
  const idChamp = useId()
  const [envoi, setEnvoi] = useState(false)
  const [erreurControle, setErreurControle] = useState<string | null>(null)
  const [refus, setRefus] = useState<unknown>(null)
  const logo = parametres.logoMinistere

  async function choisir(e: React.ChangeEvent<HTMLInputElement>) {
    const fichiers = e.target.files
    e.target.value = ""
    setErreurControle(null)
    setRefus(null)
    if (!fichiers || fichiers.length === 0) return
    if (fichiers.length > 1) return setErreurControle("Choisissez un seul fichier.")
    const fichier = fichiers[0]
    if (!TYPES_LOGO.includes(fichier.type)) return setErreurControle("Format refusé : PNG ou JPEG seulement.")
    if (fichier.size > TAILLE_MAX_LOGO) return setErreurControle("Image trop volumineuse : 2 Mo au maximum.")
    setEnvoi(true)
    try {
      onChange(await televerserLogoMinistere(fichier))
      toast({ title: "Logo du ministère enregistré" })
    } catch (err) {
      setRefus(err)
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="heading-4">Logo du ministère</h2>
        <CardDescription>
          Le logo en vigueur est figé dans chaque liste gelée ; le remplacer ne modifie aucune liste déjà gelée.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {logo ? (
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-xl border bg-card p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- image servie par un route handler protégé */}
            <img
              src={adresseLogoMinistere(logo.empreinte)}
              alt="Logo du ministère en vigueur"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : (
          <Encadre ton="warning" titre="Aucun logo : le gel est impossible." niveauTitre={3} />
        )}
        <Field>
          <FieldLabel
            htmlFor={idChamp}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "cursor-pointer focus-within:ring-1 focus-within:ring-ring",
              envoi && "pointer-events-none opacity-60",
            )}
          >
            {envoi ? <Spinner aria-hidden /> : <Upload aria-hidden className="h-4 w-4" />}
            {envoi ? "Envoi du logo…" : logo ? "Remplacer le logo" : "Téléverser le logo"}
            <input
              id={idChamp}
              type="file"
              className="sr-only"
              accept="image/png,image/jpeg"
              onChange={(e) => void choisir(e)}
              disabled={envoi}
              aria-describedby={`${idChamp}-aide`}
            />
          </FieldLabel>
          <FieldDescription id={`${idChamp}-aide`}>PNG ou JPEG, 2 Mo au plus.</FieldDescription>
          {erreurControle ? <FieldError className="text-error-ink">{erreurControle}</FieldError> : null}
        </Field>
        {refus ? <RefusMenfp erreur={refus} apresAction /> : null}
      </CardContent>
    </Card>
  )
}

function CarteSeuil({ parametres, onChange }: { parametres: Parametres; onChange: (p: Parametres) => void }) {
  const { toast } = useToast()
  const id = useId()
  const [saisie, setSaisie] = useState(() => decimaleAffichee(parametres.seuil))
  const [erreurSaisie, setErreurSaisie] = useState<string | null>(null)
  const [refus, setRefus] = useState<unknown>(null)
  const [envoi, setEnvoi] = useState(false)

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault()
    setRefus(null)
    const seuil = seuilSaisi(saisie)
    if (seuil === null) {
      setErreurSaisie("Saisissez un nombre positif à deux décimales au plus (ex. 0,15).")
      return
    }
    setErreurSaisie(null)
    setEnvoi(true)
    try {
      const p = await modifierSeuil(seuil)
      onChange(p)
      setSaisie(decimaleAffichee(p.seuil))
      toast({ title: "Seuil enregistré", description: `Seuil d'alerte : ${decimaleAffichee(p.seuil)}` })
    } catch (err) {
      setRefus(err)
    } finally {
      setEnvoi(false)
    }
  }

  const invalide = Boolean(erreurSaisie)
  return (
    <Card>
      <CardHeader>
        <h2 className="heading-4">Seuil d&apos;alerte de l&apos;écart</h2>
        <CardDescription>
          Seuil actuel : <span className="text-sm tabular-nums text-foreground">{decimaleAffichee(parametres.seuil)}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={(e) => void enregistrer(e)} noValidate>
          <Field>
            <FieldLabel htmlFor={id}>Nouveau seuil</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id={id}
                inputMode="decimal"
                autoComplete="off"
                value={saisie}
                onChange={(e) => setSaisie(e.target.value)}
                className="w-32 tabular-nums"
                aria-invalid={invalide}
                aria-describedby={`${id}-aide${invalide ? ` ${id}-erreur` : ""}`}
              />
              <Button type="submit" disabled={envoi}>
                {envoi ? <Spinner aria-hidden /> : null}
                {envoi ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
            <FieldDescription id={`${id}-aide`} className="max-w-prose">
              Deux décimales au plus (ex. 0,15). Un écart strictement supérieur au seuil est mis en évidence dans
              l&apos;aperçu.
            </FieldDescription>
            {erreurSaisie ? (
              <FieldError id={`${id}-erreur`} className="text-error-ink">
                {erreurSaisie}
              </FieldError>
            ) : null}
          </Field>
        </form>
        {refus ? <RefusMenfp erreur={refus} apresAction /> : null}
      </CardContent>
    </Card>
  )
}
