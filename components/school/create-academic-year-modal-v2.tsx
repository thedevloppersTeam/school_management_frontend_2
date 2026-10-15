"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CheckIcon, PlusIcon } from "lucide-react";
import { REQUIRED_MARK_CLASS } from "@/lib/cpmsl-classes";
import type { AcademicYear } from "@/lib/api/dashboard";
import { prochainNomAnnee } from "@/lib/academic-years/next-name";
import { toMessage } from "@/lib/errors";

/**
 * Carte de choix exclusif.
 *
 * Un vrai `<input type="radio">` masqué visuellement, pas un `<button>` stylé :
 * les quatre cartes de cette modale étaient des boutons nus — zéro
 * `role="radio"`, zéro `aria-checked` — et leur sélection n'était portée que
 * par la couleur et l'épaisseur du filet. Un lecteur d'écran annonçait quatre
 * boutons sans relation entre eux, sans dire lequel était choisi (WCAG 1.3.1 et
 * 4.1.2).
 *
 * Le radio natif rend d'un coup le groupement par `name`, l'état annoncé, la
 * navigation aux flèches et le `tabindex` roulant — tout ce qu'une
 * réimplémentation en ARIA aurait fallu écrire puis maintenir.
 *
 * Le filet reste à 1 px dans les deux états : la sélection se marque par la
 * couleur, un anneau et une coche. Avec `border-2` sur l'état choisi, la carte
 * mesurait 101 px sélectionnée contre 99 px au repos, et le bloc sautait de
 * 2 px à chaque changement de choix.
 */
function ChoiceCard({
  name,
  value,
  checked,
  onSelect,
  className = "",
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`relative flex cursor-pointer rounded-lg border p-4 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-500 ${
        checked
          ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500"
          : "border-neutral-300 bg-white hover:bg-muted"
      } ${className}`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      {checked && (
        <CheckIcon
          className="absolute right-3 top-3 h-4 w-4 text-primary-700"
          aria-hidden="true"
        />
      )}
      {children}
    </label>
  );
}

/**
 * Dates par defaut d'une annee scolaire, derivees de son nom.
 *
 * L'annee scolaire haitienne court du 1er septembre au 30 juin. Le defaut
 * etait calcule sur `new Date().getFullYear()` : correct si l'on cree l'annee
 * entre aout et decembre, faux le reste du temps — creer « 2026-2027 » en
 * fevrier 2027 produisait une annee demarrant en septembre 2027. Le nom porte
 * deja les deux millesimes, il est la bonne source.
 *
 * Chaines `YYYY-MM-DD` construites a la main, jamais `new Date(y, 8, 1)` : ce
 * dernier cree un minuit **local** que `toISOString()` decale d'un jour des que
 * le fuseau est a l'ouest de Greenwich — ce qui est le cas de Haiti.
 */
function defaultYearDates(yearName: string): { start: string; end: string } {
  const match = yearName.match(/(\d{4})-(\d{4})/);
  if (match) {
    return { start: `${match[1]}-09-01`, end: `${match[2]}-06-30` };
  }
  const y = new Date().getFullYear();
  return { start: `${y}-09-01`, end: `${y + 1}-06-30` };
}

interface CreateAcademicYearModalV2Props {
  /**
   * TOUTES les annees connues, courante et archivees comprises. C'est la
   * source du nom propose : le maximum des millesimes, pas l'annee active.
   *
   * `activeYear` et `archivedYears` restent, mais uniquement pour alimenter le
   * selecteur « copier depuis ». Ils ne suffisent pas a nommer l'annee
   * suivante : une annee en PREPARATION n'est ni l'une ni l'autre, et c'est
   * precisement celle qui manquait au calcul.
   */
  years?: AcademicYear[];
  activeYear?: AcademicYear;
  archivedYears?: AcademicYear[];
  hasActiveYear?: boolean;
  /**
   * Doit REJETER si la creation echoue.
   *
   * Le contrat rendait `void` : la modale envoyait puis fermait aussitot, sans
   * pouvoir savoir si le serveur avait refuse. En mode « annee anterieure », ou
   * le libelle est tape a la main, un 409 faisait donc disparaitre la saisie —
   * il fallait tout retaper sans savoir pourquoi.
   */
  onSubmit?: (data: {
    name: string;
    startDate?: string;
    endDate?: string;
    numberOfPeriods: 4 | 5;
    copyFromYearId?: string;
  }) => Promise<void>;
  trigger?: React.ReactNode;
}

