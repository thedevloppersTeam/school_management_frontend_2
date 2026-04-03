/**
 * POST /api/teachers
 * Proxy → POST https://apicpmsl.stelloud.cloud/api/teachers/
 *
 * Retourne la liste de tous les professeurs.
 * Note : le backend utilise POST pour les listes (pas GET).
 * Body : {} (objet vide)
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(request: NextRequest) {
  return backendFetch(request, '/api/teachers/', 'POST')
}