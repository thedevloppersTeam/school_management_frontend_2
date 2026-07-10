/**
 * GET  /api/enrollments/[id]/excluded-sections?classSubjectId=…&stepId=…
 * POST /api/enrollments/[id]/excluded-sections — replace exclusions for the
 * selected enrollment + subject + step only.
 *
 * Used by the saisie grid so the parent subject's effective max score drops by
 * the excluded sections' maxScore for the current period/étape only.
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/enrollments/${id}/excluded-sections`, 'GET')
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/enrollments/${id}/excluded-sections`, 'POST')
}
