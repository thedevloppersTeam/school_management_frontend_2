/**
 * GET /api/menfp/annees/[academicYearId]/niveaux → niveaux non terminaux de
 * l'année et état de leur référentiel (M-02, M-61, M-63).
 */
import { NextRequest } from 'next/server'
import { backendFetchValide } from '@/lib/backend'
import { GetApiMenfpAnneesAcademicYearIdNiveaux200Response } from '@/lib/api/menfp/contract.gen'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ academicYearId: string }> }
) {
  const { academicYearId } = await params
  return backendFetchValide(
    request,
    `/api/menfp/annees/${encodeURIComponent(academicYearId)}/niveaux`,
    'GET',
    GetApiMenfpAnneesAcademicYearIdNiveaux200Response,
  )
}
