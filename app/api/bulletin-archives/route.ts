// ── FICHIER 1 : app/api/bulletin-archives/route.ts ───────────────────────────
// GET /api/bulletin-archives?academicYearId=&classSessionId=&stepId=&enrollmentId=&nisu=&activeOnly=

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(request: NextRequest) {
  return backendFetch(request, '/api/bulletin-archives', 'GET')
}

async function isStaleRouteResponse(response: Response): Promise<boolean> {
  if (response.status !== 502) return false

  try {
    const data = await response.clone().json()
    const message = typeof data?.message === 'string' ? data.message : ''
    return message.includes('requested route is not mounted')
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const fallbackRequest = request.clone()
  const createResponse = await backendFetch(request, '/api/bulletin-archives/create', 'POST')

  if (await isStaleRouteResponse(createResponse)) {
    return backendFetch(fallbackRequest, '/api/bulletin-archives', 'POST')
  }

  return createResponse
}
