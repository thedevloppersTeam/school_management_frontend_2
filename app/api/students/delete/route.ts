/**
 * POST /api/students/delete
 * Proxy → POST {BACKEND}/api/students/delete
 *
 * Suppression définitive d'élèves (user + student + enrollments). Le corps
 * contient { studentIds: string[], password: string } — le mot de passe de
 * l'admin connecté, vérifié côté backend avant toute suppression.
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(request: NextRequest) {
  return backendFetch(request, '/api/students/delete', 'POST')
}
