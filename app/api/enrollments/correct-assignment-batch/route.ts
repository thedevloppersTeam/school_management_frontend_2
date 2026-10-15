// POST /api/enrollments/correct-assignment-batch
// Corrige l'affectation de plusieurs élèves d'un coup. Tout ou rien : un seul
// élève bloqué, aucune écriture. Motif obligatoire, commun au lot ; une entrée
// de journal par élève.
// Rôles autorisés : SYSTEM_ADMIN, ADMIN

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(request: NextRequest) {
  return backendFetch(request, '/api/enrollments/correct-assignment-batch', 'POST')
}
