/**
 * POST /api/promotions/[decisionId]/cancel
 * Proxy → POST /api/promotions/:decisionId/cancel (SPEC-PROMOTION § 5).
 *
 * Body : { reason? }. Refus 409 si l'inscription N+1 porte une note, une note
 * de comportement ou un bulletin archivé (RP-14, RP-21, RP-22).
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ decisionId: string }> }
) {
  const { decisionId } = await params
  return backendFetch(request, `/api/promotions/${encodeURIComponent(decisionId)}/cancel`, 'POST')
}
