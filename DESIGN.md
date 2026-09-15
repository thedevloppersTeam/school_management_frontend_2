---
name: CPMSL — Gestion Scolaire
description: Le registre numérique du Cours Privé Mixte Saint Léonard — encre ardoise sur papier crème, tourné vers le bulletin imprimé.
colors:
  ardoise-profonde: "#2A3740"
  bleu-ardoise: "hsl(209 19% 44%)"
  vieil-or: "#C3B594"
  vieil-or-clair: "#D1C19F"
  papier-creme: "hsl(40 14% 98%)"
  surface-carte: "hsl(0 0% 100%)"
  encre: "hsl(240 10% 3.9%)"
  encre-attenuee: "hsl(240 3.8% 46.1%)"
  filet: "hsl(240 5.9% 90%)"
  sourdine: "hsl(240 4.8% 95.9%)"
  tranche-registre: "hsl(205 17% 21%)"
  tranche-texte: "hsl(210 25% 87%)"
  tranche-actif: "hsl(205 16% 27%)"
  tranche-sceau: "hsl(205 20% 43%)"
  succes: "#2D7D46"
  succes-doux: "#E8F5EC"
  succes-filet: "#8DB099"
  succes-encre: "#1E5C33"
  avertissement: "#C48B1A"
  avertissement-doux: "#FEF6E0"
  avertissement-filet: "#CAB383"
  avertissement-encre: "#8A6212"
  erreur: "#C43C3C"
  erreur-doux: "#FDE8E8"
  erreur-filet: "#CC9393"
  erreur-encre: "#8F2B2B"
  information: "#2B6CB0"
  information-doux: "#E3EFF9"
  information-filet: "#8AA7C3"
  information-encre: "#1E4E80"
  destructif: "#9E2F2F"
typography:
  display:
    fontFamily: "Libre Baskerville, Georgia, serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Libre Baskerville, Georgia, serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Libre Baskerville, Georgia, serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  subtitle:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "0"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
  caption:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.03em"
  data:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0"
  data-dense:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  2xl: "18px"
  full: "9999px"
spacing:
  grille-y: "4px"
  grille-x: "8px"
  tight: "8px"
  snug: "12px"
  base: "16px"
  card: "20px"
  card-lg: "24px"
  section: "24px"
  page: "32px"
components:
  button-primary:
    backgroundColor: "{colors.bleu-ardoise}"
    textColor: "#FAFAFA"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "hsl(209 19% 44% / 0.9)"
  button-outline:
    backgroundColor: "{colors.papier-creme}"
    textColor: "{colors.encre}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.encre}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  cell-grid:
    backgroundColor: "transparent"
    textColor: "{colors.encre}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
    height: "28px"
  button-destructive:
    backgroundColor: "{colors.destructif}"
    textColor: "#FAFAFA"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  input-default:
    backgroundColor: "transparent"
    textColor: "{colors.encre}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  card-default:
    backgroundColor: "{colors.surface-carte}"
    textColor: "{colors.encre}"
    rounded: "{rounded.xl}"
    padding: "{spacing.card-lg}"
  badge-default:
    backgroundColor: "{colors.bleu-ardoise}"
    textColor: "#FAFAFA"
    typography: "{typography.caption}"
    rounded: "{rounded.md}"
    padding: "2px 10px"
  badge-outline:
    backgroundColor: "transparent"
    textColor: "{colors.encre}"
    typography: "{typography.caption}"
    rounded: "{rounded.md}"
    padding: "2px 10px"
  sidebar-item:
    backgroundColor: "transparent"
    textColor: "{colors.tranche-texte}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px"
    height: "32px"
  sidebar-item-active:
    backgroundColor: "{colors.tranche-actif}"
    textColor: "#FFFFFF"
  stat-card:
    backgroundColor: "{colors.surface-carte}"
    textColor: "{colors.encre}"
    rounded: "{rounded.xl}"
    padding: "{spacing.card}"
---

# Design System: CPMSL — Gestion Scolaire

## Overview

**Creative North Star: « Le Registre »**

L'application n'est pas un tableau de bord, c'est le registre de l'école tenu
sous forme numérique. La tranche du registre est la barre latérale ardoise
(`hsl(205 17% 21%)`), pleine et sans ombre, qui ne bouge jamais. La page ouverte
est le contenu, posé sur un papier crème (`hsl(40 14% 98%)`) et jamais sur du
blanc pur — le blanc pur est réservé aux fiches (cartes) qui reposent dessus.
Un seul administrateur passe des heures dans ce registre, et la finalité de tout
ce qu'il y consigne est un objet physique : le bulletin 8½×11 imprimé, opposable
au MENFP et remis aux familles.

Le système tient sur une tension unique : une **interface** en Inter, dense,
compacte, faite pour saisir trente notes d'affilée sans fatigue ; et une
**autorité** en Libre Baskerville, qui n'apparaît que sur les titres, le sceau et
tout ce qui engage l'établissement. Le sceau — le carré ardoise `#2A3740` frappé
d'un « SL » en vieil or `#C3B594`, coins arrondis à 14 px — est le seul endroit
où la marque hausse le ton. Partout ailleurs elle se lit dans la justesse des
détails : un filet de 1 px, un anneau de focus d'exactement 1 px, une ombre qui
n'apparaît qu'au survol.

Ce qui est explicitement rejeté : les dégradés décoratifs (le seul dégradé du
projet est le fond de la page de connexion, `#FAFAF8 → rgba(240,235,223,.3)`, et
il reste une exception), les ombres portées colorées, les accents qui ne
signalent aucun état, et toute animation qui ne répond pas à une action de
l'utilisateur.

**Key Characteristics:**
- Encre ardoise sur papier crème ; le blanc pur ne sert qu'aux fiches posées dessus.
- Serif pour ce qui fait autorité, sans-serif pour ce qui s'opère.
- Densité assumée : hauteur de contrôle de référence 36 px, barre d'en-tête 56 px.
- Plat au repos ; l'ombre est une réponse, jamais un décor.
- L'or est un sceau, pas une couleur d'interface : logo, avatar, marque de tranche.
- L'imprimé est la finalité, pas une exportation.

## Colors

Une palette d'archive : deux gris-bleus profonds, un or éteint, un papier crème,
et un jeu d'états sémantiques strictement réservé au signalement.

### Primary
- **Ardoise Profonde** (`#2A3740`) : la tranche du registre. Fond du sceau `SL`,
  fond de la barre latérale (`hsl(205 17% 21%)`, la même ardoise à 1 point de
  luminosité près), titre `h1` de la page de connexion (`text-primary-800`).
  C'est la couleur de l'institution, jamais celle d'une action.
