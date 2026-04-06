/**
 * POST /api/attitudes/update/[id]
 * Proxy → POST https://apicpmsl.stelloud.cloud/api/attitudes/update/:id
 *
 * Modifie le libellé d'une attitude.
 * Body : { label: string }
 * Rôles autorisés : ADMIN, SYSTEM_ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/attitudes/update/${id}`, 'POST')
}