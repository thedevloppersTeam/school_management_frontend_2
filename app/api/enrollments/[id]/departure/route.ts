// POST /api/enrollments/:id/departure — déclarer un départ en cours d'année
// (SPEC-RESULTATS RS-08). Corps : { leftAt: "AAAA-MM-JJ", lastAttendedStepId,
// reason: TRANSFER_OTHER_SCHOOL | DROPOUT | OTHER, note? }. Inscription ACTIVE
// seulement ; statut → DROPPED (D-19) ; journalisé STUDENT_LEFT. ADMIN.

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/enrollments/${id}/departure`, 'POST')
}