- **Bleu Ardoise** (`hsl(209 19% 44%)`, soit `#5A7085`) : le jeton `--primary`.
  Fond des boutons d'action primaires, anneau de focus (`--ring`), pastilles
  d'icône du tableau de bord (`bg-primary/10` + `text-primary`). Son état survol
  est `bg-primary/90` sur les primitives shadcn, ou le pas immédiatement plus
  sombre de sa rampe (`primary-600`, `#4A5D6E`) sur les surfaces qui appellent
  la rampe de marque (`/login` : `bg-primary-500 hover:bg-primary-600`). Les
  deux sont admis et visuellement équivalents. **Ce pas de survol n'est pas un
  jeton de marque** : il vit dans la rampe tonale de `bleu-ardoise`, pas au
  premier niveau.

Le système de marque ne compte que **deux** couleurs nommées : l'ardoise de
l'institution et le bleu de l'action. Tout le reste est un pas de rampe. La plus
sombre des deux est toujours `ardoise-profonde` — la hiérarchie de nom suit la
hiérarchie de luminosité, sans exception.

### Secondary
- **Vieil Or** (`#C3B594`) : le sceau. Glyphe `SL` du logo, et rien d'autre à
  pleine intensité.
- **Vieil Or Clair** (`#D1C19F`) : `--sidebar-primary-foreground`. Initiales de
  l'avatar dans le pied de la barre latérale. C'est le seul or présent en
  permanence à l'écran, et il occupe environ 400 px².

### Neutral
- **Papier Crème** (`hsl(40 14% 98%)`) : fond de toutes les pages `/admin`.
  Chaud, très légèrement jauni — il ne doit jamais être remplacé par du blanc.
- **Surface Fiche** (`#FFFFFF`) : fond des cartes, popovers, dialogues, feuilles.
  Le blanc est ce qui se pose *sur* le papier.
- **Encre** (`hsl(240 10% 3.9%)`) : texte principal.
- **Encre Atténuée** (`hsl(240 3.8% 46.1%)`) : libellés secondaires, légendes,
  icônes inactives, et couleur du pouce de l'ascenseur `.cpmsl-scroll` (à 25 %).
- **Filet** (`hsl(240 5.9% 90%)`) : bordures et séparateurs. Un seul poids : 1 px.
- **Sourdine** (`hsl(240 4.8% 95.9%)`) : fonds de zones inactives, `muted`,
  `secondary`, `accent` — les trois pointent vers la même valeur.
