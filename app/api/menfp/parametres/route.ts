/**
 * GET /api/menfp/parametres → seuil d'alerte et logo du ministère (M-22, M-49).
 * Réponse validée contre le contrat épinglé (ADR-007).
 */
import { NextRequest } from 'next/server'
import { backendFetchValide } from '@/lib/backend'
import { GetApiMenfpParametres200Response } from '@/lib/api/menfp/contract.gen'

export async function GET(request: NextRequest) {
  return backendFetchValide(request, '/api/menfp/parametres', 'GET', GetApiMenfpParametres200Response)
}
