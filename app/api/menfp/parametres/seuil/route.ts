/**
 * PUT /api/menfp/parametres/seuil → modifie le seuil d'alerte de l'écart (M-22).
 * Body : { seuil } (chaîne décimale, deux décimales au plus).
 */
import { NextRequest } from 'next/server'
import { backendFetchValide } from '@/lib/backend'
import { PutApiMenfpParametresSeuil200Response } from '@/lib/api/menfp/contract.gen'

export async function PUT(request: NextRequest) {
  return backendFetchValide(request, '/api/menfp/parametres/seuil', 'PUT', PutApiMenfpParametresSeuil200Response)
}
