import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')

  // OAuth error from provider
  if (error) {
    console.error('OAuth error:', error, errorDescription)
    return NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent(errorDescription || error)}`, requestUrl.origin))
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('Exchange error:', exchangeError)
      return NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent(exchangeError.message)}`, requestUrl.origin))
    }

    if (data.session) {
      try {
        const { data: user } = await supabase
          .from('users')
          .select('onboarding_complete')
          .eq('id', data.session.user.id)
          .single()

        if (user?.onboarding_complete) {
          return NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
        }
      } catch {
        // users table query failed — still send to onboarding
      }
      return NextResponse.redirect(new URL('/onboarding', requestUrl.origin))
    }
  }

  return NextResponse.redirect(new URL('/auth', requestUrl.origin))
}
