/**
 * GET /api/academic-years/steps/disable/[id]
 * Proxy → GET https://apicpmsl.stelloud.cloud/api/academic-years/steps/disable/:id
 *
 * Clôture une étape — verrouille la saisie des notes pour cette étape.
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/academic-years/steps/disable/${id}`, 'GET')
}