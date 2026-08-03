// GET /api/promotions/preview?classSessionId=...&threshold=7
// Élèves d'une salle avec leur moyenne générale annuelle et leur éligibilité.
// Rôles autorisés : SYSTEM_ADMIN, ADMIN

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(request: NextRequest) {
  return backendFetch(request, '/api/promotions/preview', 'GET')
}
