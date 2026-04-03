
/**
 * GET /api/subjects/[subjectId]/sections
 * Proxy → GET https://apicpmsl.stelloud.cloud/api/subjects/:subjectId/sections
 *
 * Retourne la liste des sous-matières d'une matière.
 * Disponible uniquement si subject.hasSections = true.
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/subjects/update/${id}`, 'POST')
}