import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'

export async function GET(request: NextRequest) {
  const cookie = request.headers.get('cookie') ?? ''

  const backendRes = await fetch(`${env.BACKEND_URL}/api/users/me`, {
    headers: { cookie },
  })

  const data = await backendRes.json()
  return NextResponse.json(data, { status: backendRes.status })
}