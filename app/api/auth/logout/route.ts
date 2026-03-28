import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL

export async function POST(request: NextRequest) {
  const cookie = request.headers.get('cookie') ?? ''

  // ── Mode production : proxy vers https://apicpmsl.stelloud.cloud ──────────
  if (BACKEND_URL) {
    try {
      const backendRes = await fetch(`${BACKEND_URL}/api/users/logout`, {
        method: 'POST',
        headers: { cookie },
      })

      const data = await backendRes.json()
      const response = NextResponse.json(data, { status: backendRes.status })

      // Forwarder le cookie expiré du backend pour effacer la session côté browser
      const setCookie = backendRes.headers.get('set-cookie')
      if (setCookie) response.headers.set('set-cookie', setCookie)

      return response
    } catch {
      return NextResponse.json({ message: 'Serveur inaccessible' }, { status: 503 })
    }
  }

  // ── Mode dev : effacer le cookie local ───────────────────────────────────
  const response = NextResponse.json({ message: 'Déconnecté' }, { status: 200 })
  response.cookies.set('connect.sid', '', {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0,
  })
  return response
}