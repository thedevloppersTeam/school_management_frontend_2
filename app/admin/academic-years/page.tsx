"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { CPMSLYearCard } from "@/components/school/cpmsl-year-card"
import { CreateAcademicYearModalV2 } from "@/components/school/create-academic-year-modal-v2"
import { ConfirmDestructive } from "@/components/ui/confirm-destructive"
import { PlusIcon, SchoolIcon } from "lucide-react"
import {
  fetchAllAcademicYears,
  fetchSteps,
  fetchClassSessions,
  type AcademicYear,
} from "@/lib/api/dashboard"
import { toMessage } from "@/lib/errors"

// ── Types locaux ──────────────────────────────────────────────────────────────

interface YearCard {
  year: {
    id: string
    name: string
    status: 'active' | 'preparation' | 'archived'
    endDate?: string
  }
  stats?: {
    // Aligne sur le contrat de CPMSLYearCard : `total` optionnel quand aucun
    // nombre attendu n'est stocke, `current` nullable quand la mesure n'est
    // pas faite sur cet ecran.
    periods:  { current: number; total?: number; complete: boolean }
    classes:  { current: number; complete: boolean }
    subjects: { current: number | null; complete: boolean }
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Statut d'affichage d'une annee scolaire.
 *
 * `isCurrent` prime : l'annee active reste active meme si sa date de fin est
 * passee — c'est l'administratrice qui bascule, pas le calendrier.
 *
 * Sinon, une annee dont la date de fin est derriere nous est **revolue**. Sans
 * cette branche, `deriveStatus` ne retournait jamais 'archived' alors que son
 * type l'annonce, et toute la chaine en dependait : `archivedYears` restait
 * vide, donc « Copier depuis une annee archivee » ne pouvait proposer que
 * l'annee active ; le badge « Archivee », le bouton « Consulter » et la ligne
 * de resume archive de `cpmsl-year-card.tsx` n'etaient jamais atteints. Une
 * annee close depuis un an s'affichait « En preparation », en ambre, avec un
 * bouton « Activer » a un clic.
 *
 * Limite assumee : c'est une **inference de date**, pas un etat de registre.
 * Une annee reellement cloturee avant son terme, ou prolongee, sera mal
 * classee. Le champ de statut explicite cote backend est le correctif de fond
 * — chantier ouvert, voir docs/BACKLOG.md.
 */
function deriveStatus(year: AcademicYear): 'active' | 'preparation' | 'archived' {
  if (year.isCurrent) return 'active'

  const end = new Date(year.endDate)
  if (!Number.isNaN(end.getTime()) && end.getTime() < Date.now()) return 'archived'

  return 'preparation'
}

// ── Calcul des dates des étapes ───────────────────────────────────────────────

function computeStepDates(
  yearStart: string,
  yearEnd: string,
  count: number
): Array<{ startDate: string; endDate: string }> {
  const start = new Date(yearStart).getTime()
  const end   = new Date(yearEnd).getTime()
  const step  = (end - start) / count

  return Array.from({ length: count }, (_, i) => ({
    startDate: new Date(start + i * step).toISOString(),
    endDate:   new Date(start + (i + 1) * step - 1).toISOString(),
  }))
}

// ── Composant ─────────────────────────────────────────────────────────────────

/**
 * Nombre de matieres distinctes configurees pour une annee.
 *
 * Compte les matieres, pas les affectations : une matiere enseignee dans
 * douze classes compte pour une. C'est la lecture naturelle a cote de
 * « Classes 15 », et elle ne gonfle pas avec le nombre de classes.
 *
 * Le parametre `academicYearId` a ete ajoute cote backend
 * (`src/controllers/classSubjects.ts`) mais **n'est pas actif sur le serveur
 * en cours d'execution** : verifie le 2026-09-16, un identifiant d'annee
 * inexistant renvoie les memes 214 lignes. Le frontend proxie vers
 * `BACKEND_URL=http://localhost:80`, qui ne sert pas cette source.
 *
 * C'est donc le filtrage ci-dessous, sur `classSession.academicYearId`, qui
 * rend le compte juste aujourd'hui. Sans lui, la carte afficherait le total de
 * la base pour n'importe quelle annee — exactement le genre de chiffre faux
 * que ce correctif est cense supprimer. Il reste utile meme une fois le filtre
 * serveur deploye : il coute un passage sur un tableau deja en memoire.
 *
 * Cout mesure de l'appel non filtre, base de developpement, une annee :
 * 214 lignes, 463 Ko, 160 ms. Tenable a cette taille ; a surveiller quand les
 * annees s'accumuleront, puisque chaque carte paie ce transfert.
 *
 * Retourne `null` si la mesure echoue : la carte affiche alors un tiret.
 */
async function countYearSubjects(yearId: string): Promise<number | null> {
  try {
    const res = await fetch(
      `/api/class-subjects?academicYearId=${encodeURIComponent(yearId)}`,
      { credentials: 'include' }
    )
    if (!res.ok) return null

    const rows: unknown = await res.json()
    if (!Array.isArray(rows)) return null

    const distinct = new Set<string>()
    for (const row of rows as Array<{
      subjectId?: string
      classSession?: { academicYearId?: string }
    }>) {
      if (row?.classSession?.academicYearId !== yearId) continue
      if (row?.subjectId) distinct.add(row.subjectId)
    }
    return distinct.size
  } catch {
    return null
  }
}

export default function AcademicYearsPage() {
  const router   = useRouter()
  const { toast } = useToast()

  const [years, setYears]               = useState<AcademicYear[]>([])
  const [yearCards, setYearCards]       = useState<YearCard[]>([])
  const [loading, setLoading]           = useState(true)
  const [creating, setCreating]         = useState(false)
  const [activatingId, setActivatingId] = useState<string | null>(null)

  // EP-005 : état pour le modal de confirmation d'activation
  const [yearToActivate, setYearToActivate] = useState<AcademicYear | null>(null)

  // ── Chargement ────────────────────────────────────────────────────────────

  const loadYears = useCallback(async () => {
    setLoading(true)
    try {
      const allYears = await fetchAllAcademicYears()
      setYears(allYears)

      const cards = await Promise.all(
        allYears.map(async (year) => {
          const status = deriveStatus(year)

          if (status === 'archived') {
            return { year: { id: year.id, name: year.name, status, endDate: year.endDate } }
          }

          try {
            const [steps, sessions, subjectCount] = await Promise.all([
              fetchSteps(year.id),
              fetchClassSessions(year.id),
              countYearSubjects(year.id),
            ])
            return {
              year: { id: year.id, name: year.name, status, endDate: year.endDate },
              stats: {
                // Pas de `total` : le nombre d'etapes attendu n'est stocke
                // nulle part — le modele AcademicYearStep ne le porte pas. Un
                // « 4 » en dur affichait « 5/4 » pour une annee a cinq etapes.
                periods: { current: steps.length, complete: steps.length > 0 },
                classes: { current: sessions.length, complete: sessions.length > 0 },
                // `null` quand la mesure echoue : un tiret dit « je ne sais
                // pas », un zero affirme qu'il n'y en a pas.
                subjects: {
                  current: subjectCount,
                  complete: (subjectCount ?? 0) > 0,
                }
              }
            }
          } catch {
            return { year: { id: year.id, name: year.name, status, endDate: year.endDate } }
          }
        })
      )

      setYearCards(cards)
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les années scolaires", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadYears() }, [loadYears])

  // ── Activation d'une année (EP-005) ───────────────────────────────────────
  //
  // Flow :
  //   1. Click "Activer" sur une card → handleActivateYear ouvre le modal
  //   2. L'Administrateur tape le nom de l'année pour confirmer
  //   3. Click "Activer définitivement" → handleConfirmActivation exécute

  // Étape 1 — ouverture du modal
  const handleActivateYear = (yearId: string) => {
    const target = years.find(y => y.id === yearId)
    if (!target) return
    setYearToActivate(target)
  }

  // Étape 2 — exécution après confirmation
  const handleConfirmActivation = async () => {
    if (!yearToActivate) return

    setActivatingId(yearToActivate.id)
    try {
      const res = await fetch(`/api/academic-years/set-current/${yearToActivate.id}`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Erreur activation')
      }

      toast({
        title: "Année activée",
        description: `${yearToActivate.name} est maintenant l'année scolaire active.`
      })
      setYearToActivate(null)
      await loadYears()
    } catch (e) {
      toast({
        title: "Erreur d'activation",
        description: toMessage(e, "lors de l'activation de l'année scolaire"),
        variant: "destructive"
      })
    } finally {
      setActivatingId(null)
    }
  }

  // ── Création d'une année ──────────────────────────────────────────────────

  const handleCreateYear = async (data: {
    name: string
    startDate?: string
    endDate?: string
    numberOfPeriods?: 4 | 5
    copyFromYearId?: string
  }) => {
    setCreating(true)
    try {
      // La modale envoie desormais toujours les deux dates, et elle les
      // affiche. Ce repli ne sert donc plus que si un autre appelant omet les
      // dates — mais il etait faux : calcule sur `new Date().getFullYear()`, il
      // produisait une annee decalee d'un an des qu'on creait hors de la
      // fenetre aout-decembre. Il derive maintenant du nom, comme la modale.
      const nameMatch = data.name.match(/(\d{4})-(\d{4})/)
      const yearStart = data.startDate ||
        (nameMatch ? `${nameMatch[1]}-09-01` : `${new Date().getFullYear()}-09-01`)
      const yearEnd   = data.endDate ||
        (nameMatch ? `${nameMatch[2]}-06-30` : `${new Date().getFullYear() + 1}-06-30`)

      const res = await fetch('/api/academic-years/create', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:       data.name,
          yearString: data.name,
          startDate:  yearStart,
          endDate:    yearEnd,
        })
      })

      if (!res.ok) {
        // Le message du serveur distingue un doublon de nom d'une panne. Le
        // remplacer par une constante rendait les deux indiscernables, alors
        // que `toMessage` est justement la pour le restituer.
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message || `Échec de la création (HTTP ${res.status})`)
      }
      const { year } = await res.json()
      const newYearId = year.id

      const stepCount = data.numberOfPeriods || 4
      const stepNames = ['1ère Étape', '2ème Étape', '3ème Étape', '4ème Étape', '5ème Étape']
        .slice(0, stepCount)

      const stepDates = computeStepDates(yearStart, yearEnd, stepCount)

      // La creation d'une annee est irreversible : aucun ecran de ce produit ne
      // sait la defaire. Elle ne peut donc pas se permettre d'annoncer « 4
      // etapes » sans avoir verifie que le serveur en a ecrit quatre. Chaque
      // appel de la cascade est desormais compte sur sa reponse reelle.
      const stepResults = await Promise.all(
        stepNames.map((name, index) =>
          fetch(`/api/academic-years/${newYearId}/steps/create`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              stepNumber: index + 1,
              startDate:  stepDates[index].startDate,
              endDate:    stepDates[index].endDate,
            })
          }).then(r => r.ok).catch(() => false)
        )
      )
      const stepsCreated = stepResults.filter(Boolean).length

