/**
 * POST /api/enrollments/transfer
 * Proxy → POST https://apicpmsl.stelloud.cloud/api/enrollments/transfer
 *
 * Transfère un élève vers une autre classe.
 * Opération atomique : ancien enrollment → TRANSFERRED, nouvel enrollment → ACTIVE.
 * L'historique des notes reste attaché à l'ancien enrollment.
 * Body : { enrollmentId, newClassSessionId, notes? }
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(request: NextRequest) {
  return backendFetch(request, '/api/enrollments/transfer', 'POST')
}