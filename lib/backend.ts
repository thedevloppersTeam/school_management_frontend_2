/**
 * lib/backend.ts
 * Shared helper for server-side fetch calls to the backend.
 */

import { NextRequest, NextResponse } from 'next/server'

export const BACKEND_URL = process.env.BACKEND_URL ?? 'https://apicpmsl.stelloud.cloud'

export async function backendFetch(
  request: NextRequest,
  backendPath: string,
  method: string
): Promise<NextResponse> {
  const cookie = request.headers.get('cookie') ?? ''
  const targetUrl = `${BACKEND_URL}${backendPath}`

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      cookie,
    },
  }

  if (method !== 'GET' && method !== 'HEAD') {
    try {
      const body = await request.json()
      console.log(`[backendFetch] Forwarding body for ${method} ${backendPath}:`, body) 
      fetchOptions.body = JSON.stringify(body)
    } catch (error) {
      console.error(`[backendFetch] Error parsing body for ${method} ${backendPath}:`, error)
      // empty body — ok
    }
  }

  try {
    const backendRes = await fetch(targetUrl, fetchOptions)
    const data = await backendRes.json()
    const response = NextResponse.json(data, { status: backendRes.status })

    const setCookie = backendRes.headers.get('set-cookie')
    if (setCookie) response.headers.set('set-cookie', setCookie)

    return response
  } catch (error) {
    console.error(`[backend] Fetch error ${targetUrl}:`, error)
    return NextResponse.json(
      { message: 'Impossible de joindre le serveur backend' },
      { status: 503 }
    )
  }
}
