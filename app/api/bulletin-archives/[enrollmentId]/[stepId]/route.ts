// GET /api/bulletin-archives/:enrollmentId/:stepId — toutes les versions

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string; stepId: string }> }
) {
  const { enrollmentId, stepId } = await params
  return backendFetch(
    request,
    `/api/bulletin-archives/${enrollmentId}/${stepId}`,
    'GET'
  )
}