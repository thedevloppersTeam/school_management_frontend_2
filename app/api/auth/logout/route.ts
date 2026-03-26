import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const cookie = request.headers.get('cookie') ?? ''

  const backendRes = await fetch(`${process.env.BACKEND_URL}/api/users/logout`, {
    method: 'POST',
    headers: { cookie },
  })

  const data = await backendRes.json()
  const response = NextResponse.json(data, { status: backendRes.status })

  // Forward the cleared session cookie from the backend
  const setCookie = backendRes.headers.get('set-cookie')
  if (setCookie) {
    response.headers.set('set-cookie', setCookie)
  }

  return response
}
