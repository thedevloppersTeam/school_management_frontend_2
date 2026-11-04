/**
 * /api/menfp/salles/[classSessionId]/rapports
 *   GET    → versions gelées et signalement M-47.
 *   POST   → gel d'une nouvelle version (motif obligatoire au-delà de la 1re). 201.
 *   DELETE → purge de toutes les versions (M-56). Corps JSON { motif } relayé
 *            tel quel : backendFetch transmet le corps de toute méthode hors GET/HEAD.
 */
import { NextRequest } from 'next/server'
import { backendFetchValide } from '@/lib/backend'
import {
  DeleteApiMenfpSallesClassSessionIdRapports200Response,
  GetApiMenfpSallesClassSessionIdRapports200Response,
  PostApiMenfpSallesClassSessionIdRapports201Response,
} from '@/lib/api/menfp/contract.gen'

type Params = { params: Promise<{ classSessionId: string }> }

function chemin(classSessionId: string): string {
  return `/api/menfp/salles/${encodeURIComponent(classSessionId)}/rapports`
}

export async function GET(request: NextRequest, { params }: Params) {
  const { classSessionId } = await params
  return backendFetchValide(request, chemin(classSessionId), 'GET', GetApiMenfpSallesClassSessionIdRapports200Response)
}

export async function POST(request: NextRequest, { params }: Params) {
  const { classSessionId } = await params
  return backendFetchValide(request, chemin(classSessionId), 'POST', PostApiMenfpSallesClassSessionIdRapports201Response)
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { classSessionId } = await params
  return backendFetchValide(
    request,
    chemin(classSessionId),
    'DELETE',
    DeleteApiMenfpSallesClassSessionIdRapports200Response,
  )
}
