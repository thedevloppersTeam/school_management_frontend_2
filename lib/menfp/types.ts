/**
 * lib/menfp/types.ts — types MENFP DÉDUITS du contrat généré (ADR-007 § 2).
 *
 * Aucun type n'est écrit à la main : chacun est `z.infer` d'un validateur de
 * lib/api/menfp/contract.gen.ts. Imports de TYPES seulement : aucun octet de
 * zod n'arrive dans le navigateur (la validation se fait dans les route handlers).
 */
import type { z } from "zod"
import type {
  DeleteApiMenfpSallesClassSessionIdRapports200Response,
  GetApiMenfpAnneesAcademicYearIdNiveaux200Response,
  GetApiMenfpParametres200Response,
  GetApiMenfpReferentielsAcademicYearIdClassTypeId200Response,
  GetApiMenfpSallesClassSessionIdApercu200Response,
  GetApiMenfpSallesClassSessionIdApercu409Response,
  GetApiMenfpSallesClassSessionIdRapports200Response,
  PostApiMenfpReferentielsAcademicYearIdClassTypeIdBody,
  PostApiMenfpReferentielsIdImportGrilleBody,
  PostApiMenfpReferentielsIdMatieresBody,
  PostApiMenfpReferentielsIdSourcesBody,
  PostApiMenfpSallesClassSessionIdRapports201Response,
} from "@/lib/api/menfp/contract.gen"

export type Parametres = z.infer<typeof GetApiMenfpParametres200Response>
export type Niveaux = z.infer<typeof GetApiMenfpAnneesAcademicYearIdNiveaux200Response>
export type Niveau = Niveaux["niveaux"][number]
export type EtatReferentiel = Niveau["etat"]
export type Referentiel = z.infer<typeof GetApiMenfpReferentielsAcademicYearIdClassTypeId200Response>
export type MatiereMinistere = Referentiel["matieres"][number]
export type Source = Referentiel["sources"][number]
export type SignalementReferentiel = Referentiel["signalements"][number]
export type CreationReferentiel = z.infer<typeof PostApiMenfpReferentielsAcademicYearIdClassTypeIdBody>
export type ImportGrille = z.infer<typeof PostApiMenfpReferentielsIdImportGrilleBody>
export type IdGrille = ImportGrille["grille"]
export type MatieresEntree = z.infer<typeof PostApiMenfpReferentielsIdMatieresBody>
export type SourcesEntree = z.infer<typeof PostApiMenfpReferentielsIdSourcesBody>
export type Apercu = z.infer<typeof GetApiMenfpSallesClassSessionIdApercu200Response>
export type LigneApercu = Apercu["lignes"][number]
export type BlocageApercu = Apercu["blocages"][number]
export type SignalementApercu = Apercu["signalements"][number]
export type ModifieDepuisLeGel = NonNullable<Apercu["modifieDepuisLeGel"]>
export type Versions = z.infer<typeof GetApiMenfpSallesClassSessionIdRapports200Response>
export type Version = Versions["versions"][number]
export type RapportGele = z.infer<typeof PostApiMenfpSallesClassSessionIdRapports201Response>
export type Purge = z.infer<typeof DeleteApiMenfpSallesClassSessionIdRapports200Response>
/** Corps d'un refus 400 ou 409 de l'aperçu ou du gel : ErreurAvecRefus, ou Erreur simple. */
export type CorpsRefus = z.infer<typeof GetApiMenfpSallesClassSessionIdApercu409Response>
