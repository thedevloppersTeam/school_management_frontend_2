/**
 * POST /api/class-subjects/teacher/[id]
 * Relais → POST /api/class-subjects/teacher/:id du serveur (lot ID-T-F-3, lot A, décisions A1 à A8).
 *
 * Pose, remplace ou retire l'enseignant d'une affectation. `id` : UUID de l'affectation
 * (`class_subjects.id`).
 * Body : { teacherId: uuid | null } — strict, vérifié par le serveur ; `null` retire.
 * 200 { classSubjectId, teacherId, geste }, validé contre le contrat épinglé ;
 * 400 PROGRAMME_ENTREE_INVALIDE ; 404 PROGRAMME_AFFECTATION_INTROUVABLE ou
 * PROGRAMME_ENSEIGNANT_INTROUVABLE ; 409 PROGRAMME_ANNEE_CLOSE, PROGRAMME_FICHE_INACTIVE ou
 * PROGRAMME_COMPTE_INACTIF.
 * Permission : programme.affectation.gerer (ADMIN, SYSTEM_ADMIN).
 */
import { NextRequest } from 'next/server'
import { backendFetchValide } from '@/lib/backend'
import { PostApiClassSubjectsTeacherId200Response } from '@/lib/api/menfp/contract.gen'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return backendFetchValide(
    request,
    `/api/class-subjects/teacher/${encodeURIComponent(id)}`,
    'POST',
    PostApiClassSubjectsTeacherId200Response,
  )
}
