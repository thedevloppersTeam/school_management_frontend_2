import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return backendFetch(request, `/api/students/${params.id}`, 'GET')
}