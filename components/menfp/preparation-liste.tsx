"use client"

/**
 * Fin d'année → Liste MENFP (SPEC-MENFP M-34, plan d'écrans B) : préparation de
 * la liste d'une salle. L'écran affiche ce que renvoie le serveur, sans rien
 * recalculer (M-36) : aperçu, blocages, signalements, bandeau M-43, différences
 * M-47, versions gelées. Il commande le gel, l'export et la purge.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Download } from "lucide-react"
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
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { ConfirmDestructive } from "@/components/ui/confirm-destructive"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/components/ui/use-toast"
import {
  fetchAllAcademicYears,
  fetchClassSessions,
  getClassSessionName,
  type AcademicYear,
  type ClassSession,
} from "@/lib/api/dashboard"
import { ApiError } from "@/lib/client-fetch"
import { geler, lireApercu, lireNiveaux, lireVersions, purger, telechargerExport } from "@/lib/menfp/api"
import { dateHeureAffichee, decimaleAffichee, TRAIT } from "@/lib/menfp/format"
import type { ContexteLien } from "@/lib/menfp/liens"
import type { Apercu, BlocageApercu, Version, Versions } from "@/lib/menfp/types"
import { Acces403, AnnonceChargement, Encadre, EtatVide, LienCorriger, RefusMenfp } from "./etats"
import { SelecteurAnnee } from "./selecteurs"
import { TableauApercu } from "./tableau-apercu"

const est403 = (e: unknown) => e instanceof ApiError && e.status === 403
const codeDe = (e: unknown) =>
  e instanceof ApiError ? ((e.body as { code?: unknown } | null)?.code as string | undefined) : undefined

export function PreparationListe() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const annee = params.get("annee")
  const salle = params.get("salle")
  const idSalle = useId()

  const [annees, setAnnees] = useState<AcademicYear[] | null>(null)
  const [charge, setCharge] = useState<{ annee: string; salles: ClassSession[] | null; erreur: unknown } | null>(null)
  const salles = charge?.annee === annee ? charge.salles : null
  const erreurSalles = charge?.annee === annee ? charge.erreur : null

  const changer = useCallback(
    (changes: Record<string, string | null>) => {
      const q = new URLSearchParams(params.toString())
      for (const [k, v] of Object.entries(changes)) {
        if (v) q.set(k, v)
        else q.delete(k)
      }
      router.replace(`${pathname}?${q.toString()}`, { scroll: false })
    },
    [params, pathname, router],
  )

  useEffect(() => {
    let actif = true
    fetchAllAcademicYears()
      .then((liste) => {
        if (!actif) return
        setAnnees(liste)
        if (!annee) {
          const active = liste.find((a) => a.isCurrent) ?? liste[0]
          if (active) changer({ annee: active.id })
        }
      })
      .catch(() => actif && setAnnees([]))
    return () => {
      actif = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lecture unique des années au montage
  }, [])

  // Salles de l'année, restreintes aux niveaux que le serveur déclare préparables
  // (non terminaux, M-02) : aucun critère « terminal » n'est codé ici.
  useEffect(() => {
    if (!annee) return
    let actif = true
    Promise.all([lireNiveaux(annee), fetchClassSessions(annee)])
      .then(([niveaux, sessions]) => {
        if (!actif) return
        const permis = new Set(niveaux.niveaux.map((n) => n.classTypeId))
        setCharge({ annee, salles: sessions.filter((s) => permis.has(s.class.classType.id)), erreur: null })
      })
      .catch((err) => actif && setCharge({ annee, salles: null, erreur: err }))
    return () => {
      actif = false
    }
  }, [annee])

  const session = salles?.find((s) => s.id === salle) ?? null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="heading-1 text-foreground">Liste MENFP</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Préparation de la liste de fin d&apos;année d&apos;une salle : aperçu, gel, versions et export Excel.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <SelecteurAnnee annees={annees} valeur={annee} onChange={(a) => changer({ annee: a, salle: null })} />
        {salles && salles.length > 0 ? (
          <Field className="w-auto">
            <FieldLabel htmlFor={idSalle}>Salle</FieldLabel>
            <Select value={salle ?? undefined} onValueChange={(v) => changer({ salle: v })}>
              <SelectTrigger id={idSalle} className="w-48">
                <SelectValue placeholder="Choisir une salle" />
              </SelectTrigger>
              <SelectContent>
                {salles.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {getClassSessionName(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
      </div>

      {est403(erreurSalles) ? (
        <Acces403 />
      ) : erreurSalles ? (
        <RefusMenfp erreur={erreurSalles} />
      ) : !annee ? (
        <EtatVide titre="Choisissez une année" />
      ) : !salles ? (
        <div aria-busy="true">
          <AnnonceChargement />
          <Skeleton className="h-10 w-48" />
        </div>
      ) : salles.length === 0 ? (
        <EtatVide
          titre="Aucune salle à préparer pour cette année"
          description="Seules les salles des niveaux non terminaux ont une liste MENFP de fin d'année."
        />
      ) : !session ? (
        <EtatVide titre="Choisissez une salle" />
      ) : (
        <Salle key={session.id} session={session} annee={annee} />
      )}
    </div>
  )
}

function Salle({ session, annee }: { session: ClassSession; annee: string }) {
  const ctx: ContexteLien = { academicYearId: annee, classTypeId: session.class.classType.id }
  const [apercu, setApercu] = useState<Apercu | null>(null)
  const [erreurApercu, setErreurApercu] = useState<unknown>(null)
  const [versions, setVersions] = useState<Versions | null>(null)
  const [erreurVersions, setErreurVersions] = useState<unknown>(null)
  const [occupe, setOccupe] = useState(false)

  const charger = useCallback(async (actif: () => boolean = () => true) => {
    const [a, v] = await Promise.allSettled([lireApercu(session.id), lireVersions(session.id)])
    if (!actif()) return
    if (a.status === "fulfilled") {
      setApercu(a.value)
      setErreurApercu(null)
    } else {
      setApercu(null)
      setErreurApercu(a.reason)
    }
    if (v.status === "fulfilled") {
      setVersions(v.value)
      setErreurVersions(null)
    } else {
      setVersions(null)
      setErreurVersions(v.reason)
    }
    setOccupe(false)
  }, [session.id])

  useEffect(() => {
    let annule = false
    void (async () => {
      await charger(() => !annule)
    })()
    return () => {
      annule = true
    }
  }, [charger])

  /** Rechargement après une action : le contenu reste affiché, marqué occupé. */
  const recharger = useCallback(() => {
    setOccupe(true)
    void charger()
  }, [charger])

  const noms = useMemo(
    () => new Map((apercu?.lignes ?? []).map((l) => [l.enrollmentId, `${l.nom} ${l.prenom}`])),
    [apercu],
  )
  const nommer = useCallback((id: string) => noms.get(id) ?? null, [noms])

  const premierChargement = apercu === null && erreurApercu === null && versions === null && erreurVersions === null
  if (premierChargement) {
    return (
      <div aria-busy="true" className="space-y-6">
        <AnnonceChargement />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    )
  }

  const modifie = apercu?.modifieDepuisLeGel ?? versions?.modifieDepuisLeGel ?? null

  return (
    <div className="space-y-6">
      {apercu?.bandeau ? (
        <Encadre ton="warning" titre="Année non close">
          <p>{apercu.bandeau}</p>
          <Link href="/admin/academic-years" className="text-sm font-medium underline underline-offset-2">
            Ouvrir Années scolaires
          </Link>
        </Encadre>
      ) : null}

      {apercu && apercu.blocages.length > 0 ? (
        <Encadre ton="error" titre="Gel impossible pour l'instant">
          <ListeBlocages blocages={apercu.blocages} ctx={ctx} nommer={nommer} />
        </Encadre>
      ) : null}

      {apercu && apercu.signalements.length > 0 ? (
        <Encadre ton="warning" titre="Signalements">
          <ul className="list-disc space-y-2 pl-4">
            {apercu.signalements.map((s, i) => (
              <li key={`${s.code}-${i}`} className="space-y-1">
                <p>{s.message}</p>
                <LienCorriger code={s.code} ctx={ctx} />
              </li>
            ))}
          </ul>
        </Encadre>
      ) : null}

      {modifie ? (
        <Encadre ton="info" titre={modifie.message}>
          <ul className="list-disc space-y-1 pl-4">
            {modifie.differences.map((d, i) => (
              <li key={i}>{d.message}</li>
            ))}
          </ul>
        </Encadre>
      ) : null}

      {est403(erreurApercu) ? (
        <Acces403 />
      ) : erreurApercu ? (
        <RefusMenfp erreur={erreurApercu} ctx={ctx} onReessayer={recharger} />
      ) : apercu ? (
        <CarteApercu apercu={apercu} occupe={occupe} />
      ) : null}

      <CarteGel
        session={session}
        apercu={apercu}
        aDesVersions={(versions?.versions.length ?? 0) > 0}
        ctx={ctx}
        nommer={nommer}
        onGele={recharger}
      />

      {est403(erreurVersions) ? (
        <Acces403 />
      ) : erreurVersions ? (
        <RefusMenfp erreur={erreurVersions} onReessayer={recharger} />
      ) : versions ? (
        <CarteVersions session={session} versions={versions.versions} onPurge={recharger} />
      ) : null}
    </div>
  )
}

