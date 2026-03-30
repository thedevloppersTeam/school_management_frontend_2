import { NextRequest, NextResponse } from 'next/server'

export async function backendFetch(
  request: NextRequest,
  path: string,
  method: string
): Promise<NextResponse> {
  const base = process.env.BACKEND_URL ?? ''
  const targetUrl = new URL(path, base)

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
      if (process.env.NODE_ENV === 'development') {
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
