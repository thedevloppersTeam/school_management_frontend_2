/**
 * GET /api/menfp/salles/[classSessionId]/apercu → aperçu de la liste d'une salle
 * (M-34) : en-tête, colonnes, lignes, écart et alerte calculés par le serveur.
 */
import { NextRequest } from 'next/server'
import { backendFetchValide } from '@/lib/backend'
import { GetApiMenfpSallesClassSessionIdApercu200Response } from '@/lib/api/menfp/contract.gen'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classSessionId: string }> }
) {
  const { classSessionId } = await params
  return backendFetchValide(
    request,
    `/api/menfp/salles/${encodeURIComponent(classSessionId)}/apercu`,
    'GET',
    GetApiMenfpSallesClassSessionIdApercu200Response,
  )
}
