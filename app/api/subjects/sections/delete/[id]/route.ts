/**
 * POST /api/subjects/sections/delete/[id]
 * Proxy → POST {BACKEND}/api/subjects/sections/delete/:id
 *
 * Supprime une sous-matière. Refusé (409) si des notes y sont rattachées.
 * Si c'était la dernière section, la matière repasse à hasSections = false.
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/subjects/sections/delete/${id}`, 'POST')
}
