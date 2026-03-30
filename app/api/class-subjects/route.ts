import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const params = searchParams.toString()
  const query = params ? `?${params}` : ''
  return backendFetch(request, `/api/class-subjects/${query}`, 'GET')
}
