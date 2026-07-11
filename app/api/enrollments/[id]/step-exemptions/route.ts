// GET  /api/enrollments/:id/step-exemptions — étapes dont l'élève est dispensé
// POST /api/enrollments/:id/step-exemptions — remplace l'ensemble { stepIds[], reason? }
// Une étape dispensée n'entre pas dans la moyenne générale de l'élève.

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/enrollments/${id}/step-exemptions`, 'GET')
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/enrollments/${id}/step-exemptions`, 'POST')
}
