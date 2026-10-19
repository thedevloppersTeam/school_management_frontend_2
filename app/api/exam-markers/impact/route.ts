// GET /api/exam-markers/impact?stepId= | classSubjectId= | sectionId=
// Notes touchées par un changement de marqueur d'examen, lu AVANT le geste
// pour la confirmation (SPEC-RESULTATS RS-06, lot M1). ADMIN.

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(request: NextRequest) {
  return backendFetch(request, '/api/exam-markers/impact', 'GET')
}
