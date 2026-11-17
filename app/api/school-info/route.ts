/**
 * GET /api/school-info
 * Proxy → GET <BACKEND_URL>/api/school-info
 *
 * Retourne les informations de l'établissement.
 * Rôles autorisés : ADMIN, SYSTEM_ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(request: NextRequest) {
  return backendFetch(request, '/api/school-info', 'GET')
}