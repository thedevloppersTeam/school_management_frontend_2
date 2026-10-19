/**
 * GET /api/results?classSessionId=&stepId=[&scope=common|exam|all]
 * Proxy → GET /api/results (SPEC-RESULTATS § 4).
 *
 * Résultats d'une salle à une étape, calculés UNE FOIS par le serveur :
 * matières, sous-matières, rubriques, étape, annuelle, lignes et barèmes à
 * imprimer, moyennes de classe. Valeurs exactes (chaînes), sans arrondi.
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(request: NextRequest) {
  return backendFetch(request, '/api/results', 'GET')
}
