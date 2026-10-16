/**
 * POST /api/class-types/update/[id]
 * Proxy → POST /api/class-types/update/:id
 *
 * Modifie un niveau scolaire.
 * Body : { name?, isTerminal?, hasTrack? }
 *   isTerminal = classe d'EXAMEN ; hasTrack = niveau à FILIÈRE (RP-11c).
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/class-types/update/${id}`, 'POST')
}
