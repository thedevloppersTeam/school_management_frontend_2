// POST /api/enrollments/track-update/:id
// Change la filière d'un élève (portée par son inscription).
// Rôles autorisés : SYSTEM_ADMIN, ADMIN

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/enrollments/track-update/${id}`, 'POST')
}
