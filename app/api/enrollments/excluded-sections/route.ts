/**
 * GET /api/enrollments/excluded-sections?classSessionId=…&classSubjectId=…&stepId=…
 * Returns every enrollment×section exclusion for the selected class session,
 * subject and step. The stepId scope is required so a dispense applies only to
 * the current period/étape, not to the whole academic year.
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(request: NextRequest) {
  return backendFetch(request, '/api/enrollments/excluded-sections', 'GET')
}
