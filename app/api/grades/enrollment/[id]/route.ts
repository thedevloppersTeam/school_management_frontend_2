/**
 * GET /api/grades/enrollment/[id]
 * Proxy → GET https://apicpmsl.stelloud.cloud/api/grades/enrollment/:enrollmentId
 *
 * Retourne toutes les notes d'un élève pour une inscription donnée.
 * Query params optionnels : stepId, classSubjectId
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN, TEACHER
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/grades/enrollment/${id}`, 'GET')
}