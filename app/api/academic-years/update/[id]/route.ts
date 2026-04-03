/**
 * POST /api/academic-years/update/[id]
 * Proxy → POST https://apicpmsl.stelloud.cloud/api/academic-years/update/:id
 *
 * Modifie les informations d'une année scolaire existante.
 * Body : { name?, startDate?, endDate? }
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/academic-years/update/${id}`, 'POST')
}