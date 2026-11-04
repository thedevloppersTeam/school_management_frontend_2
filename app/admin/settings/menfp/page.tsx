/**
 * Paramétrage → MENFP (SPEC-MENFP M-54) : logo du ministère, seuil d'alerte,
 * matières et coefficients, correspondances. Accès vérifié par le serveur
 * (menfp.referentiel.gerer) ; un 403 s'affiche dans la zone concernée.
 */
import { Suspense } from "react"
import { ParametresMenfp } from "@/components/menfp/parametres-menfp"

export default function ParametresMenfpPage() {
  return (
    <Suspense fallback={null}>
      <ParametresMenfp />
    </Suspense>
  )
}