function ListeBlocages({
  blocages,
  ctx,
  nommer,
}: {
  blocages: BlocageApercu[]
  ctx: ContexteLien
  nommer: (id: string) => string | null
}) {
  return (
    <ul className="list-disc space-y-3 pl-4">
      {blocages.map((b, i) => {
        const eleves = (b.enrollmentIds ?? []).map(nommer).filter((n): n is string => Boolean(n))
        const elements = [
          ...eleves,
          ...(b.matieres ?? []).map((m) => m.libelle),
          ...(b.matieresCpmsl ?? []).map((m) => m.nom),
          ...(b.sources ?? []).map((s) => s.nom),
        ]
        return (
          <li key={`${b.code}-${i}`} className="space-y-1">
            <p>{b.message}</p>
            {elements.length > 0 ? (
              <ul className="list-[circle] pl-4">
                {elements.map((e, j) => (
                  <li key={j}>{e}</li>
                ))}
              </ul>
            ) : null}
            <LienCorriger code={b.code} ctx={ctx} />
          </li>
        )
      })}
    </ul>
  )
}

function CarteApercu({ apercu, occupe }: { apercu: Apercu; occupe: boolean }) {
  const { entete } = apercu
  const champs: Array<[string, string]> = [
    ["École", entete.ecole?.nom ?? TRAIT],
    ["Année", entete.annee.yearString],
    ["Classe", entete.salle.niveau],
    ["Salle", entete.salle.lettre],
    ["Seuil d'alerte", decimaleAffichee(apercu.seuil)],
  ]
  return (
    <Card>
      <CardHeader>
        <h2 className="heading-4">Aperçu</h2>
        <CardDescription>Aperçu : rien n&apos;est enregistré tant que vous ne gelez pas la liste.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="flex flex-wrap gap-x-8 gap-y-2">
          {champs.map(([libelle, valeur]) => (
            <div key={libelle}>
              <dt className="text-xs text-muted-foreground">{libelle}</dt>
              <dd className="text-sm tabular-nums">{valeur}</dd>
            </div>
          ))}
        </dl>
        <TableauApercu apercu={apercu} occupe={occupe} />
      </CardContent>
    </Card>
  )
}

