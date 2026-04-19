/**
 * GET /api/subjects/[id]/sections
 * Proxy → GET https://apicpmsl.stelloud.cloud/api/subjects/:subjectId/sections
 *
 * Liste les sous-matières (sections) d'une matière.
 * Note : le param Next.js s'appelle "id" (convention projet), mais sémantiquement
 *        il représente un subjectId côté backend.
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/subjects/${id}/sections`, 'GET')
}