// GET /api/enrollments/departures/incomplete[?academicYearId=] — départs à
// compléter (SPEC-RESULTATS RS-12, D-21) : inscriptions DROPPED sans dernière
// étape suivie. Elles n'entrent dans aucune moyenne de classe. ADMIN.

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(request: NextRequest) {
  return backendFetch(request, '/api/enrollments/departures/incomplete', 'GET')
}
