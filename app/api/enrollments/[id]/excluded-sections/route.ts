/**
 * GET  /api/enrollments/[id]/excluded-sections — list sections excluded for this enrollment
 * POST /api/enrollments/[id]/excluded-sections — replace the full set
 *
 * Used by the saisie + consultation grids so the parent subject's effective
 * max score drops by the excluded sections' maxScore.
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
