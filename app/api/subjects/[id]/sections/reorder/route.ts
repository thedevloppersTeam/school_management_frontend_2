/**
 * POST /api/subjects/[id]/sections/reorder
 * Proxy → POST <backend>/api/subjects/:subjectId/sections/reorder
 *
 * Ordre et présence sur le relevé des sous-matières d'une matière.
 * Body : { items: [{ id, displayOrder, showOnReleve }] }
 * Liste COMPLÈTE des sous-matières exigée, displayOrder distincts ≥ 1.
 * Note : le param Next.js s'appelle "id" (convention projet), mais sémantiquement
 *        il représente un subjectId côté backend.
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/subjects/${id}/sections/reorder`, 'POST')
}
