/**
 * POST /api/menfp/referentiels/[id]/sources → classement des sources
 * (M-10, M-11, M-12). [id] : référentiel.
 */
import { NextRequest } from 'next/server'
import { backendFetchValide } from '@/lib/backend'
import { PostApiMenfpReferentielsIdSources200Response } from '@/lib/api/menfp/contract.gen'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetchValide(
    request,
    `/api/menfp/referentiels/${encodeURIComponent(id)}/sources`,
    'POST',
    PostApiMenfpReferentielsIdSources200Response,
  )
}
