/**
 * POST /api/subject-rubrics/create
 * Proxy → POST https://apicpmsl.stelloud.cloud/api/subject-rubrics/create
 *
 * Crée une nouvelle rubrique (R1, R2, R3 — max 3 par établissement).
 * Body : { name, code, description? }
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(request: NextRequest) {
  return backendFetch(request, '/api/subject-rubrics/create', 'POST')
}