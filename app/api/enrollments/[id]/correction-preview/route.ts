// GET /api/enrollments/:id/correction-preview?targetClassSessionId=...&targetTrackId=...
// Impact d'une correction d'affectation avant confirmation. Lecture seule.
// Rôles autorisés : SYSTEM_ADMIN, ADMIN

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/enrollments/${id}/correction-preview`, 'GET')
}
