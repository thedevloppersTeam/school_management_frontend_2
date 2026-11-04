"use client"

/**
 * Tableau de l'aperçu d'une salle (plan B et B.1). Toutes les valeurs sont
 * celles du serveur (M-36) : points, total, moyennes, écart et alerte ne sont
 * ni calculés ni comparés ici. Seul le formatage d'affichage est appliqué
 * (virgule décimale, deux décimales complétées par des zéros, sans arrondi).
 */
import { AlertTriangle } from "lucide-react"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { decimaleAffichee, decimaleBrute, TRAIT } from "@/lib/menfp/format"
import type { Apercu, LigneApercu } from "@/lib/menfp/types"

const FIGEE_NOM = "sticky left-0 z-10 w-36 min-w-36 shadow-[1px_0_0_hsl(var(--border))]"
const FIGEE_PRENOM = "sticky left-36 z-10 w-36 min-w-36 shadow-[1px_0_0_hsl(var(--border))]"
const ENTETE = "sticky top-0 z-20 bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
const VALEUR = "px-2 py-1 text-right text-sm tabular-nums"
const SERVICE = "px-2 py-1 text-xs"

const HORS_TOTAL = { DISPENSEE: "dispensée", SANS_EVALUATION: "sans évaluation" } as const

export function TableauApercu({ apercu, occupe }: { apercu: Apercu; occupe: boolean }) {
  const { entete, colonnes } = apercu
  const legende = `Aperçu de la liste MENFP, classe ${entete.salle.niveau}, salle ${entete.salle.lettre}, année ${entete.annee.yearString}`
  return (
    <TooltipProvider delayDuration={200}>
      <div aria-busy={occupe} className={cn(occupe && "opacity-60")}>
        <Table containerClassName="cpmsl-scroll max-h-[min(60vh,640px)] overflow-auto rounded-md border">
          <TableCaption className="sr-only">{legende}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className={cn(ENTETE, FIGEE_NOM, "z-30")}>Nom</TableHead>
              <TableHead scope="col" className={cn(ENTETE, FIGEE_PRENOM, "z-30")}>Prénom</TableHead>
              <TableHead scope="col" className={ENTETE}>Sexe</TableHead>
              <TableHead scope="col" className={ENTETE}>Né(e) le</TableHead>
              {colonnes.matieres.map((m) => (
                <TableHead key={m.id} scope="col" className={cn(ENTETE, "min-w-[96px] whitespace-normal text-right")}>
                  <span className="line-clamp-2 block">{m.libelle}</span>
                  <span className="block text-2xs tabular-nums text-muted-foreground">{decimaleBrute(m.coefficient)}</span>
                </TableHead>
              ))}
              <TableHead scope="col" className={cn(ENTETE, "text-right")}>
                <span className="block">Total</span>
                <span className="block text-2xs tabular-nums">{decimaleBrute(colonnes.sommeCoefficients)}</span>
              </TableHead>
              <TableHead scope="col" className={cn(ENTETE, "text-right")}>Moy. MENFP</TableHead>
              <TableHead scope="col" className={cn(ENTETE, "text-right")}>Moy. CPMSL</TableHead>
              <TableHead scope="col" className={cn(ENTETE, "text-right")}>Écart</TableHead>
              <TableHead scope="col" className={ENTETE}>Décision</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apercu.lignes.map((l) => (
              <Ligne key={l.enrollmentId} ligne={l} matieres={colonnes.matieres.map((m) => m.id)} />
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  )
}

function Ligne({ ligne, matieres }: { ligne: LigneApercu; matieres: string[] }) {
  const fond = ligne.alerte ? "bg-warning-soft" : "bg-card"
  const parMatiere = new Map(ligne.matieres.map((m) => [m.matiereId, m]))
  return (
    <TableRow className={cn(ligne.alerte ? "bg-warning-soft hover:bg-warning-soft" : undefined)}>
      <TableHead scope="row" className={cn(FIGEE_NOM, fond, "px-2 py-1 text-sm font-medium text-foreground")}>
        {ligne.nom}
      </TableHead>
      <TableCell className={cn(FIGEE_PRENOM, fond, "px-2 py-1 text-sm")}>{ligne.prenom}</TableCell>
      <TableCell className={SERVICE}>{ligne.sexe ?? TRAIT}</TableCell>
      <TableCell className={cn(SERVICE, "tabular-nums")}>{ligne.dateNaissance}</TableCell>
      {matieres.map((id) => {
        const m = parMatiere.get(id)
        if (!m) return <TableCell key={id} className={VALEUR}>{TRAIT}</TableCell>
        if (m.horsTotal) {
          return (
            <TableCell key={id} className={VALEUR}>
              <span aria-hidden>{TRAIT}</span>
              <span className="sr-only">{HORS_TOTAL[m.horsTotal]}</span>
            </TableCell>
          )
        }
        return (
          <TableCell key={id} className={VALEUR}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="rounded-sm tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {decimaleAffichee(m.points)}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="tabular-nums">
                  Notes : {decimaleBrute(m.sommeNotes)} / barèmes : {decimaleBrute(m.sommeBaremes)} — pourcentage :{" "}
                  {decimaleBrute(m.pourcentage)}
                </p>
              </TooltipContent>
            </Tooltip>
          </TableCell>
        )
      })}
      <TableCell className={VALEUR}>{decimaleAffichee(ligne.total)}</TableCell>
      <TableCell className={VALEUR}>{decimaleAffichee(ligne.moyenneMenfp)}</TableCell>
      <TableCell className={VALEUR}>{decimaleAffichee(ligne.moyenneCpmsl)}</TableCell>
      <TableCell className={cn(VALEUR, ligne.alerte && "font-semibold text-warning-ink")}>
        {ligne.alerte ? <AlertTriangle aria-hidden className="mr-1 inline h-3.5 w-3.5 text-warning-ink" /> : null}
        {decimaleAffichee(ligne.ecart)}
        {ligne.alerte ? <span className="sr-only"> écart au-delà du seuil</span> : null}
      </TableCell>
      <TableCell className={SERVICE}>{ligne.decisionFinale}</TableCell>
    </TableRow>
  )
}
