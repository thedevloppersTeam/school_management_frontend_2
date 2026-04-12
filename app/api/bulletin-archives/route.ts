// ── FICHIER 1 : app/api/bulletin-archives/route.ts ───────────────────────────
// GET /api/bulletin-archives?academicYearId=&classSessionId=&stepId=&enrollmentId=&nisu=&activeOnly=

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(request: NextRequest) {
  return backendFetch(request, '/api/bulletin-archives', 'GET')
}

export async function POST(request: NextRequest) {
  return backendFetch(request, '/api/bulletin-archives/create', 'POST')
}