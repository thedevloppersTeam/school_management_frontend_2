/**
 * POST /api/school-info/update
 * Proxy → POST https://apicpmsl.stelloud.cloud/api/school-info/update
 *
 * Met à jour les informations de l'établissement.
 * Body : { name, motto?, foundedYear?, logo?, address?, phone?, email? }
 * Rôles autorisés : ADMIN, SYSTEM_ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(request: NextRequest) {
  return backendFetch(request, '/api/school-info/update', 'POST')
}