/**
 * GET /api/class-subjects
 * Relais → GET /api/class-subjects/ du serveur (filtres classSessionId, teacherId, academicYearId
 * transmis dans la chaîne de requête).
 *
 * Minimisation (décision Q-2 d'Edy, BACKLOG ID-T-F-3d) : de l'enseignant d'une affectation, le
 * relais ne transmet que `teacherId` ; la clé `teacher` de chaque élément est retirée avant la
 * réponse au navigateur, et tout le reste est gardé. Le nom d'un enseignant se lit dans la liste
 * des fiches (POST /api/teachers).
 * Les refus du serveur sont relayés tels quels.
 */
import { NextRequest, NextResponse } from 'next/server'
import { backendFetch } from '@/lib/backend'
import { retirerEnseignantDetaille } from '@/lib/affectations/enseignant'

export async function GET(request: NextRequest) {
  const response = await backendFetch(request, '/api/class-subjects/', 'GET')
  // Refus, ou réponse sans corps : relayés tels quels.
  if (!response.ok || response.status === 204) return response
  const data: unknown = await response.json()
  return NextResponse.json(retirerEnseignantDetaille(data), { status: response.status })
}
