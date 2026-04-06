/**
 * GET /api/behaviors
 * Proxy → GET https://apicpmsl.stelloud.cloud/api/behaviors
 *
 * Retourne les comportements selon le filtre fourni.
 * Query params (un des deux) :
 *   ?enrollmentId=&stepId=      → comportement d'un seul élève
 *   ?classSessionId=&stepId=    → comportements de toute une classe
 * Rôles autorisés : ADMIN, SYSTEM_ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(request: NextRequest) {
  return backendFetch(request, '/api/behaviors', 'GET')
}