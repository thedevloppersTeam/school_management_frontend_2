/**
 * PUT /api/promotions/decisions
 * Proxy → PUT /api/promotions/decisions (SPEC-PROMOTION § 5).
 *
 * Body : { classSessionId, decisions: [{ enrollmentId, finalOutcome,
 *          overrideReason?, conditionText?, unblockReason? }] }
 * Tout ou rien : 422 + errors[] si une décision est refusée (RP-04/05/09/23).
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function PUT(request: NextRequest) {
  return backendFetch(request, '/api/promotions/decisions', 'PUT')
}
