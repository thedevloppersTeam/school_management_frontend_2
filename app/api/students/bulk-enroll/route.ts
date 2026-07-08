/**
 * POST /api/students/bulk-enroll
 * Proxy → POST {BACKEND}/api/students/bulk-enroll
 *
 * Inscription en masse depuis un import CSV. Le corps contient { rows: [...] }
 * déjà mappées côté client. Le backend traite chaque ligne indépendamment et
 * renvoie un rapport par ligne.
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(request: NextRequest) {
  return backendFetch(request, '/api/students/bulk-enroll', 'POST')
}