function CarteGel({
  session,
  apercu,
  aDesVersions,
  ctx,
  nommer,
  onGele,
}: {
  session: ClassSession
  apercu: Apercu | null
  aDesVersions: boolean
  ctx: ContexteLien
  nommer: (id: string) => string | null
  onGele: () => void
}) {
  const { toast } = useToast()
  const id = useId()
  const [motif, setMotif] = useState("")
  const [erreurMotif, setErreurMotif] = useState<string | null>(null)
  const [confirmer, setConfirmer] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [refus, setRefus] = useState<unknown>(null)
  const champMotif = useRef<HTMLTextAreaElement>(null)

  const bloque = !apercu || apercu.blocages.length > 0
  const nomSalle = getClassSessionName(session)

  function demander() {
    setRefus(null)
    if (aDesVersions && !motif.trim()) {
      setErreurMotif("Le motif est obligatoire : une version gelée existe déjà.")
      champMotif.current?.focus()
      return
    }
    setErreurMotif(null)
    setConfirmer(true)
  }

  async function confirmerGel() {
    setConfirmer(false)
    setEnvoi(true)
    try {
      const r = await geler(session.id, motif.trim() ? motif.trim() : null)
      toast({ title: `Version ${r.version} gelée`, description: nomSalle })
      setMotif("")
      onGele()
    } catch (err) {
      setRefus(err)
    } finally {
      setEnvoi(false)
    }
  }

  if (est403(refus)) {
    return (
      <Card>
        <CardHeader>
          <h2 className="heading-4">Gel</h2>
        </CardHeader>
        <CardContent>
          <Acces403 />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="heading-4">Gel</h2>
        <CardDescription>
          Une version gelée ne peut plus être modifiée ; une correction crée une nouvelle version, la précédente reste
          exportable.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field>
          <FieldLabel htmlFor={id}>Motif{aDesVersions ? " (obligatoire)" : ""}</FieldLabel>
          <Textarea
            id={id}
            ref={champMotif}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            aria-required={aDesVersions}
            aria-invalid={Boolean(erreurMotif)}
            aria-describedby={`${id}-aide${erreurMotif ? ` ${id}-erreur` : ""}`}
            rows={2}
          />
          <FieldDescription id={`${id}-aide`}>Obligatoire à partir de la version 2.</FieldDescription>
          {erreurMotif ? (
            <FieldError id={`${id}-erreur`} className="text-error-ink">
              {erreurMotif}
            </FieldError>
          ) : null}
        </Field>
        <div className="space-y-1">
          <Button type="button" onClick={demander} disabled={bloque || envoi} aria-describedby={bloque ? `${id}-bloque` : undefined}>
            {envoi ? <Spinner aria-hidden /> : null}
            {envoi ? "Gel en cours…" : aDesVersions ? "Geler une nouvelle version" : "Geler la liste"}
          </Button>
          {bloque && apercu ? (
            <p id={`${id}-bloque`} className="text-sm text-muted-foreground">
              Corrigez d&apos;abord les blocages ci-dessus.
            </p>
          ) : null}
        </div>
        {refus ? (
          <RefusMenfp
            erreur={refus}
            ctx={ctx}
            nommer={nommer}
            apresAction
            onReessayer={codeDe(refus) === "MENFP_GEL_CONCURRENT" ? onGele : undefined}
          />
        ) : null}
      </CardContent>

      <AlertDialog open={confirmer} onOpenChange={setConfirmer}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Geler la liste de {nomSalle} ?</AlertDialogTitle>
            <AlertDialogDescription>
              La version gelée ne pourra plus être modifiée ; une correction créera une nouvelle version.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmerGel()}>Geler</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function CarteVersions({
  session,
  versions,
  onPurge,
}: {
  session: ClassSession
  versions: Version[]
  onPurge: () => void
}) {
  const { toast } = useToast()
  const id = useId()
  const titre = useRef<HTMLHeadingElement>(null)
  const champMotif = useRef<HTMLTextAreaElement>(null)
  const [export_, setExport] = useState<{ id: string; erreur: unknown } | null>(null)
  const [enExport, setEnExport] = useState<string | null>(null)
  const [motif, setMotif] = useState("")
  const [erreurMotif, setErreurMotif] = useState<string | null>(null)
  const [confirmer, setConfirmer] = useState(false)
  const [purge, setPurge] = useState(false)
  const [refusPurge, setRefusPurge] = useState<unknown>(null)
  const nomSalle = getClassSessionName(session)

  async function exporter(v: Version) {
    setExport(null)
    setEnExport(v.id)
    try {
      await telechargerExport(v.id)
    } catch (err) {
      setExport({ id: v.id, erreur: err })
    } finally {
      setEnExport(null)
    }
  }

  function demanderPurge() {
    setRefusPurge(null)
    if (!motif.trim()) {
      setErreurMotif("Le motif de la purge est obligatoire.")
      champMotif.current?.focus()
      return
    }
    setErreurMotif(null)
    setConfirmer(true)
  }

  async function confirmerPurge() {
    setPurge(true)
    try {
      await purger(session.id, motif.trim())
      setConfirmer(false)
      setMotif("")
      toast({ title: "Rapports MENFP purgés", description: nomSalle })
      onPurge()
      titre.current?.focus()
    } catch (err) {
      setConfirmer(false)
      setRefusPurge(err)
    } finally {
      setPurge(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 ref={titre} tabIndex={-1} className="heading-4 outline-none">
          Versions gelées
        </h2>
      </CardHeader>
      <CardContent className="space-y-4">
        {versions.length === 0 ? (
          <EtatVide titre="Aucune version gelée" description="L'export Excel est proposé après le premier gel." />
        ) : (
          <TooltipProvider delayDuration={200}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="text-xs text-muted-foreground">Version</TableHead>
                  <TableHead scope="col" className="text-xs text-muted-foreground">Gelée le</TableHead>
                  <TableHead scope="col" className="text-xs text-muted-foreground">Motif</TableHead>
                  <TableHead scope="col" className="text-xs text-muted-foreground">Export</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="text-sm tabular-nums">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            {v.version}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-mono text-2xs">Empreinte : {v.empreinte.slice(0, 12)}…</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{dateHeureAffichee(v.geleLe)}</TableCell>
                    <TableCell className="text-sm">{v.motif ?? TRAIT}</TableCell>
                    <TableCell className="space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void exporter(v)}
                        disabled={enExport !== null}
                        aria-label={`Télécharger la version ${v.version} au format Excel`}
                      >
                        {enExport === v.id ? <Spinner aria-hidden /> : <Download aria-hidden className="h-4 w-4" />}
                        Excel
                      </Button>
                      {export_?.id === v.id ? <RefusMenfp erreur={export_.erreur} apresAction /> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TooltipProvider>
        )}

        {versions.length > 0 ? (
          <div className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold">Purge</h3>
            <Field>
              <FieldLabel htmlFor={id}>Motif de la purge (obligatoire)</FieldLabel>
              <Textarea
                id={id}
                ref={champMotif}
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                aria-required
                aria-invalid={Boolean(erreurMotif)}
                aria-describedby={erreurMotif ? `${id}-erreur` : undefined}
                rows={2}
              />
              {erreurMotif ? (
                <FieldError id={`${id}-erreur`} className="text-error-ink">
                  {erreurMotif}
                </FieldError>
              ) : null}
            </Field>
            <Button type="button" variant="destructive" onClick={demanderPurge}>
              Purger les rapports de cette salle…
            </Button>
            {refusPurge ? <RefusMenfp erreur={refusPurge} apresAction /> : null}
          </div>
        ) : null}
      </CardContent>

      <ConfirmDestructive
        open={confirmer}
        onOpenChange={setConfirmer}
        title={`Purger les rapports MENFP de ${nomSalle} ?`}
        description="Toutes les versions gelées de cette salle seront supprimées définitivement. Cette opération est irréversible."
        requireTypedName
        confirmationName={nomSalle}
        impactItems={versions.map((v) => `Version ${v.version}, gelée le ${dateHeureAffichee(v.geleLe)}`)}
        confirmLabel="Purger définitivement"
        onConfirm={confirmerPurge}
        loading={purge}
      />
    </Card>
  )
}
