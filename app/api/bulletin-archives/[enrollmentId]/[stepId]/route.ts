// GET /api/bulletin-archives/:enrollmentId/:stepId — toutes les versions

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(
  request: NextRequest,
  { params }: { params: { enrollmentId: string; stepId: string } }
) {
  return backendFetch(
    request,
    `/api/bulletin-archives/${params.enrollmentId}/${params.stepId}`,
    'GET'
  )
}