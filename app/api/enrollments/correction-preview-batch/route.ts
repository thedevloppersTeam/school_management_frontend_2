// POST /api/enrollments/correction-preview-batch
// Impact d'une correction d'affectation sur une sélection d'élèves, avant
// toute écriture. POST bien qu'il ne lise que : cinquante identifiants ne
// tiennent pas proprement dans une chaîne de requête. N'écrit rien.
// Rôles autorisés : SYSTEM_ADMIN, ADMIN

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(request: NextRequest) {
  return backendFetch(request, '/api/enrollments/correction-preview-batch', 'POST')
}
