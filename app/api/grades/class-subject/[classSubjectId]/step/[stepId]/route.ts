import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classSubjectId: string; stepId: string }> }
) {
  const { classSubjectId, stepId } = await params
  return backendFetch(request, `/api/grades/class-subject/${classSubjectId}/step/${stepId}`, 'GET')
}