- **Tranche du Registre** (`hsl(205 17% 21%)`) : fond de la barre latérale.
  **Tranche Texte** (`hsl(210 25% 87%)`), **Tranche Actif** (`hsl(205 16% 27%)`,
  fond de l'élément de navigation actif et de toutes ses bordures internes).

### États sémantiques
Le jeu d'états est **normatif** : ce sont les seules couleurs autorisées pour
signaler un état, sur tout écran nouveau ou refondu.

Chaque état a **quatre pas, et un seul rôle par pas** — c'est ce qui rend la
règle applicable sans avoir à recalculer un contraste à chaque usage :

| Pas | Classe | Rôle |
|---|---|---|
| plein | `bg-succes` | le remplissage plein et **l'icône** |
| doux | `bg-succes-soft` | la surface du bandeau, de la pastille, de la tuile |
| filet | `border-succes-border` | le trait de 1 px qui la borde |
| encre | `text-succes-ink` | **tout texte**, sur papier comme sur doux |

`ink` n'est pas une couleur de marque nouvelle : c'est un pas de rampe, le même
mécanisme qui fait de `destructif` un `erreur` plus profond.

- **Succès** (`#2D7D46`, doux `#E8F5EC`, filet `#8DB099`, encre `#1E5C33`) :
  année active, étape clôturée, saisie validée. Plein 4,87:1 sur papier ;
  encre 7,65:1 sur papier et 7,10:1 sur doux.
- **Avertissement** (`#C48B1A`, doux `#FEF6E0`, filet `#CAB383`, encre
  `#8A6212`) : année archivée en lecture seule, note manquante, session
  expirée. **Le plein ne donne que 2,86:1 sur papier** : il ne porte ni texte
  ni icône, seulement un remplissage, et le texte posé dessus est
  `text-warning-foreground` `#2A1B02` (5,62:1) — le blanc y échoue à 2,85:1.
  L'encre `#8A6212` donne 5,25:1 sur papier et 5,08:1 sur doux.
- **Erreur** (`#C43C3C`, doux `#FDE8E8`, filet `#CC9393`, encre `#8F2B2B`) :
  échec de saisie, validation refusée. Le plein donne 4,96:1 sur papier mais
  seulement 4,41:1 sur son propre doux — c'est précisément pourquoi le texte
  prend l'encre et non le plein.
- **Information** (`#2B6CB0`, doux `#E3EFF9`, filet `#8AA7C3`, encre `#1E4E80`) :
  rappel neutre, contexte, et **signalement de nouveauté** — pastille de
  notification non lue comprise.
- **Destructif** (`#9E2F2F`) : distinct de *Erreur*, mais **issu de la même
  rampe** (`erreur-700`, un pas plus profond que `erreur`). Réservé à l'**action**
  qui détruit (bouton « Supprimer », entrée « Déconnexion »), jamais au
  **constat** d'une erreur. Le pas plus sombre porte le poids de l'irréversible
  et donne 6,93:1 avec `--destructive-foreground`, contre 4,96:1 pour `erreur`.

  *`--destructive` vaut `0 54% 40%` dans `app/globals.css` depuis le
  14 septembre 2026. Il valait auparavant le rouge Tailwind `0 84.2% 60.2%`,
  soit 3,61:1 sur 21 boutons — le libellé le moins lisible de l'interface portait
  l'action la moins réversible.*

### Named Rules

**La Règle du Sceau.** L'or n'est jamais une couleur d'interface. Il n'apparaît
que sur le **sceau `SL`**, et uniquement sur un fond d'ardoise
(`ardoise-profonde` `#2A3740` ou plus sombre), où il donne 6,02:1. Un bouton or,
un badge or ou un titre or est une faute : l'or perd sa fonction dès qu'il se
répète. *Les initiales d'avatar sortent de cette exception depuis le
13 septembre 2026 : sur `sidebar-primary` `#587183` l'or ne donnait que 2,88:1,
sous le seuil texte de 4,5:1. Elles sont en blanc (5,11:1). Une règle qui
autorise un usage illisible est pire qu'une règle absente.*

**La Règle du Papier.** Le fond de page est `hsl(40 14% 98%)` et les fiches sont
`#FFFFFF`. Jamais l'inverse, jamais les deux en blanc. C'est ce delta de 2 % qui
donne la profondeur, pas l'ombre.

**La Règle des États Nommés.** Un état se signale avec `succes` /
`avertissement` / `erreur` / `information`, jamais avec une palette Tailwind
brute. *Dette résorbée le 14 septembre 2026 : les 491 classes de palette brute
(`amber-*`, `emerald-*`, `blue-*`, `slate-*`, `rose-*`, `sky-*`, `red-*`,
`violet-*`, `teal-*`) du code servi hors gabarit imprimé ont été migrées vers les
rôles. Il n'en reste aucune. Le retour d'une de ces classes est désormais une
régression, pas un héritage.*

**La Règle de la Rareté.** La couleur ne dit qu'une chose : **un état**. Ce qui
rapporte une *mesure* — un effectif, une moyenne, une médiane, un taux, une
étape — est neutre : `text-primary` sur `bg-primary/10`. Sept teintes
décoratives coexistaient sur les tuiles `StatCard` (« Total élèves » en bleu,
« Taux de réussite » en violet, « Médiane » en ardoise, « Min / Max » en
sarcelle, et « Moyenne classe » en ambre, qui laissait croire à une alerte là où
il n'y avait qu'un chiffre). Elles sont neutres depuis le 14 septembre 2026.
C'est la rareté qui donne sa force à l'alerte : si tout est coloré, plus rien
n'alerte.

## Typography

**Display Font:** Libre Baskerville (`--font-serif`, poids 400/700, italique
disponible ; repli `Georgia, serif`)
**Body Font:** Inter (`--font-sans` ; repli `system-ui, sans-serif`)
**Mono Font:** `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
"Liberation Mono", "Courier New", monospace`
**Polices d'imprimé (bulletin uniquement) :** Cookie (`--font-cookie`, nom de
l'élève manuscrit) et Lobster (`--font-lobster`, mention de fondation). Elles ne
sont **jamais** utilisées à l'écran.

Les quatre polices Google sont chargées par `next/font/google` dans
`app/layout.tsx` et exposées en variables CSS. Elles ne doivent pas être
redéclarées dans `globals.css` : cela annulerait le préchargement et les
métriques de repli de `next/font`.

**Character:** Libre Baskerville apporte le poids d'un document officiel — un
serif de transition, à contraste marqué, qui rappelle l'en-tête du bulletin.
Inter est l'inverse assumé : neutre, compact, invisible, calibré pour être lu
mille fois par jour dans une grille de notes. L'échelle de corps est
volontairement **sous-dimensionnée** par rapport aux valeurs Tailwind par défaut
(base à 15 px, `sm` à 13 px) : c'est une échelle de registre, pas de page web.
Depuis le 14 septembre 2026 cette échelle est celle que Tailwind sert — voir
*Hierarchy* ci-dessous.

### Hierarchy

**Il n'y a qu'une échelle.** Jusqu'au 14 septembre 2026 il y en avait deux : les
jetons `--text-*` ci-dessous, consommés par les sept classes de rôle, et
**l'échelle Tailwind par défaut** (12/14/16/18/20/24/30/36), consommée par les
717 utilitaires `text-*` du code. Elles ne coïncidaient nulle part au-delà de
`xs` et `lg` — au point que `text-base` (16 px) était plus gros que le corps de
page (15 px). `tailwind.config.js` fait désormais pointer chaque utilitaire sur
le jeton correspondant : `text-sm` **est** `--text-sm`, et chaque pas porte son
interlignage de rôle.

Les rôles sont matérialisés par des classes utilitaires réelles dans
`app/globals.css` (`@layer components`) :

- **Display** — `.heading-1` (serif, 700, 2.25 rem / 36 px, interligne 1.15,
  approche −0.03em) : titre de page unique. Un seul `h1` par route.
- **Headline** — `.heading-2` (serif, 700, 1.75 rem / 28 px, 1.2, −0.025em) :
  titre de section majeure, nom d'entité en tête de fiche.
- **Title** — `.heading-3` (serif, 700, 1.375 rem / 22 px, 1.25, −0.02em) :
  titre de carte importante, en-tête d'année scolaire.
- **Subtitle** — `.heading-4` (sans, 600, 1.125 rem / 18 px, 1.4, −0.01em) :
  premier niveau où l'on quitte le serif. Sous-sections, titres de modales.
- **Body** — `.body-base` (sans, 400, 0.9375 rem / 15 px, interligne 1.65) :
  corps de texte et valeur des champs. Interligne généreux malgré la petite
  taille — c'est ce qui rend la densité soutenable.
- **Label** — `.label-ui` (sans, 500, 0.8125 rem / 13 px, 1.4, +0.02em) :
  libellés de formulaire, texte des boutons, cellules de tableau.
- **Caption** — `.caption` (sans, 400, 0.75 rem / 12 px, 1.5, +0.03em) :
  mentions légales, horodatages, sous-titres d'avatar.

**Les pas serif déclarent 700, et c'est la vérité du rendu.** Libre Baskerville
n'est chargée qu'en 400 et 700 (`app/layout.tsx`), et `:root` pose
`font-synthesis: none` : un poids 600 demandé se résout en 700. `.heading-2` et
`.heading-3` annonçaient 600 tout en rendant 700 — un pas de graisse fictif, qui
laissait croire à une hiérarchie que l'œil ne voyait pas. La hiérarchie serif
tient par la taille et l'approche ; la graisse n'en fait pas partie.

**La bande de densité est nommée.** Une grille de notes ne se lit pas comme une
page : DESIGN.md prescrivait « corps 10–11 px » en prose, sans jeton, si bien que
56 cellules portaient un `text-[10px]` ou `text-[11px]` arbitraire. Deux pas
supplémentaires les nomment, sous `xs` et réservés aux surfaces de données :

L'échelle complète : `--text-3xs` 10 px, `--text-2xs` 11 px, `--text-xs` 12 px,
`--text-sm` 13 px, `--text-base` 15 px, `--text-lg` 18 px, `--text-xl` 22 px,
`--text-2xl` 28 px, `--text-3xl` 36 px. Les utilitaires correspondants sont
`text-3xs`, `text-2xs`, `text-xs` … `text-3xl`. **Aucune taille ne s'écrit plus
en valeur arbitraire ni en style en ligne** — le sceau `SchoolLogo` excepté, qui
doit rester identique hors contexte Tailwind.

**L'approche vit dans l'utilitaire, pas seulement dans le role.** `text-xs` et
`text-sm` ne sont separes que par 1 px, et ce sont les deux pas les plus
employes de l'application (289 et 420 usages). Ce qui les distingue vraiment est
l'approche — +0.03em pour la legende, +0.02em pour le libelle — qui ne vivait
que dans les sept classes de role, utilisees 67 fois contre 851 utilitaires
bruts. Chaque pas de `tailwind.config.js` porte desormais son interlignage **et**
son approche : un `text-2xl` est un chapeau meme sans `.heading-2`.

**La Regle de la Mesure.** `main` est en pleine largeur — c'est ce qu'il faut
pour une grille de notes, et ce qu'il ne faut pas pour une phrase. Sur un ecran
1920, une ligne de prose atteignait 242 caracteres, contre une cible de 45 a 75.
Tout paragraphe de prose porte `max-w-prose` (65ch, soit environ 65 caracteres a
13 px). Les grilles, les tableaux et les cartes gardent la pleine largeur.

**Le corps de page est un jeton, pas une valeur.** `body` etait fige a `15px`
alors que toute la rampe est en `rem`. Le reglage de taille de police du
navigateur agit sur `html`, pas sur `body` : un administrateur qui agrandit sa
police obtenait deux regimes de taille sur le meme ecran, l'ecart se creusant a
mesure qu'il agrandissait. `body` prend `var(--text-base)`.

### Named Rules

**La Règle de l'Autorité.** Le serif est réservé à ce qui engage
l'établissement : titres de page et de section, nom de l'école, en-tête du
bulletin. Une étiquette de bouton, une cellule de tableau ou un message d'erreur
en serif est une faute — ils appartiennent à l'outil, pas à l'institution.

**La Règle de l'Approche Inverse.** L'approche (`letter-spacing`) se resserre
quand la taille monte (−0.03em à 36 px) et s'ouvre quand elle descend (+0.03em à
12 px). Toute nouvelle taille doit respecter cette pente.

