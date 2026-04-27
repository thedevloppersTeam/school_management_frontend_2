/**
 * GET /api/class-subjects/[id]
 * Proxy → GET https://apicpmsl.stelloud.cloud/api/class-subjects/:id
 *
 * Récupère une assignation matière-classe par son ID.
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/class-subjects/${id}`, 'GET')
}