/**
 * POST /api/subjects/update/[id]
 * Proxy → POST https://apicpmsl.stelloud.cloud/api/subjects/update/:id
 *
 * Modifie une matière existante.
 * Body : { name?, maxScore?, coefficient?, hasSections?, rubricId?, description? }
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