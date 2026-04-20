/**
 * POST /api/subject-rubrics/update/[id]
 * Proxy → POST https://apicpmsl.stelloud.cloud/api/subject-rubrics/update/:id
 *
 * Modifie une rubrique existante.
 * Body : { name?, description? }
 * Note : code est immuable — ignoré silencieusement par le backend
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/subject-rubrics/update/${id}`, 'POST')
}