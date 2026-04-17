/**
 * POST /api/subjects/create
 * Proxy → POST https://apicpmsl.stelloud.cloud/api/subjects/create
 *
 * Crée une nouvelle matière dans le référentiel global.
 * Body : { name, code, maxScore, coefficient, hasSections, rubricId }
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(request: NextRequest) {
  return backendFetch(request, '/api/subjects/create', 'POST')
}