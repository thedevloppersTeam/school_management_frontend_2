/**
 * POST /api/academic-years/steps/[id]/merge-into/[targetId]
 * Proxy → POST {BACKEND}/api/academic-years/steps/:sourceId/merge-into/:targetId
 *
 * The path slug is named `[id]` (not `[sourceId]`) to share the dynamic name
 * already used by `/api/academic-years/steps/[id]/route.ts` — Next.js rejects
 * sibling routes that use different slug names at the same path position.
 *
 * Fusionne deux étapes : grades, comportements et bulletins archivés sont
 * déplacés de la source vers la cible, puis la source est supprimée.
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; targetId: string }> }
) {
  const { id, targetId } = await params
  return backendFetch(
    request,
    `/api/academic-years/steps/${id}/merge-into/${targetId}`,
    'POST'
  )
}