## Layout

**La coque.** Barre latérale persistante à gauche + zone principale. La barre
latérale mesure **16 rem** ouverte, **3 rem** repliée en mode icônes
(`collapsible="icon"`), **18 rem** en tiroir sur mobile ; l'état est mémorisé
dans un cookie 7 jours et bascule au raccourci `⌘/Ctrl + B`. Elle est bordée à
droite d'un filet `sidebar-border` de 1 px et ne porte aucune ombre.

**L'en-tête.** Barre `sticky top-0 z-40`, hauteur fixe **56 px** (`h-14`), fond
`background/95` avec `backdrop-blur` (dégradé à 60 % d'opacité quand le
navigateur supporte `backdrop-filter`). Elle enchaîne, de gauche à droite :
déclencheur de barre latérale → séparateur vertical 20 px → fil d'Ariane →
espace élastique → badge d'année active → notifications → menu utilisateur.

**Le contenu.** `p-4` en mobile, `sm:p-6` dès 640 px, `lg:p-8 lg:pt-6` dès
1024 px — le retrait supérieur reste plus court que les côtés pour compenser
visuellement l'en-tête collante.

**Rythme vertical des surfaces de lecture.** Les sections d'une page s'espacent
de 24 px (`space-y-6`), les blocs internes de 16 px (`space-y-4`). Ces deux
valeurs sont l'intégralité du vocabulaire vertical **des surfaces de lecture** —
cartes, panneaux, formulaires, modales.

**Densité des surfaces de données.** Les grilles de saisie n'obéissent pas à ce
rythme et ne le doivent pas. L'écran central du produit — une classe de 30 élèves
par une quinzaine de matières, une colonne par sous-matière — se compose en
`px-2 py-1` (8 × 4 px) pour la cellule courante et `px-3 py-1.5` (12 × 6 px)
pour les en-têtes, en corps 10–11 px, avec `tabular-nums` sur toute colonne de
chiffres, des largeurs de colonne plancher (`min-w-[…]`) et des en-têtes
collants. C'est ce que font déjà `cpmsl-grades-grid.tsx` et
`grades-view-content.tsx`, et c'est la bonne réponse : appliquer 24 px dans une
grille produirait un écran illisible sur lequel personne ne peut saisir.

**Grilles.** Une colonne par défaut, puis : `lg:grid-cols-4` pour les rangées
d'indicateurs (le motif dominant), `md:grid-cols-2` pour les formulaires,
`lg:grid-cols-3` pour les listes de cartes. Point de rupture principal à
1024 px : c'est là que le registre passe de la lecture verticale à la lecture
tabulaire.

**Conteneurs.** Centrés, paliers `sm 640 / md 768 / lg 1024 / xl 1280 /
2xl 1400 px`.

**Défilement.** Tout conteneur à débordement porte `.cpmsl-scroll` : ascenseur de
8 px, pouce `muted-foreground` à 25 % d'opacité (50 % au survol, `primary` à 50 %
à l'appui), piste et coin transparents.

### Named Rules

**La Règle des Deux Densités.** Le registre est dense là où il consigne, aéré là
où il présente. Sur une **surface de lecture** — carte, panneau, formulaire,
modale — on compose à 24 px entre sections et 16 px à l'intérieur. Sur une
**surface de données** — grille de notes, tableau de classe, liste longue — on
descend à 8–12 px horizontaux et 4–6 px verticaux, hauteur de ligne compacte,
corps 10–11 px, chiffres en `tabular-nums`. Choisir la densité avant de choisir
la valeur : appliquer le rythme de lecture à une grille est une faute aussi
grave que l'inverse.

**La Règle des Deux Espaces.** *S'applique aux surfaces de lecture uniquement.*
Le vertical s'y compose avec 24 px entre sections et 16 px à l'intérieur. Une
troisième valeur doit être nommée et justifiée ; sinon elle fabrique un rythme
que personne ne peut reproduire. Une seule est nommée aujourd'hui : le **retrait
de fiche compacte**, 20 px (`spacing.card`), employé par `StatCard` et
`CPMSLYearCard`. Il est admis parce qu'il est partagé par les deux tuiles du
tableau de bord et déclaré comme jeton, pas improvisé au cas par cas. Aucun
quatrième pas n'est autorisé sans passer par ce document.

## Elevation & Depth

