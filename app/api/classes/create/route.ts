/**
 * POST /api/classes/create
 * Proxy → POST https://apicpmsl.stelloud.cloud/api/classes/create
 *
 * Crée une nouvelle classe.
 * Body : { classTypeId, letter, maxStudents, trackId? (requis si isTerminal = true) }
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(request: NextRequest) {
  return backendFetch(request, '/api/classes/create', 'POST')
}