/**
 * POST /api/class-subjects/update/[id]
 * Proxy → POST https://apicpmsl.stelloud.cloud/api/class-subjects/update/:id
 *
 * Modifie une assignation matière-classe.
 * Body : { teacherId?, coefficientOverride? }
 * classSessionId et subjectId sont immuables après création.
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/class-subjects/update/${id}`, 'POST')
}