/**
 * lib/menfp/format.ts — formatage d'AFFICHAGE des valeurs MENFP.
 *
 * Le frontend n'effectue aucun calcul (SPEC-MENFP M-36, ADR-007 § 1) : ces
 * fonctions ne font qu'écrire autrement une chaîne reçue du serveur. Aucune
 * conversion en nombre, aucun arrondi, aucune troncature : une valeur à plus
 * de deux décimales est rendue avec toutes ses décimales.
 */

/** Chaîne décimale exacte du contrat : « 200 », « 0.1 », « -0.12 ». */
const DECIMALE = /^(-?)(\d+)(?:\.(\d+))?$/

/** Trait affiché pour une valeur absente (« — », M-42). */
export const TRAIT = "—"

/**
 * Valeur décimale à deux décimales au moins, virgule décimale :
 * « 0.1 » → « 0,10 » ; « 346 » → « 346,00 » ; « 6.925 » → « 6,925 » ;
 * `null` → « — ». Une chaîne hors format est rendue telle quelle.
 */
export function decimaleAffichee(valeur: string | null | undefined): string {
  if (valeur === null || valeur === undefined) return TRAIT
  const m = DECIMALE.exec(valeur)
  if (!m) return valeur
  const [, signe, entier, decimales = ""] = m
  return `${signe}${entier},${decimales.padEnd(2, "0")}`
}

/**
 * Valeur décimale telle quelle, virgule décimale, sans compléter : sert aux
 * coefficients (« 200 ») et aux valeurs de détail (« 0.65 » → « 0,65 »).
 */
export function decimaleBrute(valeur: string | null | undefined): string {
  if (valeur === null || valeur === undefined) return TRAIT
  return DECIMALE.test(valeur) ? valeur.replace(".", ",") : valeur
}

/**
 * Saisie du seuil d'alerte → chaîne à point pour le serveur, ou `null` si la
 * saisie n'a pas la forme attendue (1 à 3 chiffres, virgule ou point, deux
 * décimales au plus). Aucune conversion en nombre : le serveur reste juge
 * (MENFP_SEUIL_INVALIDE).
 */
export function seuilSaisi(saisie: string): string | null {
  const t = saisie.trim()
  return /^\d{1,3}([.,]\d{1,2})?$/.test(t) ? t.replace(",", ".") : null
}

const deux = (n: number) => String(n).padStart(2, "0")

/**
 * Date et heure ISO 8601 (UTC) → « JJ/MM/AAAA HH:mm » à l'heure locale du poste.
 * Une chaîne illisible est rendue telle quelle.
 */
export function dateHeureAffichee(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${deux(d.getDate())}/${deux(d.getMonth() + 1)}/${d.getFullYear()} ${deux(d.getHours())}:${deux(d.getMinutes())}`
}

/** Date « AAAA-MM-JJ » ou ISO → « JJ/MM/AAAA » (jour civil de la chaîne, sans fuseau). */
export function dateAffichee(valeur: string | null | undefined): string {
  if (!valeur) return TRAIT
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valeur)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : valeur
}

/** Libellé d'une grille officielle (M-08). */
export const LIBELLES_GRILLES = {
  AF_1_6: "1re–6e AF",
  AF_7_8: "7e–8e AF",
  NS_1_3: "NS1–NS3",
} as const

/** Libellé de l'état d'un référentiel (M-61). */
export const LIBELLES_ETAT = {
  absent: "Absent",
  incomplet: "Incomplet",
  complet: "Complet",
} as const

/** Nom de fichier de l'en-tête Content-Disposition (filename* UTF-8 prioritaire), sinon `null`. */
export function nomDeFichier(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null
  const etoile = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(contentDisposition)
  if (etoile) {
    try {
      return decodeURIComponent(etoile[1].trim())
    } catch {
      // repli sur filename=
    }
  }
  const simple = /filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i.exec(contentDisposition)
  const nom = simple?.[1] ?? simple?.[2]
  return nom ? nom.trim() : null
}
