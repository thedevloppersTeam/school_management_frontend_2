/**
 * POST /api/enrollments/transfer
 * Proxy → POST https://apicpmsl.stelloud.cloud/api/enrollments/transfer
 *
 * Transfère un élève vers une autre classe.
 * Opération atomique : ancien enrollment → TRANSFERRED, nouvel enrollment → ACTIVE.
 * Body : { enrollmentId, newClassSessionId, notes?, migrateGrades? }
 * migrateGrades=true : notes, comportements et dispenses suivent l'élève
 * (même année + même niveau requis) ; sinon l'historique reste sur l'ancien enrollment.
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(request: NextRequest) {
  return backendFetch(request, '/api/enrollments/transfer', 'POST')
}