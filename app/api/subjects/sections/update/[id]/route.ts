/**
 * POST /api/subjects/sections/update/[id]
 * Proxy → POST <BACKEND_URL>/api/subjects/sections/update/:id
 *
 * Modifie une sous-matière existante.
 * Body : { name?, maxScore?, displayOrder? }
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/subjects/sections/update/${id}`, 'POST')
}