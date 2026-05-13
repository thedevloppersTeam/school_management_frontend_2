import { NextRequest, NextResponse } from 'next/server'
import { env } from './env'

/**
 * Timeout max pour les requêtes backend.
 * Au-delà, on renvoie 504 pour éviter de bloquer les workers Next.js (FF3).
 */
const BACKEND_TIMEOUT_MS = 15_000

export async function backendFetch(
  request: NextRequest,
  path: string,
  method: string
): Promise<NextResponse> {
  const targetUrl = new URL(path, env.BACKEND_URL)

  // Forward query parameters from the incoming request
  request.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value)
  })

  const headers: Record<string, string> = {}
  const cookie = request.headers.get('cookie')
  if (cookie) headers['cookie'] = cookie

  let body: ArrayBuffer | undefined
  if (method !== 'GET' && method !== 'HEAD') {
    // Read the raw bytes once. ArrayBuffer is binary-safe so multipart uploads
    // (e.g. promotion photos) survive the proxy hop without corruption.
    body = await request.arrayBuffer()
    const incomingContentType = request.headers.get('content-type')
    headers['content-type'] = incomingContentType ?? 'application/json'
    if (env.NODE_ENV === 'development') {
      const isJsonLike =
        incomingContentType?.includes('application/json') ||
        incomingContentType?.includes('text/')
      if (isJsonLike && body.byteLength > 0 && body.byteLength < 2000) {
        const preview = new TextDecoder().decode(body)
        console.log(`[backendFetch] ${method} ${path} body=${preview}`)
      } else if (body.byteLength === 0) {
        console.log(`[backendFetch] ${method} ${path} body=<empty>`)
      } else {
        console.log(`[backendFetch] ${method} ${path} body=${body.byteLength} bytes (${incomingContentType || 'no content-type'})`)
      }
    }
  }

  // FF3 — Timeout pour éviter DoS par requêtes lentes
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS)

  try {
    const backendRes = await fetch(targetUrl.toString(), {
      method,
      headers,
      body,
      // FF2 — Ne pas suivre les redirections (anti-SSRF via 302 malveillant)
      redirect: 'manual',
      signal: controller.signal,
    })

    const data = await backendRes.json().catch(() => null)
    if (env.NODE_ENV === 'development' && !backendRes.ok) {
      console.log(`[backendFetch] ${method} ${path} → ${backendRes.status}`, data)
    }
    return NextResponse.json(data, { status: backendRes.status })
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`[backendFetch] Timeout ${method} ${path}`)
      return NextResponse.json(
        { message: 'Backend timeout' },
        { status: 504 }
      )
    }
    console.error(`[backendFetch] Error ${method} ${path}:`, error.message)
    return NextResponse.json(
      { message: 'Backend unreachable' },
      { status: 503 }
    )
  } finally {
    clearTimeout(timeoutId)
  }
}