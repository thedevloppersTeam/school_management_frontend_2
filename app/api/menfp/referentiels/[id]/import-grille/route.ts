/**
 * POST /api/menfp/referentiels/[id]/import-grille → import d'une grille officielle
 * choisie par l'utilisateur (M-37). Body : { grille }. [id] : référentiel.
 */
import { NextRequest } from 'next/server'
import { backendFetchValide } from '@/lib/backend'
import { PostApiMenfpReferentielsIdImportGrille200Response } from '@/lib/api/menfp/contract.gen'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetchValide(
    request,
    `/api/menfp/referentiels/${encodeURIComponent(id)}/import-grille`,
    'POST',
    PostApiMenfpReferentielsIdImportGrille200Response,
  )
}
