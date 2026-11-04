/**
 * GET /api/menfp/rapports/[id]/export → fichier Excel d'une version gelée (M-29).
 * Relais binaire : Content-Type, Content-Disposition (nom du fichier) et
 * Cache-Control du serveur conservés. Un refus (404, 409 empreinte invalide)
 * est relayé en JSON avec son statut.
 */
import { NextRequest } from 'next/server'
import { backendFetchBinary } from '@/lib/backend'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetchBinary(request, `/api/menfp/rapports/${encodeURIComponent(id)}/export`)
}
