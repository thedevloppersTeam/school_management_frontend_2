// GET /api/promotions/configuration-preview?sourceAcademicYearId=...&targetAcademicYearId=...
// Aperçu avant copie : quelles salles seraient créées, lesquelles existent déjà.
// Rôles autorisés : SYSTEM_ADMIN, ADMIN

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(request: NextRequest) {
  return backendFetch(request, '/api/promotions/configuration-preview', 'GET')
}
