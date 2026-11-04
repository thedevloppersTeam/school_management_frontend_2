"use client"

/**
 * Briques d'affichage communes aux écrans MENFP (plan d'écrans D et E).
 * Rôles d'état de DESIGN.md seulement (success, warning, error, info, muted) ;
 * jamais `destructive` pour un constat.
 */
import { useEffect, useRef, type ReactNode } from "react"
import Link from "next/link"
import { AlertTriangle, Info, Lock, XCircle } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { cn } from "@/lib/utils"
import { LIBELLES_ETAT } from "@/lib/menfp/format"
import { lienCorrection, type ContexteLien } from "@/lib/menfp/liens"
import { lireRefus } from "@/lib/menfp/refus"
import type { EtatReferentiel } from "@/lib/menfp/types"

type Ton = "warning" | "error" | "info"

const TONS: Record<Ton, { boite: string; icone: string; Icone: typeof AlertTriangle }> = {
  warning: { boite: "border-warning-border bg-warning-soft text-warning-ink", icone: "[&>svg]:text-warning-ink", Icone: AlertTriangle },
  error: { boite: "border-error-border bg-error-soft text-error-ink", icone: "[&>svg]:text-error", Icone: XCircle },
  info: { boite: "border-info-border bg-info-soft text-info-ink", icone: "[&>svg]:text-info", Icone: Info },
}

/**
 * Encadré d'état titré. `annonce` : "status" pour ce qui s'affiche au chargement,
 * "alert" pour ce qui suit une action (le titre reçoit alors le focus).
 */
export function Encadre({
  ton,
  titre,
  annonce = "status",
  niveauTitre = 2,
  children,
  className,
}: {
  ton: Ton
  titre: ReactNode
  annonce?: "status" | "alert"
  niveauTitre?: 2 | 3
  children?: ReactNode
  className?: string
}) {
  const { boite, icone, Icone } = TONS[ton]
  const refTitre = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (annonce === "alert") refTitre.current?.focus()
  }, [annonce])
  const Titre = niveauTitre === 2 ? "h2" : "h3"
  return (
    <Alert role={annonce} className={cn(boite, icone, className)}>
      <Icone aria-hidden className="h-4 w-4" />
      <div className="space-y-2">
        <Titre ref={refTitre} tabIndex={-1} className="text-sm font-semibold leading-snug outline-none">
          {titre}
        </Titre>
        {children ? <div className="text-sm">{children}</div> : null}
      </div>
    </Alert>
  )
}

/** Lien de correction, en texte explicite. */
export function LienCorriger({ code, ctx }: { code: string | null; ctx: ContexteLien | null }) {
  if (!code || !ctx) return null
  const lien = lienCorrection(code, ctx)
  if (!lien) return null
  return (
    <Link href={lien.href} className="text-sm font-medium underline underline-offset-2">
      {lien.libelle}
    </Link>
  )
}

/**
 * Affichage d'un refus du serveur (plan D) : TOUS les refus, dans l'ordre reçu.
 * 403 : encadré neutre. `nommer` retrouve le nom d'un élève par son inscription,
 * quand l'écran le connaît (lignes de l'aperçu).
 */
export function RefusMenfp({
  erreur,
  ctx = null,
  apresAction = false,
  nommer,
  onReessayer,
}: {
  erreur: unknown
  ctx?: ContexteLien | null
  apresAction?: boolean
  nommer?: (enrollmentId: string) => string | null
  onReessayer?: () => void
}) {
  const lu = lireRefus(erreur)
  if (lu.status === 403) return <Acces403 />
  return (
    <Encadre ton="error" titre={lu.titre} annonce={apresAction ? "alert" : "status"}>
      <ul className="list-disc space-y-2 pl-4">
        {lu.elements.map((e, i) => {
          const noms = nommer ? e.enrollmentIds.map(nommer).filter((n): n is string => Boolean(n)) : []
          return (
            <li key={`${e.code ?? "refus"}-${i}`} className="space-y-1">
              <p className="font-medium">{e.libelle}</p>
              {e.detail ? <p>{e.detail}</p> : null}
              {noms.length > 0 ? (
                <ul className="list-[circle] pl-4">
                  {noms.map((n, j) => (
                    <li key={j}>{n}</li>
                  ))}
                </ul>
              ) : null}
              <LienCorriger code={e.code} ctx={ctx} />
            </li>
          )
        })}
      </ul>
      {onReessayer ? (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onReessayer}>
          Réessayer
        </Button>
      ) : null}
    </Encadre>
  )
}

/** État vide ou neutre (plan E.4) ; titre en h2 de 15 px (DESIGN.md, écarts du 14/09). */
export function EtatVide({
  titre,
  description,
  icone,
  children,
}: {
  titre: string
  description?: ReactNode
  icone?: ReactNode
  children?: ReactNode
}) {
  return (
    <Empty className="border border-solid">
      <EmptyHeader>
        {icone ? <EmptyMedia variant="icon">{icone}</EmptyMedia> : null}
        <EmptyTitle role="heading" aria-level={2} className="text-base font-semibold">
          {titre}
        </EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {children ? <EmptyContent>{children}</EmptyContent> : null}
    </Empty>
  )
}

/** 403 : défaut de permission, neutre (ni erreur ni alerte). */
export function Acces403() {
  return (
    <EtatVide
      titre="Accès refusé"
      icone={<Lock aria-hidden />}
      description="Vous n'avez pas la permission d'accéder à cette partie (permission MENFP requise)."
    />
  )
}

const CLASSES_ETAT: Record<EtatReferentiel, string> = {
  complet: "border-success-border bg-success-soft text-success-ink",
  incomplet: "border-warning-border bg-warning-soft text-warning-ink",
  absent: "text-muted-foreground",
}

/** Badge d'état d'un référentiel (M-61) : le texte porte l'état, la couleur le double. */
export function BadgeEtat({ etat }: { etat: EtatReferentiel }) {
  return (
    <Badge variant="outline" className={cn("font-normal", CLASSES_ETAT[etat])}>
      {LIBELLES_ETAT[etat]}
    </Badge>
  )
}

/** Annonce de chargement pour les lecteurs d'écran (plan E.3). */
export function AnnonceChargement() {
  return (
    <span role="status" className="sr-only">
      Chargement…
    </span>
  )
}
