/**
 * POST /api/academic-years/set-current/[id]
 * Proxy → POST https://apicpmsl.stelloud.cloud/api/academic-years/set-current/:id
 *
 * Définit une année scolaire comme année active (isCurrent = true).
 * Une seule année peut être active à la fois — les autres passent à false.
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/academic-years/set-current/${id}`, 'POST')
}