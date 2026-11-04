/**
 * lib/menfp/liens.ts — lien de correction d'un refus ou d'un signalement MENFP
 * (plan d'écrans 5.4). Fonction pure : un code, le contexte de la salle, un lien
 * vers l'écran où corriger, ou `null`.
 */

export interface ContexteLien {
  academicYearId: string
  classTypeId?: string | null
}

export interface LienCorrection {
  href: string
  libelle: string
}

export type OngletMenfp = "general" | "matieres" | "correspondances"

/** Adresse de Paramètres › MENFP sur un onglet, avec l'année et le niveau choisis. */
export function adresseParametresMenfp(onglet: OngletMenfp, ctx?: ContexteLien): string {
  const q = new URLSearchParams({ onglet })
  if (ctx?.academicYearId) q.set("annee", ctx.academicYearId)
  if (ctx?.classTypeId) q.set("niveau", ctx.classTypeId)
  return `/admin/settings/menfp?${q.toString()}`
}

/** Adresse de l'écran de préparation de la liste, sur une année et une salle. */
export function adresseListeMenfp(academicYearId?: string | null, classSessionId?: string | null): string {
  const q = new URLSearchParams()
  if (academicYearId) q.set("annee", academicYearId)
  if (classSessionId) q.set("salle", classSessionId)
  const s = q.toString()
  return s ? `/admin/fin-annee/menfp?${s}` : "/admin/fin-annee/menfp"
}

export function lienCorrection(code: string, ctx: ContexteLien): LienCorrection | null {
  const annee = encodeURIComponent(ctx.academicYearId)
  switch (code) {
    case "MENFP_REFERENTIEL_ABSENT":
    case "MENFP_REFERENTIEL_VIDE":
    case "MENFP_MATIERE_SANS_SOURCE":
      return { href: adresseParametresMenfp("matieres", ctx), libelle: "Ouvrir Paramètres › MENFP › Matières et coefficients" }
    case "MENFP_SOURCES_NON_CLASSEES":
    case "MENFP_MODE_GLOBAL":
    case "MENFP_ASSOCIATION_SANS_RUBRIQUE":
      return { href: adresseParametresMenfp("correspondances", ctx), libelle: "Ouvrir Paramètres › MENFP › Correspondances" }
    case "MENFP_LOGO_MINISTERE_ABSENT":
      return { href: adresseParametresMenfp("general", ctx), libelle: "Ouvrir Paramètres › MENFP › Général" }
    case "MENFP_ECOLE_ABSENTE":
    case "MENFP_LOGO_ECOLE_OMIS":
      return { href: "/admin/settings", libelle: "Ouvrir Établissement › Informations générales" }
    case "MENFP_ANNEE_NON_CLOSE":
      return { href: "/admin/academic-years", libelle: "Ouvrir Années scolaires" }
    case "MENFP_DEPART_A_COMPLETER":
      return { href: `/admin/academic-year/${annee}/departures`, libelle: "Ouvrir Départs à compléter" }
    case "MENFP_DELIBERATION_ABSENTE":
      return { href: "/admin/fin-annee/promotion", libelle: "Ouvrir Promotion des élèves" }
    case "MENFP_SEXE_MANQUANT":
    case "MENFP_LISTE_VIDE":
      return { href: `/admin/academic-year/${annee}/students`, libelle: "Ouvrir Élèves inscrits" }
    case "MENFP_BAREME_NUL":
    case "MENFP_MATIERE_AFFECTEE_DEUX_FOIS":
      return { href: "/admin/settings", libelle: "Ouvrir Établissement › Classes" }
    case "MENFP_MOYENNE_IMPOSSIBLE":
      return { href: `/admin/academic-year/${annee}/grades`, libelle: "Ouvrir Notes" }
    default:
      return null
  }
}
