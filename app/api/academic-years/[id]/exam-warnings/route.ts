// GET /api/academic-years/:id/exam-warnings — avertissements RS-07 de l'année
// (classes d'examen sans étape d'examen blanc, ou sans composant d'examen).
// Lecture seule. ADMIN.

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/academic-years/${id}/exam-warnings`, 'GET')
}
