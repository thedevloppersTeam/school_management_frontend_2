// GET /api/student-audit-logs?studentId=&academicYearId=&action=&from=&to=&page=&pageSize=
// Journal d'audit élève. Ajout seul côté backend : aucune écriture ici.
// Rôles autorisés : SYSTEM_ADMIN, ADMIN

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(request: NextRequest) {
  return backendFetch(request, '/api/student-audit-logs', 'GET')
}
