"use client"

/**
 * Paramètres › MENFP › Matières et coefficients (plan A.2).
 *
 * Niveaux et état de leur référentiel : tels que renvoyés par le serveur (M-61).
 * Σ des coefficients : `sommeCoefficients` de la dernière réponse du serveur,
 * jamais une somme faite ici (M-05, M-36) ; tant que le tableau a des
 * modifications non enregistrées, il est présenté comme la valeur enregistrée.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/client-fetch"
import { creerReferentiel, enregistrerMatieres, importerGrille, lireNiveaux, lireReferentiel } from "@/lib/menfp/api"
import { decimaleBrute, LIBELLES_GRILLES } from "@/lib/menfp/format"
import type { ContexteLien } from "@/lib/menfp/liens"
import type { IdGrille, Niveau, Niveaux, Referentiel } from "@/lib/menfp/types"
import { Acces403, AnnonceChargement, BadgeEtat, Encadre, EtatVide, LienCorriger, RefusMenfp } from "./etats"
import type { ChoixNiveau } from "./parametres-menfp"
import { SelecteurAnnee } from "./selecteurs"

const NOTE_M63 = "Un niveau absent de cette liste n'a aucune salle cette année : créez d'abord les salles de ce niveau."

export function OngletMatieres({ choix }: { choix: ChoixNiveau }) {
  const { annee, niveau } = choix
  // Données marquées par l'année lue : un changement d'année les rend caduques
  // sans remise à zéro dans un effet.
  const [charge, setCharge] = useState<{ annee: string; niveaux: Niveaux | null; erreur: unknown } | null>(null)
  const niveaux = charge?.annee === annee ? charge.niveaux : null
  const erreur = charge?.annee === annee ? charge.erreur : null

  const chargerNiveaux = useCallback(
    async (actif: () => boolean = () => true) => {
      if (!annee) return
      try {
        const n = await lireNiveaux(annee)
        if (actif()) setCharge({ annee, niveaux: n, erreur: null })
      } catch (err) {
        if (actif()) setCharge({ annee, niveaux: null, erreur: err })
      }
    },
    [annee],
  )

  useEffect(() => {
    let annule = false
    void (async () => {
      await chargerNiveaux(() => !annule)
    })()
    return () => {
      annule = true
    }
  }, [chargerNiveaux])

  const courant = niveaux?.niveaux.find((n) => n.classTypeId === niveau) ?? null

  return (
    <div className="space-y-6">
      <SelecteurAnnee annees={choix.annees} valeur={annee} onChange={choix.changerAnnee} />
      {erreur instanceof ApiError && erreur.status === 403 ? (
        <Acces403 />
      ) : erreur ? (
        <RefusMenfp erreur={erreur} onReessayer={() => void chargerNiveaux()} />
      ) : !annee ? (
        <EtatVide titre="Choisissez une année" />
      ) : !niveaux ? (
        <div aria-busy="true" className="grid gap-6 md:grid-cols-[16rem_1fr]">
          <AnnonceChargement />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : niveaux.niveaux.length === 0 ? (
        <EtatVide titre="Aucun niveau à préparer pour cette année" description={NOTE_M63}>
          <Link href="/admin/settings" className="text-sm font-medium underline underline-offset-2">
            Ouvrir Établissement › Classes
          </Link>
        </EtatVide>
      ) : (
        <div className="grid items-start gap-6 md:grid-cols-[16rem_1fr]">
          <ListeNiveaux niveaux={niveaux.niveaux} courant={niveau} onChoisir={choix.changerNiveau} />
          {!courant ? (
            <EtatVide titre="Choisissez un niveau" description="Le référentiel d'un niveau porte ses matières ministère et leurs coefficients." />
          ) : (
            <PanneauNiveau
              key={`${annee}-${courant.classTypeId}`}
              annee={annee}
              niveau={courant}
              onEtatChange={() => void chargerNiveaux()}
              signalerModifications={choix.signalerModifications}
            />
          )}
        </div>
      )}
    </div>
  )
}

function ListeNiveaux({
  niveaux,
  courant,
  onChoisir,
}: {
  niveaux: Niveau[]
  courant: string | null
  onChoisir: (id: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="heading-4">Niveaux</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-1">
          {niveaux.map((n) => {
            const actif = n.classTypeId === courant
            return (
              <li key={n.classTypeId}>
                <button
                  type="button"
                  onClick={() => onChoisir(n.classTypeId)}
                  aria-current={actif ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    actif && "bg-primary/5 font-medium",
                  )}
                >
                  <span>{n.nom}</span>
                  <BadgeEtat etat={n.etat} />
                </button>
              </li>
            )
          })}
        </ul>
        <p className="max-w-prose text-xs text-muted-foreground">
          {NOTE_M63}{" "}
          <Link href="/admin/settings" className="underline underline-offset-2">
            Ouvrir Établissement › Classes
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

function PanneauNiveau({
  annee,
  niveau,
  onEtatChange,
  signalerModifications,
}: {
  annee: string
  niveau: Niveau
  onEtatChange: () => void
  signalerModifications: (sale: boolean) => void
}) {
  const [referentiel, setReferentiel] = useState<Referentiel | null>(null)
  const [erreur, setErreur] = useState<unknown>(null)
  const ctx: ContexteLien = { academicYearId: annee, classTypeId: niveau.classTypeId }

  const charger = useCallback(
    async (actif: () => boolean = () => true) => {
      try {
        const r = await lireReferentiel(annee, niveau.classTypeId)
        if (!actif()) return
        setReferentiel(r)
        setErreur(null)
      } catch (err) {
        if (actif()) setErreur(err)
      }
    },
    [annee, niveau.classTypeId],
  )

  useEffect(() => {
    if (niveau.etat === "absent") return
    let annule = false
    void (async () => {
      await charger(() => !annule)
    })()
    return () => {
      annule = true
    }
  }, [charger, niveau.etat])

  function recu(r: Referentiel) {
    setReferentiel(r)
    onEtatChange()
  }

  if (niveau.etat === "absent" && !referentiel) {
    return <CreationReferentiel annee={annee} niveau={niveau} onCree={recu} />
  }
  if (erreur instanceof ApiError && erreur.status === 403) return <Acces403 />
  if (erreur) return <RefusMenfp erreur={erreur} ctx={ctx} onReessayer={() => void charger()} />
  if (!referentiel) {
    return (
      <div aria-busy="true">
        <AnnonceChargement />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="heading-4">
        {niveau.nom} — référentiel {referentiel.etat === "complet" ? "complet" : "incomplet"}
      </h2>
      {referentiel.signalements.length > 0 ? (
        <Encadre ton="warning" titre="Raisons de l'état du référentiel" niveauTitre={3}>
          <ul className="list-disc space-y-2 pl-4">
            {referentiel.signalements.map((s, i) => (
              <li key={`${s.code}-${i}`} className="space-y-1">
                <p>{s.message}</p>
                <LienCorriger code={s.code} ctx={ctx} />
              </li>
            ))}
          </ul>
        </Encadre>
      ) : null}
      <TableauMatieres
        key={referentiel.id + referentiel.matieres.map((m) => m.id).join()}
        referentiel={referentiel}
        onEnregistre={recu}
        onRecharger={() => void charger()}
        signalerModifications={signalerModifications}
      />
    </div>
  )
}

type ModeCreation = "vide" | "copie" | "grille"

function CreationReferentiel({
  annee,
  niveau,
  onCree,
}: {
  annee: string
  niveau: Niveau
  onCree: (r: Referentiel) => void
}) {
  const { toast } = useToast()
  const idGrille = useId()
  const [mode, setMode] = useState<ModeCreation>("vide")
  const [grille, setGrille] = useState<IdGrille | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [refus, setRefus] = useState<unknown>(null)
  const [cree, setCree] = useState<Referentiel | null>(null)

  async function creer(e: React.FormEvent) {
    e.preventDefault()
    setRefus(null)
    setEnvoi(true)
    try {
      let r = cree ?? (await creerReferentiel(annee, niveau.classTypeId, { mode: mode === "copie" ? "copie" : "vide" }))
      setCree(r)
      if (mode === "grille" && grille) r = await importerGrille(r.id, grille)
      toast({ title: "Référentiel créé", description: niveau.nom })
      onCree(r)
    } catch (err) {
      setRefus(err)
    } finally {
      setEnvoi(false)
    }
  }

  const pret = mode !== "grille" || grille !== null
  return (
    <Card>
      <CardHeader>
        <h2 className="heading-4">{niveau.nom} — aucun référentiel</h2>
        <CardDescription>Aucune matière n&apos;est proposée d&apos;office : choisissez comment créer le référentiel.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void creer(e)} className="space-y-4">
          <FieldSet>
            <FieldLegend>Créer le référentiel de {niveau.nom}</FieldLegend>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as ModeCreation)} disabled={Boolean(cree)}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="vide" id={`${idGrille}-vide`} />
                <Label htmlFor={`${idGrille}-vide`}>Créer un référentiel vide</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="copie" id={`${idGrille}-copie`} />
                <Label htmlFor={`${idGrille}-copie`}>Copier le référentiel de l&apos;année précédente</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="grille" id={`${idGrille}-grille`} />
                <Label htmlFor={`${idGrille}-grille`}>Créer et importer une grille officielle</Label>
              </div>
            </RadioGroup>
            <Field className="w-auto pl-6">
              <FieldLabel htmlFor={idGrille}>Grille officielle</FieldLabel>
              <Select
                value={grille ?? undefined}
                onValueChange={(v) => setGrille(v as IdGrille)}
                disabled={mode !== "grille"}
              >
                <SelectTrigger id={idGrille} className="w-48">
                  <SelectValue placeholder="Choisir une grille" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(LIBELLES_GRILLES) as IdGrille[]).map((g) => (
                    <SelectItem key={g} value={g}>
                      {LIBELLES_GRILLES[g]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldSet>
          <Button type="submit" disabled={envoi || !pret}>
            {envoi ? <Spinner aria-hidden /> : null}
            {envoi ? "Création…" : cree ? "Importer la grille" : "Créer le référentiel"}
          </Button>
          {refus ? <RefusMenfp erreur={refus} apresAction /> : null}
        </form>
      </CardContent>
    </Card>
  )
}

interface Ligne {
  cle: string
  id: string | null
  ordre: string
  libelle: string
  coefficient: string
}

const versLignes = (r: Referentiel): Ligne[] =>
  r.matieres.map((m) => ({ cle: m.id, id: m.id, ordre: String(m.ordre), libelle: m.libelle, coefficient: m.coefficient }))

function TableauMatieres({
  referentiel,
  onEnregistre,
  onRecharger,
  signalerModifications,
}: {
  referentiel: Referentiel
  onEnregistre: (r: Referentiel) => void
  onRecharger: () => void
  signalerModifications: (sale: boolean) => void
}) {
  const { toast } = useToast()
  const [lignes, setLignes] = useState<Ligne[]>(() => versLignes(referentiel))
  const [sale, setSale] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [refus, setRefus] = useState<unknown>(null)
  const [grille, setGrille] = useState<IdGrille | null>(null)
  const [erreurOrdre, setErreurOrdre] = useState<string | null>(null)
  const champs = useRef(new Map<string, HTMLInputElement>())
  const boutonAjouter = useRef<HTMLButtonElement>(null)
  const focusApres = useRef<string | "ajouter" | null>(null)
  const compteur = useRef(0)

  useEffect(() => {
    signalerModifications(sale)
  }, [sale, signalerModifications])
  useEffect(() => () => signalerModifications(false), [signalerModifications])

  useEffect(() => {
    const cible = focusApres.current
    focusApres.current = null
    if (cible === "ajouter") boutonAjouter.current?.focus()
    else if (cible) champs.current.get(cible)?.focus()
  }, [lignes])

  function modifier(cle: string, champ: "ordre" | "libelle" | "coefficient", valeur: string) {
    setLignes((ls) => ls.map((l) => (l.cle === cle ? { ...l, [champ]: valeur } : l)))
    setSale(true)
  }

  function ajouter() {
    compteur.current += 1
    const cle = `nouvelle-${compteur.current}`
    focusApres.current = cle
    setLignes((ls) => [...ls, { cle, id: null, ordre: "", libelle: "", coefficient: "" }])
    setSale(true)
  }

  function retirer(cle: string) {
    const i = lignes.findIndex((l) => l.cle === cle)
    const suivante = lignes[i + 1] ?? lignes[i - 1]
    focusApres.current = suivante ? suivante.cle : "ajouter"
    setLignes((ls) => ls.filter((l) => l.cle !== cle))
    setSale(true)
  }

  function annuler() {
    setLignes(versLignes(referentiel))
    setSale(false)
    setRefus(null)
  }

  async function enregistrer() {
    setRefus(null)
    setErreurOrdre(null)
    // L'ordre est un entier JSON dans le contrat : une saisie qui n'est pas faite
    // de chiffres n'est pas envoyée. Les bornes restent jugées par le serveur.
    const horsForme = lignes.find((l) => !/^\d{1,4}$/.test(l.ordre.trim()))
    if (horsForme) {
      setErreurOrdre("Chaque ordre doit être un nombre entier (1 à 999).")
      return
    }
    setEnvoi(true)
    try {
      const r = await enregistrerMatieres(referentiel.id, {
        matieres: lignes.map((l) => ({
          id: l.id,
          libelle: l.libelle.trim(),
          coefficient: l.coefficient.trim(),
          ordre: Number.parseInt(l.ordre.trim(), 10),
        })),
      })
      setSale(false)
      toast({ title: "Matières enregistrées" })
      onEnregistre(r)
    } catch (err) {
      setRefus(err)
    } finally {
      setEnvoi(false)
    }
  }

  async function importer() {
    if (!grille) return
    setRefus(null)
    setEnvoi(true)
    try {
      const r = await importerGrille(referentiel.id, grille)
      toast({ title: "Grille officielle importée", description: LIBELLES_GRILLES[grille] })
      onEnregistre(r)
    } catch (err) {
      setRefus(err)
    } finally {
      setEnvoi(false)
    }
  }

  const concurrente = refus instanceof ApiError && (refus.body as { code?: unknown } | null)?.code === "MENFP_MODIFICATION_CONCURRENTE"
  const nomLigne = (l: Ligne, i: number) => (l.libelle.trim() ? l.libelle.trim() : `la nouvelle matière ${i + 1}`)

  return (
    <Card>
      <CardHeader>
        <h3 className="heading-4">Matières ministère</h3>
        <CardDescription>Libellé, coefficient et ordre de chaque matière de la liste officielle.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {lignes.length === 0 ? (
          <EtatVide titre="Aucune matière" description="Ajoutez des matières, ou importez une grille officielle.">
            <div className="flex flex-wrap items-end justify-center gap-2">
              <Select value={grille ?? undefined} onValueChange={(v) => setGrille(v as IdGrille)}>
                <SelectTrigger className="w-44" aria-label="Grille officielle à importer">
                  <SelectValue placeholder="Choisir une grille" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(LIBELLES_GRILLES) as IdGrille[]).map((g) => (
                    <SelectItem key={g} value={g}>
                      {LIBELLES_GRILLES[g]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" disabled={!grille || envoi} onClick={() => void importer()}>
                Importer une grille officielle
              </Button>
            </div>
          </EtatVide>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="w-24 px-2 text-xs text-muted-foreground">Ordre</TableHead>
                <TableHead scope="col" className="px-2 text-xs text-muted-foreground">Libellé</TableHead>
                <TableHead scope="col" className="w-32 px-2 text-xs text-muted-foreground">Coefficient</TableHead>
                <TableHead scope="col" className="w-12 px-2">
                  <span className="sr-only">Retirer</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lignes.map((l, i) => (
                <TableRow key={l.cle}>
                  <TableCell className="px-2 py-1">
                    <Input
                      className="h-7 text-right text-sm tabular-nums"
                      inputMode="numeric"
                      value={l.ordre}
                      onChange={(e) => modifier(l.cle, "ordre", e.target.value)}
                      aria-label={`Ordre de ${nomLigne(l, i)}`}
                    />
                  </TableCell>
                  <TableCell className="px-2 py-1">
                    <Input
                      ref={(el) => {
                        if (el) champs.current.set(l.cle, el)
                        else champs.current.delete(l.cle)
                      }}
                      className="h-7 text-sm"
                      maxLength={150}
                      value={l.libelle}
                      onChange={(e) => modifier(l.cle, "libelle", e.target.value)}
                      aria-label={`Libellé de ${nomLigne(l, i)}`}
                    />
                  </TableCell>
                  <TableCell className="px-2 py-1">
                    <Input
                      className="h-7 text-right text-sm tabular-nums"
                      inputMode="numeric"
                      value={l.coefficient}
                      onChange={(e) => modifier(l.cle, "coefficient", e.target.value)}
                      aria-label={`Coefficient de ${nomLigne(l, i)}`}
                    />
                  </TableCell>
                  <TableCell className="px-2 py-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => retirer(l.cle)}
                      aria-label={`Retirer ${nomLigne(l, i)} de la liste`}
                    >
                      <Trash2 aria-hidden className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Button ref={boutonAjouter} type="button" variant="outline" size="sm" onClick={ajouter}>
          <Plus aria-hidden className="h-4 w-4" />
          Ajouter une matière
        </Button>

        <div className="space-y-1">
          <p className="text-sm tabular-nums">
            Σ des coefficients (valeur enregistrée) : <span className="font-medium">{decimaleBrute(referentiel.sommeCoefficients)}</span>
          </p>
          {sale ? (
            <p className="text-xs text-warning-ink">
              Modifications non enregistrées : le Σ sera recalculé par le serveur à l&apos;enregistrement.
            </p>
          ) : null}
        </div>

        <FieldDescription className="max-w-prose">
          Les listes déjà gelées gardent leurs coefficients ; une nouvelle version appliquera les coefficients en
          vigueur.
        </FieldDescription>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={!sale || envoi} onClick={annuler}>
            Annuler
          </Button>
          <Button type="button" disabled={!sale || envoi} onClick={() => void enregistrer()}>
            {envoi ? <Spinner aria-hidden /> : null}
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>

        {erreurOrdre ? <FieldError className="text-error-ink">{erreurOrdre}</FieldError> : null}
        {refus ? <RefusMenfp erreur={refus} apresAction onReessayer={concurrente ? onRecharger : undefined} /> : null}
      </CardContent>
    </Card>
  )
}
