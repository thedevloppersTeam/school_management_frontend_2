/**
 * POST /api/class-types/create
 * Proxy → POST https://apicpmsl.stelloud.cloud/api/class-types/create
 *
 * Crée un nouveau niveau scolaire (1ère AF, NS1, NS3, etc.).
 * Body : { name, isTerminal }
 * Note : le champ "code" envoyé par le frontend n'est PAS dans la doc Postman
 *        officielle — le backend l'ignore silencieusement.
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(request: NextRequest) {
  return backendFetch(request, '/api/class-types/create', 'POST')
}