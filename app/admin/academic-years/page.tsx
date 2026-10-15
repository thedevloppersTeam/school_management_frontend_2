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
import { paginate } from "@/lib/pagination"
import { Pagination } from "@/components/ui/table-pagination"
import { useAcademicYearContext } from "@/lib/contexts/academic-year-context"
import { deriveAcademicYearStatus } from "@/lib/academic-years/status"

/**
 * Grille de 3 colonnes sur 5 lignes. Les annees s'accumulent d'une par an et ne
 * sont jamais supprimees : sans decoupage, l'ecran s'allonge indefiniment.
 */
const ITEMS_PER_PAGE = 15

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

/** Date courte française, ou '—' si la date est illisible. */
function formatDateCourte(raw?: string): string {
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
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
  const { refresh: refreshActiveYear } = useAcademicYearContext()

  const [years, setYears]               = useState<AcademicYear[]>([])
  const [yearCards, setYearCards]       = useState<YearCard[]>([])
  const [loading, setLoading]           = useState(true)
  const [creating, setCreating]         = useState(false)
  const [activatingId, setActivatingId] = useState<string | null>(null)

  // EP-005 : état pour le modal de confirmation d'activation
  const [yearToActivate, setYearToActivate] = useState<AcademicYear | null>(null)

  /**
   * Page demandee. Elle n'est jamais bornee ICI : `paginate` la ramene dans
   * l'intervalle au calcul. Supprimer des annees alors qu'on est en page 2 ne
   * laisse donc pas une grille vide, et aucun effet de correction n'est requis.
   */
  const [page, setPage] = useState(1)

  // ── Chargement ────────────────────────────────────────────────────────────

  const loadYears = useCallback(async () => {
    setLoading(true)
    try {
      const allYears = await fetchAllAcademicYears()
      setYears(allYears)

      const cards = await Promise.all(
        allYears.map(async (year) => {
          const status = deriveAcademicYearStatus(year)

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

  // Carte déjà calculée pour l'année visée : on réutilise ses statistiques
  // plutôt que de les recharger pour la modale.
  const activationCard = yearToActivate
    ? yearCards.find(c => c.year.id === yearToActivate.id)
    : undefined
  const activationIsArchived = activationCard?.year.status === 'archived'

  /**
   * Contexte chiffré de l'année visée, tel qu'il est DÉJÀ calculé pour la
   * carte. Rien n'est rechargé.
   *
   * DEUX LIMITES, toutes deux assumées :
   *   · `loadYears` ne calcule AUCUNE statistique pour une année archivée
   *     (elle sort tôt, sans `stats`). Pour une réactivation — le seul cas où
   *     ce contexte servirait — il est donc vide en pratique, et la modale se
   *     rabat sur la date de fin, seule donnée disponible à coup sûr.
   *   · le nombre d'élèves n'est calculé nulle part sur cet écran : le type
   *     `YearCard` ne porte que périodes, classes et matières.
   * Charger ces compteurs pour les années archivées est un choix produit, pas
   * un oubli technique.
   */
  const activationContexte = (() => {
    const n = activationCard?.stats?.classes?.current
    return n != null ? `${n} classes` : null
  })()

  // Étape 1 — ouverture du modal
  const handleActivateYear = (yearId: string) => {
    const target = years.find(y => y.id === yearId)
    if (!target) return
    setYearToActivate(target)
  }

  // Étape 2 — exécution après confirmation
  const handleConfirmActivation = async () => {
    if (!yearToActivate) return

    // Réactiver une année close est un geste distinct, et le serveur le refuse
    // (400) sans cette confirmation explicite. Le drapeau n'est donc pas une
    // formalité d'interface : il porte l'intention jusqu'au journal d'audit,
    // qui enregistre `confirmedReactivation`.
    const reactivation = activationIsArchived

    setActivatingId(yearToActivate.id)
    try {
      const res = await fetch(`/api/academic-years/set-current/${yearToActivate.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reactivation ? { confirmReactivation: true } : {}),
      })

      const payload = await res.json().catch(() => null)

      if (!res.ok) {
        // Le contrôleur rend `error` sur un refus métier (400) et `message`
        // sur une panne. Ne lire que `message` rendait le refus muet — c'est
        // le défaut que ce lot corrige, on ne le réintroduit pas ici.
        throw new Error(
          payload?.error || payload?.message || `Échec de l'activation (HTTP ${res.status})`,
        )
      }

      toast({
        title: reactivation ? "Année réactivée" : "Année activée",
        description: `${yearToActivate.name} est maintenant l'année scolaire active.`
      })
      setYearToActivate(null)
      // `loadYears` rafraichit CETTE liste ; `refreshActiveYear` rafraichit le
      // bandeau du bandeau superieur et tous les autres consommateurs. Sans le
      // second, le badge restait fige sur l'ancienne annee jusqu'a un
      // rechargement complet de la page.
      await Promise.all([loadYears(), refreshActiveYear()])
    } catch (e) {
      // La modale reste OUVERTE : l'administratrice voit le message et peut
      // réessayer ou annuler, au lieu d'un échec qui ferme tout en silence.
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

  /**
   * Création d'une année — UN appel, une transaction côté serveur.
   *
   * Remplace une cascade de requêtes indépendantes pilotée d'ici : l'année,
   * puis une requête par étape, puis une par salle, puis une par matière —
   * jusqu'à ~280 pour une année copiée. Chaque échec y était avalé par
   * `.then(r => r.ok).catch(() => false)`, et l'écran annonçait « structure
   * incomplète » sur une année qu'aucun écran ne savait défaire.
   *
   * Le serveur garantit désormais la structure entière ou rien. Il n'y a donc
   * plus de comptage d'échecs partiels à faire ici : il n'existe plus d'état
   * partiel à compter.
   */
  const handleCreateYear = async (data: {
    name: string
    startDate?: string
    endDate?: string
    numberOfPeriods?: 4 | 5
    copyFromYearId?: string
  }) => {
    setCreating(true)
    try {
      // Les dates ne sont plus repliées ici : le serveur refuse une date
      // invalide avec un message, au lieu d'en inventer une silencieusement.
      const res = await fetch('/api/academic-years', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:          data.name,
          yearString:    data.name,
          startDate:     data.startDate,
          endDate:       data.endDate,
          numberOfSteps: data.numberOfPeriods ?? 4,
          ...(data.copyFromYearId
            ? {
                copyFrom: {
                  sourceAcademicYearId: data.copyFromYearId,
                  includeRooms:    true,
                  includeSubjects: true,
                },
              }
            : {}),
        }),
      })

      const payload = await res.json().catch(() => null)

      if (!res.ok) {
        // Le message du serveur est restitué tel quel. Un doublon (409), une
        // date invalide (400) et une panne ne se ressemblent plus à l'écran.
        throw new Error(
          payload?.error || payload?.message || `Échec de la création (HTTP ${res.status})`,
        )
      }

      const { stepsCreated, roomsCreated, subjectsCreated } = payload ?? {}
      const details = [
        `${stepsCreated} étape${stepsCreated > 1 ? 's' : ''}`,
        ...(roomsCreated ? [`${roomsCreated} salle${roomsCreated > 1 ? 's' : ''}`] : []),
        ...(subjectsCreated ? [`${subjectsCreated} matière${subjectsCreated > 1 ? 's' : ''}`] : []),
      ].join(', ')

      toast({
        title: "Année créée",
        description: `${data.name} — ${details}.`,
      })

      await loadYears()
    } catch (e) {
      toast({
        title: "Création impossible",
        description: toMessage(e, "lors de la création de l'année scolaire"),
        variant: "destructive",
      })
      // RELANCE : sans ça, la modale ne saurait pas que l'appel a échoué et se
      // fermerait en emportant la saisie. Le toast reste — il porte le message
      // hors de la modale —, mais il ne suffit plus.
      throw e
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
  const archivedYears = years.filter(y => deriveAcademicYearStatus(y) === 'archived')

  // Decoupage APRES toute derivation de la liste — il n'y a aujourd'hui ni
  // filtre ni tri sur cet ecran, mais l'ordre compte le jour ou il y en aura :
  // paginer d'abord afficherait une page 2 calculee sur une liste non filtree.
  const pageCourante = paginate(yearCards, page, ITEMS_PER_PAGE)
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
          years={years}
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
        <div>
          {/* `items-start` : sans lui, les cartes d'une meme ligne s'etirent a
              la hauteur de la plus haute. Une annee archivee — qui n'a ni
              compteurs ni bouton Configurer plein — se retrouvait avec un
              grand vide au milieu pour s'aligner sur ses voisines. */}
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pageCourante.items.map(card => (
              <CPMSLYearCard
                key={card.year.id}
                year={card.year}
                stats={card.stats}
                onConfigure={handleConfigure}
                onActivate={
                  card.year.status === 'preparation' || card.year.status === 'archived'
                    ? handleActivateYear
                    : undefined
                }
                isActivating={activatingId === card.year.id}
              />
            ))}
          </div>

          {/* Sous la grille. Le composant se masque tout seul a une seule page
              (`pageCount <= 1`) : aucune condition a ecrire ici. */}
          <Pagination
            page={pageCourante.page}
            pageCount={pageCourante.pageCount}
            onPageChange={setPage}
            rangeStart={pageCourante.rangeStart + 1}
            rangeEnd={pageCourante.rangeEnd}
            total={pageCourante.total}
            label="Pagination des années scolaires"
            unit="années"
          />
        </div>
      )}

      {/* EP-005 : Modal de confirmation d'activation */}
      <ConfirmDestructive
        open={yearToActivate !== null}
        onOpenChange={(open) => !open && setYearToActivate(null)}
        title={
          activationIsArchived
            ? "Réactiver cette année archivée ?"
            : "Activer cette année scolaire ?"
        }
        description={
          yearToActivate
            ? (activationIsArchived
                ? `${yearToActivate.name} est une année CLOSE, terminée le ` +
                  `${formatDateCourte(yearToActivate.endDate)}` +
                  `${activationContexte ? ` (${activationContexte})` : ''}. ` +
                  `La réactiver la remet en cours pour toute l'application. `
                : ``) +
              `Cette action change l'année scolaire active pour toute l'application. ` +
              `Les utilisateurs verront désormais les données de ${yearToActivate.name}. ` +
              (hasActiveYear
                ? `L'année actuellement active (${activeYear?.name}) sera automatiquement ` +
                  `désactivée et passera en lecture seule dans cette liste.`
                : `Aucune année n'est active actuellement.`)
            : ""
        }
        confirmationName={yearToActivate?.name}
        requireTypedName={true}
        confirmLabel={
          activationIsArchived ? "Confirmer la réactivation" : "Activer définitivement"
        }
        onConfirm={handleConfirmActivation}
        loading={activatingId !== null}
      />
    </div>
  )
}