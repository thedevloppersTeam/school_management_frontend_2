"use client"

/**
 * Paramètres › MENFP › Correspondances (plan A.3) : chaque source de l'univers
 * (M-09), groupée par matière CPMSL, reçoit une matière ministère ou « Ignorée »
 * (M-10, M-11). Une source dont la matière n'a pas de rubrique ne peut être
 * qu'ignorée (M-12). Après l'enregistrement, état et signalements sont relus
 * du serveur.
 */
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { RUBRIQUE_BADGE_CLASS } from "@/lib/cpmsl-classes"
import { ApiError } from "@/lib/client-fetch"
import { classerSources, lireNiveaux, lireReferentiel } from "@/lib/menfp/api"
import { adresseParametresMenfp, type ContexteLien } from "@/lib/menfp/liens"
import type { Niveaux, Referentiel, Source, SourcesEntree } from "@/lib/menfp/types"
import { Acces403, AnnonceChargement, BadgeEtat, Encadre, EtatVide, LienCorriger, RefusMenfp } from "./etats"
import type { ChoixNiveau } from "./parametres-menfp"
import { SelecteurAnnee } from "./selecteurs"

const IGNOREE = "ignoree"
const A_CLASSER = "a-classer"

const cleSource = (s: { subjectId: string; sectionId: string | null }) => `${s.subjectId}|${s.sectionId ?? ""}`
const choixInitial = (s: Source) => (!s.classee ? A_CLASSER : s.ignoree ? IGNOREE : s.matiereId ? `m:${s.matiereId}` : A_CLASSER)

