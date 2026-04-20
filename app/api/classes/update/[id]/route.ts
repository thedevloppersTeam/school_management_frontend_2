/**
 * POST /api/classes/update/[id]
 * Proxy → POST https://apicpmsl.stelloud.cloud/api/classes/update/:id
 *
 * Modifie une classe existante.
 * Body : { maxStudents?, description? }
 * Note : classTypeId, letter sont immuables — ignorés silencieusement
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/classes/update/${id}`, 'POST')
}