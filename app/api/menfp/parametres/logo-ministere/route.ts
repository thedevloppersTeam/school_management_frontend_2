/**
 * /api/menfp/parametres/logo-ministere (M-49)
 *   GET  → octets de l'image en vigueur (relais binaire, en-têtes du serveur).
 *   POST → téléversement multipart, champ `logo`, PNG ou JPEG, 2 Mo au plus ;
 *          le corps est relayé tel quel avec son content-type.
 */
import { NextRequest } from 'next/server'
import { backendFetchBinary, backendFetchValide } from '@/lib/backend'
import { PostApiMenfpParametresLogoMinistere200Response } from '@/lib/api/menfp/contract.gen'

export async function GET(request: NextRequest) {
  return backendFetchBinary(request, '/api/menfp/parametres/logo-ministere')
}

export async function POST(request: NextRequest) {
  return backendFetchValide(
    request,
    '/api/menfp/parametres/logo-ministere',
    'POST',
    PostApiMenfpParametresLogoMinistere200Response,
  )
}
