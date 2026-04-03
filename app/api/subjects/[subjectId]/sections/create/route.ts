/**
 * POST /api/subjects/[subjectId]/sections/create
 * Proxy → POST https://apicpmsl.stelloud.cloud/api/subjects/:subjectId/sections/create
 *
 * Crée une sous-matière pour une matière existante.
 * Body : { name, code, maxScore, displayOrder }
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ subjectId: string }> }
) {
  const { subjectId } = await params
  return backendFetch(request, `/api/subjects/${subjectId}/sections/create`, 'POST')
}