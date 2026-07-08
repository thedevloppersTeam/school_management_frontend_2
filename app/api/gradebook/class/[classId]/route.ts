import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  const { classId } = await params
  return backendFetch(request, `/api/gradebook/class/${classId}`, 'GET')
}
