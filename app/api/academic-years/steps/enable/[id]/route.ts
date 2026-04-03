/**
 * GET /api/academic-years/steps/enable/[id]
 * Proxy → GET https://apicpmsl.stelloud.cloud/api/academic-years/steps/enable/:id
 *
 * Ouvre une étape — permet la saisie des notes pour cette étape.
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/academic-years/steps/enable/${id}`, 'GET')
}