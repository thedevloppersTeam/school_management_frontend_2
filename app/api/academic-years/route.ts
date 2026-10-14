import { NextRequest } from 'next/server'
import { backendFetch } from '@/lib/backend'

export async function GET(request: NextRequest) {
  return backendFetch(request, '/api/academic-years/', 'GET')
}

// Création d'une année : UN appel, une transaction côté serveur. Remplace la
// cascade qui créait l'année, ses étapes, ses salles et ses matières en une
// vingtaine à deux cents requêtes indépendantes, dont chaque échec était avalé.
export async function POST(request: NextRequest) {
  return backendFetch(request, '/api/academic-years', 'POST')
}
