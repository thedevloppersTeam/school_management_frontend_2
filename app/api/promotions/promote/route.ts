// POST /api/promotions/promote
// Promotion en bloc : crée les inscriptions des élèves dans les salles de la
// nouvelle année. Les inscriptions de l'ancienne année restent intactes.
// Rôles autorisés : SYSTEM_ADMIN, ADMIN

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(request: NextRequest) {
  return backendFetch(request, '/api/promotions/promote', 'POST')
}
