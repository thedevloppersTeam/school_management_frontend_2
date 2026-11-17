/**
 * POST /api/teachers/create
 * Relais → POST /api/teachers/create du serveur (lot ID-T).
 *
 * Crée la fiche enseignant d'un compte existant, et la lie à ce compte.
 * Body : { userId, address?, phone?, email?, hireDate?, role?, description? }
 * (address et phone facultatifs depuis le lot ID-T-C).
 * 201 { message, teacher } ; 409 IDENTITE_ENSEIGNANT_* : compte non admissible
 * ou fiche existante.
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(request: NextRequest) {
  return backendFetch(request, '/api/teachers/create', 'POST')
}
