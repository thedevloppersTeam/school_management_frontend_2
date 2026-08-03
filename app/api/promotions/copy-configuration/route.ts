// POST /api/promotions/copy-configuration
// Reprend la configuration d'une année précédente : recrée les salles dans
// l'année cible et y recopie les matières (professeur, coefficient, note max,
// filière). Idempotent.
// Rôles autorisés : SYSTEM_ADMIN, ADMIN

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(request: NextRequest) {
  return backendFetch(request, '/api/promotions/copy-configuration', 'POST')
}
