import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL

const DEV_USER = {
  id: 'dev-001', firstname: 'Admin', lastname: 'CPMSL',
  username: 'admin', type: 'ADMIN', isActive: true,
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  if (BACKEND_URL) {
    try {
      const backendRes = await fetch(`${BACKEND_URL}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await backendRes.json()
      const response = NextResponse.json(data, { status: backendRes.status })

      const setCookie = backendRes.headers.get('set-cookie')
      if (setCookie) response.headers.set('set-cookie', setCookie)

      return response
    } catch {
      return NextResponse.json(
        { message: 'Impossible de joindre le serveur. Réessayez.' },
        { status: 503 }
      )
    }
  }

  const { username, password } = body
  if (username !== 'admin' || password !== 'admin123') {
    return NextResponse.json({ message: 'Identifiants incorrects' }, { status: 401 })
  }

  const response = NextResponse.json({ session: DEV_USER }, { status: 200 })
  response.cookies.set('connect.sid', 'dev-session-token', {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8,
  })
  return response
}