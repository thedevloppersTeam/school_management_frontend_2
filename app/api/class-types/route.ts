/**
 * GET /api/class-types
 * Proxy → GET https://apicpmsl.stelloud.cloud/api/class-types
 *
 * Retourne la liste de tous les niveaux scolaires.
 * Niveaux CPMSL : 1ère AF → 9ème AF (Fondamental) + NS1 → NS4 (Secondaire).
 * isTerminal = classe d'EXAMEN (9ème AF, NS4) ; hasTrack = niveau à FILIÈRE,
 * filière obligatoire à l'inscription (NS3, NS4). Deux drapeaux distincts (RP-11c).
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */

import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(request: NextRequest) {
  return backendFetch(request, '/api/class-types', 'GET')
}
