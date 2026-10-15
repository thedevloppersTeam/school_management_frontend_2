/**
 * POST /api/classes/create
 * Proxy → POST https://apicpmsl.stelloud.cloud/api/classes/create
 *
 * Crée une nouvelle classe (salle).
 * Body : { classTypeId, letter, maxStudents, description? }
 *
 * Pas de `trackId` : une salle ne porte pas de filière. `Class` n'a aucune
 * colonne `track` et le contrôleur `createClass` ne persiste que les champs
 * ci-dessus. La filière est individuelle — elle vit sur l'inscription de
 * l'élève (`Enrollment.trackId`), y compris pour les classes terminales.
 *
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function POST(request: NextRequest) {
  return backendFetch(request, '/api/classes/create', 'POST')
}
