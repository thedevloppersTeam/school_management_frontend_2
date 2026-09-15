// POST /api/enrollments/:id/correct-assignment
// Corrige une erreur de saisie à l'inscription. L'id de l'inscription ne
// change pas. Motif obligatoire.
// Rôles autorisés : SYSTEM_ADMIN, ADMIN

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/enrollments/${id}/correct-assignment`, 'POST')
}