Le système est **plat au repos**. La profondeur vient d'abord de la hiérarchie de
fond — ardoise `hsl(205 17% 21%)` pour la tranche, papier crème
`hsl(40 14% 98%)` pour la page, blanc pur pour la fiche — et de filets de 1 px.
L'ombre n'est pas un matériau : c'est une **réponse**, à un survol ou à une
superposition réelle.

Les jetons sont définis en variables CSS sur `:root` et exposés par Tailwind
(`shadow-2xs` … `shadow-2xl`).

### Shadow Vocabulary
- **`--shadow-2xs`** (`0 1px rgb(0 0 0 / 0.05)`) : liseré de séparation, quasi
  invisible. Rarement utile.
- **`--shadow-xs`** (`0 1px 2px 0 rgb(0 0 0 / 0.05)`) : contrôles qui doivent se
  détacher à peine du fond.
- **`--shadow-sm`** (`0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 /
  0.1)`) : **plafond au repos**. Cartes, boutons, champs.
- **`--shadow-md`** (`0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 /
  0.1)`) : **réponse au survol** d'une carte cliquable, et rien d'autre.
- **`--shadow-lg`** / **`--shadow-xl`** : superpositions réelles — popover,
  dropdown, dialogue, feuille latérale.
- **`--shadow-2xl`** (`0 25px 50px -12px rgb(0 0 0 / 0.25)`) : non employé.
  Le conserver disponible sans l'introduire.

### Named Rules

**La Règle du Repos Plat.** Au repos, `shadow-sm` au maximum. Au survol,
`shadow-md`. En superposition réelle, `shadow-lg` et au-delà. Une surface qui
n'est ni survolée ni superposée n'a aucune raison de porter une ombre.

**La Règle de l'Ombre Neutre.** Toutes les ombres sont du noir transparent. Une
ombre teintée (`shadow-emerald-100/50` par exemple) est une exception héritée, à
ne pas reproduire.

## Shapes

Le rayon dérive d'une seule variable, `--radius: 0.625rem` (10 px), et de
quatre calculs :

- **6 px** (`--radius - 4px`) : petits contrôles, pouce d'ascenseur, puces.
- **8 px** (`--radius - 2px`) : **le rayon de travail**. Boutons, champs, badges,
  éléments de navigation, entrées de menu.
- **10 px** (`--radius`) : conteneurs intermédiaires.
- **14 px** (`--radius + 4px`) : cartes, panneaux, le sceau `SL`. C'est le rayon
  qui signale « fiche ».
- **18 px** (`--radius + 8px`) : réservé, non employé aujourd'hui.
- **9999 px** : uniquement pour ce qui est circulaire par nature — pastille de
  notification, point d'état de 6 px, icônes de la page de connexion.

Le vocabulaire de bordure est tout aussi étroit : **1 px, `hsl(240 5.9% 90%)`**,
sur cartes, champs, séparateurs et l'en-tête. Il n'existe pas de bordure de 2 px
dans le système. Le focus n'épaissit pas la bordure : il ajoute un anneau de 1 px
en `--ring` (`hsl(209 19% 44%)`), visible au clavier uniquement
(`focus-visible`).

Les formes sont rectangulaires et alignées : aucune découpe, aucun angle, aucune
forme organique. La seule silhouette signée du système est le **carré ardoise à
coins 14 px** du sceau, décliné en 40 px (`sm`) et 56 px (`md`/`lg`).

### Named Rules

**La Règle du Rayon Unique.** Toute valeur de rayon dérive de `--radius`. Un
rayon écrit en dur (`rounded-[12px]`) casse la cohérence de la coque entière ; la
seule exception admise est le sceau, dont les 14 px sont posés en style inline
parce qu'il doit rester identique hors contexte Tailwind.

## Components

Sobre et précis : les primitives sont les shadcn/ui en style `radix-nova`,
conservées telles quelles. La marque ne s'exprime jamais par un composant qui
hausse le ton, mais par l'accumulation de détails justes.

### Buttons
- **Shape :** rayon de travail 8 px (`rounded-md`), hauteur de référence 36 px
  (`h-9`), déclinaisons 32 px (`sm`, texte 12 px), 40 px (`lg`, retrait 32 px),
  et carré 36×36 px (`icon`).
- **Primary :** fond `Bleu Ardoise` (`hsl(209 19% 44%)`), texte `#FAFAFA`,
  `shadow`, retrait `8px 16px`. Survol : `bg-primary/90` (ou `primary-600`
  `#4A5D6E` sur les surfaces de marque).
- **Hover / Focus :** transition sur la couleur uniquement
  (`transition-colors`), jamais sur la position. Focus clavier : anneau de 1 px
  en `--ring`, `outline: none`.
- **Outline :** bordure 1 px `--input`, fond `background`, `shadow-sm` ; au
  survol, fond `accent`.
- **Secondary :** fond `sourdine`, survol à 80 % d'opacité.
- **Ghost :** transparent au repos, fond `accent` au survol. C'est la variante
  des actions d'en-tête (notifications, menu utilisateur).
- **Destructive :** fond `destructif` (`#9E2F2F`), texte blanc — 6,93:1. Dans les
  menus, l'action destructive se marque en texte (`!text-destructive`) avec un
  fond `destructif/10` au focus, pas en bouton plein.
- **Link :** couleur `primary`, soulignement au survol, décalage 4 px.
- Chaque bouton porte `gap-2` et force ses icônes à 16 px (`[&_svg]:size-4`).
  Désactivé : opacité 50 %, événements pointeur coupés.

### Cards / Containers
- **Corner Style :** 14 px (`rounded-xl`).
- **Background :** `#FFFFFF` sur papier crème.
- **Border :** 1 px `filet`, systématique — c'est elle qui délimite, pas l'ombre.
- **Shadow Strategy :** voir *La Règle du Repos Plat*. `shadow` au repos pour la
  carte de base ; les cartes cliquables passent `shadow-sm → hover:shadow-md`.
- **Internal Padding :** 24 px (`p-6`) pour `CardHeader` / `CardContent` /
  `CardFooter` ; **20 px** (`p-5`, jeton `spacing.card`) pour les deux tuiles
  compactes du tableau de bord, `StatCard` et `CPMSLYearCard`. Ce troisième pas
  est nommé et borné à ces deux composants : il n'est pas un pas de rythme
  vertical et ne se propage à aucune autre surface. Toute nouvelle carte prend
  24 px. Interligne de l'en-tête : `space-y-1.5`.
- **CardTitle** : `font-semibold leading-none tracking-tight`.
  **CardDescription** : 13 px, `encre-attenuee`.

