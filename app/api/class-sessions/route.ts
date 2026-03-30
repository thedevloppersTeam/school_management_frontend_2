import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const academicYearId = searchParams.get('academicYearId')
  const query = academicYearId ? `?academicYearId=${academicYearId}` : ''
  return backendFetch(request, `/api/class-sessions/${query}`, 'GET')
}
