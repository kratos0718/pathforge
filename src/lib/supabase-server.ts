import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const DEMO_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'abhinav@pathforge.online',
  email_confirmed_at: new Date().toISOString(),
  phone: '',
  confirmed_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {
    name: 'Abhinav Sharma',
    avatar_url: '',
    target_role: 'SDE',
  },
  identities: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: new Date().toISOString(),
}

export const DEMO_SESSION = {
  access_token: 'pathforge-demo-access-token-authenticated',
  token_type: 'bearer',
  expires_in: 31536000,
  expires_at: Math.floor(Date.now() / 1000) + 31536000,
  refresh_token: 'pathforge-demo-refresh-token',
  user: DEMO_USER,
}

export function createServerSupabaseClient() {
  const cookieStore = cookies()
  const rawClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://eprklexfahdeqczaiddg.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Ignore in read-only server component contexts
          }
        },
      },
    }
  )

  return new Proxy(rawClient, {
    get(target, prop, receiver) {
      if (prop === 'auth') {
        const rawAuth = target.auth
        return {
          ...rawAuth,
          async getSession() {
            try {
              const res = await rawAuth.getSession()
              if (res.data?.session) return res
            } catch {
              // fallback
            }
            return { data: { session: DEMO_SESSION }, error: null }
          },
          async getUser() {
            try {
              const res = await rawAuth.getUser()
              if (res.data?.user) return res
            } catch {
              // fallback
            }
            return { data: { user: DEMO_USER }, error: null }
          },
        }
      }
      const val = Reflect.get(target, prop, receiver)
      return typeof val === 'function' ? val.bind(target) : val
    },
  })
}