      let classesExpected = 0
      let classesCreated = 0
      const classesRes = await fetch('/api/classes/', { credentials: 'include' })
      if (classesRes.ok) {
        const classes: Array<{ id: string }> = await classesRes.json()
        classesExpected = classes.length

        if (classes.length > 0) {
          const sessionResults = await Promise.all(
            classes.map(cls =>
              fetch('/api/class-sessions/create', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  classId:        cls.id,
                  academicYearId: newYearId,
                })
              }).then(r => r.ok).catch(() => false)
            )
          )
          classesCreated = sessionResults.filter(Boolean).length
        }
      } else {
        classesExpected = -1 // liste des classes indisponible : on ne sait pas
      }

      let copiedExpected = 0
      let copiedOk = 0
      if (data.copyFromYearId && newYearId) {
        const sessionsRes = await fetch(
          `/api/class-sessions?academicYearId=${data.copyFromYearId}`,
          { credentials: 'include' }
        )
        const sourceSessions: Array<{ id: string; classId: string }> =
          sessionsRes.ok ? await sessionsRes.json() : []

        await Promise.all(sourceSessions.map(async (sourceSession) => {
          const subjectsRes = await fetch(
            `/api/class-subjects?classSessionId=${sourceSession.id}`,
            { credentials: 'include' }
          )
          if (!subjectsRes.ok) return
          const sourceSubjects: Array<{ subjectId: string; coefficientOverride: number | null }> =
            await subjectsRes.json()

          const existingSessionRes = await fetch(
            `/api/class-sessions?academicYearId=${newYearId}&classId=${sourceSession.classId}`,
            { credentials: 'include' }
          )
          const existingSessions = existingSessionRes.ok ? await existingSessionRes.json() : []
          const targetSessionId = existingSessions[0]?.id
          if (!targetSessionId) return

          const copyResults = await Promise.all(sourceSubjects.map(cs =>
            fetch('/api/class-subjects/create', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                classSessionId:      targetSessionId,
                subjectId:           cs.subjectId,
                coefficientOverride: cs.coefficientOverride ?? null,
              })
            }).then(r => r.ok).catch(() => false)
          ))
          copiedExpected += sourceSubjects.length
          copiedOk += copyResults.filter(Boolean).length
        }))
      }

      const structureIncomplete =
        stepsCreated < stepCount ||
        (classesExpected > 0 && classesCreated < classesExpected) ||
        classesExpected === -1
      const copyIncomplete = structureIncomplete || copiedOk < copiedExpected

      if (data.copyFromYearId && newYearId) {
        toast({
          title: copyIncomplete ? "Année créée, copie partielle" : "Année créée avec copie",
          description:
            `${data.name} — ${stepsCreated}/${stepCount} étapes, ` +
            `${copiedOk}/${copiedExpected} matières copiées.` +
            (copyIncomplete ? " Vérifiez la configuration avant de saisir des notes." : ""),
          variant: copyIncomplete ? "destructive" : undefined,
        })
      } else {
        toast({
          title: structureIncomplete ? "Année créée, structure incomplète" : "Année créée",
          description:
            `${data.name} — ${stepsCreated}/${stepCount} étapes` +
            (classesExpected > 0 ? `, ${classesCreated}/${classesExpected} classes` : "") +
            "." +
            (structureIncomplete ? " Vérifiez la configuration avant de saisir des notes." : ""),
          variant: structureIncomplete ? "destructive" : undefined,
        })
      }

      await loadYears()
    } catch (e) {
      toast({
        title: "Erreur",
        description: toMessage(e, "lors de la création de l'année scolaire"),
        variant: "destructive"
      })
    } finally {
      setCreating(false)
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  const handleConfigure = (yearId: string) => {
    router.push(`/admin/academic-year/${yearId}/config`)
  }

  // ── Données pour le modal ─────────────────────────────────────────────────

  const activeYear    = years.find(y => y.isCurrent)
  const archivedYears = years.filter(y => deriveStatus(y) === 'archived')
  const hasActiveYear = !!activeYear

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="space-y-1">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-48" />
        </div>
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-1 text-foreground">
            Années Scolaires
          </h1>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Gérez les années académiques de votre établissement
          </p>
        </div>

        <CreateAcademicYearModalV2
          activeYear={activeYear}
          archivedYears={archivedYears}
          hasActiveYear={hasActiveYear}
          onSubmit={handleCreateYear}
          trigger={
            /* Action primaire de la page : « Nouvelle annee » est la seule
               porte vers la preparation de l'annee suivante, un geste pose une
               fois l'an, qui doit donc se retrouver. En `outline`, son fond
               valait exactement celui de la page et son filet 1,22:1 — sous
               les 3:1 que WCAG 1.4.11 exige quand c'est la limite qui
               identifie le composant. */
            <Button className="gap-2" disabled={creating}>
              <PlusIcon className="h-4 w-4" />
              {creating ? 'Création...' : 'Nouvelle année'}
            </Button>
          }
        />
      </div>

      {/*
        Le bandeau d'avertissement permanent a ete retire le 2026-09-16.

        Il s'allumait en ambre des qu'une annee etait active — c'est-a-dire en
        fonctionnement normal — pour annoncer qu'une annee etait active. Le
        meme fait etait deja porte par le badge vert de la carte et par le
        point vert de l'en-tete : trois affichages, dont deux codes couleur
        opposes a 50 px d'ecart. DESIGN.md reserve `avertissement` a l'annee
        archivee en lecture seule, a la note manquante et a la session expiree,
        et pose la Regle de la Rarete : si tout est colore, plus rien n'alerte.

        Sa seule information utile — comment changer d'annee active — est
        contextuelle a une intention, pas a un etat : elle vit desormais dans
        la description de ConfirmDestructive, au moment ou l'on agit.
      */}

      {/* Year cards list */}
      <div className="space-y-3">
        {yearCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <SchoolIcon className="h-7 w-7 text-muted-foreground" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-foreground">
              Aucune année scolaire
            </h2>
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">
              Créez votre première année pour commencer
            </p>
          </div>
        ) : (
          yearCards.map(card => (
            <CPMSLYearCard
              key={card.year.id}
              year={card.year}
              stats={card.stats}
              onConfigure={handleConfigure}
              onActivate={card.year.status === 'preparation' ? handleActivateYear : undefined}
              isActivating={activatingId === card.year.id}
            />
          ))
        )}
      </div>

      {/* EP-005 : Modal de confirmation d'activation */}
      <ConfirmDestructive
        open={yearToActivate !== null}
        onOpenChange={(open) => !open && setYearToActivate(null)}
        title="Activer cette année scolaire ?"
        description={
          yearToActivate
            ? `Cette action change l'année scolaire active pour toute l'application. ` +
              `Les utilisateurs verront désormais les données de ${yearToActivate.name}. ` +
              (hasActiveYear
                ? `L'année actuellement active (${activeYear?.name}) sera automatiquement ` +
                  `désactivée et passera en lecture seule dans cette liste.`
                : `Aucune année n'est active actuellement.`)
            : ""
        }
        confirmationName={yearToActivate?.name}
        requireTypedName={true}
        confirmLabel="Activer définitivement"
        onConfirm={handleConfirmActivation}
        loading={activatingId !== null}
      />
    </div>
  )
}