/**
 * GET /api/academic-years/steps/[id]
 * Proxy → GET https://apicpmsl.stelloud.cloud/api/academic-years/steps/:id
 *
 * Récupère une étape (step) par son ID.
 * Retourne : { id, name, stepNumber, startDate, endDate, academicYearId }
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/academic-years/steps/${id}`, 'GET')
}