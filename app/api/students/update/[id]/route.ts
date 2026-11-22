/**
 * POST /api/students/update/[id]
 * Relais → POST /api/students/update/:id du serveur (lot serveur « profil élève », D-95).
 *
 * Modifie le profil d'un élève. `id` : UUID de la fiche élève (`students.id`).
 * Body (sémantique PATCH, liste fermée de 12 champs, strict, vérifié par le serveur) :
 * { lastname?, firstname?, birthDate?, gender?, nisu?, email?, address?, motherName?,
 *   fatherName?, phone1?, phone2?, parentsEmail? } ; `null` efface un champ facultatif.
 * 200 { message, student }, validé contre le contrat épinglé ;
 * 400, 404, 409, 500 : codes ELEVE_PROFIL_* (lib/errors.ts).
 * Permission : inscriptions.eleve.gerer (ADMIN, SYSTEM_ADMIN).
 */
import { NextRequest } from 'next/server'
import { backendFetchValide } from '@/lib/backend'
import { PostApiStudentsUpdateId200Response } from '@/lib/api/menfp/contract.gen'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetchValide(
    request,
    `/api/students/update/${encodeURIComponent(id)}`,
    'POST',
    PostApiStudentsUpdateId200Response,
  )
}
