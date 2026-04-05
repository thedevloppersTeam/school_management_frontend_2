/**
 * GET /api/subjects/[subjectId]
 * Proxy → GET https://apicpmsl.stelloud.cloud/api/subjects/:id
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(request: NextRequest, { params }: { params: { subjectId: string } }) {
  return backendFetch(request, `/api/subjects/${params.subjectId}`, 'GET')
}