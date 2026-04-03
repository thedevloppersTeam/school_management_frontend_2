/**
 * GET /api/subject-rubrics
 * Proxy → GET https://apicpmsl.stelloud.cloud/api/subject-rubrics/
 *
 * Retourne la liste de toutes les rubriques de matières.
 * Rubriques CPMSL : R1 (70%), R2 (25%), R3 (5%) — formule BR-001.
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(request: NextRequest) {
  return backendFetch(request, '/api/subject-rubrics/', 'GET')
}