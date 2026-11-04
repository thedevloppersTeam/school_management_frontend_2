/**
 * POST /api/menfp/referentiels/[id]/matieres → mise à jour différentielle des
 * matières ministère, à identifiants stables (M-04, M-45). [id] : référentiel.
 */
import { NextRequest } from 'next/server'
import { backendFetchValide } from '@/lib/backend'
import { PostApiMenfpReferentielsIdMatieres200Response } from '@/lib/api/menfp/contract.gen'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetchValide(
    request,
    `/api/menfp/referentiels/${encodeURIComponent(id)}/matieres`,
    'POST',
    PostApiMenfpReferentielsIdMatieres200Response,
  )
}
