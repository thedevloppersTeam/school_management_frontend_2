/**
 * GET /api/promotions/preview?classSessionId=
 * Proxy → GET /api/promotions/preview (SPEC-PROMOTION § 5).
 *
 * Délibération d'une salle : moyenne annuelle CALCULÉE PAR LE SERVEUR, issue
 * proposée, état prêt / bloqué, décision existante. Le navigateur n'en calcule
 * aucune part.
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(request: NextRequest) {
  return backendFetch(request, '/api/promotions/preview', 'GET')
}
