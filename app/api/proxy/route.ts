/**
 * app/api/proxy/route.ts
 * Route proxy générique — forward toutes les requêtes vers le backend CPMSL.
 * Usage : GET /api/proxy?path=/api/academic-years/
 *         POST /api/proxy?path=/api/students/  (body dans la requête)
 *
 * Avantages :
 * - Un seul fichier pour tous les appels backend
 * - Le cookie de session est automatiquement forwardé
 * - CORS géré côté serveur (pas de problème browser)
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'https://apicpmsl.stelloud.cloud'

async function proxyRequest(request: NextRequest, method: string) {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path')

  if (!path) {
    return NextResponse.json({ message: 'Paramètre "path" manquant' }, { status: 400 })
  }

  const cookie = request.headers.get('cookie') ?? ''
  const targetUrl = `${BACKEND_URL}${path}`

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      cookie,
    },
  }

  // Inclure le body pour POST/PATCH/PUT
  if (method !== 'GET' && method !== 'HEAD') {
    try {
      const body = await request.json()
      fetchOptions.body = JSON.stringify(body)
    } catch {
      // Body vide — pas d'erreur
    }
  }

  try {
    const backendRes = await fetch(targetUrl, fetchOptions)
    const data = await backendRes.json()
    const response = NextResponse.json(data, { status: backendRes.status })

    // Forwarder le cookie si le backend en pose un
    const setCookie = backendRes.headers.get('set-cookie')
    if (setCookie) response.headers.set('set-cookie', setCookie)

    return response
  } catch (error) {
    console.error(`[proxy] Erreur fetch ${targetUrl}:`, error)
    return NextResponse.json(
      { message: 'Impossible de joindre le serveur backend' },
      { status: 503 }
    )
  }
}

export async function GET(request: NextRequest) {
  console.log('[proxy] GET request received')
  return proxyRequest(request, 'GET')
}

export async function POST(request: NextRequest) {
  console.log('[proxy] POST request received')
  return proxyRequest(request, 'POST')
}

/* export async function PUT(request: NextRequest) {
  console.log('[proxy] PUT request received')
  return proxyRequest(request, 'PUT')
}

export async function DELETE(request: NextRequest) {
  console.log('[proxy] DELETE request received')
  return proxyRequest(request, 'DELETE')
} */