### Inputs / Fields
- **Style :** hauteur 36 px, rayon 8 px, fond **transparent** (le champ prend le
  fond de son conteneur), bordure 1 px `--input`, `shadow-sm`, texte 13 px,
  retrait `4px 12px`.
- **Focus :** `outline: none` + anneau de 1 px `--ring`. **Pas de halo, pas
  d'ombre colorée.** Sur la page de connexion, la variante de marque ajoute un
  anneau de 2 px à 20 % d'opacité (`ring-primary-500/20`) : c'est la seule
  exception, et elle est propre à cette surface.
- **Disabled :** curseur interdit, opacité 50 %.
- **Placeholder :** `encre-attenuee`.

### Navigation
- **Barre latérale :** fond `Tranche du Registre`, texte `Tranche Texte`.
  En-tête = sceau `SL` 32 px + « CPMSL » / « Admin » en 13/12 px, séparé par un
  filet. Le libellé de groupe (« Navigation ») est en 12 px, majuscules,
  `tracking-wider`, opacité 50 %, et disparaît en mode icônes.
- **Entrées :** rayon 8 px, icône 16 px pour les entrées de premier niveau,
  14 px pour les sous-entrées. Actif = fond `Tranche Actif` +
  `font-semibold` + texte blanc. Les groupes repliables ouvrent par défaut quand
  un de leurs enfants est actif, et leur chevron pivote de 90°.
- **Pied :** ligne utilisateur de 48 px — avatar carré 32 px à coins 8 px,
  initiales en or clair, nom en 13 px semi-gras, rôle en 12 px à 50 % d'opacité,
  chevron `ChevronsUpDown` à 40 % d'opacité.
- **Fil d'Ariane :** « Accueil » + page courante, deux niveaux maximum. Il ne
  reflète pas la profondeur réelle de l'URL, mais le libellé métier de la page.

### Badges
- Rayon 8 px, bordure 1 px, retrait `2px 10px`, texte 12 px semi-gras.
- **Badge d'année active** (en-tête) : variante `outline` précédée d'un point de
  6 px — plein `succes` quand une année est active, `encre-attenuee` sinon. Il
  est masqué sous 768 px.

### Grilles de saisie
- **Cellule :** `px-2 py-1` (8 × 4 px), corps 10–11 px, fond transparent, rayon
  6 px sur l'état actif uniquement. Hauteur de ligne visée ≈ 28 px.
- **En-tête :** `px-3 py-1.5` (12 × 6 px), collant, fond opaque — il doit couvrir
  les lignes qui défilent dessous.
- **Chiffres :** `tabular-nums` sur toute colonne numérique, sans exception. Une
  colonne de notes dont les chiffres ne s'alignent pas verticalement est un
  défaut, pas une préférence.
- **Colonnes :** largeur plancher via `min-w-[…]` plutôt que largeur fixe, pour
  que l'ajout d'une sous-matière ne casse pas la grille.
- **Focus :** l'anneau de 1 px reste la règle ; il ne doit pas déplacer la
  cellule ni élargir la ligne.

### Signature Component — Le Sceau (`SchoolLogo`)
Carré plein `#2A3740`, coins 14 px, ombre douce `0 4px 12px rgba(42,55,64,.15)`,
glyphe « SL » en Libre Baskerville gras `#C3B594`. Deux tailles : 40 px (glyphe
16 px) et 56 px (glyphe 22 px). Accompagné, quand `showText`, de « CPMSL » en
serif gras 20 px `#2A3740` avec approche −0.02em, surmontant « Cours Privé Mixte
Saint Léonard » en 12 px `encre-attenuee`. C'est l'unique composant du système
dont les valeurs sont posées en style inline plutôt qu'en classes : il doit être
identique partout, y compris hors contexte Tailwind.

### Signature Component — Le Bulletin imprimé (`bulletin-printable`)
Un système visuel **distinct et figé**, qui ne partage rien avec l'interface.
Feuille de `8.5in × 11in`, gabarit interne de 1040 × 1345 px ramené par
`--template-scale: 0.725`, toutes les tailles exprimées en points divisés par
cette échelle. Encre `#1c1c22`, bleu d'en-tête `#4DA3CF`, filets `#2a2a2a`, et un
codage couleur de la note : rouge `#cf3a35` (≤ 50 %), orange `#d9a21b` (< 60 %),
vert `#318c53` (< 69 %), noir au-delà. Typographie propre : Times New Roman pour
le corps, Cookie pour le nom de l'élève, Lobster pour la mention de fondation.
Le rapport de classe utilise le même langage sur un format `8½×14`.

**Ce gabarit ne se modifie pas.** Il est opposable au MENFP et aux familles
(IR-002, annexe D.1) : format, rubriques verticales R1/R2/R3, logo, légende de
pied de page et absence de bloc de synthèse sont figés. Brancher le calcul sur un
autre module change d'où viennent les chiffres, pas la mise en page.

## Do's and Don'ts

### Do:
- **Do** poser le fond de page en `hsl(40 14% 98%)` et les fiches en `#FFFFFF`.
  Test : si une carte est invisible sur son fond, l'un des deux est faux.
- **Do** dériver tout rayon de `--radius` : 8 px pour un contrôle, 14 px pour une
  fiche.
- **Do** garder la hauteur de contrôle à 36 px (`h-9`) et l'en-tête à 56 px.
  Une nouvelle hauteur doit se justifier par une contrainte de densité réelle.
- **Do** réserver Libre Baskerville aux titres et à ce qui engage
  l'établissement, et Inter à tout ce qui s'opère.
- **Do** utiliser les classes de rôle existantes (`.heading-1` … `.caption`)
  plutôt que de recomposer une taille et une approche à la main.
- **Do** signaler les états avec `succes` / `avertissement` / `erreur` /
  `information` et leurs fonds doux.
