/**
 * /api/menfp/referentiels/[academicYearId]/[classTypeId]
 *   GET  → référentiel d'une année et d'un niveau (matières, Σ, sources, signalements).
 *   POST → création vide ou par copie de l'année précédente (M-06, M-07). 201.
 *
 * Le premier segment s'appelle [id] dans l'arborescence : Next.js impose le même
 * nom à tous les segments dynamiques frères (referentiels/[id]/import-grille…).
 * Ici, il porte l'identifiant de l'ANNÉE.
 */
import { NextRequest } from 'next/server'
import { backendFetchValide } from '@/lib/backend'
import {
  GetApiMenfpReferentielsAcademicYearIdClassTypeId200Response,
  PostApiMenfpReferentielsAcademicYearIdClassTypeId201Response,
} from '@/lib/api/menfp/contract.gen'

type Params = { params: Promise<{ id: string; classTypeId: string }> }

function chemin(academicYearId: string, classTypeId: string): string {
  return `/api/menfp/referentiels/${encodeURIComponent(academicYearId)}/${encodeURIComponent(classTypeId)}`
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id, classTypeId } = await params
  return backendFetchValide(
    request,
    chemin(id, classTypeId),
    'GET',
    GetApiMenfpReferentielsAcademicYearIdClassTypeId200Response,
  )
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id, classTypeId } = await params
  return backendFetchValide(
    request,
    chemin(id, classTypeId),
    'POST',
    PostApiMenfpReferentielsAcademicYearIdClassTypeId201Response,
  )
}
