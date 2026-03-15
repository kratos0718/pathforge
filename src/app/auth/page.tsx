'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { HeroScene } from '@/components/ui/hero-scene'

function AuthInner() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const searchParams = useSearchParams()

  useEffect(() => {
    const err = searchParams.get('error')
    if (err) setError(decodeURIComponent(err))
  }, [searchParams])

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage('Check your email for the confirmation link!')
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else if (data.session) {
        const { data: user } = await supabase
          .from('users')
          .select('onboarding_complete')
          .eq('id', data.session.user.id)
          .single()
        window.location.href = user?.onboarding_complete ? '/dashboard' : '/onboarding'
      }
    }
    setLoading(false)
  }

  async function handleGuestAuth() {
    setLoading(true)
    setError('')

    // 1. Try anonymous sign-in (works if enabled in Supabase dashboard)
    try {
      const { data, error } = await supabase.auth.signInAnonymously()
      if (!error && data.session) {
        window.location.href = '/onboarding'
        return
      }
    } catch { /* anonymous auth disabled — fall through */ }

    // 2. Fallback: sign in as the seeded demo account
    const { data, error: demoErr } = await supabase.auth.signInWithPassword({
      email: 'rahul.sharma@dummy.pathforge.dev',
      password: 'PathForge@123',
    })
    if (demoErr) {
      setError('Guest access unavailable. Please create a free account — it only takes 30 seconds!')
    } else if (data.session) {
      window.location.href = '/dashboard'
    }
    setLoading(false)
  }

  async function handleGoogleAuth() {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) setError(`Google sign-in failed: ${error.message}`)
  }

  return (
    <div className="relative min-h-screen bg-black overflow-hidden">

      {/* ── 3D background scene ───────────────────────────── */}
      <div className="absolute inset-0">
        <HeroScene />
      </div>

      {/* ── Subtle vignette to keep edges dark ───────────── */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_50%_50%,transparent,rgba(0,0,0,0.6))]" />

      {/* ── Hero text (top section) ───────────────────────── */}
      <div className="relative z-10 flex flex-col items-center pt-16 pb-4 px-4 text-center">
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-white/50 text-xs font-body tracking-widest uppercase">AI-powered · Built for India</span>
        </div>

        <h1 className="font-heading text-5xl md:text-7xl font-bold text-white mb-5 leading-[1.05] tracking-tight">
          Forge your path
          <br />
          <span className="bg-gradient-to-br from-white via-white/80 to-white/30 bg-clip-text text-transparent">
            to placement
          </span>
        </h1>

        <p className="font-body text-white/35 text-base max-w-sm mb-2 tracking-wide">
          AI roadmaps · DSA tracking · Challenges · Readiness score
        </p>
        <p className="font-body text-white/20 text-sm mb-14 tracking-wide">
          50+ CSE students from your college batch already on PathForge
        </p>
      </div>

      {/* ── Auth card (centre) ────────────────────────────── */}
      <div className="relative z-10 flex justify-center px-4 pb-16">
        <Card className="w-full max-w-md bg-black/70 border-white/10 backdrop-blur-xl shadow-2xl shadow-black/60">
          <CardHeader className="pb-4">
            <CardTitle className="font-heading text-white text-xl tracking-tight">
              {mode === 'signin' ? 'Sign in to PathForge' : 'Create your account'}
            </CardTitle>
            <CardDescription className="font-body text-white/40">
              {mode === 'signin'
                ? 'Continue your placement journey'
                : 'Get your personalised 16-week roadmap'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Google */}
            <Button
              onClick={handleGoogleAuth}
              variant="outline"
              className="w-full bg-white/5 border-slate-600 text-white hover:bg-white/10 hover:border-slate-500 transition-all"
            >
              <svg className="w-4 h-4 mr-2 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </Button>

            {/* Guest */}
            <Button
              onClick={handleGuestAuth}
              disabled={loading}
              variant="outline"
              className="w-full bg-white/3 border-white/10 text-white/50 hover:bg-white/8 hover:border-white/20 hover:text-white/70 transition-all"
            >
              <svg className="w-4 h-4 mr-2 shrink-0 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              Continue as Guest
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900 px-2 text-slate-500">or email</span>
              </div>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-slate-300 text-sm">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@college.edu"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:border-purple-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-slate-300 text-sm">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:border-purple-500"
                />
              </div>

              {error && (
                <div className="bg-red-950/60 border border-red-700/50 rounded-lg p-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}
              {message && (
                <div className="bg-green-950/60 border border-green-700/50 rounded-lg p-3">
                  <p className="text-green-400 text-sm">{message}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-medium shadow-lg shadow-purple-900/40 transition-all"
              >
                {loading ? 'Loading...' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </Button>
            </form>

            <p className="text-center text-sm text-slate-500">
              {mode === 'signin' ? "No account?" : 'Have an account?'}{' '}
              <button
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage('') }}
                className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
              >
                {mode === 'signin' ? 'Sign up free' : 'Sign in'}
              </button>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Feature pills at bottom ───────────────────────── */}
      <div className="relative z-10 flex flex-wrap justify-center gap-3 px-4 pb-8">
        {['🧭 Role Compass AI', '🗺️ 16-week Roadmap', '💻 DSA Tracker', '👥 Friend Challenges', '📊 Readiness Score'].map(f => (
          <span key={f} className="bg-white/5 border border-white/10 text-white/40 text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
            {f}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthInner />
    </Suspense>
  )
}
