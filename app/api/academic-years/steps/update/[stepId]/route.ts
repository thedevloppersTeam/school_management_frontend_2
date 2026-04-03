import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stepId: string }> }
) {
  const { stepId } = await params
  return backendFetch(request, `/api/academic-years/steps/update/${stepId}`, 'POST')
}
