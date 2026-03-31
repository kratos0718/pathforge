import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// No Supabase client in middleware — avoids 504 gateway timeout on Vercel Edge.
// Auth cookies are checked directly (no network round-trip).
// Full token validation happens inside each page/API route via Supabase client.

function hasSupabaseSession(req: NextRequest): boolean {
  const cookies = req.cookies.getAll()
  // Supabase SSR stores session as:
  //   sb-<ref>-auth-token          (small tokens — email/password)
  //   sb-<ref>-auth-token.0/.1/... (chunked — Google OAuth tokens are large)
  // Check for either form with includes() so both are detected.
  return cookies.some(
    (c) => c.name.startsWith('sb-') && c.name.includes('-auth-token')
  )
}

export function middleware(req: NextRequest) {
  const isAuthed = hasSupabaseSession(req)
  const { pathname } = req.nextUrl

  const protectedPaths = [
    '/dashboard', '/onboarding', '/roadmap', '/dsa', '/cgpa',
    '/courses', '/friends', '/challenges', '/compass', '/score',
    '/upgrade', '/admin',
  ]
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p))

  if (!isAuthed && isProtected) {
    return NextResponse.redirect(new URL('/auth', req.url))
  }

  if (isAuthed && pathname === '/auth') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
