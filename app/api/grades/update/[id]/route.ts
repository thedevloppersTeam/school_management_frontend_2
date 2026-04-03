/**
 * POST /api/grades/update/[id]
 * Proxy → POST https://apicpmsl.stelloud.cloud/api/grades/update/:id
 *
 * Modifie une note existante.
 * Body : { studentScore?, gradeType?, comment?, gradedAt? }
 * Note : enrollmentId, classSubjectId, stepId sont immuables après création.
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN, TEACHER
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/grades/update/${id}`, 'POST')
}