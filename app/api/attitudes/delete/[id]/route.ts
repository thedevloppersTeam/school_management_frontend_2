/**
 * POST /api/attitudes/delete/[id]
 * Proxy → POST https://apicpmsl.stelloud.cloud/api/attitudes/delete/:id
 *
 * Supprime une attitude.
 * Body : (vide)
 * Rôles autorisés : ADMIN, SYSTEM_ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/attitudes/delete/${id}`, 'POST')
}