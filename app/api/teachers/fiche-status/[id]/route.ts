/**
 * POST /api/teachers/fiche-status/[id]
 * Relais → POST /api/teachers/fiche-status/:id du serveur (lot ID-T, D-T3).
 *
 * Active ou désactive la FICHE enseignant (`teachers.is_active`), jamais le
 * compte. `id` : UUID de la fiche.
 * Body : { isActive: boolean }
 * 200 { message, fiche: { id, userId, isActive } } ; 403 IDENTITE_ROLE_DE_SOI
 * (sa propre fiche) ; 409 IDENTITE_ENSEIGNANT_* à l'activation.
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetch(request, `/api/teachers/fiche-status/${encodeURIComponent(id)}`, 'POST')
}
