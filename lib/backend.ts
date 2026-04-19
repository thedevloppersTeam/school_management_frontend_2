import { NextRequest, NextResponse } from 'next/server'
import { env } from './env'

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

  let body: string | undefined
  if (method !== 'GET' && method !== 'HEAD') {
    try {
      const json = await request.json()
      if (env.NODE_ENV === 'development') {
        console.log(`[backendFetch] ${method} ${path}`, json)
      }
      body = JSON.stringify(json)
      headers['content-type'] = 'application/json'
    } catch {
      // no body
    }
  }

  const backendRes = await fetch(targetUrl.toString(), { method, headers, body })
  const data = await backendRes.json().catch(() => null)
  return NextResponse.json(data, { status: backendRes.status })
}
