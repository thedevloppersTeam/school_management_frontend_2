import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const cookie = request.headers.get('cookie') ?? ''

  try {
    await fetch(`${process.env.BACKEND_URL}/api/users/logout`, {
      method: 'POST',
      headers: { cookie },
    })
  } catch {
    // Proceed with local cookie clear even if backend call fails
  }

  const response = NextResponse.redirect(new URL('/login', request.url))
  response.cookies.set('connect.sid', '', { maxAge: 0, path: '/' })
  return response
}

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
