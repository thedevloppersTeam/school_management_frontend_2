/**
 * POST /api/behaviors/update/[id]
 * Proxy → POST https://apicpmsl.stelloud.cloud/api/behaviors/update/:id
 *
 * Modifie le comportement d'un élève pour une étape.
 * Body : {
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/behaviors/update/${id}`, 'POST')
}