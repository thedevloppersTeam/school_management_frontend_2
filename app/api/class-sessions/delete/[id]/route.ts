/**
 * POST /api/class-sessions/delete/[id]
 * Proxy -> POST {BACKEND}/api/class-sessions/delete/:id
 *
 * Supprime une salle/filiere de l'annee scolaire, c'est-a-dire la session de
 * classe, sans supprimer le niveau/classe de reference.
 * Roles autorises : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/class-sessions/delete/${id}`, 'POST')
}
