/**
 * POST /api/students/update/[id]
 * Proxy → POST https://apicpmsl.stelloud.cloud/api/students/update/:id
 *
 * Modifie le profil d'un élève.
 * Body : { address?, motherName?, fatherName?, phone1?, phone2?, parentsEmail? }
 * Note : nisu est immuable — ignoré silencieusement par le backend.
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return backendFetch(request, `/api/students/update/${params.id}`, 'POST')
}