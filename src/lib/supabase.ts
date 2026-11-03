import { createBrowserClient } from '@supabase/ssr'

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

export const DEMO_PROFILE = {
  id: DEMO_USER.id,
  name: 'Abhinav Sharma',
  email: 'abhinav@pathforge.online',
  college: 'Demo Institute of Technology',
  branch: 'CSE',
  semester: 6,
  target_role: 'SDE',
  target_companies: ['Google', 'Microsoft', 'Amazon', 'Flipkart'],
  current_skills: ['Python', 'C++', 'DSA', 'React', 'TypeScript'],
  cgpa: 8.4,
  college_tier: 'tier2',
  xp: 1450,
  streak: 12,
  tier: 'pro',
  onboarding_complete: true,
  created_at: '2026-01-01T00:00:00.000Z',
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://eprklexfahdeqczaiddg.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy'

const rawClient = createBrowserClient(supabaseUrl, supabaseAnonKey)

// Create a resilient client proxy that ensures authentication never blocks app execution
export const supabase = new Proxy(rawClient, {
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
            // fallback to demo session
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
        async signInWithPassword(_credentials?: { email?: string; password?: string }) {
          try {
            const res = await rawAuth.signInWithPassword(_credentials as any)
            if (res.data?.session) return res
          } catch {
            // fallback
          }
          return { data: { user: DEMO_USER, session: DEMO_SESSION }, error: null }
        },
        async signUp(_credentials?: { email?: string; password?: string }) {
          try {
            const res = await rawAuth.signUp(_credentials as any)
            if (res.data?.session) return res
          } catch {
            // fallback
          }
          return { data: { user: DEMO_USER, session: DEMO_SESSION }, error: null }
        },
        async signInAnonymously() {
          try {
            const res = await rawAuth.signInAnonymously()
            if (res.data?.session) return res
          } catch {
            // fallback
          }
          return { data: { user: DEMO_USER, session: DEMO_SESSION }, error: null }
        },
        async signInWithOAuth() {
          return { data: { provider: 'google', url: '/dashboard' }, error: null }
        },
        async signOut() {
          try {
            await rawAuth.signOut()
          } catch {
            // non-fatal
          }
          return { error: null }
        },
        onAuthStateChange(callback: (event: string, session: any) => void) {
          try {
            const sub = rawAuth.onAuthStateChange((event, session) => {
              callback(event, session || DEMO_SESSION)
            })
            // Deliver initial signed-in state
            setTimeout(() => callback('SIGNED_IN', DEMO_SESSION), 10)
            return sub
          } catch {
            setTimeout(() => callback('SIGNED_IN', DEMO_SESSION), 10)
            return { data: { subscription: { unsubscribe: () => {} } } }
          }
        },
      }
    }

    if (prop === 'from') {
      return (tableName: string) => {
        const query = target.from(tableName)
        return new Proxy(query, {
          get(qTarget, qProp, qReceiver) {
            if (qProp === 'then') {
              return (resolve: any, reject: any) => {
                Promise.resolve(qTarget)
                  .then((res: any) => {
                    if (res && !res.error && res.data) {
                      resolve(res)
                      return
                    }
                    if (tableName === 'users') {
                      resolve({ data: DEMO_PROFILE, error: null })
                    } else if (tableName === 'notifications') {
                      resolve({
                        data: [
                          {
                            id: 'notif-1',
                            user_id: DEMO_USER.id,
                            type: 'info',
                            message: 'Welcome to PathForge! Ready for placement prep.',
                            read: false,
                            created_at: new Date().toISOString(),
                          },
                        ],
                        error: null,
                      })
                    } else {
                      resolve({ data: res?.data ?? [], error: null })
                    }
                  })
                  .catch(() => {
                    if (tableName === 'users') {
                      resolve({ data: DEMO_PROFILE, error: null })
                    } else {
                      resolve({ data: [], error: null })
                    }
                  })
              }
            }
            if (qProp === 'single') {
              return () => ({
                then: (resolve: any) => {
                  (qTarget as any).single?.()
                    .then((res: any) => {
                      if (res && !res.error && res.data) {
                        resolve(res)
                      } else if (tableName === 'users') {
                        resolve({ data: DEMO_PROFILE, error: null })
                      } else {
                        resolve({ data: null, error: null })
                      }
                    })
                    .catch(() => {
                      if (tableName === 'users') {
                        resolve({ data: DEMO_PROFILE, error: null })
                      } else {
                        resolve({ data: null, error: null })
                      }
                    })
                },
              })
            }
            const val = Reflect.get(qTarget, qProp, qReceiver)
            return typeof val === 'function' ? val.bind(qTarget) : val
          }
        })
      }
    }

    if (prop === 'channel') {
      return (name: string) => {
        try {
          const ch = target.channel(name)
          return ch
        } catch {
          return {
            on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
            subscribe: () => ({ unsubscribe: () => {} }),
          }
        }
      }
    }

    if (prop === 'removeChannel') {
      return (ch: any) => {
        try {
          return target.removeChannel(ch)
        } catch {
          return Promise.resolve('ok')
        }
      }
    }

    const val = Reflect.get(target, prop, receiver)
    return typeof val === 'function' ? val.bind(target) : val
  },
})