export function CreateAcademicYearModalV2({
  years = [],
  activeYear,
  archivedYears = [],
  hasActiveYear = false,
  onSubmit,
  trigger,
}: CreateAcademicYearModalV2Props) {
  /**
   * Nom propose = le MAXIMUM des annees connues, +1.
   *
   * Il derivait de l'annee ACTIVE. Or creer une annee ne la rend pas courante
   * — l'activation est un geste distinct — donc l'annee active ne bougeait
   * jamais et le modal reproposait indefiniment le meme nom, deja pris des la
   * premiere creation. Le champ etant en lecture seule, l'ecran repondait 409
   * a perpetuite sans aucun moyen d'en sortir.
   *
   * La regle vit dans `lib/academic-years/next-name.ts`, en fonction pure,
   * pour etre testable hors React.
   */
  const nomPropose = useMemo(
    () => prochainNomAnnee(years.map((y) => y.yearString || y.name)),
    [years],
  );

  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  /**
   * Mode ANTERIEURE : rattraper une annee passee, jamais saisie.
   *
   * Le nom propose est le maximum des annees connues, +1 — il ne regarde que
   * vers l'avant, et le champ est en lecture seule. Creer « 2015-2016 » etait
   * donc impossible depuis cet ecran, alors que le backend l'accepte sans
   * reserve : aucune contrainte d'anteriorite, aucun controle de chevauchement.
   * Le mode n'existe QUE dans cette modale ; le payload envoye est identique.
   */
  const [modeAnterieure, setModeAnterieure] = useState(false);
  const [nomSaisi, setNomSaisi] = useState("");

  /** Appel en vol : garde contre la double soumission. */
  const [submitting, setSubmitting] = useState(false);
  /** Refus du serveur, affiche DANS la modale pour rester sous les yeux. */
  const [erreur, setErreur] = useState<string | null>(null);

  const name = modeAnterieure ? nomSaisi : nomPropose;

  // Derive du nom PROPOSE, pas du nom saisi : `defaultYearDates` se rabat sur
  // l'annee calendaire quand le libelle ne suit pas AAAA-AAAA, ce qui
  // reviendrait a deviner des dates en mode anterieure. La regle y est donc
  // l'inverse — on ne remplit que si le format est reconnu, et on ne touche a
  // rien sinon.
  const defaults = useMemo(() => defaultYearDates(nomPropose), [nomPropose]);

  const effectiveStart = modeAnterieure ? startDate : startDate || defaults.start;
  const effectiveEnd = modeAnterieure ? endDate : endDate || defaults.end;

  /** Bascule de mode : les dates repartent a zero, elles derivaient d'un autre nom. */
  const changerMode = (anterieure: boolean) => {
    setModeAnterieure(anterieure);
    setNomSaisi("");
    setStartDate("");
    setEndDate("");
  };

  /**
   * Saisie du nom en mode anterieure. Si le libelle suit AAAA-AAAA, les dates
   * se remplissent par convention — 1er septembre / 30 juin — et restent
   * modifiables. Sinon on ne devine rien : les champs gardent leur etat.
   */
  const onNomSaisiChange = (valeur: string) => {
    setNomSaisi(valeur);
    const m = /^(\d{4})-(\d{4})$/.exec(valeur.trim());
    if (!m) return;
    setStartDate(`${m[1]}-09-01`);
    setEndDate(`${m[2]}-06-30`);
  };
  const [numberOfPeriods, setNumberOfPeriods] = useState<4 | 5>(4);
  const [creationType, setCreationType] = useState<"scratch" | "copy">(
    "scratch",
  );
  const [copyFromYearId, setCopyFromYearId] = useState<string>("");

  /** Remet le formulaire a neuf. Appele a la fermeture, JAMAIS sur un refus. */
  const reinitialiser = () => {
    setStartDate("");
    setEndDate("");
    setNumberOfPeriods(4);
    setCreationType("scratch");
    setCopyFromYearId("");
    setModeAnterieure(false);
    setNomSaisi("");
    setErreur(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;

    setSubmitting(true);
    setErreur(null);
    try {
      await onSubmit?.({
        name: name.trim(),
        // Ce qui est envoye est exactement ce qui est affiche. Avant, un champ
        // vide envoyait `undefined` et la page appliquait en silence un defaut
        // que l'ecran n'avait jamais montre.
        startDate: effectiveStart,
        endDate: effectiveEnd,
        numberOfPeriods,
        copyFromYearId: creationType === "copy" ? copyFromYearId : undefined,
      });
      // Succes SEULEMENT : c'est ici, et nulle part ailleurs, que la saisie
      // est effacee et la modale fermee.
      reinitialiser();
      setOpen(false);
    } catch (err) {
      // La modale RESTE ouverte et la saisie INTACTE. En mode anterieure, le
      // libelle refuse est precisement ce qu'il faut corriger : le perdre
      // obligeait a tout retaper de memoire.
      setErreur(toMessage(err, "lors de la creation de l'annee scolaire"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    reinitialiser();
    setOpen(false);
  };

  const getPeriodNames = (count: 4 | 5) => {
    const names = ["1ère Étape", "2ème Étape", "3ème Étape", "4ème Étape"];
    if (count === 5) names.push("5ème Étape");
    return names;
  };

  // En mode anterieure, les dates ne sont pas pre-remplies tant que le nom
  // n'est pas reconnu : les exiger ici evite un aller-retour serveur dont le
  // seul message serait « startDate n'est pas une date valide ».
  // Ce n'est PAS un controle de chevauchement — il n'y en a aucun, par decision.
  const isSubmitDisabled =
    !name.trim() ||
    (creationType === "copy" && !copyFromYearId) ||
    (modeAnterieure && (!effectiveStart || !effectiveEnd));

  return (
    <Dialog
      open={open}
      onOpenChange={(ouvert) => {
        // Fermer pendant un appel en vol laisserait une creation orpheline
        // sans retour a l'ecran.
        if (submitting) return;
        setOpen(ouvert);
        if (!ouvert) reinitialiser();
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2">
            <PlusIcon className="h-4 w-4" />
            Nouvelle année
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px] border border-neutral-300 rounded-xl sm:rounded-xl bg-white max-h-[90vh] overflow-y-auto cpmsl-scroll">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="heading-2 text-neutral-900">
              Nouvelle année scolaire
            </DialogTitle>
            {/* FIX : aria-describedby warning */}
            <DialogDescription className="sr-only">
              Formulaire de création d'une nouvelle année scolaire
            </DialogDescription>
          </DialogHeader>

          {/* Le pied est colle : il flotte au-dessus du contenu, il faut donc lui
              reserver sa place. Sans rien, la derniere carte passait 78 px
              derriere lui ; avec `pb-24` elle s'en ecartait de 72 px, soit une
              bande vide. `pb-12` donne l'intervalle de section du systeme.
              Valeur reglee a la mesure, pas au jugement. */}
          <div className="space-y-6 pt-6 pb-12">
            {/* SECTION 1 — Informations de base */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="name"
                  className="text-sm font-medium text-neutral-900"
                >
                  Nom de l&apos;année{" "}
                  <span className={REQUIRED_MARK_CLASS} aria-label="obligatoire">
                    *
                  </span>
                </Label>
                {/* `readOnly` seul, sans `disabled` : le champ empilait les deux,
                    ce qui ajoutait `opacity: .5` par-dessus `text-neutral-600`
                    et rendait le nom a 2,23:1 — l'element le moins lisible de la
                    modale, alors que c'est la seule information a verifier avant
                    de valider une creation qu'aucun ecran ne sait defaire.
                    `disabled` etait de toute facon un contresens : ce n'est pas
                    un controle inactif, c'est une valeur affichee. */}
                {modeAnterieure ? (
                  <Input
                    id="name"
                    value={nomSaisi}
                    onChange={(e) => onNomSaisiChange(e.target.value)}
                    placeholder="Ex : 2015-2016"
                    autoComplete="off"
                    className="border-neutral-300 font-medium text-neutral-900"
                  />
                ) : (
                  <Input
                    id="name"
                    value={name}
                    readOnly
                    aria-readonly="true"
                    className="border-neutral-300 bg-neutral-50 font-medium text-neutral-900"
                  />
                )}
                <p className="text-xs text-neutral-600">
                  {modeAnterieure
                    ? "Saisissez le libellé au format AAAA-AAAA. Les dates se remplissent alors par convention, et restent modifiables."
                    : "Généré automatiquement à partir de la dernière année enregistrée"}
                </p>
              </div>

              {/* Bascule vers la saisie libre. Elle vit SOUS le champ qu'elle
                  gouverne : c'est le champ qui change, pas le formulaire. */}
              <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
                <Switch
                  id="mode-anterieure"
                  checked={modeAnterieure}
                  onCheckedChange={changerMode}
                />
                <Label htmlFor="mode-anterieure" className="cursor-pointer text-sm">
                  Créer une année antérieure
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    Pour rattraper une année passée. Le libellé devient saisissable.
                  </span>
                </Label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="startDate"
                    className="text-sm font-medium text-neutral-900"
                  >
                    Date de début
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={effectiveStart}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border-neutral-300 text-neutral-900"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="endDate"
                    className="text-sm font-medium text-neutral-900"
                  >
                    Date de fin
                  </Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={effectiveEnd}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="border-neutral-300 text-neutral-900"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-300" />

            {/* SECTION 2 — Nombre d'étapes */}
            <div className="space-y-3">
              <div>
                <div
                  id="periods-legend"
                  className="font-serif text-base font-bold tracking-tight text-primary-700"
                >
                  Nombre d&apos;étapes
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  L'école peut fonctionner avec 4 ou 5 étapes selon l'année
                </p>
              </div>

              <div
                role="radiogroup"
                aria-labelledby="periods-legend"
                className="grid grid-cols-2 gap-3"
              >
                {([4, 5] as const).map((n) => (
                  <ChoiceCard
                    key={n}
                    name="numberOfPeriods"
                    value={String(n)}
                    checked={numberOfPeriods === n}
                    onSelect={() => setNumberOfPeriods(n)}
                    className="flex-col items-center"
                  >
                    <span className="text-3xl font-bold tabular-nums text-neutral-900">
                      {n}
                    </span>
                    <span className="mt-1 text-sm text-neutral-600">
                      {n} Étapes
                    </span>
                  </ChoiceCard>
                ))}
              </div>

              <div className="rounded-lg p-3 bg-neutral-50">
                <p className="text-xs text-neutral-600 mb-2">Étapes créées :</p>
                <div className="flex flex-wrap gap-2">
                  {getPeriodNames(numberOfPeriods).map((periodName, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="border border-neutral-300 rounded px-2 py-0.5 bg-white text-xs text-neutral-900"
                    >
                      {periodName}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-300" />

            {/* SECTION 3 — Type de création */}
            <div className="space-y-3">
              <div
                id="creation-type-legend"
                className="font-serif text-base font-bold tracking-tight text-primary-700"
              >
                Type de création
              </div>

              <div
                role="radiogroup"
                aria-labelledby="creation-type-legend"
                className="space-y-3"
              >
                {[
                  {
                    value: "scratch",
                    title: "Créer depuis zéro",
                    desc: "Commencer avec une année vierge. Vous devrez configurer les classes, matières et enseignants manuellement.",
                  },
                  {
                    value: "copy",
                    title: "Copier une année existante",
                    desc: "Dupliquer la structure d'une année archivée (classes, matières). Les élèves et notes ne seront pas copiés.",
                  },
                ].map((opt) => (
                  <ChoiceCard
                    key={opt.value}
                    name="creationType"
                    value={opt.value}
                    checked={creationType === opt.value}
                    onSelect={() =>
                      setCreationType(opt.value as "scratch" | "copy")
                    }
                    className="w-full flex-col pr-10 text-left"
                  >
                    <span className="text-base font-semibold text-neutral-900">
                      {opt.title}
                    </span>
                    <span className="mt-1 text-sm text-muted-foreground">
                      {opt.desc}
                    </span>
                  </ChoiceCard>
                ))}
              </div>

              {creationType === "copy" && (
                <div className="space-y-2">
                  <Label
                    htmlFor="copyYear"
                    className="text-sm font-medium text-neutral-900"
                  >
                    Copier depuis{" "}
                    <span className={REQUIRED_MARK_CLASS} aria-label="obligatoire">
                      *
                    </span>
                  </Label>
                  <Select
                    value={copyFromYearId}
                    onValueChange={setCopyFromYearId}
                  >
                    <SelectTrigger
                      id="copyYear"
                      className="border-neutral-300 text-neutral-900"
                    >
                      <SelectValue placeholder="Sélectionnez une année source" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeYear && (
                        <SelectItem value={activeYear.id}>
                          {activeYear.name} (Active)
                        </SelectItem>
                      )}
                      {archivedYears.map((year) => (
                        <SelectItem key={year.id} value={year.id}>
                          {year.name} (Archivée)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Colle en bas du conteneur defilant : « Creer l'annee » se
              trouvait a 906 px dans une fenetre de 889 px, donc hors ecran des
              l'ouverture, et rien n'indiquait qu'il fallait faire defiler. */}
          <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 flex-col gap-3 border-t border-neutral-200 bg-white px-6 py-4 sm:flex-col sm:space-x-0">
            {erreur && (
              <div
                role="alert"
                className="w-full rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive"
              >
                {erreur}
              </div>
            )}
            <div className="flex w-full justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={submitting}
                className="border-neutral-300 hover:bg-neutral-50 text-neutral-900"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isSubmitDisabled || submitting}
                className="border-0 bg-primary-700 text-white hover:bg-primary-800 disabled:bg-neutral-400"
              >
                {submitting ? "Création…" : "Créer l'année"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
