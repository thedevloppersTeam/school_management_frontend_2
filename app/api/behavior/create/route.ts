/**
 * POST /api/behaviors/create
 * Proxy → POST https://apicpmsl.stelloud.cloud/api/behaviors/create
 *
 * Crée le comportement d'un élève pour une étape.
 * Contrainte unique : enrollmentId + stepId
 * Body : {
 *   enrollmentId: string,
 *   stepId: string,
 *   absences?: number,
 *   retards?: number,
 *   devoirsManques?: number,
 *   pointsForts?: string,
 *   defis?: string,
 *   remarque?: string,
 *   attitudeResponses?: { attitudeId: string, value: boolean }[]
 * }
 * Rôles autorisés : ADMIN, SYSTEM_ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(request: NextRequest) {
  return backendFetch(request, '/api/behaviors/create', 'POST')
}