- **Do** distinguer `destructif` (l'action qui détruit) de `erreur` (le constat),
  en gardant les deux dans la même rampe rouge.
- **Do** signaler une nouveauté — notification non lue, élément récent — avec
  `information`. Une pastille rouge annonce un incident, pas un message.
- **Do** choisir la densité avant la valeur : surface de lecture → 24/16 px ;
  surface de données → 8–12 px horizontaux, 4–6 px verticaux, corps 10–11 px.
- **Do** poser `tabular-nums` sur toute colonne de chiffres — notes, moyennes,
  effectifs, coefficients.
- **Do** donner aux colonnes de grille une largeur plancher (`min-w-[…]`) et un
  en-tête collant dès que la table défile.
- **Do** ajouter `.cpmsl-scroll` à tout conteneur qui déborde.
- **Do** garder le focus au clavier visible : anneau de 1 px en `--ring`,
  `focus-visible` et non `focus`.
- **Do** composer le vertical avec 24 px entre sections et 16 px à l'intérieur.
- **Do** appeler le backend via les gestionnaires de route `app/api/**` : la
  couche visuelle ne parle jamais au serveur en direct.

### Don't:
- **Don't** modifier le gabarit du bulletin imprimé, sous aucun prétexte visuel.
- **Don't** utiliser une palette Tailwind brute pour un état — `emerald-*`,
  `amber-*`, `rose-*`, `sky-*`. Les ~260 occurrences existantes sont une dette
  héritée, pas un précédent.
- **Don't** employer l'or ailleurs que sur le sceau `SL`, fond ardoise.
- **Don't** poser du vieil or sur un fond clair. `#C3B594` donne 2,03:1 sur blanc
  et 1,94:1 sur papier crème : il échoue pour du texte (4,5:1) comme pour une
  bordure ou un anneau de focus (3:1). L'or ne tient que sur ardoise.
- **Don't** habiller un état sélectionné ou un anneau de focus avec la famille
  `secondary-*`. Le focus est en `--ring`, 1 px, `focus-visible` — laisser la
  primitive `Input` l'appliquer plutôt que de la surcharger.
- **Don't** appliquer le rythme de lecture (24/16 px) à une grille de saisie, ni
  la densité de grille à une carte ou un formulaire.
- **Don't** introduire un quatrième pas d'espacement sans le nommer dans ce
  document. Trois sont admis : 24, 16 et 20 px (fiches compactes).
- **Don't** poser une ombre sur une surface qui n'est ni survolée ni superposée,
  et ne jamais la teinter.
- **Don't** redéclarer `--font-sans` ou `--font-serif` dans `globals.css` :
  cela annule le préchargement et les métriques de repli de `next/font`.
- **Don't** utiliser Cookie ou Lobster à l'écran : elles appartiennent à
  l'imprimé.
- **Don't** épaissir une bordure pour marquer le focus, ni ajouter un halo
  coloré. Le système ne connaît qu'un poids de bordure : 1 px.
- **Don't** animer la position d'un bouton au survol. Les transitions portent sur
  la couleur (`transition-colors`), pas sur la géométrie.
- **Don't** introduire un dégradé décoratif. Le seul dégradé du projet est le
  fond de `/login`, et il reste une exception.
- **Don't** écrire un rayon en dur (`rounded-[12px]`) ni une couleur en
  hexadécimal dans un composant d'interface — le sceau excepté.
- **Don't** ajouter un troisième pas d'espacement vertical à côté de 24 px et
  16 px sans raison explicite.

### Écarts connus au 14 septembre 2026

Constats reproduits dans le code servi. Ils sont documentés pour que personne ne
les prenne pour des précédents ; leur correction relève d'une migration dédiée,
pas de ce document.

| Écart | Emplacement | Nature | État |
|---|---|---|---|
| Or `secondary-400` en bordure et anneau de focus sur fond clair — 2,03:1, sous le seuil 3:1 de WCAG 1.4.11 | `components/school/create-academic-year-modal-v2.tsx:165, 180, 207, 278` | contraste | **Corrigé le 13/09/2026** — focus rendu à la primitive `Input` (`--ring`, 1 px), état sélectionné en `border-primary`. 5,13:1 |
| Initiales d'avatar en or `#D1C19F` sur `sidebar-primary` `#587183` — 2,88:1, sous 4,5:1 | `components/admin/admin-layout-shell.tsx:459` | contraste | **Corrigé le 13/09/2026** — initiales en blanc, 5,11:1. La Règle du Sceau a été amendée en conséquence |
| Pastille de notification non lue en `bg-destructive` alors qu'elle signale une nouveauté | `components/admin/admin-layout-shell.tsx:589-590` | sémantique | **Corrigé le 13/09/2026** — passée en `bg-info`. 5,19:1 contre 3,60:1 |
| Icône du sceau de sidebar en or `#D1C19F` sur `sidebar-primary` `#587183` — 2,88:1, sous le seuil 3:1 des composants non textuels | `components/admin/admin-layout-shell.tsx:338` | contraste | ouvert — même défaut que la ligne 459, hors périmètre du lot du 13/09 |
| Or `secondary-50` / `secondary-100` employé comme fond de survol de ligne et de bloc de code, hors sceau | `cpmsl-year-config-tabs.tsx`, `cpmsl-calendar-management.tsx`, `class-statistics.tsx`, `delete-classroom-modal.tsx` | Règle du Sceau | **Corrigé le 14/09/2026** — survol en `bg-muted`, état sélectionné en `bg-primary/5`, bloc de code en `bg-muted` |
| `--destructive` encore sur le rouge Tailwind `hsl(0 84.2% 60.2%)` | `app/globals.css` | hors rampe | **Corrigé le 14/09/2026** — `0 54% 40%`, soit `#9E2F2F`. 6,93:1 contre 3,61:1, sur 21 boutons |
| Hex `#C48B1A` / `#FEF6E0` écrits en style inline au lieu du jeton `avertissement` | `bulk-transfer-modal.tsx`, `transfer-enrollment-modal.tsx`, `step-exemption-modal.tsx`, `cpmsl-rapports-section.tsx` | Règle des États Nommés | ouvert — la migration du 14/09 a porté sur les classes Tailwind, pas sur les hex en style inline |
| Texte en `amber-600` (3,06:1) et `emerald-600` (3,61:1), dont la note et la moyenne affichées | `grades-view-content.tsx`, `students/page.tsx`, `archives/page.tsx`, `grades/[enrollmentId]/page.tsx` | contraste | **Corrigé le 14/09/2026** — tout texte d'état passe à l'encre : 5,25:1 et 7,65:1 |
| Blanc sur `bg-warning/90` — 2,85:1, sous 4,5:1 | `promotion-photo-modal.tsx:280` | contraste | **Corrigé le 14/09/2026** — `text-warning-foreground`, 5,62:1 |
| Sept teintes décoratives sur les tuiles `StatCard`, sans rapport avec un état | `cpmsl-rapports-section.tsx`, `cpmsl-bulletins-section.tsx`, `cpmsl-behavior-grid.tsx`, `cpmsl-progression-tab.tsx`, `grades-view-content.tsx`, `all-students/page.tsx`, `students/page.tsx` | Règle de la Rareté | **Corrigé le 14/09/2026** — 29 tuiles : état coloré, mesure neutre |
| Aucune prise en charge de `prefers-reduced-motion` dans tout le dépôt | `app/globals.css` | mouvement | ouvert — relève de `/impeccable harden` |
| Deux échelles typographiques en parallèle : les jetons `--text-*` de DESIGN.md et l'échelle Tailwind par défaut. `text-base` (16 px) était plus gros que le corps de page (15 px) | `tailwind.config.js` (aucun `fontSize`), 717 utilitaires `text-*` | échelle | **Corrigé le 14/09/2026** — les utilitaires pointent sur les jetons ; une seule échelle |
| 12 titres de page sur 16 en Inter, là où le serif marque l'autorité | les 16 `app/**/page.tsx` | famille | **Corrigé le 14/09/2026** — tous les `h1` passent à `.heading-1` |
| `.heading-2` et `.heading-3` déclaraient un poids 600 que Libre Baskerville n'expose pas : rendu à 700, soit le même poids que `.heading-1` | `app/globals.css` | graisse fictive | **Corrigé le 14/09/2026** — 700 déclaré |
| 77 tailles en valeur arbitraire (`text-[10px]`, `text-[11px]`, `text-[13px]`, `text-[15px]`) et 120 `fontSize` en style en ligne, hors échelle | 34 fichiers, dont la famille des modales | échelle | **Corrigé le 14/09/2026** — 197 valeurs ramenées sur les jetons ; seul le sceau garde ses valeurs en ligne |
| Titres d'état vide en `<h3>` (saut de niveau depuis `h1`) et à 13 px, soit la taille du texte qu'ils coiffent | 15 emplacements | hiérarchie | **Corrigé le 14/09/2026** — `<h2>` à 15 px |
| Filet décoratif de 3 px à gauche des titres de section, alors que le système ne connaît qu'un poids de bordure (1 px) | `cpmsl-school-info-form.tsx`, `cpmsl-calendar-management.tsx`, `create-academic-year-modal-v2.tsx`, `student-enroll-form.tsx` | bordure | **Corrigé le 14/09/2026** — filet retiré ; l'autorité vient du serif |
| `/admin/.../grades/view` sans `h1` : son premier titre était un `CardTitle` rendu en `h3` | `grades-view-content.tsx` | hiérarchie | **Corrigé le 14/09/2026** — titre de page ajouté |
| Colonnes de chiffres sans `tabular-nums` | `class-statistics.tsx`, `stat-card.tsx` | chiffres | **Corrigé le 14/09/2026** |
| Cookie et Lobster chargées par `app/layout.tsx` sur **toutes** les routes, alors qu'elles n'existent que pour le gabarit imprimé | `app/layout.tsx` | livraison | ouvert — **non touché délibérément** : le gabarit est rendu depuis cinq emplacements, et déplacer la déclaration risquerait de changer le rendu imprimé |
| 515 couleurs en hexadécimal écrites en style en ligne dans les composants d'interface | 20 fichiers, dont la famille des modales | jetons | ouvert — la migration du 14/09 a porté sur les classes, pas sur les hex en ligne |
| `body` fige a `15px` alors que toute la rampe est en `rem` : le reglage de taille de police du navigateur ne portait que sur une partie du texte | `app/globals.css` | accessibilite | **Corrige le 14/09/2026** — `body` prend `var(--text-base)` |
| Aucune mesure de lecture : `main` en pleine largeur donne ~242 caracteres par ligne a 1920 px, pour une cible de 45-75 | `admin-layout-shell.tsx`, 19 conteneurs de prose | lecture | **Corrige le 14/09/2026** — `max-w-prose` sur la prose ; les grilles gardent la pleine largeur |
| Les utilitaires `text-*` n'emportaient ni l'approche ni l'interlignage des roles : `text-xs` et `text-sm`, 709 usages cumules, ne differaient que par 1 px | `tailwind.config.js` | hierarchie | **Corrige le 14/09/2026** — chaque pas porte son approche ; les jetons `--leading-*`, jusqu'ici sans consommateur, sont branches |
| `cpmsl-year-config-tabs.tsx` : colonnes coefficient et bareme sans `tabular-nums` (0 dans tout le fichier), alors que `coefficient` est nomme par la regle | `cpmsl-year-config-tabs.tsx`, `delete-level-modal.tsx` | chiffres | **Corrige le 14/09/2026** |
| Cookie et Lobster prechargees sur toutes les routes pour zero glyphe a l'ecran | `app/layout.tsx` | livraison | **Corrige le 14/09/2026** — `preload: false`. La declaration reste globale : le gabarit est monte depuis cinq emplacements, la deplacer changerait le rendu imprime |
| `text-4xl` (36 px, interligne 1) coexistait avec `text-3xl` (36 px, interligne 1.15) : deux noms pour une taille | `create-academic-year-modal-v2.tsx` | echelle | **Corrige le 14/09/2026** |
| `font-serif font-semibold` : un poids 600 qui rend 700, en composant | `app/login/layout.tsx`, `cpmsl-calendar-management.tsx` | graisse fictive | **Corrige le 14/09/2026** — `font-bold` |
| `--text-3xs` / `--text-2xs` (10-11 px) employes a 86 % hors des surfaces de donnees, dont un paragraphe de 168 caracteres a 10 px | `inscription-form/page.tsx`, `settings/page.tsx`, `transcript/page.tsx`, `cpmsl-rapports-section.tsx` | densite | ouvert — 60 des 68 usages sont sur des surfaces de lecture. Etat anterieur (`text-[10px]`), pas une regression |
| `text-xs` (12 px) et `text-sm` (13 px) separes par 1 px portent les deux roles les plus frequents (709 usages) | l'echelle elle-meme | hierarchie | ouvert — ecarter les deux pas toucherait 709 noeuds et contredirait la rampe declaree. **Arbitrage a rendre**, pas un defaut a corriger seul |
| Les deux routes d'impression n'ont aucun `h1` | `bulletins/[enrollmentId]/[stepId]`, `bulletins/lot/...` | hierarchie | ouvert — un `h1` en `sr-only` dans l'enveloppe de route reglerait le point sans toucher au gabarit, mais tout ajout de noeud dans une route capturee par `html2canvas` releve de `spec-guardian` |
| Titres interpoles (`{studentName}`, `{fullName}`) en `.heading-2` sans `break-words` ni `truncate` | `grades/[enrollmentId]/page.tsx`, `transcript/page.tsx` | contrainte | ouvert — un nom compose long debordera |
