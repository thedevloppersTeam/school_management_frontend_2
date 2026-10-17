/**
 * POST /api/promotions/execute
 * Proxy → POST /api/promotions/execute (SPEC-PROMOTION § 5).
 *
 * Body : { items: [{ decisionId, targetClassSessionId?, trackId? }] }
 * Réponse : { executed[], excluded[{ decisionId, message }] } — les exclus
 * portent la raison rédigée par le serveur.
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(request: NextRequest) {
  return backendFetch(request, '/api/promotions/execute', 'POST')
}
