"use client";

/**
 * Cellule « Enseignant » d'une matière de salle, dans la configuration de l'année
 * (lot ID-T-F-3, partie frontend ; amendements A1 à A10 de la revue ui-designer).
 *
 * - Liste Radix (A1) : rien n'est envoyé tant qu'une option n'est pas choisie ;
 *   un choix envoie aussitôt POST /api/class-subjects/teacher/:id par le relais.
 * - Liste CONTRÔLÉE par la valeur du serveur : sur un échec, elle reste sur
 *   l'enseignant en place ; sur un succès, la ligne est mise à jour par
 *   `onEnregistre`, sans recharger le tableau (A2).
 * - État en mots sous la liste (A3) ; l'annonce aux lecteurs d'écran passe par
 *   la région partagée du tableau (`onAnnonce`).
 * - Retrait confirmé (A5, Q-3) ; remplacement nommé dans « Enregistré ».
 * - Enseignant inactif déjà affecté (A6) : option désactivée à part, et pastille.
 * - Année archivée (A7) : le nom en texte simple, sans liste.
 *
 * Toute décision vit dans lib/affectations/enseignant.ts ; aucune lecture de
 * l'objet `teacher` de GET /api/class-subjects (Q-2).
 */
import { useEffect, useId, useRef, useState } from "react";
import { CheckIcon, Loader2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { clientFetch } from "@/lib/client-fetch";
import { toMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { FicheLigne } from "@/lib/enseignants/fiches";
import {
  AUCUN_ENSEIGNANT,
  LIBELLE_AUCUN_ENSEIGNANT,
  MESSAGE_EN_COURS,
  confirmationRetrait,
  corpsAffectation,
  demandeConfirmation,
  estUnChangement,
  libelleListe,
  messageEchec,
  messageEnregistre,
  nomEnseignant,
  optionsEnseignants,
  teacherIdDuChoix,
  texteEnseignantEnPlace,
  valeurDuChoix,
  type GesteAffectation,
} from "@/lib/affectations/enseignant";

/** Durée d'affichage de « Enregistré » ; un échec reste jusqu'au geste suivant. */
const DUREE_ENREGISTRE_MS = 4000;

type Etat =
  | { type: "repos" }
  | { type: "envoi" }
  | { type: "enregistre"; message: string }
  | { type: "echec"; message: string };

interface ReponseAffectation {
  classSubjectId: string;
  teacherId: string | null;
  geste: GesteAffectation;
}

export interface AffectationEnseignantCellProps {
  classSubjectId: string;
  matiere: string;
  trackCode: string | null;
  /** Libellé de la salle, pour la phrase de confirmation du retrait. */
  salle: string;
  /** Enseignant en place (teachers.id), lu du serveur ; null = aucun. */
  teacherId: string | null;
  /** Toutes les fiches (inactives comprises) ; null tant qu'elles ne sont pas chargées. */
  fiches: FicheLigne[] | null;
  /** Message si la liste des fiches n'a pas pu être chargée. */
  erreurFiches: string | null;
  isArchived: boolean;
  onEnregistre: (classSubjectId: string, teacherId: string | null) => void;
  onAnnonce: (message: string) => void;
}

export function AffectationEnseignantCell({
  classSubjectId,
  matiere,
  trackCode,
  salle,
  teacherId,
  fiches,
  erreurFiches,
  isArchived,
  onEnregistre,
  onAnnonce,
}: AffectationEnseignantCellProps) {
  const [etat, setEtat] = useState<Etat>({ type: "repos" });
  const [retraitDemande, setRetraitDemande] = useState(false);
  const declencheur = useRef<HTMLButtonElement>(null);
  const idEtat = useId();

  useEffect(() => {
    if (etat.type !== "enregistre") return;
    const minuteur = setTimeout(() => setEtat({ type: "repos" }), DUREE_ENREGISTRE_MS);
    return () => clearTimeout(minuteur);
  }, [etat]);

  // Année archivée (A7) : texte simple ; la raison est portée par le bandeau de l'année.
  if (isArchived) {
    if (teacherId !== null && fiches === null && !erreurFiches) {
      return <span className="text-sm text-muted-foreground">Chargement…</span>;
    }
    return (
      <span className={cn("text-sm", teacherId ? "text-foreground" : "text-muted-foreground")}>
        {texteEnseignantEnPlace(fiches ?? [], teacherId)}
      </span>
    );
  }

  const { actifs, inactifEnPlace } = optionsEnseignants(fiches ?? [], teacherId);
  const envoiEnCours = etat.type === "envoi";
  const indisponible = fiches === null;
  const nomEnPlace = nomEnseignant(fiches ?? [], teacherId);

  async function envoyer(apres: string | null) {
    const ancien = nomEnPlace;
    setEtat({ type: "envoi" });
    try {
      const reponse = await clientFetch<ReponseAffectation>(
        `/api/class-subjects/teacher/${encodeURIComponent(classSubjectId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(corpsAffectation(apres)),
        },
      );
      onEnregistre(classSubjectId, reponse.teacherId);
      const message = messageEnregistre({
        geste: reponse.geste,
        matiere,
        ancien,
        nouveau: nomEnseignant(fiches ?? [], reponse.teacherId),
      });
      setEtat({ type: "enregistre", message });
      onAnnonce(message);
    } catch (err) {
      const message = messageEchec(toMessage(err, "lors de l'enregistrement de l'enseignant"));
      setEtat({ type: "echec", message });
      onAnnonce(message);
    }
  }

  function choisir(valeur: string) {
    // Pendant un envoi, la liste reste active (le focus y reste, A2) mais un autre choix est ignoré.
    if (envoiEnCours) return;
    const apres = teacherIdDuChoix(valeur);
    if (!estUnChangement(teacherId, apres)) return;
    if (demandeConfirmation(teacherId, apres)) {
      setRetraitDemande(true);
      return;
    }
    void envoyer(apres);
  }

  const confirmation = confirmationRetrait({
    nom: nomEnPlace ?? "L'enseignant",
    matiere,
    salle,
  });
  const inactifAffiche = inactifEnPlace !== null && inactifEnPlace.valeur === teacherId;

  return (
    <div className="flex min-w-[14rem] flex-col gap-1">
      <Select
        value={valeurDuChoix(teacherId)}
        onValueChange={choisir}
        // Jamais désactivée pendant l'envoi : une liste désactivée perd le focus clavier (revue ui-designer).
        disabled={indisponible}
      >
        <SelectTrigger
          ref={declencheur}
          aria-label={libelleListe(matiere, trackCode)}
          aria-busy={envoiEnCours || undefined}
          aria-invalid={etat.type === "echec" || undefined}
          aria-describedby={idEtat}
          className={cn("h-9 bg-white", etat.type === "echec" && "border-error-border")}
        >
          <SelectValue
            placeholder={indisponible ? (erreurFiches ? "Liste indisponible" : "Chargement…") : LIBELLE_AUCUN_ENSEIGNANT}
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={AUCUN_ENSEIGNANT}>{LIBELLE_AUCUN_ENSEIGNANT}</SelectItem>
          {inactifEnPlace && (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel className="text-xs font-medium text-muted-foreground">Affecté, inactif</SelectLabel>
                <SelectItem value={inactifEnPlace.valeur} disabled>
                  {inactifEnPlace.libelle}
                </SelectItem>
              </SelectGroup>
            </>
          )}
          {actifs.length > 0 && (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel className="text-xs font-medium text-muted-foreground">Enseignants actifs</SelectLabel>
                {actifs.map((o) => (
                  <SelectItem key={o.valeur} value={o.valeur}>
                    {o.libelle}
                  </SelectItem>
                ))}
              </SelectGroup>
            </>
          )}
        </SelectContent>
      </Select>

      {inactifAffiche && (
        <Badge variant="outline" className="self-start border-warning-border bg-warning-soft text-warning-ink">
          {inactifEnPlace.etat} · Toujours affecté
        </Badge>
      )}

      {/* État de la ligne, relié à la liste par aria-describedby : la raison d'un échec est relue au focus. */}
      <div id={idEtat}>
      {indisponible && erreurFiches && <p className="text-xs text-error-ink">{erreurFiches}</p>}

      {etat.type === "envoi" && (
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2Icon className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          {MESSAGE_EN_COURS}
        </p>
      )}
      {etat.type === "enregistre" && (
        <p className="inline-flex items-center gap-1.5 text-xs text-success-ink">
          <CheckIcon className="h-3.5 w-3.5 text-success" aria-hidden="true" />
          {etat.message}
        </p>
      )}
      {etat.type === "echec" && <p className="text-xs text-error-ink">{etat.message}</p>}
      </div>

      <AlertDialog open={retraitDemande} onOpenChange={(ouvert) => !ouvert && setRetraitDemande(false)}>
        <AlertDialogContent
          onCloseAutoFocus={(e) => {
            // Focus rendu à la liste de cette ligne, après la confirmation comme après l'annulation (A5).
            e.preventDefault();
            declencheur.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation.titre}</AlertDialogTitle>
            <AlertDialogDescription>{confirmation.effet}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setRetraitDemande(false);
                void envoyer(null);
              }}
            >
              {confirmation.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
