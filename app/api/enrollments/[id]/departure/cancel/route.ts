// POST /api/enrollments/:id/departure/cancel — annuler un départ : retour
// ACTIVE, champs de départ remis à vide ; journalisé STUDENT_LEFT_CANCELLED.
// Corps : { reason? }. Inscription DROPPED seulement. ADMIN.

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/enrollments/${id}/departure/cancel`, 'POST')
}
