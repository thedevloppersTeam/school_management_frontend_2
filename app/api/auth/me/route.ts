import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL

const DEV_USER = {
  id: 'dev-001', firstname: 'Admin', lastname: 'CPMSL',
  username: 'admin', type: 'ADMIN', isActive: true,
}

export async function GET(request: NextRequest) {
  const cookie = request.headers.get('cookie') ?? ''

  // ── Mode production : proxy vers https://apicpmsl.stelloud.cloud ──────────
  if (BACKEND_URL) {
    try {
      const backendRes = await fetch(`${BACKEND_URL}/api/users/me`, {
        headers: { cookie },
      })

      const data = await backendRes.json()
      return NextResponse.json(data, { status: backendRes.status })
    } catch {
      return NextResponse.json({ message: 'Serveur inaccessible' }, { status: 503 })
    }
  }

  // ── Mode dev : vérifier le cookie local ──────────────────────────────────
  const sessionCookie = request.cookies.get('connect.sid')
  if (!sessionCookie || sessionCookie.value !== 'dev-session-token') {
    return NextResponse.json({ message: 'Non authentifié' }, { status: 401 })
  }
  return NextResponse.json(DEV_USER, { status: 200 })
}