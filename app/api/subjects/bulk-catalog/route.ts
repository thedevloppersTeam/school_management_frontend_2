/**
 * POST /api/subjects/bulk-catalog
 * Proxy → POST {BACKEND}/api/subjects/bulk-catalog
 *
 * Import en masse du référentiel Matières & Rubriques (CSV). Idempotent :
 * les rubriques/matières/sous-matières existantes sont mises à jour
 * uniquement si leurs données diffèrent, sinon ignorées.
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(request: NextRequest) {
  return backendFetch(request, '/api/subjects/bulk-catalog', 'POST')
}
