/**
 * GET /api/attitudes
 * Proxy → GET https://apicpmsl.stelloud.cloud/api/attitudes
 *
 * Liste les attitudes d'une année scolaire.
 * Query params : ?academicYearId=  (optionnel)
 * Rôles autorisés : ADMIN, SYSTEM_ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(request: NextRequest) {
  return backendFetch(request, '/api/attitudes', 'GET')
}