// POST /api/enrollments/:id/departure/complete — compléter un départ ancien
// (SPEC-RESULTATS RS-12, D-20) : inscription DROPPED ou TRANSFERRED sans
// dernière étape suivie → DROPPED avec date, dernière étape, motif, commentaire.
// Corps : { leftAt, lastAttendedStepId, reason, note? }. Journalisé
// STUDENT_LEFT_COMPLETED. ADMIN.

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/enrollments/${id}/departure/complete`, 'POST')
}