export function OngletCorrespondances({ choix }: { choix: ChoixNiveau }) {
  const { annee, niveau } = choix
  const idNiveau = useId()
  const [charge, setCharge] = useState<{ annee: string; niveaux: Niveaux | null; erreur: unknown } | null>(null)
  const niveaux = charge?.annee === annee ? charge.niveaux : null
  const erreurNiveaux = charge?.annee === annee ? charge.erreur : null

  useEffect(() => {
    if (!annee) return
    let actif = true
    lireNiveaux(annee)
      .then((n) => actif && setCharge({ annee, niveaux: n, erreur: null }))
      .catch((err) => actif && setCharge({ annee, niveaux: null, erreur: err }))
    return () => {
      actif = false
    }
  }, [annee])

  const courant = niveaux?.niveaux.find((n) => n.classTypeId === niveau) ?? null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <SelecteurAnnee annees={choix.annees} valeur={annee} onChange={choix.changerAnnee} />
        {niveaux && niveaux.niveaux.length > 0 ? (
          <Field className="w-auto">
            <FieldLabel htmlFor={idNiveau}>Niveau</FieldLabel>
            <Select value={niveau ?? undefined} onValueChange={(v) => choix.changerNiveau(v)}>
              <SelectTrigger id={idNiveau} className="w-48">
                <SelectValue placeholder="Choisir un niveau" />
              </SelectTrigger>
              <SelectContent>
                {niveaux.niveaux.map((n) => (
                  <SelectItem key={n.classTypeId} value={n.classTypeId}>
                    {n.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        {courant ? <BadgeEtat etat={courant.etat} /> : null}
      </div>

      {erreurNiveaux instanceof ApiError && erreurNiveaux.status === 403 ? (
        <Acces403 />
      ) : erreurNiveaux ? (
        <RefusMenfp erreur={erreurNiveaux} />
      ) : !annee ? (
        <EtatVide titre="Choisissez une année" />
      ) : !niveaux ? (
        <div aria-busy="true">
          <AnnonceChargement />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : niveaux.niveaux.length === 0 ? (
        <EtatVide
          titre="Aucun niveau à préparer pour cette année"
          description="Un niveau sans salle cette année n'apparaît pas : créez d'abord les salles de ce niveau."
        />
      ) : !courant ? (
        <EtatVide titre="Choisissez un niveau" />
      ) : courant.etat === "absent" ? (
        <EtatVide titre="Aucun référentiel pour ce niveau" description="Créez d'abord le référentiel et ses matières ministère.">
          <Link
            href={adresseParametresMenfp("matieres", { academicYearId: annee, classTypeId: courant.classTypeId })}
            className="text-sm font-medium underline underline-offset-2"
          >
            Ouvrir Matières et coefficients
          </Link>
        </EtatVide>
      ) : (
        <Classement
          key={`${annee}-${courant.classTypeId}`}
          ctx={{ academicYearId: annee, classTypeId: courant.classTypeId }}
          signalerModifications={choix.signalerModifications}
        />
      )}

      <p className="max-w-prose text-sm text-muted-foreground">
        Les affectations de filière ne sont pas des sources en classe non terminale : elles n&apos;apparaissent pas
        ici.
      </p>
    </div>
  )
}

function Classement({
  ctx,
  signalerModifications,
}: {
  ctx: ContexteLien & { classTypeId: string }
  signalerModifications: (sale: boolean) => void
}) {
  const { toast } = useToast()
  const [referentiel, setReferentiel] = useState<Referentiel | null>(null)
  const [erreur, setErreur] = useState<unknown>(null)
  const [choixParSource, setChoixParSource] = useState<Record<string, string>>({})
  const [envoi, setEnvoi] = useState(false)
  const [refus, setRefus] = useState<unknown>(null)

  const recevoir = useCallback((r: Referentiel) => {
    setReferentiel(r)
    setChoixParSource(Object.fromEntries(r.sources.map((s) => [cleSource(s), choixInitial(s)])))
  }, [])

  const charger = useCallback(
    async (actif: () => boolean = () => true) => {
      try {
        const r = await lireReferentiel(ctx.academicYearId, ctx.classTypeId)
        if (!actif()) return
        recevoir(r)
        setErreur(null)
      } catch (err) {
        if (actif()) setErreur(err)
      }
    },
    [ctx.academicYearId, ctx.classTypeId, recevoir],
  )

  useEffect(() => {
    let annule = false
    void (async () => {
      await charger(() => !annule)
    })()
    return () => {
      annule = true
    }
  }, [charger])

  const modifiees = useMemo(
    () => (referentiel ? referentiel.sources.filter((s) => choixParSource[cleSource(s)] !== choixInitial(s)) : []),
    [referentiel, choixParSource],
  )
  const sale = modifiees.length > 0
  useEffect(() => {
    signalerModifications(sale)
  }, [sale, signalerModifications])
  useEffect(() => () => signalerModifications(false), [signalerModifications])

  const groupes = useMemo(() => {
    const parMatiere = new Map<string, Source[]>()
    for (const s of referentiel?.sources ?? []) {
      const g = parMatiere.get(s.subjectId)
      if (g) g.push(s)
      else parMatiere.set(s.subjectId, [s])
    }
    return [...parMatiere.values()]
  }, [referentiel])

  async function enregistrer() {
    if (!referentiel) return
    setRefus(null)
    setEnvoi(true)
    const entree: SourcesEntree = {
      sources: modifiees.map((s) => {
        const v = choixParSource[cleSource(s)]
        return {
          subjectId: s.subjectId,
          sectionId: s.sectionId,
          matiereId: v.startsWith("m:") ? v.slice(2) : null,
          ignoree: v === IGNOREE,
        }
      }),
    }
    try {
      recevoir(await classerSources(referentiel.id, entree))
      toast({ title: "Correspondances enregistrées" })
    } catch (err) {
      setRefus(err)
    } finally {
      setEnvoi(false)
    }
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

  const libelleMatiere = (id: string | null) => referentiel.matieres.find((m) => m.id === id)?.libelle ?? "—"

  return (
    <div className="space-y-6">
      {referentiel.signalements.length > 0 ? (
        <Encadre ton="warning" titre="Signalements" niveauTitre={3}>
          <ul className="list-disc space-y-2 pl-4">
            {referentiel.signalements.map((s, i) => (
              <li key={`${s.code}-${i}`} className="space-y-1">
                <p>{s.message}</p>
                {s.code === "MENFP_MATIERE_SANS_RUBRIQUE" ? (
                  <Link href="/admin/settings" className="text-sm font-medium underline underline-offset-2">
                    Ouvrir Établissement › Matières &amp; Rubriques
                  </Link>
                ) : s.code === "MENFP_MATIERE_SANS_SOURCE" ? (
                  <LienCorriger code={s.code} ctx={ctx} />
                ) : null}
              </li>
            ))}
          </ul>
        </Encadre>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={!sale || envoi} onClick={() => void enregistrer()}>
          {envoi ? <Spinner aria-hidden /> : null}
          {envoi ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Button type="button" variant="outline" disabled={!sale || envoi} onClick={() => recevoir(referentiel)}>
          Annuler
        </Button>
      </div>
      {refus ? <RefusMenfp erreur={refus} ctx={ctx} apresAction /> : null}

      {groupes.length === 0 ? (
        <EtatVide titre="Aucune source pour ce niveau" description="Aucune matière n'est affectée aux salles de ce niveau." />
      ) : (
        groupes.map((sources) => (
          <GroupeSources
            key={sources[0].subjectId}
            sources={sources}
            referentiel={referentiel}
            choixParSource={choixParSource}
            onChoix={(cle, v) => setChoixParSource((c) => ({ ...c, [cle]: v }))}
          />
        ))
      )}

      <Card>
        <CardHeader>
          <h3 className="heading-4">Sources classées hors de l&apos;univers</h3>
        </CardHeader>
        <CardContent>
          {referentiel.classementHorsUnivers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune source hors de l&apos;univers.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="text-xs text-muted-foreground">Source (identifiant)</TableHead>
                  <TableHead scope="col" className="text-xs text-muted-foreground">Classement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referentiel.classementHorsUnivers.map((c) => (
                  <TableRow key={cleSource(c)}>
                    <TableCell className="font-mono text-2xs">{cleSource(c)}</TableCell>
                    <TableCell className="text-sm">{c.ignoree ? "Ignorée" : libelleMatiere(c.matiereId)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function GroupeSources({
  sources,
  referentiel,
  choixParSource,
  onChoix,
}: {
  sources: Source[]
  referentiel: Referentiel
  choixParSource: Record<string, string>
  onChoix: (cle: string, valeur: string) => void
}) {
  const id = useId()
  const tete = sources[0]
  const sansRubrique = tete.rubrique === null
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <h3 className="heading-4">{tete.nomMatiere}</h3>
        {sansRubrique ? (
          <Badge variant="outline" className="font-normal text-muted-foreground">
            Sans rubrique
          </Badge>
        ) : (
          <Badge className={`border-0 ${RUBRIQUE_BADGE_CLASS}`}>{tete.rubrique}</Badge>
        )}
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {sources.map((s) => {
            const cle = cleSource(s)
            const valeur = choixParSource[cle] ?? choixInitial(s)
            const nomSource = s.nomSousMatiere ?? s.nomMatiere
            const idAide = `${id}-${s.sectionId ?? "globale"}-aide`
            return (
              <li key={cle} className="flex flex-wrap items-center gap-3 py-2">
                <span className="min-w-40 text-sm">{nomSource}</span>
                <Select value={valeur} onValueChange={(v) => onChoix(cle, v)} disabled={sansRubrique && valeur === IGNOREE}>
                  <SelectTrigger
                    className="w-64"
                    aria-label={`Matière ministère pour ${nomSource}, ${s.nomMatiere}`}
                    aria-describedby={sansRubrique ? idAide : undefined}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {valeur === A_CLASSER ? <SelectItem value={A_CLASSER}>— à classer —</SelectItem> : null}
                    {referentiel.matieres
                      // Sans rubrique : seule l'association existante reste visible
                      // (MENFP_ASSOCIATION_SANS_RUBRIQUE), pour pouvoir l'ignorer.
                      .filter((m) => !sansRubrique || valeur === `m:${m.id}`)
                      .map((m) => (
                        <SelectItem key={m.id} value={`m:${m.id}`} disabled={sansRubrique}>
                          {m.libelle}
                        </SelectItem>
                      ))}
                    <SelectItem value={IGNOREE}>Ignorée</SelectItem>
                  </SelectContent>
                </Select>
                {valeur === A_CLASSER ? (
                  <Badge variant="outline" className="border-warning-border bg-warning-soft font-normal text-warning-ink">
                    Non classée
                  </Badge>
                ) : null}
                {sansRubrique ? (
                  <FieldDescription id={idAide} className="w-full">
                    Seul choix possible : cette matière n&apos;a pas de rubrique.
                  </FieldDescription>
                ) : null}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
