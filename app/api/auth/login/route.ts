import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'

export async function POST(request: NextRequest) {
  const body = await request.json()

  const backendRes = await fetch(`${env.BACKEND_URL}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await backendRes.json()
  const response = NextResponse.json(data, { status: backendRes.status })

  // Forward the session cookie from the backend to the browser
  const setCookie = backendRes.headers.get('set-cookie')
  if (setCookie) {
    response.headers.set('set-cookie', setCookie)
  }

  return response
}