import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const cookie = request.headers.get('cookie') ?? ''

  const backendRes = await fetch(`${process.env.BACKEND_URL}/api/users/me`, {
    headers: { cookie },
  })

  const data = await backendRes.json()
  return NextResponse.json(data, { status: backendRes.status })
}
