/**
 * Fin d'année → Liste MENFP (SPEC-MENFP M-34) : aperçu d'une salle, gel,
 * versions, export Excel et purge. Les valeurs affichées sont celles du
 * serveur (M-36) ; accès vérifié par le serveur (menfp.rapport.*).
 */
import { Suspense } from "react"
import { PreparationListe } from "@/components/menfp/preparation-liste"

export default function ListeMenfpPage() {
  return (
    <Suspense fallback={null}>
      <PreparationListe />
    </Suspense>
  )
}
