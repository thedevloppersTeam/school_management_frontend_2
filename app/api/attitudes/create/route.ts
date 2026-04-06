/**
 * POST /api/attitudes/create
 * Proxy → POST https://apicpmsl.stelloud.cloud/api/attitudes/create
 *
 * Crée une attitude pour une année scolaire.
 * Body : { label: string, academicYearId: string }
 * Rôles autorisés : ADMIN, SYSTEM_ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(request: NextRequest) {
  return backendFetch(request, '/api/attitudes/create', 'POST')
}