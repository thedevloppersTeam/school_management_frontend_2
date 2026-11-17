/**
 * GET /api/teachers/candidats
 * Relais → GET /api/teachers/candidats du serveur (lot ID-T-C).
 *
 * Comptes sans fiche enseignant, admissibles à en recevoir une (D-T4), actifs
 * ou désactivés : [{ id, firstname, lastname, username, isActive }], triés par
 * nom puis prénom. Paramètre facultatif `q` (recherche texte), transmis tel
 * quel par backendFetch.
 * Rôles autorisés : SYSTEM_ADMIN, ADMIN
 */
import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(request: NextRequest) {
  return backendFetch(request, '/api/teachers/candidats', 'GET')
}
