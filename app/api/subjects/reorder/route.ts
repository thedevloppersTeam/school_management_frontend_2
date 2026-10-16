/**
 * POST /api/subjects/reorder
 * Proxy → POST <backend>/api/subjects/reorder
 *
 * Ordre, colonne imposée et présence sur le relevé des matières d'un niveau.
 * Body : { classTypeId, items: [{ id, displayOrder, releveColumn, showOnReleve }] }
 * Liste COMPLÈTE des matières du niveau exigée, displayOrder distincts ≥ 1.
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(request: NextRequest) {
  return backendFetch(request, '/api/subjects/reorder', 'POST')
}
