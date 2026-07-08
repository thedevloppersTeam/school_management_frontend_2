/**
 * GET /api/enrollments/excluded-sections?classSessionId=…
 * Returns every enrollment×section exclusion in the given class session, so
 * the consultation grid can fetch them in a single request instead of one per
 * student.
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(request: NextRequest) {
  return backendFetch(request, '/api/enrollments/excluded-sections', 'GET')
}
