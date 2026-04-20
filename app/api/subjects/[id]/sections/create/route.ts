/**
 * POST /api/subjects/[id]/sections/create
 * Proxy → POST https://apicpmsl.stelloud.cloud/api/subjects/:subjectId/sections/create
 *
 * Crée une sous-matière pour une matière existante.
 * Body : { name, code, maxScore, displayOrder }
 * Note : le param Next.js s'appelle "id" (convention projet), mais sémantiquement
 *        il représente un subjectId côté backend.
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/subjects/${id}/sections/create`, 'POST')
}