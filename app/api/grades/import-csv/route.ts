/**
 * POST /api/grades/import-csv
 * Proxy → POST <backend>/api/grades/import-csv
 *
 * Body : { classSessionId, stepId, csvText, gradeType? }
 * Réponse : { totals, studentsNotFound, subjectsNotFound, sectionsNotFound, rowErrors }
 *
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN.
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(request: NextRequest) {
  return backendFetch(request, '/api/grades/import-csv', 'POST')
}
