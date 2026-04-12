import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Toujours laisser passer : Next.js internals + API auth
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  const session = request.cookies.get('connect.sid')

  // Page login : accessible sans session
  // Si déjà connecté → rediriger directement vers le dashboard
  if (pathname === '/login') {
    if (session) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // Page racine / → rediriger vers login (ou dashboard si connecté)
  if (pathname === '/') {
    if (session) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Toutes les routes /admin/* → session obligatoire
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}